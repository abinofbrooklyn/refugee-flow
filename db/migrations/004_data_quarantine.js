/**
 * Migration 004: Data quarantine table + ingestion_log quarantine_count column
 *
 * Creates:
 *   - data_quarantine table for storing rows that fail validation
 *   - Index on (source, status) for efficient suppression lookups
 *   - quarantine_count column on ingestion_log for tracking per-run quarantine totals
 *   - Seeds known-bad IOM records as pre-accepted quarantine entries
 *
 * The 15+ known unfixable IOM records (source data errors: Iran coords labeled
 * Hungary, Libya coords labeled India, etc.) are seeded as status='accepted' so
 * they never re-trigger quarantine alerts on future IOM ingestion runs.
 */

exports.up = async (knex) => {
  // 1. Create the data_quarantine table
  await knex.schema.createTable('data_quarantine', (t) => {
    t.increments('id').primary();
    t.text('source').notNullable();
    t.specificType('raw_data', 'jsonb').notNullable();
    t.text('rule_violated').notNullable();
    t.specificType('violation_detail', 'jsonb').notNullable();
    t.timestamp('quarantined_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text('status').notNullable().defaultTo('pending');
    t.timestamp('reviewed_at', { useTz: true }).nullable();
    t.text('review_note').nullable();
  });

  // 2. Index for efficient lookup during suppression checks and health monitoring
  await knex.raw(
    'CREATE INDEX data_quarantine_source_status_idx ON data_quarantine(source, status)'
  );

  // 3. Add quarantine_count to ingestion_log for tracking per-run quarantine totals
  await knex.raw(
    'ALTER TABLE ingestion_log ADD COLUMN quarantine_count INTEGER DEFAULT 0'
  );

  // 4. Seed known-bad IOM records as pre-accepted quarantine entries.
  //    These are records with source data errors (e.g. Iran coordinates labeled as
  //    Hungary route, Libya coordinates labeled as India) that cannot be fixed because
  //    the error is in IOM's source data. Seeding them as 'accepted' prevents
  //    re-flagging on every IOM ingestion run.
  //
  //    The query identifies records that are clearly in the wrong geographic region:
  //    - Labeled Central/Eastern Med but coordinates are far east (lng > 60)
  //    - Labeled Americas but coordinates are east of Atlantic (lng > -15)
  //    - Labeled Eastern Med but coordinates are implausibly south (lat < 15)
  //    - Labeled Eastern Land Borders but coordinates are in tropics (lat < 20)
  //
  //    If the query returns 0 rows (empty DB), seed is skipped silently.
  const badRows = await knex.raw(`
    SELECT id, lat, lng, route, location
    FROM route_deaths
    WHERE (route != 'South & East Asia' AND lat IS NOT NULL AND lng > 60)
       OR (route != 'Americas' AND lat IS NOT NULL AND lng < -35)
       OR (route = 'Eastern Mediterranean' AND lat IS NOT NULL AND (lng > 55 OR lat < 15))
       OR (route = 'Eastern Land Borders' AND lat IS NOT NULL AND lat < 20)
  `);

  if (badRows.rows && badRows.rows.length > 0) {
    const seeds = badRows.rows.map(row => ({
      source: 'iom',
      raw_data: JSON.stringify({ id: row.id, lat: row.lat, lng: row.lng, route: row.route, location: row.location }),
      rule_violated: 'geo-label-mismatch',
      violation_detail: JSON.stringify([{
        rule: 'geo-label-mismatch',
        expected: 'auto-detected',
        found: row.route,
        detail: 'Known unfixable source data error — pre-accepted to suppress future alerts',
      }]),
      status: 'accepted',
    }));

    await knex('data_quarantine').insert(seeds);
  }
};

exports.down = async (knex) => {
  // 1. Remove quarantine_count from ingestion_log
  await knex.raw('ALTER TABLE ingestion_log DROP COLUMN IF EXISTS quarantine_count');

  // 2. Drop the data_quarantine table (cascade removes the index too)
  await knex.schema.dropTableIfExists('data_quarantine');
};
