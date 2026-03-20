# CBP Border Crossing Data Ingestion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest U.S. CBP (Customs and Border Protection) encounter data into the existing `ibc_crossings` table so the Americas route displays border crossing data identically to how European routes display Frontex IBC data.

**Architecture:** Download CBP CSV data, normalize nationalities and convert fiscal year months to calendar year quarters, filter to Title 8 USBP apprehensions only, insert into existing `ibc_crossings` table with `route = "Americas"`, update `country_routes` table, and add CBP to the About page data sources.

**Tech Stack:** Node.js, csv-parse, knex (PostgreSQL), existing IBC frontend components (no frontend changes needed)

---

## Context

### What CBP data looks like (CSV columns)
```
Fiscal Year, Month Grouping, Month (abbv), Component, Land Border Region,
Area of Responsibility, AOR (Abbv), Demographic, Citizenship,
Title of Authority, Encounter Type, Encounter Count
```

### What we need to produce (ibc_crossings table rows)
```
route: "Americas"
border_location: "Southwest Land Border" | "Northern Land Border"
nationality_long: "Mexico" (title case)
year: "2020" (calendar year, not fiscal year)
quarter: "q1" (calendar quarter)
count: 12345 (summed from monthly encounters)
```

### Key normalizations
1. **Fiscal year → calendar year:** CBP FY2024 OCT = October 2023 (calendar). For months Oct/Nov/Dec, subtract 1 from fiscal year.
2. **Nationality casing:** CBP uses "MEXICO" → we need "Mexico". Special cases: "EL SALVADOR" → "El Salvador", "MYANMAR (BURMA)" → "Myanmar".
3. **Filter:** Only `Component = "U.S. Border Patrol"` AND `Title of Authority = "Title 8"` (USBP apprehensions = closest equivalent to Frontex IBC detections).
4. **Aggregate:** Sum encounter counts by route + nationality + calendar year + calendar quarter. Discard sector/AOR detail.

### Data gap
CBP CSV data covers FY2020-FY2026 (Oct 2019 - present). Pre-2020 data is PDF-only and not included. This will be noted in the About page data sources section.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/ingestCBP.js` | Create | CBP CSV ingestion script |
| `scripts/nationality-map.js` | Create | Shared nationality normalization map (CBP uppercase → title case) |
| `scripts/updateCBP.js` | Create | Automated monthly download + ingestion script (for cron) |
| `scripts/ingestFrontexIBC.js` | Modify (line 109) | Scope DELETE to non-Americas routes to prevent data loss |
| `src/components/about/config/accordionsConfig.jsx` | Modify | Add CBP data source entry |
| `src/data/IBC_crossingCountByCountry.json` | Modify | Update Americas total_cross after ingestion |

No database migration needed — reuses existing `ibc_crossings` table.
No frontend component changes needed — Americas IBC tab will auto-populate.
No API changes needed — `findRouteIbc()` already returns all routes from `ibc_crossings`.

---

## Task 1: Create nationality normalization map

**Files:**
- Create: `scripts/nationality-map.js`

- [ ] **Step 1: Create the nationality map file**

This maps CBP uppercase nationality names to the title-case format used in the IBC table. Also handles special cases and reconciles naming differences.

```javascript
/**
 * Maps CBP uppercase nationality names to title-case display names
 * matching the format used in ibc_crossings / Frontex IBC data.
 */
const CBP_NATIONALITY_MAP = {
  'MEXICO': 'Mexico',
  'GUATEMALA': 'Guatemala',
  'HONDURAS': 'Honduras',
  'EL SALVADOR': 'El Salvador',
  'COLOMBIA': 'Colombia',
  'VENEZUELA': 'Venezuela',
  'CUBA': 'Cuba',
  'HAITI': 'Haiti',
  'ECUADOR': 'Ecuador',
  'NICARAGUA': 'Nicaragua',
  'BRAZIL': 'Brazil',
  'INDIA': 'India',
  'CHINA': 'China',
  'TURKEY': 'Türkiye',
  'ROMANIA': 'Romania',
  'RUSSIA': 'Russia',
  'UKRAINE': 'Ukraine',
  'MYANMAR (BURMA)': 'Myanmar',
  'PERU': 'Peru',
  'PHILIPPINES': 'Philippines',
  'CANADA': 'Canada',
  'DOMINICAN REPUBLIC': 'Dominican Republic',
  'COSTA RICA': 'Costa Rica',
  'DEMOCRATIC REPUBLIC OF THE CONGO': 'Democratic Republic of the Congo',
  'SIERRA LEONE': 'Sierra Leone',
  'BURKINA FASO': 'Burkina Faso',
  'SOUTH KOREA': 'South Korea',
  'OTHER': 'Other',
};

