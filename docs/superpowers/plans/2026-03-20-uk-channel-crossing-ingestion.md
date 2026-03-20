# UK English Channel Crossing Data Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest UK Home Office small boat crossing data into the existing `ibc_crossings` table so the English Channel route displays border crossing data identically to how European routes display Frontex IBC data and Americas displays CBP data.

**Architecture:** Download UK Home Office XLSX, filter to "Small boat arrivals" only, aggregate across sex/age by nationality+quarter, diff-based upsert into `ibc_crossings` with `route = "English Channel"`. No fiscal year conversion needed — data is already in calendar quarters.

**Tech Stack:** Node.js, xlsx (already installed), knex (PostgreSQL), existing IBC frontend components (no frontend changes needed)

---

## Context

### What UK Home Office data looks like (Data_IER_D01 sheet)
```
Year | Quarter   | Method of entry      | Nationality  | Region       | Sex    | Age Group    | Number of detections
2023 | 2023 Q3   | Small boat arrivals  | Afghanistan  | Asia Central | Male   | 25 to 39     | 847
```

### What we need to produce (ibc_crossings table rows)
```
route: "English Channel"
border_location: "Sea"
nationality_long: "Afghanistan"
year: "2023"
quarter: "q3"
count: 3421 (summed across sex/age for that nationality+quarter)
```

### Key normalizations
1. **Filter:** Only `Method of entry = "Small boat arrivals"` (skip air arrivals, port detections, inland detections)
2. **Aggregate:** Sum `Number of detections` across sex and age group → one row per nationality + quarter
3. **Quarter format:** Parse "2023 Q3" → `year: "2023"`, `quarter: "q3"`
4. **Nationality cleanup:** Some entries like "British overseas citizens" or "Not stated" should be mapped or skipped

### Data coverage
2018 Q1 to 2025 Q4 (8 years). Updated quarterly by UK Home Office.

### Download URL pattern
```
https://assets.publishing.service.gov.uk/media/{hash}/illegal-entry-routes-to-the-uk-dataset-{month}-{year}.xlsx
```
The hash changes each release, so automated download requires scraping the index page. Manual download is more reliable for quarterly updates.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/ingestUKChannel.js` | Create | UK Home Office XLSX ingestion script |
| `scripts/updateUKChannel.js` | Create | Quarterly auto-download + ingestion script |
| `src/components/about/config/accordionsConfig.jsx` | Modify | Add UK Home Office data source entry |
| `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx` | Modify | Data Sources link for English Channel |
| `src/components/RefugeeRoute_textArea_content_basicInfo.jsx` | Modify | Data Sources link for English Channel |
| `src/data/IBC_crossingCountByCountry.json` | Modify | Update English Channel total_cross after ingestion |

No database migration needed — reuses existing `ibc_crossings` table.
No new frontend components needed — English Channel IBC tab will auto-populate.

---

## Task 1: Create UK Channel ingestion script

**Files:**
- Create: `scripts/ingestUKChannel.js`

- [ ] **Step 1: Create the ingestion script**

```javascript
#!/usr/bin/env node
/**
 * Ingest UK Home Office small boat crossing data from XLSX.
 * Download from: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables
 *
 * Filters to "Small boat arrivals" only.
 * Aggregates across sex/age → one count per nationality + quarter.
 * Diff-based upsert into ibc_crossings with route = "English Channel".
 *
 * Usage: node scripts/ingestUKChannel.js <path-to-xlsx>
 */
require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');
const knex = require('knex');
const config = require('../db/knexfile.js');

const db = knex(config.production || config.development || config);

const ROUTE_NAME = 'English Channel';
const BORDER_LOCATION = 'Sea';
const METHOD_FILTER = 'Small boat arrivals';

// Skip these "nationalities" — not actual countries
const SKIP_NATIONALITIES = new Set([
  'Not stated', 'Other', 'Stateless', 'British overseas citizens',
]);

/**
 * Parse "2023 Q3" → { year: "2023", quarter: "q3" }
 */
