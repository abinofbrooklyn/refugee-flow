#!/usr/bin/env node
/**
 * Automated CBP data update.
 * Constructs the expected CSV URL based on current date, downloads it,
 * and runs ingestion.
 *
 * CBP publishes data ~2 months behind. URL pattern:
 * https://www.cbp.gov/sites/default/files/{YYYY-Mon}/
 *   nationwide-encounters-fy{start}-fy{end}-{month}-aor.csv
 *
 * Run via cron: 0 0 15 * * cd /path/to/refugee-flow && node scripts/updateCBP.js >> logs/cbp-update.log 2>&1
 * (15th of each month to account for CBP's ~2 month publishing lag)
 *
 * Exit codes:
 *   0 = success (or no changes needed)
 *   1 = download failed (URL pattern may have changed — needs manual check)
 *   2 = ingestion failed
 */
require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'tmp');
const MONTH_ABBRS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * CBP data lags ~2 months. Figure out which month's data to expect.
 * Also determine the fiscal year range for the filename.
 */
function getExpectedFileParams() {
  const now = new Date();
  // Data month is ~2 months behind
  const dataDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const dataMonth = MONTH_ABBRS[dataDate.getMonth()];

  // Fiscal year: Oct starts new FY
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  // CBP typically spans 4 fiscal years in the filename
  const startFY = currentFY - 3;

  return { dataMonth, startFY, endFY: currentFY, now };
}

function fy(y) { return String(y).slice(2); }

/**
 * Build candidate URLs. CBP has used varying directory structures,
 * so we try multiple patterns.
 */
function buildCandidateUrls({ dataMonth, startFY, endFY, now }) {
  const urls = [];
  const filename = `nationwide-encounters-fy${fy(startFY)}-fy${fy(endFY)}-${dataMonth}-aor.csv`;
  const pad = (n) => String(n).padStart(2, '0');

  // Try current month's directory and previous months
  for (let offset = 0; offset <= 2; offset++) {
    const dirDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const dirYear = dirDate.getFullYear();
    const dirMonthNum = pad(dirDate.getMonth() + 1); // "01"-"12"
    const dirMonthName = MONTH_NAMES[dirDate.getMonth()]; // "Jan"-"Dec"

    // Pattern 1: /sites/default/files/YYYY-MM/filename.csv (current format, e.g. 2026-02)
    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthNum}/${filename}`);

    // Pattern 2: /sites/default/files/YYYY-Mon/filename.csv (e.g. 2026-Feb)
    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthName}/${filename}`);

    // Pattern 3: /sites/default/files/assets/documents/YYYY-Mon/filename.csv (oldest format)
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
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
      // CBP sometimes serves CSV as text/html or application/octet-stream
      if (contentType.includes('html') && !contentType.includes('csv')) {
        res.resume();
        return reject(new Error(`Got HTML instead of CSV (likely 404 page)`));
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

async function run() {
  const params = getExpectedFileParams();
  console.log(`[${new Date().toISOString()}] CBP Auto-Update`);
  console.log(`Looking for: month=${params.dataMonth}, FY${params.startFY}-FY${params.endFY}`);

  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const csvPath = path.join(DOWNLOAD_DIR, 'cbp-latest.csv');
  const urls = buildCandidateUrls(params);

  let downloaded = false;
  for (const url of urls) {
    try {
      console.log('Trying:', url);
      await downloadFile(url, csvPath);
      // Verify it's actually CSV (check first line for expected header)
      const firstLine = fs.readFileSync(csvPath, 'utf-8').split('\n')[0];
      if (!firstLine.includes('Fiscal Year')) {
        console.log('Downloaded file is not a valid CBP CSV. Skipping.');
        fs.unlinkSync(csvPath);
        continue;
      }
      console.log('Downloaded successfully.');
      downloaded = true;
      break;
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }

  if (!downloaded) {
    console.error('\nERROR: Could not download CBP CSV from any known URL pattern.');
    console.error('The URL structure may have changed. Please download manually from:');
    console.error('https://www.cbp.gov/document/stats/nationwide-encounters');
    console.error('Then run: node scripts/ingestCBP.js <path-to-csv>');
    process.exit(1);
  }

  // Run ingestion
  try {
    console.log('\nRunning ingestion...');
    execSync(`node ${path.join(__dirname, 'ingestCBP.js')} ${csvPath}`, { stdio: 'inherit' });
    console.log('\nCBP data update complete.');
  } catch (e) {
    console.error('\nERROR: Ingestion failed.');
    process.exit(2);
  }

  // Cleanup
  try { fs.unlinkSync(csvPath); } catch (e) { /* ignore */ }
}

run();
