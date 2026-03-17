# Phase 4: Data Ingestion Pipeline - Research

**Researched:** 2026-03-17
**Domain:** Node.js scheduled ingestion, external REST APIs (ACLED, UNHCR, IOM), CSV parsing, Express admin routes
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Ingestion Runtime**
- Node scripts running within the Express server process — not Supabase Edge Functions
- One ingestion module per data source (ACLED, UNHCR, IOM) in a `server/ingestion/` directory
- Each module exports a function: fetch → transform → geo precision → upsert

**Scheduling Mechanism**
- node-cron within the Express server for weekly schedule
- Jobs run when server is running — acceptable for low-traffic app
- Each source has its own cron schedule (all weekly, staggered)
- Manual trigger via admin API endpoint

**Admin UI**
- React route within the existing SPA at `/admin`
- Shared-secret password check via API middleware (not full auth)
- Flow: enter password → upload CSV → preview parsed rows → commit or cancel
- CSV parser runs server-side; preview returns parsed rows as JSON

**Geo Precision & Dedup**
- All lat/lng precision-reduced to 2 decimal places before storage
- Deduplication on lat,lng composite key at insert time
- Reuse `reduceGeoPercision()` from `server/controllers/api/data/helpers/dataProcessors.js`
- Applied to ALL ingestion sources and CSV uploads

**Failure & Retry Policy**
- Log failures to `ingestion_log` table — no automatic retry
- `ingestion_log` schema: id, source, status (success/error), rows_affected, error_message, started_at, completed_at
- Manual re-run via admin endpoint for recovery

**Incremental Sync**
- Track `last_synced` timestamp per source (via `ingestion_log`)
- After initial full pull, fetch only data newer than `last_synced`

**War Notes Population**
- Populate empty `war_notes` table from ACLED API `notes` field
- Part of the ACLED ingestion module

### Claude's Discretion
- Specific ACLED, UNHCR, and IOM API endpoint URLs and query parameters
- API key management approach (env vars)
- CSV parsing library choice
- node-cron schedule expressions (weekly, staggered)
- Exact `ingestion_log` table migration design
- Admin UI component structure and styling
- Whether to add an ingestion status dashboard to admin page
- Upsert strategy (INSERT ON CONFLICT vs DELETE+INSERT)

### Deferred Ideas (OUT OF SCOPE)
- Ingestion status dashboard in admin UI
- Email/Slack alerting on ingestion failure
- Historical backfill from ACLED/UNHCR archives
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INGEST-01 | War/conflict data ingested automatically from ACLED API on weekly schedule | ACLED OAuth + `notes` + `fatalities` + `latitude`/`longitude` fields documented; node-cron v4.2.1 weekly syntax confirmed |
| INGEST-02 | Asylum application data ingested automatically from UNHCR API on weekly schedule | UNHCR `https://api.unhcr.org/population/v1/asylum-applications/` confirmed public (no auth); pagination via `page`/`maxPages` documented |
| INGEST-03 | Route death data ingested automatically from IOM Missing Migrants API on weekly schedule | IOM has no REST API; direct CSV download URL confirmed: `/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv`; CSV field mapping documented |
| INGEST-04 | All ingested lat/lng data passes through precision reduction and deduplication before storage | `reduceGeoPercision()` in dataProcessors.js confirmed reusable; Knex `onConflict().merge()` for upsert documented |
| INGEST-05 | Ingestion failures logged to `ingestion_log` table with error details | Migration pattern documented; try/catch wrapper pattern defined |
| INGEST-06 | Admin can upload CSV data via password-protected `/admin` route | multer v2.1.1 for upload; middleware shared-secret pattern defined |
| INGEST-07 | CSV uploads show preview before committing to database | csv-parse v6.1.0 server-side; preview returns JSON rows; two-step commit flow documented |
</phase_requirements>

---

## Summary

Phase 4 builds a data pipeline on top of the existing Express/Knex/Supabase stack from Phase 3. Three external data sources feed the database on a weekly cron schedule: ACLED (conflict events + war notes), UNHCR (asylum applications), and IOM Missing Migrants (route deaths). The key architectural challenge is that the three APIs have very different authentication and access models — ACLED requires OAuth bearer tokens, UNHCR is fully public (no auth), and IOM has no REST API at all and requires downloading a CSV file from a direct URL.