function parseQuarter(qStr) {
  const match = qStr.match(/^(\d{4})\s+Q(\d)$/);
  if (!match) return null;
  return { year: match[1], quarter: 'q' + match[2] };
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/ingestUKChannel.js <path-to-xlsx>');
    console.error('Download from: https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables');
    process.exit(1);
  }

  console.log('Reading:', filePath);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Data_IER_D01'];
  if (!ws) {
    console.error('Sheet "Data_IER_D01" not found. Available:', wb.SheetNames);
    process.exit(1);
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Row 0 = title, Row 1 = headers, Row 2+ = data
  const rows = data.slice(2);
  console.log('Total rows:', rows.length);

  // Filter to small boat arrivals only
  const filtered = rows.filter(r => r[2] === METHOD_FILTER);
  console.log('Small boat rows:', filtered.length);

  // Aggregate: sum across sex/age → one count per nationality + quarter
  const quarterly = new Map();
  let skipped = 0;

  for (const r of filtered) {
    const nationality = r[3];
    const quarterStr = r[1];
    const count = parseInt(r[7]) || 0;

    if (!nationality || !quarterStr || SKIP_NATIONALITIES.has(nationality)) {
      skipped++;
      continue;
    }

    const parsed = parseQuarter(quarterStr);
    if (!parsed) { skipped++; continue; }

    const key = `${nationality}|${parsed.year}|${parsed.quarter}`;
    quarterly.set(key, (quarterly.get(key) || 0) + count);
  }

  console.log('Quarterly aggregates:', quarterly.size);
  console.log('Skipped rows:', skipped);

  // Build new dataset
  const newData = new Map();
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [nationality, year, quarter] = key.split('|');
    newData.set(key, {
      route: ROUTE_NAME,
      border_location: BORDER_LOCATION,
      nationality_long: nationality,
      year,
      quarter,
      count,
    });
  }

  console.log('New data rows:', newData.size);

  // Fetch existing English Channel rows and diff
  const existingRows = await db('ibc_crossings').where('route', ROUTE_NAME).select('*');
  const existingMap = new Map();
  for (const row of existingRows) {
    const key = `${row.nationality_long}|${row.year}|${row.quarter}`;
    existingMap.set(key, row);
  }

  const toInsert = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const [key, newRow] of newData) {
    const existing = existingMap.get(key);
    if (!existing) {
      toInsert.push(newRow);
    } else if (existing.count !== newRow.count) {
      toUpdate.push({ pk: existing.pk, count: newRow.count });
    } else {
      unchanged++;
    }
  }

  console.log(`Diff: ${toInsert.length} new, ${toUpdate.length} updated, ${unchanged} unchanged`);

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
    console.log('Done! Inserted:', toInsert.length, 'Updated:', toUpdate.length);
  } else {
    console.log('No changes needed — data is already up to date.');
  }

  // Update country_routes table
  console.log('Updating country_routes...');
  const nationalities = [...new Set([...newData.values()].map(r => r.nationality_long))];
  const existingRoutes = await db('country_routes').select('*');
  const routesByCountry = new Map(existingRoutes.map(r => [r.country, r.routes || []]));

  const routesToUpdate = [];
  const routesToInsert = [];
  for (const nat of nationalities) {
    const routes = routesByCountry.get(nat);
    if (routes) {
      if (!routes.includes(ROUTE_NAME)) {
        routesToUpdate.push({ country: nat, routes: [...routes, ROUTE_NAME] });
      }
    } else {
      routesToInsert.push({ country: nat, routes: [ROUTE_NAME] });
    }
  }
  for (const row of routesToUpdate) {
    await db('country_routes').where('country', row.country).update({ routes: row.routes });
  }
  if (routesToInsert.length) await db('country_routes').insert(routesToInsert);
  console.log('Updated country_routes:', routesToUpdate.length, 'updated,', routesToInsert.length, 'inserted');

  // Summary
  const yearRange = await db('ibc_crossings')
    .where('route', ROUTE_NAME)
    .min('year as min_year')
    .max('year as max_year');
  const totalCount = await db('ibc_crossings')
    .where('route', ROUTE_NAME)
    .sum('count as total');
  console.log('English Channel year range:', yearRange[0].min_year, '-', yearRange[0].max_year);
  console.log('English Channel total crossings:', totalCount[0].total);

  await db.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Verify dry run**

Run: `node scripts/ingestUKChannel.js`

Expected: Usage message with download URL, exit code 1.

- [ ] **Step 3: Commit**

```bash
git add scripts/ingestUKChannel.js
git commit -m "feat: add UK Home Office small boat crossing ingestion script"
```

---

## Task 2: Run initial ingestion

- [ ] **Step 1: Run the ingestion**

The XLSX is already downloaded at `tmp/uk-ier-dec-2025.xlsx`.

Run: `node scripts/ingestUKChannel.js tmp/uk-ier-dec-2025.xlsx`

Expected output:
```
Small boat rows: ~4710
Quarterly aggregates: ~1100
Diff: ~1100 new, 0 updated, 0 unchanged
Done! Inserted: ~1100 Updated: 0
English Channel year range: 2018 - 2025
English Channel total crossings: ~XXXXX
```

- [ ] **Step 2: Verify idempotent re-run**

Run the same command again. Expected:
```
Diff: 0 new, 0 updated, ~1100 unchanged
No changes needed — data is already up to date.
```

- [ ] **Step 3: Verify in browser**

Navigate to `localhost:3000/route/EnglishChannel` → IBC tab should show:
- Country cards for Afghanistan, Albania, Iran, Iraq, Syria, etc.
- Sparkline charts from 2018 onwards
- Border location showing "Sea"

