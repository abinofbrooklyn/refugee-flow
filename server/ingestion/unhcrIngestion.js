const db = require('../database/connection');
const { logIngestion, getLastSyncDate } = require('./ingestionLogger');

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
 * UNHCR provides annual totals only — quarter is always 'q1'.
 * @param {Array} items
 * @returns {Array}
 */
function transformUnhcrItems(items) {
  return items.map((item) => ({
    record_id: null,
    year: String(item.year),
    quarter: 'q1',
    origin: item.coo_name,
    destination: item.coa_name,
    value: parseInt(item.applied, 10) || 0,
  }));
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
    const rows = transformUnhcrItems(rawItems);

    // Deduplicate rows by conflict key — keep the last occurrence (highest value wins)
    const deduped = new Map();
    for (const row of rows) {
      const key = `${row.year}|${row.quarter}|${row.origin}|${row.destination}`;
      deduped.set(key, row);
    }
    const uniqueRows = Array.from(deduped.values());

    let totalInserted = 0;
    for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
      const batch = uniqueRows.slice(i, i + BATCH_SIZE);
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
