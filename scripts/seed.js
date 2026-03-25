require('dotenv').config();
const db = require('../server/database/connection');
const { dataLoader, reduceGeoPercision, warReducer } = require('../server/controllers/api/data/helpers/dataProcessors');

async function seed() {
  console.log('Starting seed...');

  // TRUNCATE all tables for idempotency
  await db.raw('TRUNCATE TABLE war_events, war_notes, asy_applications, route_deaths, ibc_crossings, country_routes RESTART IDENTITY CASCADE');

  // === 1. WAR EVENTS ===
  // Load with precision reduction via JSON reviver (same as dataController.js)
  const warRaw = dataLoader('war_all.json', (key, value) =>
    (key === 'lat' || key === 'lng' ? reduceGeoPercision(value, 2) : value)
  );
  // Apply warReducer: sorts each quarter by fat DESC, deduplicates on lat,lng
  const warReduced = warReducer(warRaw);
  const warRows = [];
  warReduced.forEach(yr => {
    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      yr.value[q].forEach(ev => {
        warRows.push({
          event_id: ev.id,
          year: yr.Year,
          quarter: q,
          fat: ev.fat,
          int: ev.int,
          evt: ev.evt,
          cot: ev.cot, // JS array -> pg text[] via pg driver
          lat: ev.lat,
          lng: ev.lng,
        });
      });
    });
  });
  await db.batchInsert('war_events', warRows, 500);
  console.log(`Seeded war_events: ${warRows.length} rows`);

  // === 2. WAR NOTES === (empty — MongoDB data lost, ACLED sourcing deferred to Phase 4)
  console.log('Seeded war_notes: 0 rows (table created empty per plan)');

  // === 3. ASY_APPLICATIONS ===
  // Source shape: object keyed by year string -> {q1:[...], q2:[...], q3:[...], q4:[...]}
  const asyRaw = dataLoader('asy_application_all.json');
  const asyRows = [];
  Object.entries(asyRaw).forEach(([year, quarters]) => {
    ['q1', 'q2', 'q3', 'q4'].forEach(q => {
      if (quarters[q]) {
        quarters[q].forEach(rec => {
          asyRows.push({
            record_id: rec.id,
            year: year,
            quarter: q,
            origin: rec.Origin,
            destination: rec.destination,
            value: rec.Value,
          });
        });
      }
    });
  });
  // Use chunked insert with onConflict ignore — source JSON has duplicates
  for (let i = 0; i < asyRows.length; i += 500) {
    await db('asy_applications').insert(asyRows.slice(i, i + 500)).onConflict(['year', 'quarter', 'origin', 'destination']).ignore();
  }
  const asyCount = await db('asy_applications').count('* as c');
  console.log(`Seeded asy_applications: ${asyCount[0].c} rows (${asyRows.length} source, dupes ignored)`);

  // === 4. ROUTE DEATHS ===
  // Source shape: flat array of records. Keep dead/missing/dead_and_missing as text.
  // Apply precision reduction to lat/lng at seed time.
  const routeDeathRaw = dataLoader('route_death.json');
  const routeDeathRows = routeDeathRaw.map(r => ({
    id: String(r.id),
    date: r.date,
    quarter: r.quarter,
    year: r.year,
    dead: r.dead,
    missing: r.missing,
    dead_and_missing: r.dead_and_missing,
    cause_of_death_display_text: r.cause_of_death_displayText,
    cause_of_death: r.cause_of_death,
    location: r.location,
    description: r.description,
    source: r.source,
    lat: (r.lat != null && r.lat !== '') ? reduceGeoPercision(parseFloat(r.lat), 2) : null,
    lng: (r.lng != null && r.lng !== '') ? reduceGeoPercision(parseFloat(r.lng), 2) : null,
    route: r.route,
    route_display_text: r.route_displayText,
    source_url: r.source_url,
  }));
  await db.batchInsert('route_deaths', routeDeathRows, 500);
  console.log(`Seeded route_deaths: ${routeDeathRows.length} rows`);

  // === 5. IBC CROSSINGS ===
  // Source shape: object keyed by route name -> array of crossing records
  // Each record has Route, BorderLocation, NationalityLong, and year-keyed objects {q1,q2,q3,q4}
  // Normalize: one row per route/border/nationality/year/quarter combo. Omit null counts.
  const ibcRaw = dataLoader('IBC_all.json');
  const ibcRows = [];
  Object.entries(ibcRaw).forEach(([routeName, records]) => {
    records.forEach(rec => {
      // Year keys are the properties that are NOT Route, BorderLocation, NationalityLong
      Object.entries(rec).forEach(([key, val]) => {
        if (key === 'Route' || key === 'BorderLocation' || key === 'NationalityLong') return;
        // key is a year string like '2009', val is {q1: N, q2: N, q3: N, q4: N}
        if (typeof val === 'object' && val !== null) {
          ['q1', 'q2', 'q3', 'q4'].forEach(q => {
            if (val[q] != null) {
              ibcRows.push({
                route: rec.Route,
                border_location: rec.BorderLocation,
                nationality_long: rec.NationalityLong,
                year: key,
                quarter: q,
                count: val[q],
              });
            }
          });
        }
      });
    });
  });
  await db.batchInsert('ibc_crossings', ibcRows, 500);
  console.log(`Seeded ibc_crossings: ${ibcRows.length} rows`);

  // === 6. COUNTRY ROUTES ===
  // Source shape: array of {country, route} where route is string[]
  const countryRouteRaw = dataLoader('country_route_list.json');
  const countryRouteRows = countryRouteRaw.map(r => ({
    country: r.country,
    routes: r.route, // JS array -> pg text[]
  }));
  await db.batchInsert('country_routes', countryRouteRows, 500);
  console.log(`Seeded country_routes: ${countryRouteRows.length} rows`);

  console.log('Seed complete.');
  await db.destroy();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
