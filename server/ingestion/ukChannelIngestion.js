const https = require('https');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../database/connection');
const { logIngestion } = require('./ingestionLogger');
const { validateRows, quarantineRows } = require('./validator');
const { sendQuarantineAlert } = require('./alerter');

const ROUTE_NAME = 'English Channel';
const BORDER_LOCATION = 'Sea';
const METHOD_FILTER = 'Small boat arrivals';
const DOWNLOAD_DIR = path.join(__dirname, '../../tmp');
const INDEX_URL = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';

const SKIP_NATIONALITIES = new Set([
  'Not stated', 'Other', 'Stateless', 'British overseas citizens',
]);

function parseQuarter(qStr) {
  const match = qStr.match(/^(\d{4})\s+Q(\d)$/);
  if (!match) return null;
  return { year: match[1], quarter: 'q' + match[2] };
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 60000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(resolve); });
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on('error', reject);
  });
}

/**
 * Ingest UK Channel XLSX data into ibc_crossings table.
 * @param {string} xlsxPath - Path to downloaded XLSX file
 */
async function ingestUkChannelData(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets['Data_IER_D01'];
  if (!ws) throw new Error('Sheet "Data_IER_D01" not found. Available: ' + wb.SheetNames.join(', '));

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const rows = data.slice(2);
  const filtered = rows.filter(r => r[2] === METHOD_FILTER);

  const quarterly = new Map();
  for (const r of filtered) {
    const nationality = r[3];
    const quarterStr = r[1];
    const count = parseInt(r[7]) || 0;

    if (!nationality || !quarterStr || SKIP_NATIONALITIES.has(nationality)) continue;

    const parsed = parseQuarter(quarterStr);
    if (!parsed) continue;

    const key = `${nationality}|${parsed.year}|${parsed.quarter}`;
    quarterly.set(key, (quarterly.get(key) || 0) + count);
  }

  const newData = new Map();
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [nationality, year, quarter] = key.split('|');
    newData.set(key, {
      route: ROUTE_NAME, border_location: BORDER_LOCATION,
      nationality_long: nationality, year, quarter, count,
    });
  }

  // Validate rows — quarantine bad data, proceed with clean
  const allNewRows = Array.from(newData.values());
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
    console.error('[UK Channel] Validation failed, proceeding with all rows:', valErr.message);
  }

  const existingRows = await db('ibc_crossings').where('route', ROUTE_NAME).select('*');
  const existingMap = new Map();
  for (const row of existingRows) {
    existingMap.set(`${row.nationality_long}|${row.year}|${row.quarter}`, row);
  }

  const toInsert = [];
  const toUpdate = [];
  for (const newRow of cleanNewRows) {
    const key = `${newRow.nationality_long}|${newRow.year}|${newRow.quarter}`;
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(newRow);
    } else if (existing.count !== newRow.count) {
      toUpdate.push({ pk: existing.pk, count: newRow.count });
    }
  }

  if (toInsert.length > 0 || toUpdate.length > 0) {
    await db.transaction(async trx => {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        await trx('ibc_crossings').insert(toInsert.slice(i, i + BATCH_SIZE));
      }
      for (const row of toUpdate) {
        await trx('ibc_crossings').where('pk', row.pk).update({ count: row.count });
      }
    });
  }

  // Update country_routes
  const nationalities = [...new Set(cleanNewRows.map(r => r.nationality_long))];
  const existingRoutes = await db('country_routes').select('*');
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
async function runUkChannelIngestion() {
  const startedAt = new Date();
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
  } catch (err) {
    await logIngestion({
      source: 'uk-channel',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
  }
}

module.exports = { runUkChannelIngestion, ingestUkChannelData };
