import { parse } from 'csv-parse/sync';
import db from '../database/connection';
import { logIngestion } from './ingestionLogger';
import { normalizeRow } from './iomNormalizer';
import { validateRows, quarantineRows } from './validator';
import { sendQuarantineAlert } from './alerter';
import { IngestionResult } from '../types/ingestion';
import { RouteDeathRow } from '../types/knex';

const IOM_CSV_URL =
  'https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv';
const BATCH_SIZE = 500;

interface IomCsvRow {
  'Main ID': string;
  'Incident Date': string;
  'Incident Year': string;
  'Number of Dead': string;
  'Minimum Estimated Number of Missing': string;
  'Total Number of Dead and Missing': string;
  'Cause of Death': string;
  'Country of Incident': string;
  'Information Source': string;
  Coordinates: string;
  'Migration Route': string;
  URL: string;
  [key: string]: string;
}

/**
 * Parse a "lat, lng" coordinate string into separate lat/lng values with reduced precision.
 * Returns { lat: null, lng: null } for invalid or empty input.
 */
export function parseCoordinates(coordStr: string | null | undefined): { lat: number | null; lng: number | null } {
  if (!coordStr || String(coordStr).trim() === '') return { lat: null, lng: null };
  const parts = String(coordStr).split(',');
  if (parts.length !== 2) return { lat: null, lng: null };
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return { lat: null, lng: null };
  return { lat, lng };
}

/**
 * Convert a calendar month number (1-12) to a quarter string ('q1'-'q4').
 */
export function monthToQuarter(month: number): string {
  return 'q' + Math.ceil(month / 3);
}

/**
 * Transform raw CSV rows into rows ready for the route_deaths table.
 */
export function transformIomRows(csvRows: IomCsvRow[]): RouteDeathRow[] {
  const rawRows = csvRows.map((row) => {
    const coords = parseCoordinates(row['Coordinates']);
    const incidentDate = row['Incident Date'] || null;
    let quarter: string | null = null;
    if (incidentDate) {
      const d = new Date(incidentDate);
      if (!isNaN(d.getTime())) {
        quarter = monthToQuarter(d.getMonth() + 1);
      }
    }
    return {
      id: String(row['Main ID']),
      date: incidentDate,
      quarter,
      year: String(row['Incident Year'] || ''),
      dead: row['Number of Dead'] || null,
      missing: row['Minimum Estimated Number of Missing'] || null,
      dead_and_missing: row['Total Number of Dead and Missing'] || null,
      cause_of_death: row['Cause of Death'] || null,
      cause_of_death_display_text: row['Cause of Death'] || null,
      location: row['Country of Incident'] || null,
      description: null,
      source: row['Information Source'] || null,
      lat: coords.lat,
      lng: coords.lng,
      route: row['Migration Route'] || null,
      route_display_text: row['Migration Route'] || null,
      source_url: row['URL'] || null,
    } as Record<string, unknown>;
  });

  // Apply normalization pipeline: fix swapped coords, resolve route, apply geo bounds
  const normalized = rawRows.map(normalizeRow);

  // Strip internal tracking flags before returning DB-ready rows
  const cleaned = normalized.map(({ _wasFallback, _rawRoute, ...rest }) => rest as Record<string, unknown>);

  // No dedup — DB unique ID constraint (onConflict('id').ignore()) handles true duplicates
  return cleaned as unknown as RouteDeathRow[];
}

/**
 * Filter transformed rows to only those on or after the cutoff date.
 * Returns all rows if cutoffDate is null (first run / empty table).
 */
export function filterNewRows(
  rows: RouteDeathRow[],
  cutoffDate: string | null,
): RouteDeathRow[] {
  if (!cutoffDate) return rows;
  return rows.filter(r => r.date != null && r.date >= cutoffDate);
}

/**
 * Download the IOM Missing Migrants CSV and parse it into row objects.
 */
export async function fetchAndParseIomCsv(): Promise<IomCsvRow[]> {
  const response = await fetch(IOM_CSV_URL);
  if (!response.ok) {
    throw new Error(`IOM CSV fetch error: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  return parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as IomCsvRow[];
}

/**
 * Main entry: download IOM CSV, transform, upsert into route_deaths, log result.
 * Always downloads full CSV — no date-filter API exists.
 * Uses onConflict('id').ignore() to skip existing records efficiently.
 */
export async function runIomIngestion(): Promise<IngestionResult> {
  const startedAt = new Date();
  const start = Date.now();
  try {
    const csvRows = await fetchAndParseIomCsv();
    const rows = transformIomRows(csvRows).filter((r) => r.id && r.id !== 'null' && r.id !== 'undefined');

    // Log normalization summary
    console.log(`[IOM] ${csvRows.length} CSV rows -> ${rows.length} after normalization+dedup`);

    // Validate rows — quarantine bad data, proceed with clean
    let cleanRows = rows as unknown as Record<string, unknown>[];
    let quarantineCount = 0;
    try {
      const { clean, quarantined } = await validateRows('iom', rows as unknown as Record<string, unknown>[]);
      cleanRows = clean;
      quarantineCount = quarantined.length;
      if (quarantined.length > 0) {
        await quarantineRows('iom', quarantined);
        await sendQuarantineAlert('iom', quarantined);
        console.log(`[IOM] ${quarantined.length} rows quarantined, ${clean.length} clean`);
      }
    } catch (valErr) {
      console.error('[IOM] Validation failed, proceeding with all rows:', (valErr as Error).message);
    }

    let totalInserted = 0;
    for (let i = 0; i < cleanRows.length; i += BATCH_SIZE) {
      const batch = cleanRows.slice(i, i + BATCH_SIZE);
      await db<RouteDeathRow>('route_deaths').insert(batch).onConflict('id').ignore();
      totalInserted += batch.length;
    }

    await logIngestion({
      source: 'iom',
      status: 'success',
      rowsAffected: totalInserted,
      startedAt,
      quarantineCount,
    });

    return {
      source: 'iom',
      rowsAffected: totalInserted,
      quarantineCount,
      duration: Date.now() - start,
    };
  } catch (err) {
    await logIngestion({
      source: 'iom',
      status: 'error',
      errorMessage: (err as Error).message,
      startedAt,
    });
    return {
      source: 'iom',
      rowsAffected: 0,
      quarantineCount: 0,
      duration: Date.now() - start,
      error: (err as Error).message,
    };
  }
}
