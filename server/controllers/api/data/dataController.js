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

  // === Iran-Afghanistan Corridor (Afghanistan/Iran corridor) ===
  'Afghanistan to Iran': 'Iran-Afghanistan Corridor',

  // === South & East Asia (Bay of Bengal, Myanmar/Bangladesh) ===
  'Bay of Bengal/Andaman Sea': 'South & East Asia',
  'Naf River crossing': 'South & East Asia',

  // === English Channel (UK crossings) ===
  'Mainland Europe to the UK': 'English Channel',

  // === Western Mediterranean (Italy-France Alpine/Riviera border) ===
  'Italy to France': 'Western Mediterranean',

  // Legacy catch-all — will be geo-distributed
  'Others': 'Others',
};

// Geographic fallback for null/unmapped/Others routes
const geoFallback = (lat, lng) => {
  // Western African — Atlantic crossings near Africa (Canary Islands, Cabo Verde)
  if (lng >= -35 && lng < -15 && lat > 5 && lat < 36) return 'Western African';
  // Americas — Western hemisphere
  if (lng < -15) return 'Americas';
  // Europe
  if (lat > 48 && lng >= -10 && lng <= 10) return 'English Channel';
  if (lat > 40 && lng >= -10 && lng <= 5) return 'Western Mediterranean';
  if (lat > 40 && lng > 5 && lng <= 10) return 'Western Mediterranean'; // Italy/France/Switzerland
  if (lat > 40 && lng > 10 && lng <= 30) return 'Western Balkans';
  // Mediterranean & North Africa
  if (lat > 30 && lng >= -10 && lng <= 15) return 'Western Mediterranean';
  if (lat > 30 && lng > 15 && lng <= 37) return 'Central Mediterranean';
  // Iran-Afghanistan Corridor
  if (lat > 30 && lng > 37) return 'Iran-Afghanistan Corridor';
  // South & East Asia (South, Southeast, East Asia) — lng > 70
  // Afghanistan heartland (lng 65-70) stays with Iran-Afghanistan Corridor
  if (lng > 70) return 'South & East Asia';
  // Iran-Afghanistan Corridor (lng 55-70)
  if (lat <= 30 && lng > 55 && lng <= 70) return 'Iran-Afghanistan Corridor';
  // East & Southern Africa (lat < -5, lng 25-55)
  if (lat <= -5 && lng > 25 && lng <= 55) return 'East & Southern Africa';
  // Horn of Africa — East Africa + Yemen (lng 30-55, lat -5 to 20)
  if (lat > -5 && lat <= 20 && lng > 30 && lng <= 55) return 'Horn of Africa';
  // Arabian Peninsula / Persian Gulf (lng 45-65, lat 20-30)
  if (lat > 20 && lat <= 30 && lng > 45 && lng <= 65) return 'Iran-Afghanistan Corridor';
  // Persian Gulf / Iran area (lng 50-65, lat < 30 remaining)
  if (lat <= 30 && lng > 50 && lng <= 65) return 'Iran-Afghanistan Corridor';
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
    // Fix swapped lat/lng (lat should be -90 to 90, lng -180 to 180)
    let lat = row.lat;
    let lng = row.lng;
    if (lat < -90 || lat > 90) {
      const tmp = lat; lat = lng; lng = tmp;
    }

    const key = `${lat}|${lng}|${row.date}|${row.dead_and_missing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let mappedRoute = row.route ? (ROUTE_MAP[row.route] || 'Others') : geoFallback(lat, lng);
    // For catch-all "Others" records, always use geographic fallback
    if (mappedRoute === 'Others') {
      mappedRoute = geoFallback(lat, lng);
    }

    // Geographic corrections for misrouted records
    if (mappedRoute === 'Eastern Land Borders' && (lng > 40 || lng < 15)) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (mappedRoute === 'Central Mediterranean' && (lng > 55 || lng < -15)) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (lng > 70 && mappedRoute !== 'South & East Asia' && mappedRoute !== 'Americas') {
      mappedRoute = 'South & East Asia';
    }
    if (lng < -35 && mappedRoute !== 'Americas') {
      mappedRoute = 'Americas';
    }
    if (mappedRoute === 'Eastern Mediterranean' && lng < 15) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (mappedRoute === 'Horn of Africa' && (lng < 30 || lat > 25 || lng > 55)) {
      mappedRoute = geoFallback(lat, lng);
    }
    // Records at lat > 55 in non-arctic routes — reroute to English Channel (Northern Europe transit)
    if (lat > 55 && !['English Channel'].includes(mappedRoute)) {
      mappedRoute = 'English Channel';
    }
    // Libya-labelled records at Indian coords (lng 65-85) — source data error, keep in Central Med
    // Tanzania-labelled records at Tunisia coords — source data error, keep in East & Southern Africa
    // These are unfixable without manual coordinate correction

    // Western African records in Sudan/East Africa (lng > 25) — reroute to Horn of Africa
    if (mappedRoute === 'Western African' && lng > 25 && lat < 15) {
      mappedRoute = 'Horn of Africa';
    }
    // Western Balkans records far from Balkans — reroute by geography
    // Western Mediterranean records far from West Med — reroute
    if (mappedRoute === 'Western Mediterranean' && (lng > 15 || lng < -25)) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (mappedRoute === 'Western Balkans' && lng < 10) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (mappedRoute === 'Western Balkans' && lng > 35) {
      mappedRoute = geoFallback(lat, lng);
    }
    if (mappedRoute === 'Western African' && lng < -35) {
      mappedRoute = 'Americas';
    }
    if (mappedRoute === 'Americas' && lng > -35 && lng < -15 && lat > 5 && lat < 36) {
      mappedRoute = 'Western African';
    }
    // Americas records with positive longitude — source data error (lng should be negative)
    // Keep in Americas rather than geo-routing to Asia
    if (mappedRoute === 'Americas' && lng > 0) {
      // These are US-Mexico records with wrong sign — keep in Americas
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
      lat: lat,
      lng: lng,
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
