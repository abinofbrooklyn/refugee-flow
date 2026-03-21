'use strict';

import https from 'https';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import db from '../database/connection';
import { logIngestion } from './ingestionLogger';
import { validateRows, quarantineRows } from './validator';
import { sendQuarantineAlert } from './alerter';
import { IngestionResult } from '../types/ingestion';
import { IbcCrossingRow } from '../types/knex';

const FRONTEX_PAGE_URL = 'https://www.frontex.europa.eu/what-we-do/monitoring-and-risk-analysis/migratory-map/';
const BATCH_SIZE = 500;

// Map XLSX route names to DB/app route names
export const ROUTE_NAME_MAP: Record<string, string> = {
  'Central Mediterranean Route': 'Central Mediterranean',
  'Western Mediterranean Route': 'Western Mediterranean',
  'Western Balkan Route': 'Western Balkans',
  'Eastern Mediterranean Route': 'Eastern Mediterranean',
  'Western African Route': 'Western African',
  'Eastern Borders Route': 'Eastern Land Borders',
  'Black Sea Route': 'Black Sea',
  'Circular Route from Albania to Greece': 'Circular Route from Albania to Greece',
  'Other': 'Other',
};

const QUARTER_MAP: Record<string, string> = {
  JAN: 'q1', FEB: 'q1', MAR: 'q1',
  APR: 'q2', MAY: 'q2', JUN: 'q2',
  JUL: 'q3', AUG: 'q3', SEP: 'q3',
  OCT: 'q4', NOV: 'q4', DEC: 'q4',
};

interface ColInfo {
  col: number;
  month: string;
  year: string;
  quarter: string;
}

interface FrontexUpsertResult {
  inserted: number;
  updated: number;
  unchanged: number;
  stale: number;
}

/**
 * Fetch a URL and return the response body as a string.
 */
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk: Buffer) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Download a file from a URL to a local path.
 */
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(resolve as () => void); });
      file.on('error', (err: Error) => { fs.unlink(dest, () => {}); reject(err); });
    }).on('error', reject);
  });
}

/**
 * Parse Frontex XLSX and return quarterly aggregated rows.
 */
export function parseXlsx(filePath: string): Omit<IbcCrossingRow, 'pk'>[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Detections_of_IBC'];
  if (!ws) throw new Error('Sheet "Detections_of_IBC" not found');

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const headers = data[1] as string[];
  const rows = data.slice(2);

  const colInfo: ColInfo[] = [];
  for (let c = 3; c < headers.length; c++) {
    const h = headers[c];
    if (!h) continue;
    const month = h.slice(0, 3).toUpperCase();
    const year = h.slice(3);
    const quarter = QUARTER_MAP[month];
    if (!quarter || !year) continue;
    colInfo.push({ col: c, month, year, quarter });
  }

  const quarterly = new Map<string, number>();
  for (const row of rows) {
    const r = row as unknown[];
    const routeRaw = r[0] as string | undefined;
    const nationality = r[2] as string | undefined;
    if (!routeRaw || !nationality) continue;

    const route = ROUTE_NAME_MAP[routeRaw] || routeRaw;
    for (const ci of colInfo) {
      const val = r[ci.col];
      if (!val || val === 0) continue;
      const key = `${route}|${nationality}|${ci.year}|${ci.quarter}`;
      quarterly.set(key, (quarterly.get(key) || 0) + (typeof val === 'number' ? val : parseInt(String(val)) || 0));
    }
  }

  const upsertRows: Omit<IbcCrossingRow, 'pk'>[] = [];
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [route, nationality, year, quarter] = key.split('|');
    upsertRows.push({
      route,
      border_location: 'Land/Sea',
      nationality_long: nationality,
      year,
      quarter,
      count,
      count_southwest: null,
      count_northern: null,
    });
  }
  return upsertRows;
}

/**
 * Diff-based upsert for Frontex data.
 * Excludes Americas and English Channel routes (CBP/UK data).
 */
