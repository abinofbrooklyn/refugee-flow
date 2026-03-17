const { parse } = require('csv-parse/sync');
const db = require('../database/connection');
const { logIngestion } = require('./ingestionLogger');
const { reduceGeoPercision } = require('../controllers/api/data/helpers/dataProcessors');

const IOM_CSV_URL =
  'https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv';
const BATCH_SIZE = 500;

/**
 * Parse a "lat, lng" coordinate string into separate lat/lng values with reduced precision.
 * Returns { lat: null, lng: null } for invalid or empty input.
 * @param {string|null} coordStr
 * @returns {{ lat: number|null, lng: number|null }}
 */
function parseCoordinates(coordStr) {
  if (!coordStr || String(coordStr).trim() === '') return { lat: null, lng: null };
  const parts = String(coordStr).split(',');
  if (parts.length !== 2) return { lat: null, lng: null };
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return { lat: null, lng: null };
  return {
    lat: reduceGeoPercision(lat, 2),
    lng: reduceGeoPercision(lng, 2),
  };
}

/**
 * Convert a calendar month number (1-12) to a quarter string ('q1'-'q4').
 * @param {number} month
 * @returns {string}
 */
function monthToQuarter(month) {
  return 'q' + Math.ceil(month / 3);
}

/**
 * Transform raw CSV rows into rows ready for the route_deaths table.
 * @param {Array<Object>} csvRows
 * @returns {Array<Object>}
 */
function transformIomRows(csvRows) {
  return csvRows.map((row) => {
    const coords = parseCoordinates(row['Coordinates']);
    const incidentDate = row['Incident Date'] || null;
    let quarter = null;
    if (incidentDate) {
      const d = new Date(incidentDate);
      if (!isNaN(d.getTime())) {
        quarter = monthToQuarter(d.getMonth() + 1);
      }
    }
    return {
      id: String(row['Main ID']),
      date: incidentDate,
      quarter,
      year: String(row['Incident Year'] || ''),
      dead: row['Number of Dead'] || null,
      missing: row['Minimum Estimated Number of Missing'] || null,
      dead_and_missing: row['Total Number of Dead and Missing'] || null,
      cause_of_death: row['Cause of Death'] || null,
      cause_of_death_display_text: row['Cause of Death'] || null,
      location: row['Country of Incident'] || null,
      description: null,
      source: row['Information Source'] || null,
      lat: coords.lat,
      lng: coords.lng,
      route: row['Migration Route'] || null,
      route_display_text: row['Migration Route'] || null,
      source_url: row['URL'] || null,
    };
  });
}

/**
 * Download the IOM Missing Migrants CSV and parse it into row objects.
 * @returns {Promise<Array<Object>>}
 */
async function fetchAndParseIomCsv() {
  const response = await fetch(IOM_CSV_URL);
  if (!response.ok) {
    throw new Error(`IOM CSV fetch error: ${response.status} ${response.statusText}`);
  }
  const csvText = await response.text();
  return parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
}

/**
 * Main entry: download IOM CSV, transform, upsert into route_deaths, log result.
 * Always downloads full CSV — no date-filter API exists.
 * Uses onConflict('id').ignore() to skip existing records efficiently.
 */
async function runIomIngestion() {
  const startedAt = new Date();
  try {
    const csvRows = await fetchAndParseIomCsv();
    const rows = transformIomRows(csvRows).filter((r) => r.id && r.id !== 'null' && r.id !== 'undefined');

    let totalInserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db('route_deaths').insert(batch).onConflict('id').ignore();
      totalInserted += batch.length;
    }

    await logIngestion({
      source: 'iom',
      status: 'success',
      rowsAffected: totalInserted,
      startedAt,
    });
  } catch (err) {
    await logIngestion({
      source: 'iom',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
  }
}

module.exports = { runIomIngestion, parseCoordinates, transformIomRows, fetchAndParseIomCsv, monthToQuarter };
