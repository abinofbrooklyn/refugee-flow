#!/usr/bin/env node
/**
 * Ingest U.S. CBP (Customs and Border Protection) encounter data from CSV.
 * Download from: https://www.cbp.gov/document/stats/nationwide-encounters
 *
 * Filters to USBP Title 8 apprehensions only (equivalent to Frontex IBC).
 * Converts fiscal year months to calendar year quarters.
 * Diff-based upsert into ibc_crossings table with route = "Americas".
 *
 * Usage: node scripts/ingestCBP.js <path-to-csv>
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

  // Filter: USBP + Title 8 + land borders only (equivalent to Frontex IBC detections)
  // Exclude "Other" (air/sea/interior) — not border crossings
  const filtered = records.filter(r =>
    r['Component'] === 'U.S. Border Patrol' &&
    r['Title of Authority'] === 'Title 8' &&
    r['Land Border Region'] !== 'Other'
  );
  console.log('After USBP/Title 8 filter:', filtered.length, 'rows');

  // Aggregate: monthly → quarterly by border_location + nationality + calendar year + quarter
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
    existingMap.delete(key);
  }

  // Rows in DB but not in new data = stale, remove them
  const staleKeys = [...existingMap.values()].map(r => r.pk);

  console.log(`Diff: ${toInsert.length} new, ${toUpdate.length} updated, ${unchanged} unchanged, ${staleKeys.length} stale`);

  // Apply changes in a transaction
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

  // Update country_routes table — add Americas to each nationality's route list
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