The admin route adds a second ingestion path: authenticated CSV upload for supplemental data. A shared-secret middleware (one `ADMIN_SECRET` env var checked against `Authorization: Bearer <secret>`) gates all admin endpoints. The CSV flow is two-step: POST to `/admin/csv/preview` returns parsed rows as JSON, then POST to `/admin/csv/commit` writes them to the database. The `ingestion_log` table records every run's outcome for observability without external alerting infrastructure.

The project already has all the scaffolding needed: Express, Knex, dotenv, the `reduceGeoPercision()` helper, and the `batchInsert` pattern from the seed script. The primary new dependencies are `node-cron` (scheduling), `multer` (file upload), and `csv-parse` (CSV parsing).

**Primary recommendation:** Follow the seed script's fetch → transform → geo precision → batchInsert pattern for all three ingestion modules. Use Knex `onConflict().ignore()` (or `.merge()`) for upsert idempotency instead of TRUNCATE+INSERT, which would destroy existing data.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | 4.2.1 | Weekly scheduled task execution inside Express process | Lightweight, cron-syntax familiar, no external daemon required |
| multer | 2.1.1 | Multipart/form-data file upload middleware for Express | De-facto standard for Express file uploads; memory storage keeps files in buffer for immediate parsing |
| csv-parse | 6.1.0 | CSV buffer/stream parsing server-side | Battle-tested, supports `columns: true` for header-keyed objects, sync + callback + stream APIs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch (or built-in `fetch`) | Node 18+ built-in | HTTP requests to ACLED and UNHCR APIs | Node 18+ provides global `fetch`; no additional package needed if server runs Node 18+ |
| pg-connection-string | already installed | Already used in db/connection.js | No new dependency needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| csv-parse | papaparse | papaparse (v5.5.3) is browser-first; csv-parse is Node-native with better streaming support |
| multer memory storage | multer disk storage | Disk storage writes temp files; memory keeps buffer in RAM — simpler for small CSV uploads |
| node-cron | node-schedule | node-schedule allows more complex date-based scheduling; node-cron is locked in CONTEXT.md |

### Installation
```bash
npm install node-cron csv-parse multer
```

---

## External API Reference

