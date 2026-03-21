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

const ROUTE_NAME = 'English Channel';
const BORDER_LOCATION = 'Sea';
const METHOD_FILTER = 'Small boat arrivals';
const DOWNLOAD_DIR = path.join(__dirname, '../../tmp');
const INDEX_URL = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';

const SKIP_NATIONALITIES = new Set<string>([
  'Not stated', 'Other', 'Stateless', 'British overseas citizens',
]);

interface ParsedQuarter {
  year: string;
  quarter: string;
}

interface UkIngestResult {
  inserted: number;
  updated: number;
  quarantineCount: number;
}

function parseQuarter(qStr: string): ParsedQuarter | null {
  const match = qStr.match(/^(\d{4})\s+Q(\d)$/);
  if (!match) return null;
  return { year: match[1], quarter: 'q' + match[2] };
}

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location!).then(resolve).catch(reject);
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
 * Ingest UK Channel XLSX data into ibc_crossings table.
 */
export async function ingestUkChannelData(xlsxPath: string): Promise<UkIngestResult> {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['Data_IER_D01'];
  if (!ws) throw new Error('Sheet "Data_IER_D01" not found. Available: ' + wb.SheetNames.join(', '));

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const rows = data.slice(2);
  const filtered = rows.filter(r => (r as unknown[])[2] === METHOD_FILTER);

  const quarterly = new Map<string, number>();
  for (const r of filtered) {
    const row = r as unknown[];
    const nationality = row[3] as string | undefined;
    const quarterStr = row[1] as string | undefined;
    const count = parseInt(String(row[7])) || 0;

    if (!nationality || !quarterStr || SKIP_NATIONALITIES.has(nationality)) continue;

    const parsed = parseQuarter(quarterStr);
    if (!parsed) continue;

    const key = `${nationality}|${parsed.year}|${parsed.quarter}`;
    quarterly.set(key, (quarterly.get(key) || 0) + count);
  }

  const newData = new Map<string, Omit<IbcCrossingRow, 'pk'>>();
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [nationality, year, quarter] = key.split('|');
    newData.set(key, {
      route: ROUTE_NAME, border_location: BORDER_LOCATION,
      nationality_long: nationality, year, quarter, count,
      count_southwest: null, count_northern: null,
    });
  }

  // Validate rows — quarantine bad data, proceed with clean
  const allNewRows = Array.from(newData.values()) as Record<string, unknown>[];
  let cleanNewRows = allNewRows;
  let quarantineCount = 0;
  try {
    const { clean, quarantined } = await validateRows('uk-channel', allNewRows);
    cleanNewRows = clean;
    quarantineCount = quarantined.length;
    if (quarantined.length > 0) {
      await quarantineRows('uk-channel', quarantined);
      await sendQuarantineAlert('uk-channel', quarantined);
      console.log(`[UK Channel] ${quarantined.length} rows quarantined, ${clean.length} clean`);
    }
  } catch (valErr) {
    console.error('[UK Channel] Validation failed, proceeding with all rows:', (valErr as Error).message);
  }

  const existingRows = await db<IbcCrossingRow>('ibc_crossings').where('route', ROUTE_NAME).select('*');
  const existingMap = new Map<string, IbcCrossingRow>();
  for (const row of existingRows) {
    existingMap.set(`${row.nationality_long}|${row.year}|${row.quarter}`, row);
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Array<{ pk: number; count: number | null }> = [];
  for (const newRow of cleanNewRows) {
    const key = `${newRow.nationality_long}|${newRow.year}|${newRow.quarter}`;
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(newRow);
    } else if (existing.count !== newRow.count) {
      toUpdate.push({ pk: existing.pk, count: newRow.count as number | null });
    }
  }

  if (toInsert.length > 0 || toUpdate.length > 0) {
    await db.transaction(async trx => {
      const BATCH = 500;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        await trx('ibc_crossings').insert(toInsert.slice(i, i + BATCH));
      }
      for (const row of toUpdate) {
        await trx('ibc_crossings').where('pk', row.pk).update({ count: row.count });
      }
    });
  }

  // Update country_routes
  const nationalities = [...new Set(cleanNewRows.map(r => r.nationality_long as string))];
  const existingRoutes = await db('country_routes').select('*') as Array<{ country: string; routes: string[] }>;
  const routesByCountry = new Map(existingRoutes.map(r => [r.country, r.routes || []]));
  for (const nat of nationalities) {
    const routes = routesByCountry.get(nat);
    if (routes && !routes.includes(ROUTE_NAME)) {
      await db('country_routes').where('country', nat).update({ routes: [...routes, ROUTE_NAME] });
    } else if (!routes) {
      await db('country_routes').insert({ country: nat, routes: [ROUTE_NAME] });
    }
  }

  return { inserted: toInsert.length, updated: toUpdate.length, quarantineCount };
}

/**
 * Main entry: scrape GOV.UK for latest XLSX, download, and ingest.
 */
export async function runUkChannelIngestion(): Promise<IngestionResult> {
  const startedAt = new Date();
  const start = Date.now();
  try {
    const html = await fetchPage(INDEX_URL);
    const match = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"]+illegal-entry-routes-to-the-uk-dataset[^"]+\.xlsx)"/);
    if (!match) throw new Error('Could not find XLSX download link on GOV.UK index page');

    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const xlsxPath = path.join(DOWNLOAD_DIR, 'uk-channel-latest.xlsx');

    await downloadFile(match[1], xlsxPath);
    const result = await ingestUkChannelData(xlsxPath);

    try { fs.unlinkSync(xlsxPath); } catch (e) { /* ignore */ }

    await logIngestion({
      source: 'uk-channel',
      status: 'success',
      rowsAffected: result.inserted + result.updated,
      startedAt,
      quarantineCount: result.quarantineCount || 0,
    });

    return {
      source: 'uk-channel',
      rowsAffected: result.inserted + result.updated,
      quarantineCount: result.quarantineCount || 0,
      duration: Date.now() - start,
    };
  } catch (err) {
    await logIngestion({
      source: 'uk-channel',
      status: 'error',
      errorMessage: (err as Error).message,
      startedAt,
    });
    return {
      source: 'uk-channel',
      rowsAffected: 0,
      quarantineCount: 0,
      duration: Date.now() - start,
      error: (err as Error).message,
    };
  }
}