/**
 * Normalize a CBP nationality string.
 * Falls back to title-casing each word if not in the explicit map.
 */
function normalizeCbpNationality(raw) {
  if (!raw) return 'Unknown';
  const upper = raw.trim().toUpperCase();
  if (CBP_NATIONALITY_MAP[upper]) return CBP_NATIONALITY_MAP[upper];
  // Fallback: title case each word
  return upper.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

module.exports = { CBP_NATIONALITY_MAP, normalizeCbpNationality };
```

- [ ] **Step 2: Verify file is valid**

Run: `node -e "const m = require('./scripts/nationality-map.js'); console.log(m.normalizeCbpNationality('EL SALVADOR'), m.normalizeCbpNationality('MYANMAR (BURMA)'))"`

Expected: `El Salvador Myanmar`

- [ ] **Step 3: Commit**

```bash
git add scripts/nationality-map.js
git commit -m "feat: add CBP nationality normalization map"
```

---

## Task 2: Create CBP ingestion script

**Files:**
- Create: `scripts/ingestCBP.js`

- [ ] **Step 1: Install csv-parse dependency**

Run: `npm install csv-parse`

The CBP data is CSV (unlike Frontex which is XLSX). `csv-parse` is a lightweight, standard CSV parser.

- [ ] **Step 2: Create the ingestion script**

```javascript
#!/usr/bin/env node
/**
 * Ingest U.S. CBP (Customs and Border Protection) encounter data from CSV.
 * Download from: https://www.cbp.gov/document/stats/nationwide-encounters
 *
 * Filters to USBP Title 8 apprehensions only (equivalent to Frontex IBC).
 * Converts fiscal year months to calendar year quarters.
 * Inserts into ibc_crossings table with route = "Americas".
 *
 * Usage: node scripts/ingestCBP.js [path-to-csv]
 *
 * NOTE: This script ONLY touches Americas route data in ibc_crossings.
 *       Frontex IBC data for other routes is left untouched.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const knex = require('knex');
const config = require('../db/knexfile.js');
const { normalizeCbpNationality } = require('./nationality-map.js');

const db = knex(config.production || config.development || config);

const ROUTE_NAME = 'Americas';

// Calendar quarter from month abbreviation
const QUARTER_MAP = {
  JAN: 'q1', FEB: 'q1', MAR: 'q1',
  APR: 'q2', MAY: 'q2', JUN: 'q2',
  JUL: 'q3', AUG: 'q3', SEP: 'q3',
  OCT: 'q4', NOV: 'q4', DEC: 'q4',
};

/**
 * Convert CBP fiscal year + month to calendar year.
 * US fiscal year starts October: FY2024 OCT = October 2023.
 * Oct/Nov/Dec belong to the previous calendar year.
 */
function toCalendarYear(fiscalYear, monthAbbr) {
  const fy = parseInt(fiscalYear);
  if (['OCT', 'NOV', 'DEC'].includes(monthAbbr)) {
    return String(fy - 1);
  }
  return String(fy);
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/ingestCBP.js <path-to-csv>');
    console.error('Download CSV from: https://www.cbp.gov/document/stats/nationwide-encounters');
    process.exit(1);
  }

  console.log('Reading:', filePath);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log('Total CSV rows:', records.length);

  // Filter: USBP + Title 8 only (equivalent to Frontex IBC detections)
  const filtered = records.filter(r =>
    r['Component'] === 'U.S. Border Patrol' &&
    r['Title of Authority'] === 'Title 8'
  );
  console.log('After USBP/Title 8 filter:', filtered.length, 'rows');

  // Aggregate: monthly → quarterly by border_location + nationality + calendar year + quarter
  // Key: borderLocation|nationality|calYear|quarter → sum
  const quarterly = new Map();
  let skipped = 0;

  for (const r of filtered) {
    const monthAbbr = (r['Month (abbv)'] || '').toUpperCase().trim();
    const fiscalYear = (r['Fiscal Year'] || '').replace('FYTD', '').trim();
    const count = parseInt(r['Encounter Count']) || 0;
    const nationality = r['Citizenship'];
    const borderRegion = r['Land Border Region'] || 'Other';

    if (!monthAbbr || !fiscalYear || !QUARTER_MAP[monthAbbr]) {
      skipped++;
      continue;
    }

    const calYear = toCalendarYear(fiscalYear, monthAbbr);
    const quarter = QUARTER_MAP[monthAbbr];
    const normNationality = normalizeCbpNationality(nationality);

    // Use border region as border_location (Southwest Land Border / Northern Land Border)
    const key = `${borderRegion}|${normNationality}|${calYear}|${quarter}`;
    quarterly.set(key, (quarterly.get(key) || 0) + count);
  }

  console.log('Quarterly aggregates:', quarterly.size);
  console.log('Skipped rows:', skipped);

  // Build new dataset as a map keyed by unique composite key
  const newData = new Map();
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [borderLocation, nationality, year, quarter] = key.split('|');
    const upsertKey = `${borderLocation}|${nationality}|${year}|${quarter}`;
    newData.set(upsertKey, {
      route: ROUTE_NAME,
      border_location: borderLocation,
      nationality_long: nationality,
      year,
      quarter,
      count,
    });
  }

  console.log('New data rows:', newData.size);

  // Fetch existing Americas rows and diff against new data
  const existingRows = await db('ibc_crossings').where('route', ROUTE_NAME).select('*');
  const existingMap = new Map();
  for (const row of existingRows) {
    const key = `${row.border_location}|${row.nationality_long}|${row.year}|${row.quarter}`;
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

  // Apply changes in a transaction
  if (toInsert.length > 0 || toUpdate.length > 0) {
    await db.transaction(async trx => {
      // Batch insert new rows
      const BATCH_SIZE = 500;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        await trx('ibc_crossings').insert(toInsert.slice(i, i + BATCH_SIZE));
      }
      // Update changed rows
      for (const row of toUpdate) {
        await trx('ibc_crossings').where('pk', row.pk).update({ count: row.count });
      }
    });
    console.log('Done! Inserted:', toInsert.length, 'Updated:', toUpdate.length);
  } else {
    console.log('No changes needed — data is already up to date.');
  }

  // Update country_routes table — add Americas to each nationality's route list
  console.log('Updating country_routes...');
  const nationalities = [...new Set([...newData.values()].map(r => r.nationality_long))];
  const existingRoutes = await db('country_routes').select('*');
  const routesByCountry = new Map(existingRoutes.map(r => [r.country, r.routes || []]));

  const toUpdate = [];
  const toInsert = [];
  for (const nat of nationalities) {
    const routes = routesByCountry.get(nat);
    if (routes) {
      if (!routes.includes(ROUTE_NAME)) {
        toUpdate.push({ country: nat, routes: [...routes, ROUTE_NAME] });
      }
    } else {
      toInsert.push({ country: nat, routes: [ROUTE_NAME] });
    }
  }
  for (const row of toUpdate) {
    await db('country_routes').where('country', row.country).update({ routes: row.routes });
  }
  if (toInsert.length) await db('country_routes').insert(toInsert);
  console.log('Updated country_routes:', toUpdate.length, 'updated,', toInsert.length, 'inserted');

  // Print summary
  const yearRange = await db('ibc_crossings')
    .where('route', ROUTE_NAME)
    .min('year as min_year')
    .max('year as max_year');
  const totalCount = await db('ibc_crossings')
    .where('route', ROUTE_NAME)
    .sum('count as total');
  console.log('Americas year range:', yearRange[0].min_year, '-', yearRange[0].max_year);
  console.log('Americas total crossings:', totalCount[0].total);

  await db.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Verify script parses correctly (dry run)**

