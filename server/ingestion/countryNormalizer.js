/**
 * Country name normalization for asylum data.
 *
 * Pure functions — no database dependency.
 * Maps variant country names (UNHCR, Eurostat, etc.) to canonical forms
 * used by the frontend's exact-match filtering.
 *
 * Exports: normalizeCountryName, CANONICAL_NAMES, EU_DESTINATIONS
 */

// Variant name → canonical name mappings
const CANONICAL_NAMES = {
  'USA (EOIR)': 'United States',
  'USA (INS/DHS)': 'United States',
  'United States of America': 'United States',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'Serbia and Kosovo: S/RES/1244 (1999)': 'Serbia',
  'The former Yugoslav Rep. of Macedonia': 'North Macedonia',
  'Rep. of Korea': 'South Korea',
  'Iran (Islamic Rep. of)': 'Iran',
  "Cote d'Ivoire": "Cote d'Ivoire",
  'Dem. Rep. of the Congo': 'DR Congo',
  'Rep. of the Congo': 'Republic of the Congo',
  'Central African Rep.': 'Central African Republic',
  'Swaziland': 'Eswatini',
  'Syrian Arab Rep.': 'Syria',
  'Czech Rep.': 'Czechia',
};

/**
 * Normalize a country name to its canonical form.
 * Returns the input unchanged if no mapping exists (passthrough).
 * @param {string} name - Raw country name from data source
 * @returns {string} Canonical country name
 */
function normalizeCountryName(name) {
  return CANONICAL_NAMES[name] || name;
}

/**
 * Set of 31 canonical EU/EEA destination country names.
 * Uses canonical forms (e.g. 'Czechia' not 'Czech Rep.').
 */
const EU_DESTINATIONS = new Set([
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus',
  'Czechia', 'Denmark', 'Estonia', 'Finland', 'France',
  'Germany', 'Greece', 'Hungary', 'Ireland', 'Italy',
  'Latvia', 'Lithuania', 'Luxembourg', 'Malta', 'Netherlands',
  'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden',
  // EEA + associated
  'Iceland', 'Liechtenstein', 'Norway', 'Switzerland',
]);

module.exports = { normalizeCountryName, CANONICAL_NAMES, EU_DESTINATIONS };
