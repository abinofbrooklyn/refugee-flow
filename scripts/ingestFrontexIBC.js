#!/usr/bin/env node
/**
 * Ingest Frontex IBC (Illegal Border Crossing) data from XLSX
 * Download from: https://www.frontex.europa.eu/what-we-do/monitoring-and-risk-analysis/migratory-map/
 *
 * Converts monthly data to quarterly aggregates and upserts into ibc_crossings table.
 */
require('dotenv').config();
const XLSX = require('xlsx');
const path = require('path');
const knex = require('knex');
const config = require('../db/knexfile.js');

const db = knex(config.production || config.development || config);

// Map XLSX route names to the route names used in the DB/app
const ROUTE_NAME_MAP = {
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

// Month abbreviations in the XLSX headers
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const QUARTER_MAP = {
  JAN: 'q1', FEB: 'q1', MAR: 'q1',
  APR: 'q2', MAY: 'q2', JUN: 'q2',
  JUL: 'q3', AUG: 'q3', SEP: 'q3',
  OCT: 'q4', NOV: 'q4', DEC: 'q4',
};

async function run() {
  const filePath = process.argv[2] || '/Users/abinabraham/Downloads/Monthly_detections_of_IBC_2026_03_03.xlsx';

  console.log('Reading:', filePath);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Detections_of_IBC'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = data[1]; // Row 1 has headers
  const rows = data.slice(2); // Data starts at row 2

  // Parse column headers to get month/year info
  // Format: "JAN2009", "FEB2009", etc. (columns 3+)
  const colInfo = [];
  for (let c = 3; c < headers.length; c++) {
    const h = headers[c];
    if (!h) continue;
    const month = h.slice(0, 3).toUpperCase();
    const year = h.slice(3);
    const quarter = QUARTER_MAP[month];
    if (!quarter || !year) continue;
    colInfo.push({ col: c, month, year, quarter });
  }

  console.log('Columns span:', colInfo[0].month + colInfo[0].year, 'to', colInfo[colInfo.length-1].month + colInfo[colInfo.length-1].year);

  // Aggregate monthly → quarterly by route + nationality
  // Key: route|nationality|year|quarter → sum of counts
  const quarterly = new Map();

  let skipped = 0;
  for (const row of rows) {
    const routeRaw = row[0];
    const borderType = row[1];
    const nationality = row[2];

    if (!routeRaw || !nationality) { skipped++; continue; }

    const route = ROUTE_NAME_MAP[routeRaw] || routeRaw;

    for (const ci of colInfo) {
      const val = row[ci.col];
      if (!val || val === 0) continue;

      const key = `${route}|${nationality}|${ci.year}|${ci.quarter}`;
      quarterly.set(key, (quarterly.get(key) || 0) + (typeof val === 'number' ? val : parseInt(val) || 0));
    }
  }

  console.log('Quarterly aggregates:', quarterly.size);
  console.log('Skipped rows:', skipped);

  // Build upsert rows
  const upsertRows = [];
  for (const [key, count] of quarterly) {
    if (count === 0) continue;
    const [route, nationality, year, quarter] = key.split('|');
    upsertRows.push({
      route,
      border_location: 'Land/Sea', // aggregated
      nationality_long: nationality,
      year,
      quarter,
      count,
    });
  }

  console.log('Rows to upsert:', upsertRows.length);

  // Diff against existing Frontex data (exclude Americas/CBP data)
  console.log('Diffing against existing data...');
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

  // Verify
  const yearRange = await db('ibc_crossings').whereNot('route', 'Americas').min('year as min_year').max('year as max_year');
  console.log('Frontex year range:', yearRange[0].min_year, '-', yearRange[0].max_year);
  console.log('Routes in DB:', (await db('ibc_crossings').distinct('route')).map(r => r.route));

  await db.destroy();
}

run().catch(e => { console.error(e); process.exit(1); });
