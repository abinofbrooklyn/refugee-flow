import db from '../database/connection';
import { logIngestion, getLastSyncDate } from './ingestionLogger';
import { normalizeCountryName, EU_DESTINATIONS } from './countryNormalizer';
import { computeSeasonalRatios, distributeByQuarter } from './quarterlyEstimator';
import { validateRows, quarantineRows } from './validator';
import { sendQuarantineAlert } from './alerter';
import { IngestionResult } from '../types/ingestion';
import { AsyApplicationRow } from '../types/knex';

const UNHCR_API_BASE = 'https://api.unhcr.org/population/v1/asylum-applications/';
const PAGE_LIMIT = 100;
const BATCH_SIZE = 500;

interface UnhcrApiItem {
  coa_name: string;
  coo_name: string;
  year: string | number;
  applied: string | number;
  [key: string]: unknown;
}

interface UnhcrApiResponse {
  maxPages?: number;
  items?: UnhcrApiItem[];
  [key: string]: unknown;
}

interface EurostatAggRow {
  origin: string;
  quarter: string;
  value: number;
}

/**
 * Fetch all UNHCR asylum application records, paginating through all pages.
 */
export async function fetchAllUnhcrApplications(yearFrom: number | null): Promise<UnhcrApiItem[]> {
  const items: UnhcrApiItem[] = [];
  let page = 1;
  let maxPages = 1;

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), page: String(page) });
    if (yearFrom != null) {
      params.append('yearFrom', String(yearFrom));
    }
    const url = `${UNHCR_API_BASE}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`UNHCR API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as UnhcrApiResponse;
    maxPages = data.maxPages || 1;
    if (Array.isArray(data.items)) {
      items.push(...data.items);
    }
    page += 1;
  } while (page <= maxPages);

  return items;
}

/**
 * Transform raw UNHCR API items into rows ready for asy_applications table.
 * Normalizes country names and skips EU/EEA destinations (Eurostat owns those).
 * UNHCR provides annual totals only — quarter is 'q1' (expanded later in runUnhcrIngestion).
 */
export function transformUnhcrItems(items: UnhcrApiItem[]): Omit<AsyApplicationRow, 'pk'>[] {
  const rows: Omit<AsyApplicationRow, 'pk'>[] = [];
  for (const item of items) {
    const destination = normalizeCountryName(item.coa_name);
    if (EU_DESTINATIONS.has(destination)) continue; // Eurostat owns EU/EEA data
    rows.push({
      record_id: null,
      year: String(item.year),
      quarter: 'q1',
      origin: normalizeCountryName(item.coo_name),
      destination,
      value: parseInt(String(item.applied), 10) || 0,
    });
  }
  return rows;
}

/**
 * Main entry: fetch UNHCR data, transform, upsert into asy_applications, log result.
 */
export async function runUnhcrIngestion(): Promise<IngestionResult> {
  const startedAt = new Date();
  const start = Date.now();
  try {
    const lastSync = await getLastSyncDate('unhcr');
    const yearFrom = lastSync ? lastSync.getFullYear() : null;

    const rawItems = await fetchAllUnhcrApplications(yearFrom);
    const annualRows = transformUnhcrItems(rawItems);

    // Fetch seasonal ratios from existing Eurostat quarterly data
    const eurostatRows = await db('asy_applications')
      .select('origin', 'quarter')
      .sum('value as value')
      .whereIn('destination', Array.from(EU_DESTINATIONS))
      .groupBy('origin', 'quarter') as EurostatAggRow[];
    const ratios = computeSeasonalRatios(eurostatRows);

    // Expand each annual row into 4 quarterly rows using seasonal ratios
    const expandedRows: Omit<AsyApplicationRow, 'pk'>[] = [];
    for (const row of annualRows) {
      const originRatios = ratios[row.origin!] || null;
      const quarterly = distributeByQuarter(row.value ?? 0, originRatios);
      for (const q of ['q1', 'q2', 'q3', 'q4'] as const) {
        expandedRows.push({
          ...row,
          quarter: q,
          value: quarterly[q],
        });
      }
    }

    // Deduplicate by conflict key — keep the last occurrence
    const deduped = new Map<string, Omit<AsyApplicationRow, 'pk'>>();
    for (const row of expandedRows) {
      const key = `${row.year}|${row.quarter}|${row.origin}|${row.destination}`;
      deduped.set(key, row);
    }
    const uniqueRows = Array.from(deduped.values()) as Record<string, unknown>[];

    // Validate rows — quarantine bad data, proceed with clean
    let cleanRows = uniqueRows;
    let quarantineCount = 0;
    try {
      const { clean, quarantined } = await validateRows('unhcr', uniqueRows);
      cleanRows = clean;
      quarantineCount = quarantined.length;
      if (quarantined.length > 0) {
        await quarantineRows('unhcr', quarantined);
        await sendQuarantineAlert('unhcr', quarantined);
        console.log(`[UNHCR] ${quarantined.length} rows quarantined, ${clean.length} clean`);
      }
    } catch (valErr) {
      console.error('[UNHCR] Validation failed, proceeding with all rows:', (valErr as Error).message);
    }

    let totalInserted = 0;
    for (let i = 0; i < cleanRows.length; i += BATCH_SIZE) {
      const batch = cleanRows.slice(i, i + BATCH_SIZE);
      await db<AsyApplicationRow>('asy_applications')
        .insert(batch)
        .onConflict(['year', 'quarter', 'origin', 'destination'])
        .merge();
      totalInserted += batch.length;
    }

    await logIngestion({
      source: 'unhcr',
      status: 'success',
      rowsAffected: totalInserted,
      startedAt,
      quarantineCount,
    });

    return {
      source: 'unhcr',
      rowsAffected: totalInserted,
      quarantineCount,
      duration: Date.now() - start,
    };
  } catch (err) {
    await logIngestion({
      source: 'unhcr',
      status: 'error',
      errorMessage: (err as Error).message,
      startedAt,
    });
    return {
      source: 'unhcr',
      rowsAffected: 0,
      quarantineCount: 0,
      duration: Date.now() - start,
      error: (err as Error).message,
    };
  }
}
