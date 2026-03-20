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
