/**
 * IOM route normalization pipeline.
 *
 * Pure functions — no database dependency.
 * Extracted from dataController.js to run at ingestion time
 * instead of on every API read.
 *
 * Exports: ROUTE_MAP, geoFallback, fixSwappedLatLng, resolveRoute,
 *          applyGeoBoundsCorrections, normalizeRow, deduplicateRows
 */

// Map IOM route names to display categories
const ROUTE_MAP = {
  // === Central Mediterranean (Libya/Tunisia -> Italy via Sahara) ===
  'Central Mediterranean': 'Central Mediterranean',
  'Central Mediterranean,Sahara Desert crossing': 'Central Mediterranean',
  'Sahara Desert crossing': 'Central Mediterranean',

  // === Eastern Mediterranean (Turkey -> Greece/Cyprus) ===
  'Eastern Mediterranean': 'Eastern Mediterranean',
  'Iran to Türkiye': 'Eastern Mediterranean',
  'Syria to Türkiye': 'Eastern Mediterranean',
  // Türkiye-Europe land route: deep Turkey/Caucasus (lng 30-47) is Eastern Mediterranean,
  // not Western Balkans. Re-mapped per validation context decision 2026-03-20.
  'Türkiye-Europe land route': 'Eastern Mediterranean',

  // === Western Mediterranean (Morocco -> Spain) ===
  'Western Mediterranean': 'Western Mediterranean',

  // === Western African (West Africa -> Canary Islands) ===
  'Western African': 'Western African',
  'Western Africa / Atlantic route to the Canary Islands': 'Western African',

  // === Western Balkans (Greece/Turkey -> Central Europe overland) ===
  'Western Balkans': 'Western Balkans',

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
};

// Geographic fallback for null/unmapped/Others routes
// Regions are ordered north-to-south, west-to-east with no gaps
const geoFallback = (lat, lng) => {
  // === Western Hemisphere ===
  if (lng >= -35 && lng < -15 && lat > 5 && lat < 36) return 'Western African'; // Atlantic (Canary Is, Cabo Verde)
  if (lng < -15) return 'Americas';

  // === East & Southeast Asia (lng > 70) ===
  if (lng > 70) return 'South & East Asia';

  // === Northern Europe (lat > 55) ===
  if (lat > 55 && lng >= -10 && lng <= 10) return 'English Channel';
  if (lat > 55 && lng > 10 && lng <= 35) return 'Eastern Land Borders'; // Scandinavia, Baltics, Finland
  if (lat > 55 && lng > 35) return 'Eastern Land Borders'; // Arctic Russia — no good route, park here

  // === Central/Eastern Europe (lat 40-55) ===
  if (lat > 48 && lng >= -10 && lng <= 10) return 'English Channel'; // NW Europe
  if (lat > 40 && lng >= -10 && lng <= 5) return 'Western Mediterranean';
  if (lat > 40 && lng > 5 && lng <= 10) return 'Western Mediterranean'; // Italy/France/Switzerland
  if (lat > 40 && lat <= 50 && lng > 10 && lng <= 30) return 'Western Balkans';
  if (lat > 50 && lat <= 55 && lng > 10 && lng <= 30) return 'Eastern Land Borders'; // Poland, Germany, Czechia
  if (lat > 40 && lat <= 55 && lng > 30 && lng <= 35) return 'Eastern Land Borders'; // Ukraine, western Black Sea
  if (lat > 40 && lat <= 45 && lng > 35 && lng <= 45) return 'Eastern Mediterranean'; // eastern Turkey, Caucasus transit
  // lat > 45, lng > 35: deep Russia/Caucasus — no valid migration route
  // Falls through to catch-all at bottom (Western African) which will fail geo bounds → quarantine

  // === Mediterranean belt (lat 30-40) ===
  if (lat > 30 && lng >= -10 && lng <= 15) return 'Western Mediterranean';
  if (lat > 30 && lat <= 40 && lng > 15 && lng <= 21) return 'Central Mediterranean'; // Libya/Tunisia coast
  if (lat > 30 && lat <= 40 && lng > 21 && lng <= 42) return 'Eastern Mediterranean'; // Greece, Turkey, Levant, N. Syria
  if (lat > 30 && lat <= 40 && lng > 42 && lng <= 70) return 'Iran-Afghanistan Corridor';

  // === North Africa / Sahara / Arabian Peninsula (lat 15-30) ===
  if (lat > 15 && lat <= 30 && lng >= -15 && lng <= 15) return 'Central Mediterranean'; // Sahara transit (Niger, Mali north, Algeria south)
  if (lat > 15 && lat <= 30 && lng > 15 && lng <= 37) return 'Central Mediterranean'; // Egypt, Sudan north, Libya south
  if (lat > 25 && lat <= 30 && lng > 37 && lng <= 48) return 'Horn of Africa'; // Red Sea, Saudi Arabia
  if (lat > 25 && lat <= 30 && lng > 48 && lng <= 55) return 'Iran-Afghanistan Corridor'; // Iranian coast, Persian Gulf
  if (lat > 15 && lat <= 25 && lng > 37 && lng <= 55) return 'Horn of Africa'; // Yemen, Gulf of Aden, Saudi south
  if (lat > 15 && lat <= 30 && lng > 55 && lng <= 70) return 'Iran-Afghanistan Corridor'; // Arabian Sea to Afghanistan

  // === Tropical Africa (lat -5 to 15) ===
  if (lat > -5 && lat <= 15 && lng >= -15 && lng <= 15) return 'Western African'; // West Africa (Sahel, coast)
  if (lat > -5 && lat <= 15 && lng > 15 && lng <= 30) return 'Central Mediterranean'; // Central Africa (Chad, CAR, Sudan south)
  if (lat > -5 && lat <= 15 && lng > 30 && lng <= 55) return 'Horn of Africa'; // East Africa (Somalia, Ethiopia, Kenya, Djibouti)

  // === Southern Africa (lat < -5) ===
  if (lat <= -5 && lng > 15 && lng <= 55) return 'East & Southern Africa'; // includes Central Africa (Angola, DRC south)

  // === Remaining catch-all ===
  if (lng >= -15 && lng <= 15) return 'Western African'; // West/Central Africa remaining
  if (lng > 55 && lng <= 70) return 'Iran-Afghanistan Corridor';
  return 'UNRESOLVED'; // No valid route — validator will quarantine this
};

