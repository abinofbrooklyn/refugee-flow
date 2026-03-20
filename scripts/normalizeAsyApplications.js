// scripts/normalizeAsyApplications.js
// One-time backfill script for existing asy_applications seed data.
// Run: node scripts/normalizeAsyApplications.js
//
// Phase 1: Normalize country names to canonical forms
// Phase 2: Re-distribute annual-only UNHCR rows into quarterly estimates
//
// Idempotent — safe to run multiple times.

require('dotenv').config();
const db = require('../server/database/connection');
const { normalizeCountryName, EU_DESTINATIONS } = require('../server/ingestion/countryNormalizer');
const { computeSeasonalRatios, distributeByQuarter } = require('../server/ingestion/quarterlyEstimator');

async function run() {
  // Phase 1: Normalize country names in-place
  console.log('Phase 1: Normalizing country names...');
  const rows = await db('asy_applications').select('year', 'quarter', 'origin', 'destination', 'value');
  let nameUpdates = 0;

  for (const row of rows) {
    const normOrigin = normalizeCountryName(row.origin);
    const normDest = normalizeCountryName(row.destination);
    if (normOrigin !== row.origin || normDest !== row.destination) {
      // Check if target row already exists (name normalization could create conflict)
      const existing = await db('asy_applications')
        .where({ year: row.year, quarter: row.quarter, origin: normOrigin, destination: normDest })
        .first();
      if (existing) {
        // Merge: add values, delete old row
        await db('asy_applications')
          .where({ year: row.year, quarter: row.quarter, origin: normOrigin, destination: normDest })
          .update({ value: existing.value + row.value });
        await db('asy_applications')
          .where({ year: row.year, quarter: row.quarter, origin: row.origin, destination: row.destination })
          .del();
      } else {
        // Rename in place
        await db('asy_applications')
          .where({ year: row.year, quarter: row.quarter, origin: row.origin, destination: row.destination })
          .update({ origin: normOrigin, destination: normDest });
      }
      nameUpdates++;
    }
  }
  console.log(`Phase 1: Normalized ${nameUpdates} country names`);

  // Phase 2: Re-distribute annual-only UNHCR rows into quarterly estimates
  console.log('Phase 2: Re-distributing annual-only rows...');

  // Find year/origin/dest combos where only a single row exists
  const combos = await db('asy_applications')
    .select('year', 'origin', 'destination')
    .count('* as cnt')
    .groupBy('year', 'origin', 'destination')
    .having(db.raw('count(*) = 1'));

  // Get seasonal ratios from existing Eurostat data (EU destinations with real quarterly data)
  const eurostatRows = await db('asy_applications')
    .select('origin', 'quarter')
    .sum('value as value')
    .whereIn('destination', Array.from(EU_DESTINATIONS))
    .groupBy('origin', 'quarter');
  const ratios = computeSeasonalRatios(eurostatRows);

  let redistributed = 0;
  for (const combo of combos) {
    const row = await db('asy_applications')
      .where({ year: combo.year, origin: combo.origin, destination: combo.destination, quarter: 'q1' })
      .first();
    if (!row) continue; // Single row is not q1, skip
    if (EU_DESTINATIONS.has(row.destination)) continue; // Skip EU destinations (already quarterly)
    if (row.value === 0) continue;

    const originRatios = ratios[row.origin] || null;
    const quarterly = distributeByQuarter(row.value, originRatios);

    // Update existing q1 row
    await db('asy_applications')
      .where({ year: row.year, quarter: 'q1', origin: row.origin, destination: row.destination })
      .update({ value: quarterly.q1 });

    // Insert q2, q3, q4
    for (const q of ['q2', 'q3', 'q4']) {
      await db('asy_applications').insert({
        record_id: null,
        year: row.year,
        quarter: q,
        origin: row.origin,
        destination: row.destination,
        value: quarterly[q],
      }).onConflict(['year', 'quarter', 'origin', 'destination']).merge();
    }
    redistributed++;
  }
  console.log(`Phase 2: Re-distributed ${redistributed} annual-only rows into quarterly`);

  const finalCount = await db('asy_applications').count('* as count').first();
  console.log(`Final row count: ${finalCount.count}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Normalization failed:', err);
  process.exit(1);
});
