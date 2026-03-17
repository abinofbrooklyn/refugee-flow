'use strict';

const { XMLParser } = require('fast-xml-parser');
const db = require('../database/connection');
const { logIngestion, getLastSyncDate } = require('./ingestionLogger');

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/migr_asyappctzm';
const BATCH_SIZE = 500;

// EU/EEA Eurostat geo codes → full country names (matching asy_applications.destination)
const EU_GEO = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czech Rep.', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', EL: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden',
  // EEA + associated
  IS: 'Iceland', LI: 'Liechtenstein', NO: 'Norway', CH: 'Switzerland',
};

// Origin country ISO2 codes → full names (matching asy_applications.origin)
// Covers the 64 origins in existing seed data
const CITIZEN_CODES = {
  AF: 'Afghanistan', DZ: 'Algeria', AO: 'Angola', BH: 'Bahrain', BD: 'Bangladesh',
  BJ: 'Benin', BW: 'Botswana', BF: 'Burkina Faso', BI: 'Burundi', KH: 'Cambodia',
  CM: 'Cameroon', TD: 'Chad', DJ: 'Djibouti', EG: 'Egypt', GQ: 'Equatorial Guinea',
  ER: 'Eritrea', ET: 'Ethiopia', GA: 'Gabon', GM: 'Gambia', GH: 'Ghana',
  GN: 'Guinea', GW: 'Guinea-Bissau', IN: 'India', ID: 'Indonesia', IQ: 'Iraq',
  IR: 'Iran (Islamic Rep. of)', CI: "Cote d'Ivoire", JO: 'Jordan', KE: 'Kenya',
  KW: 'Kuwait', LB: 'Lebanon', LR: 'Liberia', LY: 'Libya', MW: 'Malawi',
  ML: 'Mali', MR: 'Mauritania', MA: 'Morocco', MZ: 'Mozambique', MM: 'Myanmar',
  NP: 'Nepal', NE: 'Niger', NG: 'Nigeria', PK: 'Pakistan', PS: 'Palestine',
  RW: 'Rwanda', SA: 'Saudi Arabia', SN: 'Senegal', SL: 'Sierra Leone', SO: 'Somalia',
  ZA: 'South Africa', LK: 'Sri Lanka', SD: 'Sudan', SY: 'Syrian Arab Rep.',
  TZ: 'Tanzania', TG: 'Togo', TN: 'Tunisia', TR: 'Turkey', UG: 'Uganda',
  AE: 'United Arab Emirates', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
  CD: 'Dem. Rep. of the Congo', CG: 'Rep. of the Congo', CF: 'Central African Rep.',
  SS: 'South Sudan', SY: 'Syria', IL: 'Israel', MG: 'Madagascar', OM: 'Oman',
  NA: 'Namibia', SZ: 'Swaziland', QA: 'Qatar', LS: 'Lesotho',
};

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/**
 * Fetch monthly asylum data from Eurostat for a single origin→destination pair.
 * Returns array of { month: '2023-01', value: 650 } objects.
 */
