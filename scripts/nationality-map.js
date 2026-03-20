/**
 * Maps CBP uppercase nationality names to title-case display names
 * matching the format used in ibc_crossings / Frontex IBC data.
 */
const CBP_NATIONALITY_MAP = {
  'MEXICO': 'Mexico',
  'GUATEMALA': 'Guatemala',
  'HONDURAS': 'Honduras',
  'EL SALVADOR': 'El Salvador',
  'COLOMBIA': 'Colombia',
  'VENEZUELA': 'Venezuela',
  'CUBA': 'Cuba',
  'HAITI': 'Haiti',
  'ECUADOR': 'Ecuador',
  'NICARAGUA': 'Nicaragua',
  'BRAZIL': 'Brazil',
  'INDIA': 'India',
  'CHINA': 'China',
  'TURKEY': 'Türkiye',
  'ROMANIA': 'Romania',
  'RUSSIA': 'Russia',
  'UKRAINE': 'Ukraine',
  'MYANMAR (BURMA)': 'Myanmar',
  'PERU': 'Peru',
  'PHILIPPINES': 'Philippines',
  'CANADA': 'Canada',
  'DOMINICAN REPUBLIC': 'Dominican Republic',
  'COSTA RICA': 'Costa Rica',
  'DEMOCRATIC REPUBLIC OF THE CONGO': 'Democratic Republic of the Congo',
  'SIERRA LEONE': 'Sierra Leone',
  'BURKINA FASO': 'Burkina Faso',
  'SOUTH KOREA': 'South Korea',
  'OTHER': 'Other',
};

/**
 * Normalize a CBP nationality string.
 * Falls back to title-casing each word if not in the explicit map.
 */
function normalizeCbpNationality(raw) {
  if (!raw) return 'Unknown';
  const upper = raw.trim().toUpperCase();
  if (CBP_NATIONALITY_MAP[upper]) return CBP_NATIONALITY_MAP[upper];
  // Fallback: title case each word
  return upper.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

module.exports = { CBP_NATIONALITY_MAP, normalizeCbpNationality };
