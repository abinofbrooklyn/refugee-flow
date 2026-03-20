const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const db = require('../database/connection');
const { logIngestion } = require('./ingestionLogger');
const { normalizeCbpNationality } = require('../../scripts/nationality-map.js');

const ROUTE_NAME = 'Americas';
const DOWNLOAD_DIR = path.join(__dirname, '../../tmp');
const MONTH_ABBRS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const QUARTER_MAP = {
  JAN: 'q1', FEB: 'q1', MAR: 'q1',
  APR: 'q2', MAY: 'q2', JUN: 'q2',
  JUL: 'q3', AUG: 'q3', SEP: 'q3',
  OCT: 'q4', NOV: 'q4', DEC: 'q4',
};

function toCalendarYear(fiscalYear, monthAbbr) {
  const fy = parseInt(fiscalYear);
  if (['OCT', 'NOV', 'DEC'].includes(monthAbbr)) return String(fy - 1);
  return String(fy);
}

function getExpectedFileParams() {
  const now = new Date();
  const dataDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const dataMonth = MONTH_ABBRS[dataDate.getMonth()];
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const startFY = currentFY - 3;
  return { dataMonth, startFY, endFY: currentFY, now };
}

function fy(y) { return String(y).slice(2); }

function buildCandidateUrls({ dataMonth, startFY, endFY, now }) {
  const urls = [];
  const filename = `nationwide-encounters-fy${fy(startFY)}-fy${fy(endFY)}-${dataMonth}-aor.csv`;
  const pad = (n) => String(n).padStart(2, '0');

  for (let offset = 0; offset <= 2; offset++) {
    const dirDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const dirYear = dirDate.getFullYear();
    const dirMonthNum = pad(dirDate.getMonth() + 1);
    const dirMonthName = MONTH_NAMES[dirDate.getMonth()];

    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthNum}/${filename}`);
    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthName}/${filename}`);
    urls.push(`https://www.cbp.gov/sites/default/files/assets/documents/${dirYear}-${dirMonthName}/${filename}`);
  }
  return urls;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/csv,application/csv,*/*',
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirect = res.headers.location;
        if (!redirect) return reject(new Error('Redirect with no location'));
        return downloadFile(redirect, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('html') && !contentType.includes('csv')) {
        res.resume();
        return reject(new Error('Got HTML instead of CSV (likely 404 page)'));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(resolve); });
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Ingest CBP CSV data into ibc_crossings table.
 * @param {string} csvContent - Raw CSV string
 */
async function ingestCbpData(csvContent) {
  const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

  const filtered = records.filter(r =>
    r['Component'] === 'U.S. Border Patrol' &&
    r['Title of Authority'] === 'Title 8' &&
    r['Land Border Region'] !== 'Other'
  );

  const quarterly = new Map();
  for (const r of filtered) {
    const monthAbbr = (r['Month (abbv)'] || '').toUpperCase().trim();
    const fiscalYear = (r['Fiscal Year'] || '').replace('FYTD', '').trim();
    const count = parseInt(r['Encounter Count']) || 0;
    const nationality = r['Citizenship'];
    const borderRegion = r['Land Border Region'] || '';

    if (!monthAbbr || !fiscalYear || !QUARTER_MAP[monthAbbr]) continue;

    const calYear = toCalendarYear(fiscalYear, monthAbbr);
    const quarter = QUARTER_MAP[monthAbbr];
    const normNationality = normalizeCbpNationality(nationality);

    const key = `${normNationality}|${calYear}|${quarter}`;
    if (!quarterly.has(key)) quarterly.set(key, { total: 0, southwest: 0, northern: 0 });
    const entry = quarterly.get(key);
    entry.total += count;
    if (borderRegion === 'Southwest Land Border') entry.southwest += count;
    else if (borderRegion === 'Northern Land Border') entry.northern += count;
  }

  const newData = new Map();
  for (const [key, counts] of quarterly) {
    if (counts.total === 0) continue;
    const [nationality, year, quarter] = key.split('|');
    const upsertKey = `Land|${nationality}|${year}|${quarter}`;
    newData.set(upsertKey, {
      route: ROUTE_NAME, border_location: 'Land', nationality_long: nationality,
      year, quarter, count: counts.total,
      count_southwest: counts.southwest || null, count_northern: counts.northern || null,
    });
  }

  const existingRows = await db('ibc_crossings').where('route', ROUTE_NAME).select('*');
  const existingMap = new Map();
  for (const row of existingRows) {
    existingMap.set(`${row.border_location}|${row.nationality_long}|${row.year}|${row.quarter}`, row);
  }

  const toInsert = [];
  const toUpdate = [];
  for (const [key, newRow] of newData) {
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(newRow);
    } else if (existing.count !== newRow.count || existing.count_southwest !== newRow.count_southwest || existing.count_northern !== newRow.count_northern) {
      toUpdate.push({ pk: existing.pk, count: newRow.count, count_southwest: newRow.count_southwest, count_northern: newRow.count_northern });
    }
  }

  if (toInsert.length > 0 || toUpdate.length > 0) {
    await db.transaction(async trx => {
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        await trx('ibc_crossings').insert(toInsert.slice(i, i + BATCH_SIZE));
      }
      for (const row of toUpdate) {
        await trx('ibc_crossings').where('pk', row.pk).update({ count: row.count, count_southwest: row.count_southwest, count_northern: row.count_northern });
      }
    });
  }

  // Update country_routes
  const nationalities = [...new Set([...newData.values()].map(r => r.nationality_long))];
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

  return { inserted: toInsert.length, updated: toUpdate.length };
}

/**
 * Main entry: download latest CBP CSV and ingest.
 */
async function runCbpIngestion() {
  const startedAt = new Date();
  try {
    const params = getExpectedFileParams();
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

    const csvPath = path.join(DOWNLOAD_DIR, 'cbp-latest.csv');
    const urls = buildCandidateUrls(params);

    let downloaded = false;
    for (const url of urls) {
      try {
        await downloadFile(url, csvPath);
        const firstLine = fs.readFileSync(csvPath, 'utf-8').split('\n')[0];
        if (!firstLine.includes('Fiscal Year')) {
          fs.unlinkSync(csvPath);
          continue;
        }
        downloaded = true;
        break;
      } catch (e) { /* try next URL */ }
    }

    if (!downloaded) {
      throw new Error('Could not download CBP CSV from any known URL pattern');
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const result = await ingestCbpData(csvContent);

    try { fs.unlinkSync(csvPath); } catch (e) { /* ignore */ }

    await logIngestion({
      source: 'cbp',
      status: 'success',
      rowsAffected: result.inserted + result.updated,
      startedAt,
    });
  } catch (err) {
    await logIngestion({
      source: 'cbp',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
  }
}

module.exports = { runCbpIngestion, ingestCbpData };