async function fetchMonthlyData(citizenIso, geoIso, startPeriod, endPeriod) {
  const url = `${EUROSTAT_BASE}/M.PER.${citizenIso}.T.TOTAL.TOTAL.${geoIso}?startPeriod=${startPeriod}&endPeriod=${endPeriod}&detail=dataonly`;

  const res = await fetch(url);
  if (!res.ok) {
    // 404 = no data for this pair, not an error
    if (res.status === 404) return [];
    throw new Error(`Eurostat API error: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  const parsed = xmlParser.parse(xml);

  // Navigate SDMX structure to extract observations
  const dataSet = parsed?.['m:GenericData']?.['m:DataSet'];
  if (!dataSet) return [];

  let series = dataSet['g:Series'];
  if (!series) return [];
  if (!Array.isArray(series)) series = [series];

  const observations = [];
  for (const s of series) {
    let obs = s['g:Obs'];
    if (!obs) continue;
    if (!Array.isArray(obs)) obs = [obs];

    for (const o of obs) {
      const period = o['g:ObsDimension']?.['@_value'];
      const value = o['g:ObsValue']?.['@_value'];
      if (period && value != null) {
        observations.push({ month: period, value: parseInt(value, 10) || 0 });
      }
    }
  }

  return observations;
}

/**
 * Sum monthly observations into quarterly rows for asy_applications.
 * @param {Array} monthlyData - [{ month: '2023-01', value: 650 }, ...]
 * @param {string} originName - Full country name
 * @param {string} destName - Full country name
 * @returns {Array} rows ready for asy_applications table
 */
function sumToQuarters(monthlyData, originName, destName) {
  // Group by year+quarter
  const buckets = {};

  for (const { month, value } of monthlyData) {
    const [yearStr, monthStr] = month.split('-');
    const monthNum = parseInt(monthStr, 10);
    const quarter = 'q' + Math.ceil(monthNum / 3);
    const key = `${yearStr}-${quarter}`;

    if (!buckets[key]) {
      buckets[key] = { year: yearStr, quarter, total: 0 };
    }
    buckets[key].total += value;
  }

  return Object.values(buckets).map(b => ({
    record_id: null,
    year: b.year,
    quarter: b.quarter,
    origin: originName,
    destination: destName,
    value: b.total,
  }));
}

/**
 * Main ingestion entry point.
 * Fetches monthly asylum data from Eurostat for all EU/EEA destination × origin pairs,
 * sums months into quarters, and upserts into asy_applications.
 */
async function runEurostatIngestion() {
  const startedAt = new Date();

  try {
    const lastSync = await getLastSyncDate('eurostat');
    const now = new Date();

    // Determine date range
    let startYear, startMonth;
    if (lastSync) {
      startYear = lastSync.getFullYear();
      startMonth = String(lastSync.getMonth() + 1).padStart(2, '0');
    } else {
      // First run: fetch from 2010 (matches seed data range)
      startYear = 2010;
      startMonth = '01';
    }
    const endYear = now.getFullYear();
    const endMonth = String(now.getMonth() + 1).padStart(2, '0');
    const startPeriod = `${startYear}-${startMonth}`;
    const endPeriod = `${endYear}-${endMonth}`;

    const geoEntries = Object.entries(EU_GEO);
    const citizenEntries = Object.entries(CITIZEN_CODES);
    let totalRows = 0;

    // Fetch per destination to keep requests manageable
    for (const [geoIso, destName] of geoEntries) {
      const allRows = [];

      for (const [citizenIso, originName] of citizenEntries) {
        try {
          const monthly = await fetchMonthlyData(citizenIso, geoIso, startPeriod, endPeriod);
          if (monthly.length > 0) {
            const quarterlyRows = sumToQuarters(monthly, originName, destName);
            allRows.push(...quarterlyRows);
          }
        } catch (err) {
          // Log per-pair errors but continue with other pairs
          console.error(`Eurostat fetch failed for ${citizenIso}→${geoIso}: ${err.message}`);
        }

        // Small delay to avoid hammering Eurostat (64 origins × 30 destinations = ~1920 requests)
        await new Promise(r => setTimeout(r, 100));
      }

      // Upsert this destination's rows in batches
      for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
        const batch = allRows.slice(i, i + BATCH_SIZE);
        await db('asy_applications')
          .insert(batch)
          .onConflict(['year', 'quarter', 'origin', 'destination'])
          .merge();
      }
      totalRows += allRows.length;
    }

    await logIngestion({
      source: 'eurostat',
      status: 'success',
      rowsAffected: totalRows,
      startedAt,
    });
  } catch (err) {
    await logIngestion({
      source: 'eurostat',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
    throw err;
  }
}

module.exports = {
  runEurostatIngestion,
  fetchMonthlyData,
  sumToQuarters,
  EU_GEO,
  CITIZEN_CODES,
};
