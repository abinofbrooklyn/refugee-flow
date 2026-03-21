/** War event as returned by /data/reduced_war_data */
export interface WarEvent {
  id: number;
  lat: number;
  lng: number;
  fat: number;
  evt: number;
  cot: string[];
  int: number;
  year: string;
  quarter: string;
}

/** Route death as returned by /data/route_death */
export interface RouteDeath {
  id: number;
  lat: number | null;
  lng: number | null;
  year: string;
  quarter: string;
  dead: string;
  missing: string;
  dead_and_missing: string;
  route: string;
  cause_of_death: string;
  country: string;
}

/** Asylum application as returned by /data/asy_applications */
export interface AsyApplication {
  id: number;
  year: string;
  quarter: string;
  destination: string;
  origin: string;
  applied: number;
}

/** IBC crossing as returned by /data/route_IBC */
export interface IbcCrossing {
  id: number;
  year: string;
  quarter: string;
  route: string;
  count: number | null;
}

/** Country route as returned by /data/route_IBC_country_list */
export interface CountryRoute {
  country: string;
  route: string;
}

/** Crossing count by country (static JSON import) */
export interface CrossingCountByCountry {
  [country: string]: number;
}

/** War note as returned by /data/war_notes */
export interface WarNote {
  war_event_id: number;
  notes: string;
}
