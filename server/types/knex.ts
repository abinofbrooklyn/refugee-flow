// Database row types matching the actual PostgreSQL schema
// Used with Knex generics: db<WarEventRow>('war_events')

export interface WarEventRow {
  pk: number;
  event_id: string;       // text after migration 002 (was integer)
  year: string;
  quarter: string;
  fat: number | null;
  int: number | null;
  evt: number | null;
  cot: string[];           // text[] — pg driver returns as JS array
  lat: number;
  lng: number;
}

export interface WarNoteRow {
  id: string;              // text after migration 002 (was integer)
  notes: string;
  source: string;
}

export interface AsyApplicationRow {
  pk: number;
  record_id: number | null;
  year: string;
  quarter: string;
  origin: string | null;
  destination: string | null;
  value: number | null;
}

export interface RouteDeathRow {
  id: string;              // text primary key
  date: string | null;
  quarter: string | null;
  year: string | null;
  dead: string | null;
  missing: string | null;
  dead_and_missing: string | null;
  cause_of_death_display_text: string | null;
  cause_of_death: string | null;
  location: string | null;
  description: string | null;
  source: string | null;
  lat: number | null;
  lng: number | null;
  route: string | null;
  route_display_text: string | null;
  source_url: string | null;
}

export interface IbcCrossingRow {
  pk: number;
  route: string;
  border_location: string | null;
  nationality_long: string | null;
  year: string;
  quarter: string;
  count: number | null;
  count_southwest: number | null;  // added in migration 003
  count_northern: number | null;   // added in migration 003
}

export interface CountryRouteRow {
  country: string;
  routes: string[];        // DB column is 'routes' (plural), mapped to 'route' in API response
}

export interface IngestionLogRow {
  id: number;
  source: string;
  status: string;
  rows_affected: number;
  error_message: string | null;
  started_at: Date;
  completed_at: Date;
  quarantine_count: number;  // added in migration 004
}

export interface DataQuarantineRow {
  id: number;
  source: string;
  raw_data: Record<string, unknown>;
  rule_violated: string;
  violation_detail: Record<string, unknown>;
  quarantined_at: Date;
  status: string;
  reviewed_at: Date | null;
  review_note: string | null;
}
