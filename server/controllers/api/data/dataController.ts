import db from '../../../database/connection';
import {
  WarEventRow,
  WarNoteRow,
  AsyApplicationRow,
  RouteDeathRow,
  IbcCrossingRow,
  CountryRouteRow,
} from '../../../types/knex';

// 1. findWarNote — returns [] (war_notes table is empty for Phase 3)
export const findWarNote = async (query: number): Promise<WarNoteRow[]> => {
  const rows = await db<WarNoteRow>('war_notes').where({ id: String(query) });
  return rows;
};

// 2. findReducedWar — reconstructs [{Year, value: {q1:[events], q2, q3, q4}}]
// Events within each quarter must be ordered by fat DESC (matches warReducer output)
interface WarYearRecord {
  Year: string;
  value: {
    q1: WarEventShape[];
    q2: WarEventShape[];
    q3: WarEventShape[];
    q4: WarEventShape[];
  };
}

interface WarEventShape {
  id: string;
  fat: number | null;
  int: number | null;
  evt: number | null;
  cot: string[];
  lat: number;
  lng: number;
}

export const findReducedWar = async (): Promise<WarYearRecord[]> => {
  const rows = await db<WarEventRow>('war_events')
    .select('*')
    .where('year', '>=', '2010')
    .orderBy([
      { column: 'year' },
      { column: 'quarter' },
      { column: 'fat', order: 'desc' },
    ]);

  const byYear: Record<string, WarYearRecord> = {};
  rows.forEach(row => {
    if (!byYear[row.year]) {
      byYear[row.year] = { Year: row.year, value: { q1: [], q2: [], q3: [], q4: [] } };
    }
    byYear[row.year].value[row.quarter as keyof typeof byYear[string]['value']].push({
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
interface AsyQuarterRecord {
  Origin: string | null;
  Value: number | null;
  id: number | null;
  destination: string | null;
}

type AsyYearMap = Record<string, { q1: AsyQuarterRecord[]; q2: AsyQuarterRecord[]; q3: AsyQuarterRecord[]; q4: AsyQuarterRecord[] }>;

export const findAsyApplicationAll = async (): Promise<[AsyYearMap]> => {
  const rows = await db<AsyApplicationRow>('asy_applications').select('*').where('year', '>=', '2010');

  const result: AsyYearMap = {};
  rows.forEach(row => {
    if (!result[row.year]) {
      result[row.year] = { q1: [], q2: [], q3: [], q4: [] };
    }
    result[row.year][row.quarter as keyof typeof result[string]].push({
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
interface RouteDeathShape {
  id: string;
  date: string | null;
  quarter: string | null;
  year: string | null;
  dead: string | null;
  missing: string | null;
  dead_and_missing: string | null;
  cause_of_death_displayText: string | null;
  cause_of_death: string | null;
  location: string | null;
  description: string | null;
  source: string | null;
  lat: number | null;
  lng: number | null;
  route: string | null;
  route_displayText: string | null;
  source_url: string | null;
}

const VALID_ROUTES = [
  'Eastern Mediterranean', 'Central Mediterranean', 'Western Mediterranean',
  'English Channel', 'Western Balkans', 'Eastern Land Borders',
  'Americas', 'Western African', 'Horn of Africa',
  'East & Southern Africa', 'Iran-Afghanistan Corridor', 'South & East Asia',
];

export const findRouteDeath = async (route?: string): Promise<RouteDeathShape[]> => {
  let query = db<RouteDeathRow>('route_deaths').select('*');
  if (route) {
    if (!VALID_ROUTES.includes(route)) {
      return []; // reject unknown routes
    }
    query = query.where('route', route);
  }
  const rows = await query;
  return rows.map(row => ({
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
    route: row.route,
    route_displayText: row.route,
    source_url: row.source_url,
  }));
};

// 5. findRouteIbcCountryList — returns [{country, route: [...]}]
// Note: field name is 'route' (singular) in the API response, matching source JSON
interface IbcCountryListShape {
  country: string;
  route: string[];
}

export const findRouteIbcCountryList = async (): Promise<IbcCountryListShape[]> => {
  const rows = await db<CountryRouteRow>('country_routes').select('country', 'routes');
  return rows.map(row => ({
    country: row.country,
    route: row.routes, // DB column 'routes' -> API field 'route' (singular)
  }));
};

// 6. findRouteIbc — reconstructs route-keyed object
// Shape: {"Eastern Mediterranean": [{Route, BorderLocation, NationalityLong, 2009: {q1,q2,q3,q4}, ...}]}
interface IbcRecord {
  Route: string;
  BorderLocation: string | null;
  NationalityLong: string | null;
  borderBreakdown?: Record<string, Record<string, { southwest: number; northern: number }>>;
  [year: string]: unknown;
}

export const findRouteIbc = async (): Promise<Record<string, IbcRecord[]>> => {
  const rows = await db<IbcCrossingRow>('ibc_crossings').select('*');

  // Group by route -> then by (route + border_location + nationality_long) -> pivot years
  const routeMap: Record<string, Record<string, IbcRecord>> = {};
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
    (rec[row.year] as Record<string, number | null>)[row.quarter] = row.count;
    // Include border region breakdown if available (CBP Americas data)
    if (row.count_southwest != null || row.count_northern != null) {
      if (!rec.borderBreakdown) rec.borderBreakdown = {};
      if (!rec.borderBreakdown[row.year]) rec.borderBreakdown[row.year] = {};
      rec.borderBreakdown[row.year][row.quarter] = {
        southwest: row.count_southwest || 0,
        northern: row.count_northern || 0,
      };
    }
    // Clean footnote markers (^ * etc.) from nationality names
    if (rec.NationalityLong) {
      rec.NationalityLong = rec.NationalityLong.replace(/[\^*~]+$/g, '').trim();
    }
  });

  // Convert from {route: {key: record}} to {route: [records]}
  const result: Record<string, IbcRecord[]> = {};
  Object.entries(routeMap).forEach(([route, keyMap]) => {
    result[route] = Object.values(keyMap);
  });
  return result;
};
