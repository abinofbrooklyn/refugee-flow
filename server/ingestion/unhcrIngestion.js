const db = require('../database/connection');
const { logIngestion, getLastSyncDate } = require('./ingestionLogger');
const { normalizeCountryName, EU_DESTINATIONS } = require('./countryNormalizer');
const { computeSeasonalRatios, distributeByQuarter } = require('./quarterlyEstimator');
const { validateRows, quarantineRows } = require('./validator');
const { sendQuarantineAlert } = require('./alerter');

const UNHCR_API_BASE = 'https://api.unhcr.org/population/v1/asylum-applications/';
const PAGE_LIMIT = 100;
const BATCH_SIZE = 500;

/**
 * Fetch all UNHCR asylum application records, paginating through all pages.
 * @param {number|null} yearFrom - If provided, only fetch records from this year onward.
 * @returns {Promise<Array>} Flat array of all API items.
 */
async function fetchAllUnhcrApplications(yearFrom) {
  const items = [];
  let page = 1;
  let maxPages = 1;

  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), page: String(page) });
    if (yearFrom != null) {
      params.append('yearFrom', String(yearFrom));
    }
    const url = `${UNHCR_API_BASE}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`UNHCR API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    maxPages = data.maxPages || 1;
    if (Array.isArray(data.items)) {
      items.push(...data.items);
    }
    page += 1;
  } while (page <= maxPages);

  return items;
}

/**
 * Transform raw UNHCR API items into rows ready for asy_applications table.
 * Normalizes country names and skips EU/EEA destinations (Eurostat owns those).
 * UNHCR provides annual totals only — quarter is 'q1' (expanded later in runUnhcrIngestion).
 * @param {Array} items
 * @returns {Array}
 */
function transformUnhcrItems(items) {
  const rows = [];
  for (const item of items) {
    const destination = normalizeCountryName(item.coa_name);
    if (EU_DESTINATIONS.has(destination)) continue; // Eurostat owns EU/EEA data
    rows.push({
      record_id: null,
      year: String(item.year),
      quarter: 'q1',
      origin: normalizeCountryName(item.coo_name),
      destination,
      value: parseInt(item.applied, 10) || 0,
    });
  }
  return rows;
}

/**
 * Main entry: fetch UNHCR data, transform, upsert into asy_applications, log result.
 */
async function runUnhcrIngestion() {
  const startedAt = new Date();
  try {
    const lastSync = await getLastSyncDate('unhcr');
    const yearFrom = lastSync ? lastSync.getFullYear() : null;

    const rawItems = await fetchAllUnhcrApplications(yearFrom);
    const annualRows = transformUnhcrItems(rawItems);

    // Fetch seasonal ratios from existing Eurostat quarterly data
    const eurostatRows = await db('asy_applications')
      .select('origin', 'quarter')
      .sum('value as value')
      .whereIn('destination', Array.from(EU_DESTINATIONS))
      .groupBy('origin', 'quarter');
    const ratios = computeSeasonalRatios(eurostatRows);

    // Expand each annual row into 4 quarterly rows using seasonal ratios
    const expandedRows = [];
    for (const row of annualRows) {
      const originRatios = ratios[row.origin] || null;
      const quarterly = distributeByQuarter(row.value, originRatios);
      for (const q of ['q1', 'q2', 'q3', 'q4']) {
        expandedRows.push({
          ...row,
          quarter: q,
          value: quarterly[q],
        });
      }
    }

    // Deduplicate by conflict key — keep the last occurrence
    const deduped = new Map();
    for (const row of expandedRows) {
      const key = `${row.year}|${row.quarter}|${row.origin}|${row.destination}`;
      deduped.set(key, row);
    }
    const uniqueRows = Array.from(deduped.values());

    // Validate rows — quarantine bad data, proceed with clean
    let cleanRows = uniqueRows;
    let quarantineCount = 0;
    try {
      const { clean, quarantined } = await validateRows('unhcr', uniqueRows);
      cleanRows = clean;
      quarantineCount = quarantined.length;
      if (quarantined.length > 0) {
        await quarantineRows('unhcr', quarantined);
        await sendQuarantineAlert('unhcr', quarantined);
        console.log(`[UNHCR] ${quarantined.length} rows quarantined, ${clean.length} clean`);
      }
    } catch (valErr) {
      console.error('[UNHCR] Validation failed, proceeding with all rows:', valErr.message);
    }

    let totalInserted = 0;
    for (let i = 0; i < cleanRows.length; i += BATCH_SIZE) {
      const batch = cleanRows.slice(i, i + BATCH_SIZE);
      await db('asy_applications')
        .insert(batch)
        .onConflict(['year', 'quarter', 'origin', 'destination'])
        .merge();
      totalInserted += batch.length;
    }

    await logIngestion({
      source: 'unhcr',
      status: 'success',
      rowsAffected: totalInserted,
      startedAt,
      quarantineCount,
    });
  } catch (err) {
    await logIngestion({
      source: 'unhcr',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
  }
}

module.exports = { runUnhcrIngestion, fetchAllUnhcrApplications, transformUnhcrItems };