/**
 * Fix swapped lat/lng values.
 * Latitude must be in [-90, 90]; if outside that range, swap with longitude.
 * @param {number|null} lat
 * @param {number|null} lng
 * @returns {{ lat: number|null, lng: number|null }}
 */
function fixSwappedLatLng(lat, lng) {
  if (lat !== null && lng !== null && (lat < -90 || lat > 90)) {
    return { lat: lng, lng: lat };
  }
  return { lat, lng };
}

/**
 * Resolve a raw IOM route name to a display category.
 * Returns { route, wasFallback, rawRoute } for unknown-route alerting.
 * @param {string|null} rawRoute
 * @param {number} lat
 * @param {number} lng
 * @returns {{ route: string, wasFallback: boolean, rawRoute: string|null }}
 */
function resolveRoute(rawRoute, lat, lng) {
  if (!rawRoute || rawRoute.trim() === '') {
    return { route: geoFallback(lat, lng), wasFallback: true, rawRoute };
  }
  const mapped = ROUTE_MAP[rawRoute];
  if (!mapped) {
    return { route: geoFallback(lat, lng), wasFallback: true, rawRoute };
  }
  return { route: mapped, wasFallback: false, rawRoute };
}

/**
 * Apply geographic bounds corrections.
 * Overrides source route when coordinates are clearly in the wrong region.
 * @param {string} route
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
function applyGeoBoundsCorrections(route, lat, lng) {
  // Hard geographic limits — these always win regardless of source route
  if (lng > 70 && route !== 'South & East Asia' && route !== 'Americas') return 'South & East Asia';
  if (lng < -35 && route !== 'Americas') return 'Americas';
  if (lat > 55 && !['English Channel', 'Eastern Land Borders'].includes(route)) return geoFallback(lat, lng);

  // Route-specific geographic bounds — reroute if record is far from its assigned region
  // Every route has a bounds check to catch IOM source data errors (fat-fingered coords)
  if (route === 'Central Mediterranean' && (lng > 37 || lng < -15 || lat < 5 || lat > 48)) return geoFallback(lat, lng);
  if (route === 'Eastern Mediterranean' && (lng < 15 || lng > 45 || lat < 30 || lat > 45)) return geoFallback(lat, lng);
  if (route === 'Western Mediterranean' && (lng > 15 || lng < -25 || lat < 25 || lat > 48)) return geoFallback(lat, lng);
  if (route === 'English Channel' && (lng < -10 || lng > 10 || lat < 48 || lat > 60)) return geoFallback(lat, lng);
  if (route === 'Western Balkans' && (lng < 10 || lng > 35 || lat > 50 || lat < 35)) return geoFallback(lat, lng);
  if (route === 'Eastern Land Borders' && (lng > 40 || lng < 10 || lat < 45 || lat > 70)) return geoFallback(lat, lng);
  if (route === 'Western African' && (lng > 15 || lng < -35 || lat < -17 || lat > 36)) return geoFallback(lat, lng);
  if (route === 'East & Southern Africa' && (lat > 15 || lng < 15 || lng > 55)) return geoFallback(lat, lng);
  if (route === 'Horn of Africa' && (lng < 30 || lng > 55 || lat < -5 || lat > 30)) return geoFallback(lat, lng);
  if (route === 'Iran-Afghanistan Corridor' && (lng < 42 || lng > 70 || lat < 20 || lat > 40)) return geoFallback(lat, lng);
  if (route === 'South & East Asia' && (lng < 70 || lat > 35 || lat < -15)) return geoFallback(lat, lng);
  if (route === 'Americas' && lng > -15) return geoFallback(lat, lng);
  if (route === 'Americas' && lng > -35 && lng < -15 && lat > 5 && lat < 36) return 'Western African';
  return route;
}

/**
 * Full normalization pipeline for a single row.
 * Fixes swapped coords, resolves route, applies geographic bounds corrections.
 * Adds _wasFallback and _rawRoute tracking fields (strip before DB insert).
 * @param {Object} row
 * @returns {Object}
 */
function normalizeRow(row) {
  const { lat, lng } = fixSwappedLatLng(row.lat, row.lng);
  if (lat === null || lng === null) {
    return { ...row, lat, lng, _wasFallback: false, _rawRoute: row.route };
  }
  const resolved = resolveRoute(row.route, lat, lng);
  const corrected = applyGeoBoundsCorrections(resolved.route, lat, lng);
  return {
    ...row,
    lat,
    lng,
    route: corrected,
    route_display_text: corrected,
    _wasFallback: resolved.wasFallback,
    _rawRoute: resolved.rawRoute,
  };
}

/**
 * Remove duplicate rows by lat|lng|date|dead_and_missing composite key.
 * Keeps first occurrence.
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
function deduplicateRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.lat}|${row.lng}|${row.date}|${row.dead_and_missing}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  normalizeRow,
  deduplicateRows,
  ROUTE_MAP,
  geoFallback,
  fixSwappedLatLng,
  resolveRoute,
  applyGeoBoundsCorrections,
};
