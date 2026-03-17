exports.up = async (knex) => {
  // 1. Alter war_events.event_id from integer to text (ACLED uses string IDs)
  await knex.raw('ALTER TABLE war_events ALTER COLUMN event_id TYPE text USING event_id::text');

  // 2. Add unique index on war_events.event_id for upsert support
  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS war_events_event_id_unique ON war_events(event_id)'
  );

  // 3. Alter war_notes.id from integer to text (ACLED event_id_cnty linkage uses string IDs)
  await knex.raw('ALTER TABLE war_notes ALTER COLUMN id TYPE text USING id::text');

  // 4. Deduplicate asy_applications before adding unique index.
  //    Keep the lowest pk for each (year, quarter, origin, destination) group.
  await knex.raw(`
    DELETE FROM asy_applications
    WHERE pk NOT IN (
      SELECT MIN(pk)
      FROM asy_applications
      GROUP BY year, quarter, origin, destination
    )
  `);

  // 5. Add unique composite index on asy_applications(year, quarter, origin, destination)
  //    Enables UNHCR ingestion to use onConflict(...).merge() safely
  await knex.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS asy_applications_year_quarter_origin_dest_unique ON asy_applications(year, quarter, origin, destination)'
  );

  // 6. Create ingestion_log table for tracking all data ingestion runs
  await knex.schema.createTable('ingestion_log', (t) => {
    t.increments('id').primary();
    t.text('source').notNullable(); // 'acled', 'unhcr', 'iom', 'csv'
    t.text('status').notNullable(); // 'success', 'error'
    t.integer('rows_affected').defaultTo(0);
    t.text('error_message').nullable();
    t.timestamp('started_at', { useTz: true }).notNullable();
    t.timestamp('completed_at', { useTz: true }).notNullable();
  });
};

exports.down = async (knex) => {
  // 1. Drop ingestion_log table
  await knex.schema.dropTableIfExists('ingestion_log');

  // 2. Drop asy_applications unique index
  await knex.raw('DROP INDEX IF EXISTS asy_applications_year_quarter_origin_dest_unique');

  // 3. Drop war_events unique index
  await knex.raw('DROP INDEX IF EXISTS war_events_event_id_unique');

  // 4. Revert war_events.event_id back to integer
  await knex.raw('ALTER TABLE war_events ALTER COLUMN event_id TYPE integer USING event_id::integer');

  // 5. Revert war_notes.id back to integer
  await knex.raw('ALTER TABLE war_notes ALTER COLUMN id TYPE integer USING id::integer');
};
