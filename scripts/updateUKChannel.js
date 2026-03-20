#!/usr/bin/env node
/**
 * Automated UK Home Office data update.
 * Scrapes the GOV.UK statistics page for the latest XLSX download link,
 * downloads it, and runs ingestion.
 *
 * UK Home Office publishes quarterly. Run via cron monthly to catch updates:
 * 0 0 1 * * cd /path/to/refugee-flow && node scripts/updateUKChannel.js >> logs/uk-update.log 2>&1
 *
 * Exit codes:
 *   0 = success
 *   1 = download failed
 *   2 = ingestion failed
 */
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'tmp');
const INDEX_URL = 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables';

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

async function run() {
  console.log(`[${new Date().toISOString()}] UK Channel Auto-Update`);

  // Scrape index page for the XLSX download link
  console.log('Fetching index page...');
  const html = await fetchPage(INDEX_URL);

  // Look for the dataset XLSX link (pattern: illegal-entry-routes-to-the-uk-dataset-*.xlsx)
  const match = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"]+illegal-entry-routes-to-the-uk-dataset[^"]+\.xlsx)"/);
  if (!match) {
    console.error('ERROR: Could not find XLSX download link on index page.');
    console.error('The page structure may have changed. Download manually from:');
    console.error(INDEX_URL);
    process.exit(1);
  }

  const xlsxUrl = match[1];
  console.log('Found XLSX:', xlsxUrl);

  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const xlsxPath = path.join(DOWNLOAD_DIR, 'uk-channel-latest.xlsx');

  try {
    await downloadFile(xlsxUrl, xlsxPath);
    console.log('Downloaded successfully.');
  } catch (e) {
    console.error('ERROR: Download failed:', e.message);
    process.exit(1);
  }

  // Run ingestion
  try {
    console.log('\nRunning ingestion...');
    execSync(`node ${path.join(__dirname, 'ingestUKChannel.js')} ${xlsxPath}`, { stdio: 'inherit' });
    console.log('\nUK Channel data update complete.');
  } catch (e) {
    console.error('\nERROR: Ingestion failed.');
    process.exit(2);
  }

  try { fs.unlinkSync(xlsxPath); } catch (e) { /* ignore */ }
}

run();