Run: `node scripts/ingestCBP.js` (no args)

Expected: Usage message with download URL, exit code 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingestCBP.js package.json package-lock.json
git commit -m "feat: add CBP border crossing ingestion script"
```

---

## Task 3: Download CBP data and run ingestion

- [ ] **Step 1: Download the CBP CSV**

Go to https://www.cbp.gov/document/stats/nationwide-encounters and download the latest "Nationwide Encounters" AOR CSV file (FY20-FY26 or similar).

Save to a convenient location (e.g., `~/Downloads/`).

- [ ] **Step 2: Run the ingestion script**

Run: `node scripts/ingestCBP.js ~/Downloads/<filename>.csv`

Expected output (first run):
```
Reading: ~/Downloads/<filename>.csv
Total CSV rows: ~46000
After USBP/Title 8 filter: ~XXXX rows
Quarterly aggregates: ~XXX
New data rows: ~XXX
Diff: ~XXX new, 0 updated, 0 unchanged
Done! Inserted: ~XXX Updated: 0
Updated country_routes: ~XX updated, ~XX inserted
Americas year range: 2019 - 2025
Americas total crossings: ~XXXXXXX
```

On subsequent runs with the same CSV, expect:
```
Diff: 0 new, 0 updated, ~XXX unchanged
No changes needed — data is already up to date.
```

- [ ] **Step 3: Verify in browser**

Navigate to `localhost:3000/route/Americas` and click the IBC tab. Should show:
- Country cards for Mexico, Guatemala, Honduras, El Salvador, etc.
- Sparkline charts with quarterly data from 2019/2020 onwards
- Border location showing "Southwest Land Border" or "Northern Land Border"
- Total crossing counts per nationality

- [ ] **Step 4: Commit**

```bash
git commit -m "data: ingest CBP border crossing data for Americas route"
```

(No files to commit unless the script needed tweaks during the run.)

---

## Task 4: Update IBC crossing count for Americas

**Files:**
- Modify: `src/data/IBC_crossingCountByCountry.json` (line 46)

After ingestion, the Americas `total_cross` in the JSON file should be updated to reflect the actual CBP crossing total.

- [ ] **Step 1: Get the actual total from the database**

Run: `node -e "require('dotenv').config(); const db = require('knex')(require('./db/knexfile.js').production || require('./db/knexfile.js').development); db('ibc_crossings').where('route','Americas').sum('count as total').then(r => { console.log(r[0].total); db.destroy(); })"`

Note the number output.

- [ ] **Step 2: Update the JSON file**

In `src/data/IBC_crossingCountByCountry.json`, change the Americas `total_cross` value from `8058` to the actual total from step 1.

- [ ] **Step 3: Commit**

```bash
git add src/data/IBC_crossingCountByCountry.json
git commit -m "data: update Americas total_cross with CBP encounter total"
```

---

## Task 5: Add CBP to About page data sources

**Files:**
- Modify: `src/components/about/config/accordionsConfig.jsx` (Data Sources section, after Frontex entry)

- [ ] **Step 1: Add CBP data source entry**

Add this entry after the Frontex entry (around line 200) in the `Data Sources` accordion contents array:

```jsx
{
  children: (
    <>
      &#8226;
      &nbsp;
      <em>
        <a target="_blank" rel="noopener noreferrer" href='https://www.cbp.gov/newsroom/stats/nationwide-encounters'>U.S. Customs and Border Protection</a>
      </em>
      &nbsp;
      (CBP) publishes monthly encounter statistics for U.S. land borders. Refugee Flow uses Title 8 U.S. Border Patrol apprehension data for the Americas route, aggregated quarterly by nationality. CBP data covers FY2020 (October 2019) to present. Pre-2020 data is not available in machine-readable format.
    </>
  ),
},
```

- [ ] **Step 2: Verify in browser**

Navigate to `localhost:3000/about`, expand Data Sources, verify CBP entry appears with correct link and description.

- [ ] **Step 3: Commit**

```bash
git add src/components/about/config/accordionsConfig.jsx
git commit -m "docs: add CBP data source to About page with coverage note"
```

---

## Task 6: Convert Frontex ingestion to diff-based upsert

**Files:**
- Modify: `scripts/ingestFrontexIBC.js`

The existing Frontex script does a full table wipe and reinsert (~13.8K rows) every run. This has two problems:
1. After CBP data exists in the same table, it would destroy Americas data
2. It's wasteful — most monthly updates only add ~100 new rows

Convert to the same diff-based strategy as the CBP script.

- [ ] **Step 1: Rewrite the insert section of ingestFrontexIBC.js**

Replace everything from `// Clear existing data and insert fresh` (line 107) through `console.log('Done! Total inserted:', inserted);` (line 121) with:

