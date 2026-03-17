exports.up = async (knex) => {
  // 1. war_events — ~56K rows after dedup
  await knex.schema.createTable('war_events', (t) => {
    t.increments('pk').primary();
    t.integer('event_id').notNullable();
    t.string('year', 4).notNullable();
    t.string('quarter', 2).notNullable(); // q1, q2, q3, q4
    t.integer('fat');
    t.integer('int');
    t.integer('evt');
    t.specificType('cot', 'text[]'); // always [country, region]
    t.float('lat', 8).notNullable(); // float8 = double precision, avoids string return
    t.float('lng', 8).notNullable();
    t.index(['year', 'quarter']);
  });

  // 2. war_notes — empty for Phase 3 (MongoDB data lost)
  await knex.schema.createTable('war_notes', (t) => {
    t.integer('id').primary();
    t.text('notes');
    t.text('source');
  });

  // 3. asy_applications — ~82K records
  await knex.schema.createTable('asy_applications', (t) => {
    t.increments('pk').primary();
    t.integer('record_id');
    t.string('year', 4).notNullable();
    t.string('quarter', 2).notNullable();
    t.text('origin');
    t.text('destination');
    t.integer('value');
    t.index(['year', 'quarter']);
  });

  // 4. route_deaths — 4736 records. dead/missing/dead_and_missing stored as TEXT to preserve response shape
  await knex.schema.createTable('route_deaths', (t) => {
    t.text('id').primary();
    t.text('date');
    t.text('quarter');
    t.text('year');
    t.text('dead');
    t.text('missing');
    t.text('dead_and_missing');
    t.text('cause_of_death_display_text');
    t.text('cause_of_death');
    t.text('location');
    t.text('description');
    t.text('source');
    t.float('lat', 8); // nullable — 2 records have null lat/lng
    t.float('lng', 8);
    t.text('route');
    t.text('route_display_text');
    t.text('source_url');
  });

  // 5. ibc_crossings — fully normalized: ~13.8K rows (347 records x ~40 year-quarter combos, nulls omitted)
  await knex.schema.createTable('ibc_crossings', (t) => {
    t.increments('pk').primary();
    t.text('route').notNullable();
    t.text('border_location');
    t.text('nationality_long');
    t.string('year', 4).notNullable();
    t.string('quarter', 2).notNullable();
    t.integer('count');
    t.index(['route']);
  });

  // 6. country_routes — one row per country, routes as text[]
  await knex.schema.createTable('country_routes', (t) => {
    t.increments('pk').primary();
    t.text('country').notNullable().unique();
    t.specificType('routes', 'text[]');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('country_routes');
  await knex.schema.dropTableIfExists('ibc_crossings');
  await knex.schema.dropTableIfExists('route_deaths');
  await knex.schema.dropTableIfExists('asy_applications');
  await knex.schema.dropTableIfExists('war_notes');
  await knex.schema.dropTableIfExists('war_events');
};
