'use strict';

import db from '../database/connection';
import { logIngestion, getLastSyncDate } from './ingestionLogger';
import { reduceGeoPercision } from '../controllers/api/data/helpers/dataProcessors';
import { validateRows, quarantineRows } from './validator';
import { sendQuarantineAlert } from './alerter';
import { IngestionResult } from '../types/ingestion';
import { WarEventRow, WarNoteRow } from '../types/knex';

const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token';
const ACLED_DATA_URL = 'https://acleddata.com/api/acled/read';
const PAGE_LIMIT = 5000;
const BATCH_SIZE = 500;

interface AcledTokenResponse {
  access_token?: string;
  [key: string]: unknown;
}

interface AcledEvent {
  event_id_cnty: string | number;
  event_date: string;
  fatalities: string | number;
  latitude: string | number;
  longitude: string | number;
  notes?: string;
  year: string | number;
}

interface AcledApiResponse {
  data?: AcledEvent[];
  [key: string]: unknown;
}

/**
 * Format a Date as YYYY-MM-DD for ACLED API date filters.
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Authenticate with ACLED OAuth and return the access_token.
 * Throws if authentication fails.
 */
export async function getAcledToken(): Promise<string> {
  const params = new URLSearchParams({
    username: process.env.ACLED_EMAIL ?? '',
    password: process.env.ACLED_PASSWORD ?? '',
    grant_type: 'password',
    client_id: 'acled',
  });
  const res = await fetch(ACLED_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json() as AcledTokenResponse;
  if (!data.access_token) {
    throw new Error('ACLED auth failed: ' + JSON.stringify(data));
  }
  return data.access_token;
}

/**
 * Map month number (1-12) to quarter string 'q1'-'q4'.
 */
export function monthToQuarter(month: number): string {
  return 'q' + Math.ceil(month / 3);
}

/**
 * Fetch all ACLED events with pagination. Optionally filter by lastSync date.
 */
export async function fetchAcledEvents(token: string, lastSync: Date | null): Promise<AcledEvent[]> {
  const allEvents: AcledEvent[] = [];
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
    const json = await res.json() as AcledApiResponse;
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
 */
export function transformAcledEvents(events: AcledEvent[]): {
  warRows: Omit<WarEventRow, 'pk'>[];
  noteRows: WarNoteRow[];
} {
  const warRows: Omit<WarEventRow, 'pk'>[] = [];
  const noteRows: WarNoteRow[] = [];

  for (const e of events) {
    warRows.push({
      event_id: String(e.event_id_cnty),
      year: String(e.year),
      quarter: monthToQuarter(new Date(e.event_date).getMonth() + 1),
      fat: parseInt(String(e.fatalities), 10) || 0,
      int: null,
      evt: null,
      cot: null as unknown as string[],
      lat: reduceGeoPercision(parseFloat(String(e.latitude)), 2),
      lng: reduceGeoPercision(parseFloat(String(e.longitude)), 2),
    });

    noteRows.push({
      id: String(e.event_id_cnty),
      notes: e.notes || null as unknown as string,
      source: 'ACLED',
    });
  }

  return { warRows, noteRows };
}

/**
 * Main ingestion entry point. Fetches ACLED events, transforms, and upserts
 * into war_events and war_notes tables, then logs the result.
 */
export async function runAcledIngestion(): Promise<IngestionResult> {
  const startedAt = new Date();
  const start = Date.now();

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
      console.error('[ACLED] Validation failed, proceeding with all rows:', (valErr as Error).message);
    }

    // Build a set of clean event_ids to filter notes accordingly
    const cleanEventIds = new Set(cleanWarRows.map(r => r.event_id));
    const cleanNoteRows = validNoteRows.filter(r => cleanEventIds.has(r.id));

    // Upsert war_events in batches of 500
    for (let i = 0; i < cleanWarRows.length; i += BATCH_SIZE) {
      const batch = cleanWarRows.slice(i, i + BATCH_SIZE);
      await db<WarEventRow>('war_events').insert(batch).onConflict('event_id').ignore();
    }

    // Upsert war_notes in batches of 500
    for (let i = 0; i < cleanNoteRows.length; i += BATCH_SIZE) {
      const batch = cleanNoteRows.slice(i, i + BATCH_SIZE);
      await db<WarNoteRow>('war_notes').insert(batch).onConflict('id').merge();
    }

    await logIngestion({
      source: 'acled',
      status: 'success',
      rowsAffected: cleanWarRows.length,
      startedAt,
      quarantineCount,
    });

    return {
      source: 'acled',
      rowsAffected: cleanWarRows.length,
      quarantineCount,
      duration: Date.now() - start,
    };
  } catch (err) {
    await logIngestion({
      source: 'acled',
      status: 'error',
      errorMessage: (err as Error).message,
      startedAt,
    });
    throw err;
  }
}