### ACLED API
**Source:** [acleddata.com/api-documentation/acled-endpoint](https://acleddata.com/api-documentation/acled-endpoint) — MEDIUM confidence (official docs, OAuth details verified)

**Authentication:** OAuth 2.0 password grant — requires `ACLED_EMAIL` + `ACLED_PASSWORD` env vars.

```
POST https://acleddata.com/oauth/token
Body: { email, password, grant_type: "password", client_id: "acled" }
Response: { access_token, refresh_token, expires_in }
```

Token is valid 24 hours. Include as `Authorization: Bearer <token>` on data requests.

**Data endpoint:**
```
GET https://acleddata.com/api/acled/read
Params:
  _format=json
  event_date=<YYYY-MM-DD>|<YYYY-MM-DD>&event_date_where=BETWEEN  (incremental)
  fields=event_id_cnty|event_date|fatalities|latitude|longitude|notes|year
  limit=<N>&page=<N>  (pagination)
```

**Key response fields:**
| ACLED Field | DB Column | Notes |
|-------------|-----------|-------|
| `event_id_cnty` | `war_events.event_id` | String ID like "SYR1234" — needs mapping to integer or store as text |
| `fatalities` | `war_events.fat` | Integer |
| `latitude` | `war_events.lat` | Decimal — apply `reduceGeoPercision()` |
| `longitude` | `war_events.lng` | Decimal — apply `reduceGeoPercision()` |
| `notes` | `war_notes.notes` | Short event description |
| `year` | `war_events.year` | String |

**IMPORTANT — event_id_cnty type mismatch:** The DB schema stores `event_id` as `integer` but ACLED returns string IDs like `"SYR1234"`. The planner must decide: store as text (requires migration) or hash to integer. Research recommendation: store as text to preserve fidelity — requires an `ALTER TABLE war_events ALTER COLUMN event_id TYPE text` migration.

**Quarter derivation:** ACLED does not return quarter. Derive from `event_date` month: Jan-Mar=q1, Apr-Jun=q2, Jul-Sep=q3, Oct-Dec=q4.

**Rate limits:** Not explicitly documented. Stagger cron jobs (ACLED runs Monday, UNHCR Wednesday, IOM Friday) to avoid simultaneous calls.

---

### UNHCR Refugee Statistics API
**Source:** [api.unhcr.org/population/v1/asylum-applications/](https://api.unhcr.org/population/v1/asylum-applications/) — HIGH confidence (live API verified)

**Authentication:** None required (public API).

**Data endpoint:**
```
GET https://api.unhcr.org/population/v1/asylum-applications/
Params:
  limit=100          (records per page, max ~100)
  page=<N>           (pagination: use maxPages from response)
  yearFrom=<YYYY>    (incremental — filter by start year)
  yearTo=<YYYY>      (end year filter)
  _format=json       (optional, JSON is default)
```

**Response structure:**
```json
{
  "page": 1,
  "maxPages": 42,
  "total": { "applied": 3848894 },
  "items": [
    {
      "year": 2023,
      "coo_name": "Afghanistan",
      "coo_iso": "AFG",
      "coa_name": "Germany",
      "coa_iso": "DEU",
      "procedure_type": "G",
      "app_type": "N",
      "applied": 25000
    }
  ]
}
```

**IMPORTANT — no quarter field:** UNHCR API does not provide quarterly breakdown. Insert with `quarter: 'q1'` as a placeholder, or assign all to `q1` for annual data. This means ingested UNHCR data will differ structurally from seeded data (which had q1-q4 from source JSON). The planner must decide how to handle this — research recommendation: use a single `year` aggregate per record and store all in `q1` (the app's front-end already handles sparse quarters).

**Field mapping:**
| UNHCR Field | DB Column |
|-------------|-----------|
| `coo_name` | `asy_applications.origin` |
| `coa_name` | `asy_applications.destination` |
| `year` | `asy_applications.year` |
| `applied` | `asy_applications.value` |
| *(none)* | `asy_applications.quarter` → use `'q1'` |
| *(none)* | `asy_applications.record_id` → generate or use null |

---

### IOM Missing Migrants
**Source:** [missingmigrants.iom.int/downloads](https://missingmigrants.iom.int/downloads) — MEDIUM confidence (CSV URL structure verified, API confirmed absent)

**Authentication:** None required (public download, Creative Commons 4.0).

**No REST API exists.** Data is downloaded as a CSV file from:
```
https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv
```

The ingestion module fetches this URL with `fetch()`, streams the response body through `csv-parse`, and upserts the parsed rows.

**Confirmed CSV field names (from live file):**
| CSV Column | DB Column | Notes |
|------------|-----------|-------|
| `Main ID` | `route_deaths.id` | String — already text in DB |
| `Incident Date` | `route_deaths.date` | Date string |
| `Incident Year` | `route_deaths.year` | String |
| `Number of Dead` | `route_deaths.dead` | Store as text per DB schema |
| `Minimum Estimated Number of Missing` | `route_deaths.missing` | Store as text |
| `Total Number of Dead and Missing` | `route_deaths.dead_and_missing` | Store as text |
| `Cause of Death` | `route_deaths.cause_of_death` | Text |
| `Country of Incident` | `route_deaths.location` | Text (maps to location) |
| `Migration Route` | `route_deaths.route` | Text |
| `Coordinates` | `route_deaths.lat` + `.lng` | Single "lat,lng" string — must split and parse |
| `Information Source` | `route_deaths.source` | Text |
| `URL` | `route_deaths.source_url` | Text |

**IMPORTANT — Coordinates column:** The CSV has a single `Coordinates` field containing a lat,lng pair as a string (e.g., `"35.12, 14.52"`). The ingestion module must split on `,`, parse both as floats, then apply `reduceGeoPercision()`. Some records may have empty coordinates (same pattern as seed: treat as null).

**Quarter derivation:** Derive from `Incident Date` or `Month` column, same month-to-quarter mapping as ACLED.

**Incremental approach for IOM:** Since there is no date-filter API, the full CSV is always downloaded. Use `onConflict('id').ignore()` in Knex to skip existing records — this is efficient as the CSV is a fixed-size file (~10MB total history).

---

## Architecture Patterns

### Recommended Project Structure
```
server/
├── ingestion/
│   ├── acledIngestion.js       # ACLED conflict events + war notes
│   ├── unhcrIngestion.js       # Asylum applications
│   ├── iomIngestion.js         # Route deaths (CSV download)
│   └── ingestionLogger.js      # Shared logging to ingestion_log table
├── routes/
│   ├── dataRoute.js            # Existing (unchanged)
│   └── adminRoute.js           # NEW: admin endpoints
├── controllers/
│   ├── api/data/               # Existing (unchanged)
│   └── admin/
│       └── adminController.js  # NEW: CSV upload + manual trigger handlers
├── middleware/
│   └── adminAuth.js            # NEW: shared-secret check middleware
db/
└── migrations/
    └── 002_create_ingestion_log.js  # NEW migration
```

### Pattern 1: Ingestion Module Structure

Each ingestion module exports a single async function following this contract:

```javascript
// server/ingestion/acledIngestion.js
const db = require('../database/connection');
const { reduceGeoPercision } = require('../controllers/api/data/helpers/dataProcessors');
const { logIngestion } = require('./ingestionLogger');

async function runAcledIngestion() {
  const startedAt = new Date();
  let rowsAffected = 0;

  try {
    // 1. Authenticate
    const token = await getAcledToken();

    // 2. Fetch (with last_synced for incremental)
    const lastSync = await getLastSyncDate('acled');
    const events = await fetchAcledEvents(token, lastSync);

    // 3. Transform + geo precision
    const rows = events.map(e => ({
      event_id: e.event_id_cnty,
      year: String(e.year),
      quarter: monthToQuarter(new Date(e.event_date).getMonth() + 1),
      fat: e.fatalities,
      lat: reduceGeoPercision(parseFloat(e.latitude), 2),
      lng: reduceGeoPercision(parseFloat(e.longitude), 2),
    }));

    // 4. Dedup on lat,lng composite
    const deduped = deduplicateByLatLng(rows);

    // 5. Upsert (INSERT ON CONFLICT DO NOTHING for event_id)
    rowsAffected = await db('war_events')
      .insert(deduped)
      .onConflict('event_id')
      .ignore();

    await logIngestion({ source: 'acled', status: 'success', rowsAffected, startedAt });
  } catch (err) {
    await logIngestion({ source: 'acled', status: 'error', errorMessage: err.message, startedAt });
    throw err; // re-throw so cron can log
  }
}

module.exports = { runAcledIngestion };
```

### Pattern 2: node-cron Initialization in server.js

Weekly staggered schedule — Monday for ACLED, Wednesday for UNHCR, Friday for IOM:

```javascript
// server/server.js — add after existing middleware setup
const cron = require('node-cron');
const { runAcledIngestion } = require('./ingestion/acledIngestion');
const { runUnhcrIngestion } = require('./ingestion/unhcrIngestion');
const { runIomIngestion } = require('./ingestion/iomIngestion');

// Staggered weekly schedules (all at 02:00 server time)
// Format: second(optional) minute hour day-of-month month day-of-week
cron.schedule('0 2 * * 1', () => runAcledIngestion().catch(console.error));   // Monday
cron.schedule('0 2 * * 3', () => runUnhcrIngestion().catch(console.error));   // Wednesday
cron.schedule('0 2 * * 5', () => runIomIngestion().catch(console.error));     // Friday
```

**Note on node-cron v4:** The API is `cron.schedule(expression, callback)` — identical in v3 and v4 for basic usage. The `6-field` format (with optional leading seconds field) is supported.

### Pattern 3: Admin Shared-Secret Middleware

```javascript
// server/middleware/adminAuth.js
function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
module.exports = adminAuth;
```

### Pattern 4: CSV Upload + Preview (Two-Step)

```javascript
// server/routes/adminRoute.js
const multer = require('multer');
const { parse } = require('csv-parse/sync');  // sync API for small CSVs
const adminAuth = require('../middleware/adminAuth');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.use(express.json());
router.use(adminAuth);

// Step 1: Preview — parse and return rows as JSON
router.post('/csv/preview', upload.single('file'), (req, res) => {
  try {
    const rows = parse(req.file.buffer, {
      columns: true,        // use first row as headers
      skip_empty_lines: true,
      trim: true,
    });
    res.json({ rows, count: rows.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Step 2: Commit — validate and insert confirmed rows
router.post('/csv/commit', async (req, res) => {
  try {
    const { rows, target } = req.body; // target: 'route_deaths' | 'war_events' | etc.
    // transform + upsert rows to target table
    // ...
    res.json({ inserted: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Pattern 5: Knex Upsert Strategy

Use `onConflict().ignore()` to skip duplicates (idempotent re-runs):

```javascript
// INSERT, skip if primary key already exists
await db('route_deaths')
  .insert(rows)
  .onConflict('id')
  .ignore();
```

For `war_events` (no natural primary key unique constraint at the event_id level yet), use `batchInsert` with a preceding cleanup step or add a unique constraint on `event_id` via migration.

### Anti-Patterns to Avoid
- **TRUNCATE then re-insert on every weekly run:** Destroys previously-uploaded CSV supplement data that isn't in the APIs. Use upsert instead.
- **Running all three cron jobs at the same time:** Schedule at different weekdays (Mon/Wed/Fri) to avoid concurrent API calls and rate-limit issues.
- **Storing tokens in memory without refresh:** ACLED tokens expire in 24 hours. Re-authenticate on each ingestion run (weekly runs are well within the 24h window, but don't cache across restarts).
- **Parsing `Coordinates` as a single string in the DB:** Always split to separate `lat` and `lng` columns. The CSV has `"35.12, 14.52"` format.
- **Running cron jobs during test:** Gate cron initialization behind `if (require.main === module)` (same pattern already used in server.js for `app.listen`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload handling | Custom multipart body parser | multer | multipart/form-data boundaries are complex; multer handles memory/disk storage, file size limits, MIME type filtering |
| CSV parsing | Manual string split | csv-parse | Handles quoted fields, escaped commas, BOM markers, encoding issues |
| Cron scheduling | setInterval with manual time math | node-cron | Cron expressions are well-understood; setInterval drifts and doesn't handle server restart |
| OAuth token management | Custom token cache/refresh | Re-authenticate per run | Weekly runs are within 24h token lifetime — no need for refresh token logic in v1 |
| Dedup logic | Custom Set-based dedup | Knex `onConflict().ignore()` + existing `uniqBy` | DB-level dedup is authoritative; memory dedup only catches duplicates within a single batch |

---

## Common Pitfalls

### Pitfall 1: ACLED event_id Type Mismatch
**What goes wrong:** DB schema has `event_id` as `integer`, but ACLED API returns `event_id_cnty` as a country-prefixed string like `"SYR14523"`. Attempting to insert causes a Postgres type error.
**Why it happens:** The seed data (from original JSON) had numeric IDs; ACLED API uses a different ID format.
**How to avoid:** Write a migration `002` that alters `war_events.event_id` from `integer` to `text` BEFORE writing the ingestion module. Also add a unique index on `event_id` for upsert support.
**Warning signs:** `ERROR: invalid input syntax for type integer` during first ingestion run.

### Pitfall 2: IOM Coordinates Column is a Combined String
**What goes wrong:** CSV column named `Coordinates` contains `"35.12, 14.52"` — a single string with both lat and lng. Treating it as lat alone, or failing to split, produces null or wrong coordinates.
**Why it happens:** IOM's CSV format combines coordinates into one column, unlike the existing `route_death.json` which had separate `lat` and `lng`.
**How to avoid:** In the IOM ingestion module, always split `Coordinates` on `,`, trim whitespace, and apply `reduceGeoPercision(parseFloat(...), 2)` to each part.
**Warning signs:** All route death events appear at `lat=null` or at coordinate `0,0` on the globe.

### Pitfall 3: UNHCR API Has No Quarter Field
**What goes wrong:** `asy_applications` table requires a `quarter` column value, but UNHCR API returns annual totals only. Inserting without a quarter value causes a not-null constraint violation (if enforced) or produces data that only populates one quarter in the UI.
**Why it happens:** UNHCR provides annual statistics — the existing seeded data had quarterly breakdowns from a different source JSON that UNHCR no longer exposes via API.
**How to avoid:** Insert all UNHCR records with `quarter: 'q1'`. Document this as a data limitation. The front-end iterates q1-q4 but handles empty arrays gracefully.
**Warning signs:** UI shows data only in Q1 for UNHCR-ingested years.

### Pitfall 4: Cron Jobs Running in Test Environment
**What goes wrong:** Jest test suite imports `server.js` which initializes cron jobs, causing scheduled functions to run or interfere during tests (open handles, timeouts).
**Why it happens:** node-cron registers timers that prevent Node from exiting cleanly.
**How to avoid:** Gate cron initialization: `if (require.main === module) { cron.schedule(...) }`. This mirrors the existing `app.listen` pattern already in `server/server.js`.
**Warning signs:** Jest reports "open handles" or tests hang after completion.

### Pitfall 5: Admin Route Ordering in server.js
**What goes wrong:** The catch-all `res.sendFile(index.html)` route in server.js intercepts `/admin` API calls before they reach the admin router, returning HTML instead of JSON.
**Why it happens:** Express matches routes in order; the static file handler and SPA fallback are currently the last routes. Admin API routes (e.g., `/admin/csv/preview`) must be mounted BEFORE the static/fallback handlers.
**How to avoid:** Mount admin routes before `app.use(express.static(...))` and the SPA fallback.
**Warning signs:** POST `/admin/csv/preview` returns 200 with HTML content.

### Pitfall 6: ingestion_log Started_at/Completed_at Timezone
**What goes wrong:** `started_at` and `completed_at` are stored as local time, making log entries hard to compare across environments.
**Why it happens:** `new Date()` returns local time in Node.
**How to avoid:** Always store as UTC: `new Date().toISOString()` or use Postgres `NOW()` via `db.fn.now()`.

---

## Code Examples

### IOM CSV Fetch and Parse

```javascript
// Source: csv-parse docs (csv.js.org/parse/) + IOM URL confirmed at missingmigrants.iom.int
const { parse } = require('csv-parse/sync');

async function fetchIomData() {
  const response = await fetch(
    'https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv'
  );
  const csvText = await response.text();
  const rows = parse(csvText, {
    columns: true,        // first row as headers
    skip_empty_lines: true,
    trim: true,
  });
  return rows;
}
```

### IOM Coordinates Splitting

```javascript
// Coordinates column: "35.12, 14.52" format
function parseCoordinates(coordStr) {
  if (!coordStr || coordStr.trim() === '') return { lat: null, lng: null };
  const parts = coordStr.split(',');
  if (parts.length !== 2) return { lat: null, lng: null };
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return { lat: null, lng: null };
  return {
    lat: reduceGeoPercision(lat, 2),
    lng: reduceGeoPercision(lng, 2),
  };
}
```

### ACLED OAuth Authentication

```javascript
// Source: acleddata.com/api-documentation/getting-started
async function getAcledToken() {
  const res = await fetch('https://acleddata.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.ACLED_EMAIL,
      password: process.env.ACLED_PASSWORD,
      grant_type: 'password',
      client_id: 'acled',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('ACLED auth failed: ' + JSON.stringify(data));
  return data.access_token;
}
```

### UNHCR Paginated Fetch

```javascript
// Source: api.unhcr.org/population/v1/ — live API verified
async function fetchAllUnhcrApplications(yearFrom) {
  const items = [];
  let page = 1;
  let maxPages = 1;
  do {
    const url = new URL('https://api.unhcr.org/population/v1/asylum-applications/');
    url.searchParams.set('limit', '100');
    url.searchParams.set('page', String(page));
    if (yearFrom) url.searchParams.set('yearFrom', String(yearFrom));
    const res = await fetch(url.toString());
    const data = await res.json();
    items.push(...data.items);
    maxPages = data.maxPages;
    page++;
  } while (page <= maxPages);
  return items;
}
```

### ingestion_log Knex Upsert + Logging

```javascript
// server/ingestion/ingestionLogger.js
const db = require('../database/connection');

async function logIngestion({ source, status, rowsAffected = 0, errorMessage = null, startedAt }) {
  await db('ingestion_log').insert({
    source,
    status,
    rows_affected: rowsAffected,
    error_message: errorMessage,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
  });
}

async function getLastSyncDate(source) {
  const row = await db('ingestion_log')
    .where({ source, status: 'success' })
    .orderBy('completed_at', 'desc')
    .first();
  return row ? new Date(row.completed_at) : null;
}

module.exports = { logIngestion, getLastSyncDate };
```

### node-cron Weekly Schedule (v4 syntax)

```javascript
// Source: github.com/node-cron/node-cron — v4.0.0 confirmed
const cron = require('node-cron');

// Format: minute hour day-of-month month day-of-week
// '0 2 * * 1' = Monday at 02:00
cron.schedule('0 2 * * 1', () => {
  runAcledIngestion().catch(err => console.error('[ACLED cron]', err.message));
});
```

### .env.example additions

```bash
# Data Ingestion API Keys
ACLED_EMAIL=your_acled_account_email
ACLED_PASSWORD=your_acled_account_password

# Admin shared secret (any long random string)
ADMIN_SECRET=your_random_secret_here
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ACLED API key in query params | OAuth 2.0 bearer token | ~2023 (ACLED migrated) | Must POST to token endpoint first; no simple `?key=X` parameter |
| IOM REST API | CSV download only | IOM never had a public REST API | Ingestion module must fetch full CSV each time; use `onConflict().ignore()` for idempotency |
| node-cron v2/v3 | v4.2.1 | 2024-2025 | Same `cron.schedule()` API; ES module support added; no breaking changes for CJS usage |

**Deprecated/outdated:**
- ACLED query-param authentication (`?email=X&key=Y`): The old API used this; the current API uses OAuth. Any existing examples using `?key=` are from the pre-2023 API and will not work.

---

## Open Questions

1. **ACLED event_id type — text vs. integer in DB**
   - What we know: DB has `event_id integer`; ACLED returns `event_id_cnty` as strings like `"SYR14523"`
   - What's unclear: Does the existing seeded data use numeric IDs that would conflict with ACLED string IDs? The seed loaded from `war_all.json` which had `ev.id` as numeric.
   - Recommendation: Write migration `002` to add `event_id` unique constraint and change type to `text`. The existing integer IDs from seed data will be cast to text strings cleanly.

2. **UNHCR asylum data quarterly breakdown**
   - What we know: UNHCR API only returns annual totals; existing DB data has q1-q4 breakdown from original JSON seed
   - What's unclear: Will the front-end degrade gracefully if all UNHCR-ingested records are in q1?
   - Recommendation: Store with `quarter: 'q1'` for ingested data. Front-end already handles empty arrays for quarters.

3. **war_notes schema compatibility with ACLED `notes` field**
   - What we know: `war_notes` schema is `{ id integer PK, notes text, source text }`. ACLED provides `notes` text and `event_id_cnty` string.
   - What's unclear: `war_notes.id` is integer PK but `event_id_cnty` from ACLED is a string. Must align foreign key.
   - Recommendation: If `war_events.event_id` becomes text, also change `war_notes.id` to text. Or derive a hash. Include in the migration plan.

4. **ACLED API rate limits and pagination limit**
   - What we know: ACLED docs don't specify explicit rate limits for OAuth users; pagination uses `page` param
   - What's unclear: Maximum `limit` per page, and whether there's a requests-per-day cap
   - Recommendation: Use `limit=5000` (common ACLED default) with pagination loop. Add 500ms delay between pages if rate errors are encountered.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 |
| Config file | `jest.config.js` (already exists — `projects[1]` is `server` matching `tests/server/**/*.test.js`) |
| Quick run command | `npx jest --testPathPattern=tests/server --testNamePattern="ingestion"` |
| Full suite command | `npx jest --testPathPattern=tests/server` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 | ACLED ingestion module runs without error and inserts rows | unit (mocked fetch) | `npx jest tests/server/ingestion.test.js -t "ACLED"` | Wave 0 |
| INGEST-02 | UNHCR ingestion module runs without error and inserts rows | unit (mocked fetch) | `npx jest tests/server/ingestion.test.js -t "UNHCR"` | Wave 0 |
| INGEST-03 | IOM ingestion module parses CSV and inserts rows | unit (mocked fetch) | `npx jest tests/server/ingestion.test.js -t "IOM"` | Wave 0 |
| INGEST-04 | All ingested lat/lng values are precision-reduced to 2 dp | unit | `npx jest tests/server/ingestion.test.js -t "geo precision"` | Wave 0 |
| INGEST-05 | ingestion_log table records success and error rows | unit | `npx jest tests/server/ingestion.test.js -t "ingestion_log"` | Wave 0 |
| INGEST-06 | POST /admin/csv/preview returns 401 without secret, 200 with | integration | `npx jest tests/server/admin.test.js -t "auth"` | Wave 0 |
| INGEST-07 | POST /admin/csv/preview returns parsed rows as JSON | integration | `npx jest tests/server/admin.test.js -t "preview"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest tests/server/ingestion.test.js tests/server/admin.test.js --passWithNoTests`
- **Per wave merge:** `npx jest --testPathPattern=tests/server`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/server/ingestion.test.js` — unit tests for all 3 ingestion modules (mocked fetch, mocked db)
- [ ] `tests/server/admin.test.js` — integration tests for `/admin` routes using supertest
- [ ] `db/migrations/002_create_ingestion_log.js` — must exist before any ingestion tests run (or mock db)

---

## Sources

### Primary (HIGH confidence)
- [ACLED API elements docs](https://acleddata.com/api-documentation/elements-acleds-api) — query parameters, field names, response structure
- [ACLED endpoint docs](https://acleddata.com/api-documentation/acled-endpoint) — base URL `https://acleddata.com/api/acled/read`, field names (`notes`, `fatalities`, `latitude`, `longitude`, `event_id_cnty`)
- [ACLED getting started](https://acleddata.com/api-documentation/getting-started) — OAuth authentication flow confirmed
- [UNHCR asylum-applications API](https://api.unhcr.org/population/v1/asylum-applications/?limit=5) — live API response verified: fields `year`, `coo_name`, `coa_name`, `applied`, `maxPages`
- [IOM Missing Migrants allData CSV](https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv) — CSV headers confirmed: `Main ID`, `Incident Date`, `Coordinates`, `Number of Dead`, `Migration Route`, etc.
- `npm view` commands — confirmed versions: node-cron@4.2.1, multer@2.1.1, csv-parse@6.1.0, papaparse@5.5.3

### Secondary (MEDIUM confidence)
- [node-cron GitHub](https://github.com/node-cron/node-cron) — v4.0.0 API, 6-field cron expression format
- [IOM downloads page](https://missingmigrants.iom.int/downloads) — confirmed no REST API, only CSV download

### Tertiary (LOW confidence)
- UNHCR asylum-applications quarterly breakdown — confirmed absent via live API; front-end compatibility with q1-only data is inferred from reading dataController.js (handles empty arrays)
- ACLED rate limits — not documented; recommendation to stagger cron jobs is precautionary

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions confirmed via npm registry
- Architecture: HIGH — all patterns derived from existing codebase (seed.js, server.js, dataRoute.js)
- API specifics: MEDIUM — ACLED OAuth flow and UNHCR response structure confirmed via live/official sources; ACLED field names confirmed from docs
- Pitfalls: HIGH — IOM coordinates format confirmed from live CSV, event_id type mismatch confirmed from code review, cron-in-test pitfall is well-known pattern

**Research date:** 2026-03-17
**Valid until:** 2026-06-17 (APIs are stable; ACLED OAuth format unlikely to change; IOM CSV URL may shift — verify before implementation)