```javascript
  // Diff against existing Frontex data (exclude Americas/CBP data)
  const existingRows = await db('ibc_crossings').whereNot('route', 'Americas').select('*');
  const existingMap = new Map();
  for (const row of existingRows) {
    const key = `${row.route}|${row.nationality_long}|${row.year}|${row.quarter}`;
    existingMap.set(key, row);
  }

  const toInsert = [];
  const toUpdate = [];
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
    // Remove from existingMap to track stale rows
    existingMap.delete(key);
  }

  // Rows in DB but not in new data = stale, remove them
  const staleKeys = [...existingMap.values()].map(r => r.pk);

  console.log(`Diff: ${toInsert.length} new, ${toUpdate.length} updated, ${unchanged} unchanged, ${staleKeys.length} stale`);

  if (toInsert.length > 0 || toUpdate.length > 0 || staleKeys.length > 0) {
    await db.transaction(async trx => {
      const BATCH_SIZE = 500;
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
    console.log('Done! Inserted:', toInsert.length, 'Updated:', toUpdate.length, 'Removed stale:', staleKeys.length);
  } else {
    console.log('No changes needed — data is already up to date.');
  }
```

- [ ] **Step 2: Verify Frontex script works with diff approach**

Run: `node scripts/ingestFrontexIBC.js` (with the original Frontex XLSX file)