export async function upsertFrontexData(upsertRows: Omit<IbcCrossingRow, 'pk'>[]): Promise<FrontexUpsertResult> {
  const NON_FRONTEX_ROUTES = ['Americas', 'English Channel'];
  const existingRows = await db<IbcCrossingRow>('ibc_crossings')
    .whereNotIn('route', NON_FRONTEX_ROUTES)
    .select('*');

  const existingMap = new Map<string, IbcCrossingRow>();
  for (const row of existingRows) {
    const key = `${row.route}|${row.nationality_long}|${row.year}|${row.quarter}`;
    existingMap.set(key, row);
  }

  const toInsert: Omit<IbcCrossingRow, 'pk'>[] = [];
  const toUpdate: Array<{ pk: number; count: number | null }> = [];
  let unchanged = 0;

  for (const row of upsertRows) {
    const key = `${row.route}|${row.nationality_long}|${row.year}|${row.quarter}`;
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(row);
    } else if (existing.count !== row.count) {
      toUpdate.push({ pk: existing.pk, count: row.count });
    } else {
      unchanged++;
    }
    existingMap.delete(key);
  }

  const staleKeys = [...existingMap.values()].map(r => r.pk);

  if (toInsert.length > 0 || toUpdate.length > 0 || staleKeys.length > 0) {
    await db.transaction(async trx => {
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        await trx('ibc_crossings').insert(toInsert.slice(i, i + BATCH_SIZE));
      }
      for (const row of toUpdate) {
        await trx('ibc_crossings').where('pk', row.pk).update({ count: row.count });
      }
      if (staleKeys.length > 0) {
        await trx('ibc_crossings').whereIn('pk', staleKeys).del();
      }
    });
  }

  return { inserted: toInsert.length, updated: toUpdate.length, unchanged, stale: staleKeys.length };
}

/**
 * Main entry: scrape Frontex page for XLSX link, download, parse, upsert, log.
 */
export async function runFrontexIngestion(): Promise<IngestionResult> {
  const startedAt = new Date();
  const start = Date.now();
  let tmpPath: string | null = null;
  try {
    // Scrape page for XLSX link
    console.log('[Frontex] Fetching migratory map page...');
    const html = await fetchText(FRONTEX_PAGE_URL);
    const match = html.match(/href="(\/assets\/Migratory_routes\/[^"]*\.xlsx)"/);
    if (!match) throw new Error('Could not find XLSX link on Frontex page');

    const xlsxUrl = 'https://www.frontex.europa.eu' + match[1];
    console.log('[Frontex] Found XLSX:', xlsxUrl);

    // Download
    const tmpDir = path.join(__dirname, '..', '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    tmpPath = path.join(tmpDir, 'frontex-latest.xlsx');

    await downloadFile(xlsxUrl, tmpPath);
    console.log('[Frontex] Downloaded.');

    // Parse and upsert
    const upsertRows = parseXlsx(tmpPath);
    console.log(`[Frontex] ${upsertRows.length} rows from XLSX`);

    // Validate rows — quarantine bad data, proceed with clean
    let cleanRows = upsertRows as Record<string, unknown>[];
    let quarantineCount = 0;
    try {
      const { clean, quarantined } = await validateRows('frontex', upsertRows as Record<string, unknown>[]);
      cleanRows = clean;
      quarantineCount = quarantined.length;
      if (quarantined.length > 0) {
        await quarantineRows('frontex', quarantined);
        await sendQuarantineAlert('frontex', quarantined);
        console.log(`[Frontex] ${quarantined.length} rows quarantined, ${clean.length} clean`);
      }
    } catch (valErr) {
      console.error('[Frontex] Validation failed, proceeding with all rows:', (valErr as Error).message);
    }

    const result = await upsertFrontexData(cleanRows as Omit<IbcCrossingRow, 'pk'>[]);
    console.log(`[Frontex] Done: ${result.inserted} inserted, ${result.updated} updated, ${result.unchanged} unchanged, ${result.stale} stale`);

    await logIngestion({
      source: 'frontex',
      status: 'success',
      rowsAffected: result.inserted + result.updated,
      startedAt,
      quarantineCount,
    });

    return {
      source: 'frontex',
      rowsAffected: result.inserted + result.updated,
      quarantineCount,
      duration: Date.now() - start,
    };
  } catch (err) {
    console.error('[Frontex] Error:', (err as Error).message);
    await logIngestion({
      source: 'frontex',
      status: 'error',
      errorMessage: (err as Error).message,
      startedAt,
    });
    return {
      source: 'frontex',
      rowsAffected: 0,
      quarantineCount: 0,
      duration: Date.now() - start,
      error: (err as Error).message,
    };
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
  }
}