- [ ] **Step 4: Commit**

```bash
git commit -m "data: ingest UK small boat crossing data for English Channel route"
```

---

## Task 3: Update crossing count and Data Sources links

**Files:**
- Modify: `src/data/IBC_crossingCountByCountry.json`
- Modify: `src/components/about/config/accordionsConfig.jsx`
- Modify: `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx`
- Modify: `src/components/RefugeeRoute_textArea_content_basicInfo.jsx`

- [ ] **Step 1: Get actual total from database**

Run: `node -e "require('dotenv').config(); const db = require('knex')(require('./db/knexfile.js').production || require('./db/knexfile.js').development); db('ibc_crossings').where('route','English Channel').sum('count as total').then(r => { console.log(r[0].total); db.destroy(); })"`

- [ ] **Step 2: Update English Channel total_cross in JSON**

In `src/data/IBC_crossingCountByCountry.json`, update the English Channel `total_cross` from `253` to the actual total.

- [ ] **Step 3: Add UK Home Office to About page data sources**

Add after the CBP entry in `accordionsConfig.jsx`:

```jsx
{
  children: (
    <>
      &#8226;
      &nbsp;
      <em>
        <a target="_blank" rel="noopener noreferrer" href='https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables'>UK Home Office</a>
      </em>
      &nbsp;
      publishes quarterly statistics on irregular entry routes to the UK. Refugee Flow uses small boat arrival data for the English Channel route, aggregated by nationality. Data covers 2018 Q1 to present.
    </>
  ),
},
```

- [ ] **Step 4: Update Data Sources links for English Channel**

In `RefugeeRoute_textArea_content_ibcCountry.jsx`, update the data source onClick:
```javascript
// Change from:
this.currentRouteName === 'Americas' ? 'https://www.cbp.gov/...' : 'https://frontex.europa.eu/...'
// To:
this.currentRouteName === 'Americas' ? 'https://www.cbp.gov/newsroom/stats/nationwide-encounters'
  : this.currentRouteName === 'English Channel' ? 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables'
  : 'https://frontex.europa.eu/along-eu-borders/migratory-map/'
```

Apply the same pattern in `RefugeeRoute_textArea_content_basicInfo.jsx` for the Current Situation data source.

- [ ] **Step 5: Commit**

```bash
git add src/data/IBC_crossingCountByCountry.json src/components/about/config/accordionsConfig.jsx src/components/RefugeeRoute_textArea_content_ibcCountry.jsx src/components/RefugeeRoute_textArea_content_basicInfo.jsx
git commit -m "feat: add UK Home Office data source links for English Channel route"
```

---

## Task 4: Create quarterly auto-update script

**Files:**
- Create: `scripts/updateUKChannel.js`

- [ ] **Step 1: Create the update script**

```javascript
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
      headers: { 'User-Agent': 'Mozilla/5.0' },
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
      headers: { 'User-Agent': 'Mozilla/5.0' },
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
```

- [ ] **Step 2: Test the script**

Run: `node scripts/updateUKChannel.js`

Should scrape the GOV.UK page, find the XLSX link, download, and ingest (likely showing "no changes" since we already ingested).

- [ ] **Step 3: Commit**

```bash
git add scripts/updateUKChannel.js
git commit -m "feat: add quarterly UK Channel auto-update script"
```

---

## Task 5: Write tests

**Files:**
- Create: `tests/server/ukChannelIngestion.test.js`

- [ ] **Step 1: Write tests for quarter parsing and data filtering logic**

Test:
- `parseQuarter("2023 Q3")` → `{ year: "2023", quarter: "q3" }`
- `parseQuarter("2018 Q1")` → `{ year: "2018", quarter: "q1" }`
- `parseQuarter("invalid")` → `null`
- Skip nationalities list contains expected entries
- Script exits with usage when no args

- [ ] **Step 2: Run tests**

Run: `npx jest tests/server/ukChannelIngestion.test.js`

- [ ] **Step 3: Commit**

```bash
git add tests/server/ukChannelIngestion.test.js
git commit -m "test: add UK Channel ingestion tests"
```

---

## Task 6: Verify end-to-end

- [ ] **Step 1: Build the project**

Run: `npx vite build`

- [ ] **Step 2: Verify English Channel route page**

Navigate to `localhost:3000/route/EnglishChannel`:
- Basic Info tab: existing death/missing data
- IBC tab: small boat crossing data by nationality with sparkline charts from 2018
- Data Sources button → opens UK Home Office page

- [ ] **Step 3: Verify About page**

Navigate to `localhost:3000/about` → Data Sources. UK Home Office entry should be present.

- [ ] **Step 4: Run all tests**

Run: `npx jest tests/server/`

All tests should pass.

- [ ] **Step 5: Final commit if needed**

Stage only specific changed files.