First run after conversion should show all rows as "new" (since we haven't changed the data). Second run with the same file should show:
```
Diff: 0 new, 0 updated, ~13800 unchanged, 0 stale
No changes needed — data is already up to date.
```

- [ ] **Step 3: Verify Americas data is preserved**

```
node -e "require('dotenv').config(); const db = require('knex')(require('./db/knexfile.js').production || require('./db/knexfile.js').development); db('ibc_crossings').where('route','Americas').count('* as cnt').then(r => { console.log('Americas rows:', r[0].cnt); db.destroy(); })"
```

Expected: Americas rows count > 0 (CBP data preserved).

- [ ] **Step 4: Commit**

```bash
git add scripts/ingestFrontexIBC.js
git commit -m "refactor: convert Frontex IBC ingestion to diff-based upsert

Replaces full delete+reinsert with diff strategy: only insert new rows,
update changed counts, remove stale rows. Preserves Americas/CBP data
by scoping queries to non-Americas routes."
```

---

## Task 7: Create automated monthly CBP update script

**Files:**
- Create: `scripts/updateCBP.js`

This script attempts to download the latest CBP CSV by constructing the expected URL based on the current date, then runs ingestion. Designed to be called by cron monthly. Fails loudly if the URL pattern has changed.

- [ ] **Step 1: Create the update script**

```javascript
#!/usr/bin/env node
/**
 * Automated CBP data update.
 * Constructs the expected CSV URL based on current date, downloads it,
 * and runs ingestion.
 *
 * CBP publishes data ~2 months behind. URL pattern:
 * https://www.cbp.gov/sites/default/files/assets/documents/2025-Mar/
 *   nationwide-encounters-fy23-fy26-jan-aor.csv
 *
 * Run via cron: 0 0 15 * * node /path/to/scripts/updateCBP.js
 * (15th of each month to account for CBP's ~2 month publishing lag)
 *
 * Exit codes:
 *   0 = success
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

/**
 * CBP data lags ~2 months. Figure out which month's data to expect.
 * Also determine the fiscal year range for the filename.
 */
function getExpectedFileParams() {
  const now = new Date();
  // Data month is ~2 months behind
  const dataDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const dataMonth = MONTH_ABBRS[dataDate.getMonth()];

  // Fiscal year: Oct starts new FY. Current FY = year if month >= Oct, else year
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  // CBP typically spans 4 fiscal years in the filename
  const startFY = currentFY - 3;

  return { dataMonth, startFY, endFY: currentFY };
}

/**
 * Try multiple URL patterns that CBP has used.
 * Returns the first one that successfully downloads.
 */
function buildCandidateUrls({ dataMonth, startFY, endFY }) {
  const fy = (y) => String(y).slice(2); // 2026 -> "26"

  // CBP URL structure has changed over time. Try likely patterns:
  // Pattern: /document/stats/nationwide-encounters-fy{start}-fy{end}-td
  // Direct CSV: /sites/default/files/.../nationwide-encounters-fy{start}-fy{end}-{month}-aor.csv
  return [
    `https://www.cbp.gov/sites/default/files/assets/documents/${new Date().getFullYear()}-${capitalize(MONTH_ABBRS[new Date().getMonth()])}/nationwide-encounters-fy${fy(startFY)}-fy${fy(endFY)}-${dataMonth}-aor.csv`,
    `https://www.cbp.gov/sites/default/files/assets/documents/${new Date().getFullYear()}-${capitalize(MONTH_ABBRS[new Date().getMonth() - 1])}/nationwide-encounters-fy${fy(startFY)}-fy${fy(endFY)}-${dataMonth}-aor.csv`,
  ];
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('csv') && !contentType.includes('octet-stream') && !contentType.includes('text')) {
        return reject(new Error(`Unexpected content-type: ${contentType} for ${url}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  const params = getExpectedFileParams();
  console.log(`Looking for CBP data: month=${params.dataMonth}, FY${params.startFY}-FY${params.endFY}`);

  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const csvPath = path.join(DOWNLOAD_DIR, `cbp-latest.csv`);
  const urls = buildCandidateUrls(params);

  let downloaded = false;
  for (const url of urls) {
    try {
      console.log('Trying:', url);
      await downloadFile(url, csvPath);
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
  fs.unlinkSync(csvPath);
}

run();
```

- [ ] **Step 2: Add tmp/ to .gitignore if not already there**

Run: `grep -q '^tmp/' .gitignore || echo 'tmp/' >> .gitignore`

- [ ] **Step 3: Test the script**

Run: `node scripts/updateCBP.js`

If CBP's current URL pattern matches, it should download and ingest automatically. If not, it will print an error with manual instructions — which is the correct failure mode.

- [ ] **Step 4: Commit**

```bash
git add scripts/updateCBP.js .gitignore
git commit -m "feat: add automated monthly CBP data update script"
```

- [ ] **Step 5: Document the cron setup**

To run monthly on the 15th (accounting for CBP's ~2 month lag):

```bash
# Add to crontab (crontab -e):
0 0 15 * * cd /path/to/refugee-flow && node scripts/updateCBP.js >> logs/cbp-update.log 2>&1
```

Or if deploying on a server, add to the deployment's scheduled tasks.

---

## Task 8: Verify end-to-end

- [ ] **Step 1: Build the project**

Run: `npx vite build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify Americas route page**

Navigate to `localhost:3000/route/Americas`:
- Basic Info tab: death/missing data (existing, should still work)
- IBC tab: CBP encounter data by nationality with sparkline charts
- Map: death markers (existing, should still work)

- [ ] **Step 3: Verify globe route filter**

On the globe page, click ROUTE icon → Americas → Click for more. Should navigate to Americas route page.

- [ ] **Step 4: Verify About page**

Navigate to `localhost:3000/about` → Data Sources. CBP entry should be present with pre-2020 gap note.

- [ ] **Step 5: Final commit (only if tweaks were needed)**

Stage only specific changed files — do not use `git add -A` to avoid staging downloaded CSVs or unrelated files.
