const db = require('../../../database/connection');

// 1. findWarNote — returns [] (war_notes table is empty for Phase 3)
const findWarNote = async (query) => {
  const rows = await db('war_notes').where({ id: query });
  return rows;
};

// 2. findReducedWar — reconstructs [{Year, value: {q1:[events], q2, q3, q4}}]
// Events within each quarter must be ordered by fat DESC (matches warReducer output)
const findReducedWar = async () => {
  const rows = await db('war_events')
    .select('*')
    .where('year', '>=', '2010')
    .orderBy([
      { column: 'year' },
      { column: 'quarter' },
      { column: 'fat', order: 'desc' },
    ]);

  const byYear = {};
  rows.forEach(row => {
    if (!byYear[row.year]) {
      byYear[row.year] = { Year: row.year, value: { q1: [], q2: [], q3: [], q4: [] } };
    }
    byYear[row.year].value[row.quarter].push({
      id: row.event_id,
      fat: row.fat,
      int: row.int,
      evt: row.evt,
      cot: row.cot,  // pg returns text[] as JS array
      lat: row.lat,  // float8 returns as number
      lng: row.lng,
    });
  });

  return Object.values(byYear).sort((a, b) => a.Year.localeCompare(b.Year));
};

// 3. findAsyApplicationAll — reconstructs [{2010: {q1:[records], ...}, 2011: {...}, ...}]
// Note: response is array-wrapped single object (not flat array)
const findAsyApplicationAll = async () => {
  const rows = await db('asy_applications').select('*').where('year', '>=', '2010');

  const result = {};
  rows.forEach(row => {
    if (!result[row.year]) {
      result[row.year] = { q1: [], q2: [], q3: [], q4: [] };
    }
    result[row.year][row.quarter].push({
      Origin: row.origin,
      Value: row.value,
      id: row.record_id,
      destination: row.destination,
    });
  });

  return [result]; // Array-wrapped single object — matches original response shape
};

// 4. findRouteDeath — returns flat array with original camelCase field names
// IMPORTANT: DB column names are snake_case; API response uses original field names
// Map IOM route names to display categories
const ROUTE_MAP = {
  // === Central Mediterranean (Libya/Tunisia → Italy via Sahara) ===
  'Central Mediterranean': 'Central Mediterranean',
  'Central Mediterranean,Sahara Desert crossing': 'Central Mediterranean',
  'Sahara Desert crossing': 'Central Mediterranean',

  // === Eastern Mediterranean (Turkey → Greece/Cyprus) ===
  'Eastern Mediterranean': 'Eastern Mediterranean',
  'Iran to Türkiye': 'Eastern Mediterranean',
  'Syria to Türkiye': 'Eastern Mediterranean',

  // === Western Mediterranean (Morocco → Spain) ===
  'Western Mediterranean': 'Western Mediterranean',

  // === Western African (West Africa → Canary Islands) ===
  'Western African': 'Western African',
  'Western Africa / Atlantic route to the Canary Islands': 'Western African',

  // === Western Balkans (Greece/Turkey → Central Europe overland) ===
  'Western Balkans': 'Western Balkans',
  'Türkiye-Europe land route': 'Western Balkans',

  // === Eastern Land Borders (EU eastern frontier) ===
  'Eastern Land Borders': 'Eastern Land Borders',
  'Belarus-EU border': 'Eastern Land Borders',
  'Ukraine to Europe': 'Eastern Land Borders',

  // === Americas (US-Mexico, Caribbean, Central/South America) ===
  'US-Mexico border crossing': 'Americas',
  'Caribbean to US': 'Americas',
  'Caribbean to Central America': 'Americas',
  'Dominican Republic to Puerto Rico': 'Americas',
  'Haiti to Dominican Republic': 'Americas',
  'Venezuela to Caribbean': 'Americas',
  'Darien': 'Americas',
  'Central Mediterranean,US-Mexico border crossing': 'Americas',

  // === Horn of Africa (East Africa, Horn, Southern Africa) ===
  'Horn of Africa Route': 'Horn of Africa',
  'Eastern Route to/from EHOA': 'Horn of Africa',
  'Northern Route from EHOA': 'Horn of Africa',
  'Route to Southern Africa': 'East & Southern Africa',
  'Sea crossings to Mayotte': 'East & Southern Africa',
  'DRC to Uganda': 'East & Southern Africa',

  // === Middle East & Central Asia (Afghanistan/Iran corridor) ===
  'Afghanistan to Iran': 'Middle East & Central Asia',

  // === South & Southeast Asia (Bay of Bengal, Myanmar/Bangladesh) ===
  'Bay of Bengal/Andaman Sea': 'South & Southeast Asia',
  'Naf River crossing': 'South & Southeast Asia',

  // === English Channel (UK crossings) ===
  'Mainland Europe to the UK': 'English Channel',

  // === Western Mediterranean (Italy-France Alpine/Riviera border) ===
  'Italy to France': 'Western Mediterranean',

  // Legacy catch-all — will be geo-distributed
  'Others': 'Others',
};

