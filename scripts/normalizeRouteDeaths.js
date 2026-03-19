// scripts/normalizeRouteDeaths.js
// One-time script to normalize existing route_deaths data in-place.
// Run: node scripts/normalizeRouteDeaths.js
//
// After running, the database contains clean normalized route values.

require('dotenv').config();
const db = require('../server/database/connection');
const { normalizeRow, deduplicateRows } = require('../server/ingestion/iomNormalizer');

const BATCH_SIZE = 500;

async function run() {
  console.log('Loading all route_deaths rows...');
  const rows = await db('route_deaths').select('*');
  console.log(`Found ${rows.length} rows`);

  // Normalize all rows
  const pairs = rows.map(r => {
    const norm = normalizeRow(r);
    const { _wasFallback, _rawRoute, ...clean } = norm;
    return { original: r, cleaned: clean };
  });

  // Collect rows that need updating
  const toUpdate = pairs.filter(({ original, cleaned }) =>
    cleaned.route !== original.route ||
    cleaned.lat !== original.lat ||
    cleaned.lng !== original.lng ||
    cleaned.route_display_text !== original.route_display_text
  );

  console.log(`${toUpdate.length} of ${rows.length} rows need updating`);

  // Batch update using raw SQL with CASE statements for efficiency
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const ids = batch.map(b => b.original.id);

    // Build a values list for bulk update via UPDATE ... FROM (VALUES ...)
    const values = batch.map(({ original, cleaned }) => {
      const route = (cleaned.route || '').replace(/'/g, "''");
      const lat = cleaned.lat === null ? 'NULL' : cleaned.lat;
      const lng = cleaned.lng === null ? 'NULL' : cleaned.lng;
      const id = original.id.replace(/'/g, "''");
      return `('${id}', '${route}', ${lat}::float8, ${lng}::float8)`;
    }).join(',\n');

    await db.raw(`
      UPDATE route_deaths AS t SET
        route = v.route,
        route_display_text = v.route,
        lat = v.lat,
        lng = v.lng
      FROM (VALUES ${values}) AS v(id, route, lat, lng)
      WHERE t.id = v.id
    `);

    console.log(`  Updated ${Math.min(i + BATCH_SIZE, toUpdate.length)} / ${toUpdate.length}`);
  }
  console.log(`Updated ${toUpdate.length} rows`);

  // Remove duplicates: find rows that deduplicateRows would filter out
  const allNormalized = pairs.map(p => p.cleaned);
  const deduped = deduplicateRows(allNormalized);
  const dedupedIds = new Set(deduped.map(r => r.id));
  const duplicateIds = allNormalized.filter(r => !dedupedIds.has(r.id)).map(r => r.id);

  if (duplicateIds.length > 0) {
    console.log(`Removing ${duplicateIds.length} duplicate rows...`);
    for (let i = 0; i < duplicateIds.length; i += BATCH_SIZE) {
      const batch = duplicateIds.slice(i, i + BATCH_SIZE);
      await db('route_deaths').whereIn('id', batch).del();
    }
    console.log(`Deleted ${duplicateIds.length} duplicates`);
  } else {
    console.log('No duplicates found');
  }

  const finalCount = await db('route_deaths').count('* as count').first();
  console.log(`Final row count: ${finalCount.count}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Normalization failed:', err);
  process.exit(1);
});
