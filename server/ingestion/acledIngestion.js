'use strict';

const db = require('../database/connection');
const { logIngestion, getLastSyncDate } = require('./ingestionLogger');
const { reduceGeoPercision } = require('../controllers/api/data/helpers/dataProcessors');
const { validateRows, quarantineRows } = require('./validator');
const { sendQuarantineAlert } = require('./alerter');

const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token';
const ACLED_DATA_URL = 'https://acleddata.com/api/acled/read';
const PAGE_LIMIT = 5000;
const BATCH_SIZE = 500;

/**
 * Format a Date as YYYY-MM-DD for ACLED API date filters.
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Authenticate with ACLED OAuth and return the access_token.
 * Throws if authentication fails.
 */
async function getAcledToken() {
  const params = new URLSearchParams({
    username: process.env.ACLED_EMAIL,
    password: process.env.ACLED_PASSWORD,
    grant_type: 'password',
    client_id: 'acled',
  });
  const res = await fetch(ACLED_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('ACLED auth failed: ' + JSON.stringify(data));
  }
  return data.access_token;
}

/**
 * Map month number (1-12) to quarter string 'q1'-'q4'.
 */
function monthToQuarter(month) {
  return 'q' + Math.ceil(month / 3);
}

/**
 * Fetch all ACLED events with pagination. Optionally filter by lastSync date.
 * @param {string} token - OAuth access token
 * @param {Date|null} lastSync - Date of last successful sync, or null for full fetch
 * @returns {Array} flat array of all event objects
 */
async function fetchAcledEvents(token, lastSync) {
  const allEvents = [];
  let page = 1;

  while (true) {
    let url = `${ACLED_DATA_URL}?_format=json&fields=event_id_cnty|event_date|fatalities|latitude|longitude|notes|year&limit=${PAGE_LIMIT}&page=${page}`;

    if (lastSync instanceof Date) {
      const from = formatDate(lastSync);
      const to = formatDate(new Date());
      url += `&event_date=${from}|${to}&event_date_where=BETWEEN`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const events = json.data || [];
    allEvents.push(...events);

    if (events.length < PAGE_LIMIT) {
      break;
    }
    page++;
  }

  return allEvents;
}

/**
 * Transform raw ACLED events into war_events and war_notes rows.
 * @param {Array} events - raw ACLED event objects
 * @returns {{ warRows: Array, noteRows: Array }}
 */
function transformAcledEvents(events) {
  const warRows = [];
  const noteRows = [];

  for (const e of events) {
    warRows.push({
      event_id: String(e.event_id_cnty),
      year: String(e.year),
      quarter: monthToQuarter(new Date(e.event_date).getMonth() + 1),
      fat: parseInt(e.fatalities, 10) || 0,
      int: null,
      evt: null,
      cot: null,
      lat: reduceGeoPercision(parseFloat(e.latitude), 2),
      lng: reduceGeoPercision(parseFloat(e.longitude), 2),
    });

    noteRows.push({
      id: String(e.event_id_cnty),
      notes: e.notes || null,
      source: 'ACLED',
    });
  }

  return { warRows, noteRows };
}

/**
 * Main ingestion entry point. Fetches ACLED events, transforms, and upserts
 * into war_events and war_notes tables, then logs the result.
 */
async function runAcledIngestion() {
  const startedAt = new Date();

  try {
    const token = await getAcledToken();
    const lastSync = await getLastSyncDate('acled');
    const events = await fetchAcledEvents(token, lastSync);
    const { warRows, noteRows } = transformAcledEvents(events);

    // Filter out rows where lat or lng is NaN
    const validWarRows = warRows.filter(r => !isNaN(r.lat) && !isNaN(r.lng));
    const validNoteRows = noteRows.filter((_, i) => !isNaN(warRows[i].lat) && !isNaN(warRows[i].lng));

    // Validate rows — quarantine bad data, proceed with clean
    let cleanWarRows = validWarRows;
    let quarantineCount = 0;
    try {
      const { clean, quarantined } = await validateRows('acled', validWarRows);
      cleanWarRows = clean;
      quarantineCount = quarantined.length;
      if (quarantined.length > 0) {
        await quarantineRows('acled', quarantined);
        await sendQuarantineAlert('acled', quarantined);
        console.log(`[ACLED] ${quarantined.length} rows quarantined, ${clean.length} clean`);
      }
    } catch (valErr) {
      console.error('[ACLED] Validation failed, proceeding with all rows:', valErr.message);
    }

    // Build a set of clean event_ids to filter notes accordingly
    const cleanEventIds = new Set(cleanWarRows.map(r => r.event_id));
    const cleanNoteRows = validNoteRows.filter(r => cleanEventIds.has(r.id));

    // Upsert war_events in batches of 500
    for (let i = 0; i < cleanWarRows.length; i += BATCH_SIZE) {
      const batch = cleanWarRows.slice(i, i + BATCH_SIZE);
      await db('war_events').insert(batch).onConflict('event_id').ignore();
    }

    // Upsert war_notes in batches of 500
    for (let i = 0; i < cleanNoteRows.length; i += BATCH_SIZE) {
      const batch = cleanNoteRows.slice(i, i + BATCH_SIZE);
      await db('war_notes').insert(batch).onConflict('id').merge();
    }

    await logIngestion({
      source: 'acled',
      status: 'success',
      rowsAffected: cleanWarRows.length,
      startedAt,
      quarantineCount,
    });
  } catch (err) {
    await logIngestion({
      source: 'acled',
      status: 'error',
      errorMessage: err.message,
      startedAt,
    });
    throw err;
  }
}

module.exports = {
  runAcledIngestion,
  getAcledToken,
  fetchAcledEvents,
  transformAcledEvents,
  monthToQuarter,
};