// Geographic fallback for null/unmapped/Others routes
const geoFallback = (lat, lng) => {
  // Americas — Western hemisphere
  if (lng < -20) return 'Americas';
  // Europe
  if (lat > 48 && lng >= -10 && lng <= 5) return 'English Channel';
  if (lat > 40 && lng >= -10 && lng <= 5) return 'Western Mediterranean';
  if (lat > 40 && lng > 5 && lng <= 15) return 'Western Balkans';
  if (lat > 40 && lng > 15 && lng <= 30) return 'Western Balkans';
  // Mediterranean & North Africa
  if (lat > 30 && lng >= -10 && lng <= 15) return 'Western Mediterranean';
  if (lat > 30 && lng > 15 && lng <= 37) return 'Central Mediterranean';
  // Middle East & Central Asia
  if (lat > 30 && lng > 37) return 'Middle East & Central Asia';
  // South & Southeast Asia
  if (lng > 70) return 'South & Southeast Asia';
  // Middle East (lat <= 30, lng 55-70)
  if (lat <= 30 && lng > 55 && lng <= 70) return 'Middle East & Central Asia';
  // East & Southern Africa (lat < -5, lng 25-55)
  if (lat <= -5 && lng > 25 && lng <= 55) return 'East & Southern Africa';
  // Horn of Africa — East Africa only (lng 30-55, lat -5 to 30)
  if (lat > -5 && lat <= 30 && lng > 30 && lng <= 55) return 'Horn of Africa';
  // Sahara transit — North Africa between lat 15-30
  if (lat > 15 && lat <= 30 && lng >= -10 && lng <= 30) return 'Central Mediterranean';
  // West, Central & Southern Africa (everything else in Africa)
  if (lng >= -20 && lng <= 30) return 'Western African';
  // Catch remaining
  return 'Western African';
};
const findRouteDeath = async () => {
  const rows = await db('route_deaths').select('*');

  // Deduplicate by lat/lng/date/dead_and_missing
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    const key = `${row.lat}|${row.lng}|${row.date}|${row.dead_and_missing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let mappedRoute = row.route ? (ROUTE_MAP[row.route] || 'Others') : geoFallback(row.lat, row.lng);
    // For catch-all "Others" records, always use geographic fallback
    if (mappedRoute === 'Others') {
      mappedRoute = geoFallback(row.lat, row.lng);
    }

    // Geographic corrections for misrouted records
    // Eastern Land Borders records outside Eastern Europe — reroute by geography
    if (mappedRoute === 'Eastern Land Borders' && (row.lng > 40 || row.lng < 15)) {
      mappedRoute = geoFallback(row.lat, row.lng);
    }
    // Eastern Mediterranean records in Western Med area — reroute
    if (mappedRoute === 'Eastern Mediterranean' && row.lng < 15) {
      mappedRoute = geoFallback(row.lat, row.lng);
    }
    // Horn of Africa records with misgeocoded coordinates — reroute by geography
    if (mappedRoute === 'Horn of Africa' && (row.lng < 30 || row.lat > 30)) {
      mappedRoute = geoFallback(row.lat, row.lng);
    }
    // Western African records in the Americas — reroute
    if (mappedRoute === 'Western African' && row.lng < -20) {
      mappedRoute = 'Americas';
    }

    deduped.push({
      id: row.id,
      date: row.date,
      quarter: row.quarter,
      year: row.year,
      dead: row.dead,
      missing: row.missing,
      dead_and_missing: row.dead_and_missing,
      cause_of_death_displayText: row.cause_of_death_display_text,
      cause_of_death: row.cause_of_death,
      location: row.location,
      description: row.description,
      source: row.source,
      lat: row.lat,
      lng: row.lng,
      route: mappedRoute,
      route_displayText: mappedRoute,
      source_url: row.source_url,
    });
  }
  return deduped;
};

// 5. findRouteIbcCountryList — returns [{country, route: [...]}]
// Note: field name is 'route' (singular) in the API response, matching source JSON
const findRouteIbcCountryList = async () => {
  const rows = await db('country_routes').select('country', 'routes');
  return rows.map(row => ({
    country: row.country,
    route: row.routes, // DB column 'routes' -> API field 'route' (singular)
  }));
};

// 6. findRouteIbc — reconstructs route-keyed object
// Shape: {"Eastern Mediterranean": [{Route, BorderLocation, NationalityLong, 2009: {q1,q2,q3,q4}, ...}]}
const findRouteIbc = async () => {
  const rows = await db('ibc_crossings').select('*');

  // Group by route -> then by (route + border_location + nationality_long) -> pivot years
  const routeMap = {};
  rows.forEach(row => {
    if (!routeMap[row.route]) routeMap[row.route] = {};
    const key = `${row.route}|${row.border_location}|${row.nationality_long}`;
    if (!routeMap[row.route][key]) {
      routeMap[row.route][key] = {
        Route: row.route,
        BorderLocation: row.border_location,
        NationalityLong: row.nationality_long,
      };
    }
    const rec = routeMap[row.route][key];
    if (!rec[row.year]) rec[row.year] = { q1: 0, q2: 0, q3: 0, q4: 0 };
    rec[row.year][row.quarter] = row.count;
    // Clean footnote markers (^ * etc.) from nationality names
    rec.NationalityLong = rec.NationalityLong.replace(/[\^*~]+$/g, '').trim();
  });

  // Convert from {route: {key: record}} to {route: [records]}
  const result = {};
  Object.entries(routeMap).forEach(([route, keyMap]) => {
    result[route] = Object.values(keyMap);
  });
  return result;
};

module.exports = {
  findWarNote,
  findReducedWar,
  findAsyApplicationAll,
  findRouteDeath,
  findRouteIbcCountryList,
  findRouteIbc,
};
