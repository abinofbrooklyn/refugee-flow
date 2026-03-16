# Phase 3: Database Migration - Research

**Researched:** 2026-03-15
**Domain:** PostgreSQL / Knex.js / Docker Compose / Express data layer
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hosted Supabase (supabase.com free tier) — no self-hosting
- Remove MongoDB and Mongoose entirely — clean break, no fallback
- Switch from config.js to .env + dotenv for all configuration
- .env.example ships with local docker-compose defaults; production .env points to Supabase
- Normalize ALL 5 JSON datasets into proper relational tables — no JSONB blobs
- War data: flatten the nested Year → quarter → events structure into a relational war_events table (or similar)
- Asylum data: normalize the year + mixed-type value object into proper columns
- Route data (route_death, IBC_all, country_route_list): each gets its own table with proper columns
- Create war_notes table in Postgres (id, notes, source). MongoDB data is LOST. War notes table created empty for Phase 3; ACLED sourcing deferred to Phase 4
- Geo coordinates stored pre-reduced (2 decimal places) and deduplicated on lat,lng composite key at insert time
- Existing reduceGeoPercision() and uniqBy logic moves to the seed/insert layer
- Node seed script (scripts/seed.js or similar) reads JSON files, applies precision reduction + dedup, inserts into Postgres
- Seed from JSON files only — MongoDB is inaccessible, no export possible
- Use a migration tool (knex migrations, dbmate, or similar) for versioned schema creation — not raw SQL
- All-at-once endpoint cutover — build all Postgres queries, seed all data, swap all 6 endpoints together
- Postgres container only — Express still runs on host via npm
- Auto-seed on first run via Docker entrypoint init script
- Named Docker volume for data persistence across restarts (docker-compose down -v to reset)
- Expose port 5432 to host for direct DB access (psql, pgAdmin, GUI tools)

### Claude's Discretion
- Database client/ORM choice (pg, knex, drizzle, or Supabase JS client)
- Migration tool choice (knex migrations, dbmate, or similar)
- Exact table names, column types, and index strategy
- How to handle the client-side IBC_crossingCountByCountry.json (currently imported directly in frontend, bypasses API)
- Seed script error handling and idempotency approach

### Deferred Ideas (OUT OF SCOPE)
- War notes data population from ACLED API — Phase 4 ingestion pipeline
- ACLED incremental sync (filter by date range since last sync), last_synced timestamp per source
- Incremental pattern for all ingestion sources (ACLED, UNHCR, IOM)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | All data served from PostgreSQL (Supabase) — no MongoDB dependency | Knex + pg as client; remove mongoose; dotenv replaces config.js; all 6 endpoints rewritten against Postgres tables |
| DB-02 | All 6 existing API endpoints return identical response shapes from PostgreSQL | Response shape analysis below confirms exact shapes; JSON aggregation via jsonb_build_object + jsonb_agg needed for war and asylum nested formats |
| DB-03 | Geo coordinates stored precision-reduced and deduplicated in the database | Seed script applies reduceGeoPercision(n,2) and dedup before INSERT; UNIQUE constraint on (lat,lng) enforces dedup at DB level for war_events |
| DB-04 | Local PostgreSQL dev environment available via docker-compose | Docker official postgres image + /docker-entrypoint-initdb.d pattern for auto-seed on first run; named volume for persistence |
</phase_requirements>

---

## Summary

This phase replaces a MongoDB/Mongoose-backed Express API with a PostgreSQL-backed one using Knex.js as both the query builder and migration runner. The app has 5 static JSON dataset files (26 MB total) that need to be normalized into relational tables and seeded via a one-time seed script. Six Express endpoints must return response shapes byte-for-byte identical to the current JSON-file-backed implementations — no frontend changes permitted.

The war data is the trickiest normalization challenge. It's currently a 9-entry array (one per year, 2010-2018) where each year has 4 quarters (q1-q4), and each quarter contains 1000-1700 conflict event objects. The API endpoint reconstructs this exact nested shape, so the Postgres query must use `jsonb_build_object` + `jsonb_agg` aggregate functions to reproduce the `{Year, value: {q1:[...], q2:[...], q3:[...], q4:[...]}}` shape. Alternatively, and more robustly, the controller can re-assemble the nested shape in Node.js from flat SELECT results — this is simpler to write and debug, and the dataset is small enough (9 years * ~5000 events) that application-layer assembly is fast.

For local dev, the official Docker postgres image auto-runs any `.sql` or `.sh` scripts placed in `/docker-entrypoint-initdb.d/` on first container start. The seed is triggered there by a shell script that calls `node scripts/seed.js`. Supabase's free tier provides a standard PostgreSQL connection string; `pg` (node-postgres) connects to both the local Docker container and Supabase using the same `DATABASE_URL` env var, making environment switching trivial.

**Primary recommendation:** Use Knex.js for migrations + query builder, with `pg` (node-postgres) as the underlying driver. This is the most battle-tested combination for Express + PostgreSQL, has the best `batchInsert` support for seeding, and avoids TypeScript requirement of Drizzle.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg (node-postgres) | ^8.x | PostgreSQL driver | Canonical Node.js Postgres driver; used by Knex under the hood; connects to both local Docker and Supabase with same connection string |
| knex | ^3.x | Migration runner + query builder | Built-in migration versioning (knex_migrations table), batchInsert utility, works identically against local Docker and Supabase |
| dotenv | ^16.x | Env var loading | Industry standard; loads .env into process.env before any other require; supports .env.example convention |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lodash (already installed) | ^4.x | round + uniqBy in seed script | Already in package.json; reuse existing reduceGeoPercision and uniqBy implementations directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Knex | Drizzle ORM | Drizzle requires TypeScript; project is JS; Knex is simpler for a project with no schema evolution after seed |
| Knex | @supabase/supabase-js | Supabase JS client wraps PostgREST REST API, not direct SQL; adds latency; overkill when we control the server |
| Knex | raw pg queries | Would need to hand-roll migration state tracking; Knex migrations give version history for free |
| dotenv | Node.js --env-file flag (v20.6+) | --env-file is native but dotenv works across all Node versions and is more explicit about where loading happens |

**Installation:**
```bash
npm install pg knex dotenv
npm uninstall mongoose
```

---

## Architecture Patterns

### Recommended Project Structure
```
server/
├── database/
│   ├── connection.js          # Knex instance configured from DATABASE_URL (replaces mongoose connection.js)
│   └── migrations/
│       └── 20240101_initial_schema.js   # One migration file — all tables
├── controllers/api/data/
│   └── dataController.js      # Replace Mongoose queries with Knex queries (same export shape)
scripts/
├── seed.js                    # Node seed script: reads JSON, reduces, deduplicates, batchInserts
docker/
└── init-db.sh                 # Entrypoint script: runs migrations + seed on first container start
docker-compose.yml             # Postgres container + volume definition
.env.example                   # Template with local docker-compose defaults
.env                           # Git-ignored; local = docker, production = Supabase URL
```

### Pattern 1: Knex Connection Singleton
**What:** Export a single configured Knex instance; all query code imports from this one location.
**When to use:** Everywhere that touches the database.
**Example:**
```javascript
// server/database/connection.js
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

module.exports = db;
```

### Pattern 2: dataRoute.js Migration — Drop `connection.then()` Wrapper
**What:** Current routes wrap all queries in `connection.then(...)` because Mongoose connection is async. With Knex, the connection is synchronous at require-time (pool is managed internally). Routes become simpler.
**When to use:** All 6 route handlers in `server/routes/dataRoute.js`.
**Example:**
```javascript
// BEFORE (Mongoose):
router.get('/reduced_war_data', (req, res) => {
  connection.then(() => {
    findReducedWar().then(d => res.json(d));
  }).catch(err => res.json({ error: err }));
});

// AFTER (Knex):
router.get('/reduced_war_data', (req, res) => {
  findReducedWar()
    .then(d => res.json(d))
    .catch(err => res.json({ error: err }));
});
```

### Pattern 3: War Data — App-Layer Shape Reconstruction (Simpler than SQL Aggregation)
**What:** SELECT all war_events rows, group by year+quarter in Node.js to rebuild `{Year, value: {q1,q2,q3,q4}}` shape. Avoids complex jsonb_build_object SQL nesting.
**When to use:** `findReducedWar()` controller function.
**Example:**
```javascript
// server/controllers/api/data/dataController.js
const findReducedWar = async () => {
  const rows = await db('war_events').select('*').orderBy(['year', 'quarter', db.raw('fat DESC')]);
  // Group into {Year, value: {q1:[], q2:[], q3:[], q4:[]}} — mirrors warReducer() output
  const byYear = {};
  for (const row of rows) {
    if (!byYear[row.year]) byYear[row.year] = { Year: String(row.year), value: {q1:[],q2:[],q3:[],q4:[]} };
    byYear[row.year].value[row.quarter].push({
      id: row.id, fat: row.fat, int: row.int, evt: row.evt,
      cot: row.cot,  // stored as JSONB array
      lat: row.lat, lng: row.lng
    });
  }
  return Object.values(byYear);
};
```

### Pattern 4: Knex Migration File
**What:** Single migration file creates all tables in `up()`, drops them in `down()`.
**When to use:** Schema creation before seeding.
**Example:**
```javascript
// server/database/migrations/20240101_initial_schema.js
exports.up = function(knex) {
  return knex.schema
    .createTable('war_events', t => {
      t.integer('id').primary();
      t.string('year', 4).notNullable();
      t.string('quarter', 2).notNullable(); // 'q1'|'q2'|'q3'|'q4'
      t.integer('fat');
      t.integer('int');
      t.integer('evt');
      t.jsonb('cot');             // ["Country","Region"] array
      t.decimal('lat', 8, 2).notNullable();
      t.decimal('lng', 8, 2).notNullable();
      t.index(['year', 'quarter']);
      t.unique(['lat', 'lng', 'year', 'quarter']); // dedup enforcement
    })
    // ... more createTable calls
};
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('war_events')
    // ...
};
```

### Pattern 5: Knex batchInsert for Seeding
**What:** Insert thousands of rows in transaction-wrapped chunks of 1000.
**When to use:** seed.js for large tables (war_events ~55K rows after dedup).
**Example:**
```javascript
// scripts/seed.js
await knex.batchInsert('war_events', rows, 1000);
```

### Pattern 6: Idempotent Seed Script
**What:** Check if data already exists before inserting; skip if seeded. Allows rerunning seed.js safely.
**Example:**
```javascript
const count = await db('war_events').count('id as n').first();
if (parseInt(count.n) > 0) {
  console.log('war_events already seeded, skipping');
  return;
}
await db.batchInsert('war_events', rows, 1000);
```

### Pattern 7: Docker Compose with Named Volume + Auto-Seed
**What:** Named volume persists Postgres data across `docker-compose up/down`. Init script triggers migrations + seed on first run only.
**Example:**
```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: refugeeflow
      POSTGRES_USER: refugeeflow
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
volumes:
  pgdata:
```
```bash
# docker/init-db.sh — runs once on first postgres volume init
#!/bin/bash
cd /app && node scripts/migrate.js && node scripts/seed.js
```

### Anti-Patterns to Avoid
- **Keeping `connection.then()` wrappers:** Knex pools connections internally; wrapping Knex queries in a Promise gate adds no value and clutters code.
- **Storing war cot[] as TEXT:** Store as JSONB to preserve array structure and avoid JSON.parse on every read.
- **Running migrations inside seed.js:** Separate concerns — migrations go in one script, seeding in another. Orchestrate from Docker init.
- **Using supabase-js in the Express server:** The server has direct database access via connection string; supabase-js adds an HTTP round-trip and is designed for browser clients.
- **TRUNCATE + re-insert in idempotent seed:** Prefer count-check approach; TRUNCATE on a named volume with real data would destroy it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema version tracking | Custom knex_ran[] table | knex.migrate.latest() | Knex manages its own migration state table (knex_migrations); handles ordering, rollback, locking |
| Bulk insert chunking | Manual loop with pg | knex.batchInsert(table, rows, 1000) | batchInsert wraps in transaction with configurable chunk size; handles parameter limit |
| Connection pooling | Manual pg.Pool management | Knex pool config (min/max) | Knex wraps pg.Pool; handles acquire/release, reconnect on error |
| DB env switching | Conditional config.js logic | DATABASE_URL env var | One connection string switches between local Docker and Supabase; no code changes |
| Dedup on read | uniqBy in dataController | UNIQUE constraint + seed-time dedup | Dedup once at insert time; reads are clean from day 1; matches DB-03 requirement |

**Key insight:** Knex's batchInsert and migrate.latest() cover 80% of what a custom migration/seeding system would need, without the edge cases.

---

## Current Endpoint Response Shapes (Contract)

This is the contract that Postgres queries MUST reproduce. The frontend cannot change.

### GET /data/reduced_war_data
```json
[
  {
    "Year": "2010",
    "value": {
      "q1": [{"id":205358,"fat":1,"int":17,"evt":0,"cot":["Egypt","Northern Africa"],"lat":31.29,"lng":34.24}, ...],
      "q2": [...],
      "q3": [...],
      "q4": [...]
    }
  },
  ...
]
```
- Array of 9 year objects (2010–2018)
- Each quarter array is sorted DESC by `fat` and deduplicated on `lat,lng`
- lat/lng are already precision-reduced to 2 decimal places (in current code at load time)

### GET /data/asy_application_all
```json
[
  {
    "2010": {
      "q1": [{"Origin":"Indonesia","Value":12,"id":138,"destination":"Australia"}, ...],
      "q2": [...], "q3": [...], "q4": [...]
    },
    "2011": {...},
    ...
  }
]
```
- Wrapped in outer array (single-element array containing the entire object)
- Keys are year strings; values are quarter objects
- No lat/lng — no precision reduction needed

### GET /data/route_death
```json
[
  {
    "id":"4625","date":"29-Sep-10","quarter":"3Q2010","year":"2010",
    "dead":"0","missing":"0","dead_and_missing":"2",
    "cause_of_death_displayText":"drowned",
    "cause_of_death":"drowning or exhaustion related death",
    "location":"evros","description":"...","source":"Zaman/NOB",
    "lat":"41.24","lng":"26.14","route":"Eastern Mediterranean",
    "route_displayText":"Eastern Mediterranean","source_url":""
  },
  ...
]
```
- Flat array of 4736 records
- All values are strings (even numeric id, dead, lat, lng) — must cast to TEXT on SELECT or store as text
- lat/lng stored as strings in source; need precision-reduction before store

### GET /data/route_IBC
```json
{
  "Eastern Mediterranean": [
    {"2009":{"q4":119,...},"2010":{...},...,"Route":"Eastern Mediterranean","BorderLocation":"Land/Sea","NationalityLong":"Syria"},
    ...
  ],
  "Central Mediterranean": [...],
  ...
}
```
- Object keyed by route name (9 routes)
- Each route is array of nationality records; each record has year keys (dynamic: "2009"–"2018") containing quarter objects, plus Route/BorderLocation/NationalityLong metadata
- No lat/lng
- **Tricky to normalize:** The year columns are dynamic (2009, 2010, ..., 2018). Better stored as a flat table with (route, nationality, year, quarter, value) and reassembled in Node.js.

### GET /data/route_IBC_country_list
```json
[{"country":"CAMEROON","route":["Eastern Mediterranean",...]}, ...]
```
- Flat array of 73 country objects; route is a string array
- Store route as JSONB array, or normalize into a country_routes join table and re-assemble

### GET /data/note/:id
```json
[{"_id":"...","id":1,"notes":"...","source":"...","__v":0}]
```
- Array (may be empty) — Mongoose returned array for `.find()`
- Phase 3: table is seeded empty; endpoint returns `[]` for all ids
- CRITICAL: Response must be an array, not null/object

---

## Schema Design Recommendations

### Table: war_events
```sql
CREATE TABLE war_events (
  id          INTEGER PRIMARY KEY,
  year        SMALLINT NOT NULL,
  quarter     CHAR(2)  NOT NULL CHECK (quarter IN ('q1','q2','q3','q4')),
  fat         INTEGER,
  int         INTEGER,
  evt         INTEGER,
  cot         JSONB,                    -- ["Country","Region"]
  lat         NUMERIC(5,2) NOT NULL,
  lng         NUMERIC(6,2) NOT NULL
);
CREATE INDEX war_events_year_quarter ON war_events(year, quarter);
-- Dedup enforced at seed time (sort by fat DESC, uniqBy lat,lng per quarter)
-- No UNIQUE on lat,lng because same location can appear in different year/quarters
```

### Table: asy_applications
```sql
CREATE TABLE asy_applications (
  id          SERIAL PRIMARY KEY,
  year        SMALLINT NOT NULL,
  quarter     CHAR(2)  NOT NULL CHECK (quarter IN ('q1','q2','q3','q4')),
  origin      TEXT NOT NULL,
  destination TEXT NOT NULL,
  value       INTEGER,
  record_id   INTEGER               -- original JSON 'id' field
);
CREATE INDEX asy_apps_year_quarter ON asy_applications(year, quarter);
```

### Table: route_deaths
```sql
CREATE TABLE route_deaths (
  id                        INTEGER PRIMARY KEY,
  date                      TEXT,
  quarter                   TEXT,
  year                      SMALLINT,
  dead                      TEXT,
  missing                   TEXT,
  dead_and_missing          TEXT,
  cause_of_death_display    TEXT,
  cause_of_death            TEXT,
  location                  TEXT,
  description               TEXT,
  source                    TEXT,
  lat                       TEXT,          -- store as text to preserve "41.24" string format
  lng                       TEXT,
  route                     TEXT,
  route_display             TEXT,
  source_url                TEXT
);
```

### Table: ibc_crossings
```sql
CREATE TABLE ibc_crossings (
  id              SERIAL PRIMARY KEY,
  route           TEXT NOT NULL,
  nationality     TEXT NOT NULL,
  border_location TEXT,
  year            SMALLINT NOT NULL,
  quarter         CHAR(2) NOT NULL,
  value           INTEGER               -- nullable (source has nulls)
);
CREATE INDEX ibc_crossings_route ON ibc_crossings(route);
```

### Table: country_routes
```sql
CREATE TABLE country_routes (
  id       SERIAL PRIMARY KEY,
  country  TEXT NOT NULL,
  routes   JSONB NOT NULL              -- ["Eastern Mediterranean", ...]
);
-- 73 rows; route array stored as JSONB for simple round-trip
```

### Table: war_notes
```sql
CREATE TABLE war_notes (
  id      INTEGER PRIMARY KEY,
  notes   TEXT,
  source  TEXT
);
-- Seeded empty for Phase 3; ACLED populates in Phase 4
```

---

## Common Pitfalls

### Pitfall 1: Route Death lat/lng String Type
**What goes wrong:** route_death.json has lat/lng as string values ("41.244376"). The API response currently returns strings too. If you cast to NUMERIC and store as numbers, the response shape changes and the frontend breaks.
**Why it happens:** The JSON source stores them as strings; the frontend may be comparing them as strings.
**How to avoid:** Store lat and lng as TEXT in route_deaths table OR cast back to TEXT on SELECT. Apply precision reduction to the numeric value but store the rounded string representation ("41.24").
**Warning signs:** Frontend map shows wrong pin positions or missing pins after cutover.

### Pitfall 2: asy_application_all Response is Array-Wrapped Object
**What goes wrong:** The controller calls `findAsyApplicationAll()` which returns `[dataLoader('asy_application_all.json')]` — note the wrapping array. The JSON file itself is an object (`{"2010":{...}}`). The API returns a single-element array containing the whole object.
**Why it happens:** Careless copying of `findAsyApplicationAll` without noticing the `[]` wrapper in the current code.
**How to avoid:** When reconstructing the asylum response, wrap the entire year-keyed object in an array: `return [{ "2010": {...}, "2011": {...}, ... }]`.

### Pitfall 3: Docker Init Script Only Runs on First Volume Creation
**What goes wrong:** Developer modifies seed data and re-runs `docker-compose up` expecting re-seed. Nothing happens because `/docker-entrypoint-initdb.d/` scripts only run when the named volume is empty.
**Why it happens:** Docker official postgres image design — init scripts are for initial setup only.
**How to avoid:** Document clearly: `docker-compose down -v && docker-compose up` to fully reset. Alternatively, make seed.js runnable standalone: `node scripts/seed.js` with TRUNCATE + re-insert behavior when `--force` flag is passed.
**Warning signs:** "Already seeded" message but with stale data.

### Pitfall 4: Knex Migration Directory Must Match Config
**What goes wrong:** Knex looks for migrations in `./migrations` by default; if migrations live in `server/database/migrations/`, knex will not find them unless config specifies `directory`.
**How to avoid:** Create `knexfile.js` at project root (or pass config object) with explicit `migrations: { directory: './server/database/migrations' }`.

### Pitfall 5: Supabase Free Tier Pauses After Inactivity
**What goes wrong:** Supabase free projects pause after 7 days of inactivity. Connection attempts fail with connection refused.
**Why it happens:** Supabase free tier resource management.
**How to avoid:** Document this clearly. The app can be "woken up" by visiting the Supabase dashboard. Not a migration concern — an operational concern for production deployment.

### Pitfall 6: war_events IBC Response Shape — IBC Object Not Array
**What goes wrong:** `/data/route_IBC` returns an OBJECT keyed by route name, not an array. If you accidentally return `SELECT * FROM ibc_crossings` rows as a flat array, the frontend breaks.
**How to avoid:** Reassemble the route-keyed object in the controller before `res.json()`.

### Pitfall 7: Mongoose `find()` Returns Array — war_notes Must Too
**What goes wrong:** `findWarNote(id)` currently returns `warNoteModel.find({id: query}, ...)` which resolves to an array. The new Postgres query must also return an array. If you use `knex('war_notes').where({id}).first()`, it returns a single object or `undefined`, not an array.
**How to avoid:** Use `knex('war_notes').where({id})` (no `.first()`) so it returns an array (possibly empty).

---

## Code Examples

### Knex connection setup
```javascript
// server/database/connection.js
// Source: knexjs.org/guide/ (official docs)
require('dotenv').config();
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

module.exports = db;
```

### dotenv in server entry point
```javascript
// server/server.js — add at very top
require('dotenv').config();
// ... rest of server.js unchanged
```

### .env.example (local docker defaults)
```
DATABASE_URL=postgresql://refugeeflow:password@localhost:5432/refugeeflow
PORT=2700
NODE_ENV=development
```

### Running Knex migrations programmatically
```javascript
// scripts/migrate.js
require('dotenv').config();
const db = require('../server/database/connection');

db.migrate.latest({ directory: './server/database/migrations' })
  .then(() => { console.log('migrations complete'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
```

### Seed script structure
```javascript
// scripts/seed.js
require('dotenv').config();
const { round, uniqBy } = require('lodash');
const db = require('../server/database/connection');
const dataLoader = (file) => require(`./server/controllers/api/data/datasets/${file}`);

const reduceGeoPercision = (num, precision) => round(num, precision);

async function seedWarEvents() {
  const count = (await db('war_events').count('id as n').first()).n;
  if (parseInt(count) > 0) return console.log('war_events: already seeded');

  const warData = dataLoader('war_all.json');
  const rows = [];
  for (const yearEntry of warData) {
    for (const [quarter, events] of Object.entries(yearEntry.value)) {
      const sorted = events.sort((a, b) => b.fat - a.fat);
      const deduped = uniqBy(sorted, i => `${reduceGeoPercision(i.lat, 2)},${reduceGeoPercision(i.lng, 2)}`);
      for (const e of deduped) {
        rows.push({
          id: e.id, year: yearEntry.Year, quarter,
          fat: e.fat, int: e.int, evt: e.evt, cot: JSON.stringify(e.cot),
          lat: reduceGeoPercision(e.lat, 2), lng: reduceGeoPercision(e.lng, 2),
        });
      }
    }
  }
  await db.batchInsert('war_events', rows, 1000);
  console.log(`war_events: inserted ${rows.length} rows`);
}
```

### docker-compose.yml
```yaml
# Source: Docker Docs — https://docs.docker.com/guides/pre-seeding/
version: '3.9'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: refugeeflow
      POSTGRES_USER: refugeeflow
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
volumes:
  pgdata:
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mongoose with MongoDB | Knex + pg with PostgreSQL | This phase | Relational queries, SQL power, owner-controlled data |
| config.js checked into repo | .env + dotenv (git-ignored) | This phase | Credentials never in git; standard 12-factor practice |
| JSON file loading at startup | Postgres queries at request time | This phase | Data can be updated without redeploying the server |
| Geo reduction at request time | Precision stored at insert time | This phase | No CPU cost on every request; data is always clean |
| Mongoose `find()` promises | Knex query promises | This phase | `connection.then()` wrapper no longer needed; simpler route handlers |

**Deprecated/outdated after this phase:**
- `config.js` and `config.example.js` — replaced by `.env` + `.env.example`
- `server/database/Models.js` — Mongoose schema definitions removed
- `server/database/connection.js` — replaced with Knex connection singleton
- `mongoose` package — removed from package.json entirely
- `warDataAll` module-level JSON pre-loading in `dataController.js` — replaced with DB queries

---

## Open Questions

1. **IBC_crossingCountByCountry.json — keep as frontend static import or migrate to API?**
   - What we know: `src/utils/api.js` imports this JSON directly as a module (not via API). `src/data/IBC_crossingCountByCountry.json` has 9 route entries with `total_cross`, `center_lng`, `center_lat`, `zoom` — pre-aggregated/pre-calculated data.
   - What's unclear: Is this data derived from IBC_all.json (can be recomputed), or is it separately sourced?
   - Recommendation: Phase 3 — leave as static frontend import (out of the 6-endpoint contract). The CONTEXT.md marks this as Claude's Discretion. It is already working and not touching the database. Migrate in a later phase if needed.

2. **Supabase connection string format — transaction mode vs session mode**
   - What we know: Supabase free tier provides two connection strings: direct (port 5432) and connection pooler/Supavisor (port 6543, transaction mode). Supavisor transaction mode does not support prepared statements.
   - What's unclear: Will Knex use prepared statements by default?
   - Recommendation: Use Supabase's direct connection string (port 5432) for the Express server since it's a persistent long-running process. Transaction mode pooler is designed for serverless functions. Direct connection avoids prepared statement limitations.

3. **route_death lat/lng precision — string vs numeric storage**
   - What we know: Source JSON stores them as strings with 6 decimal places. Current API returns them as strings.
   - Recommendation: Store as TEXT after applying precision reduction (convert to float, round to 2 decimals, store string). This preserves the API response type contract exactly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (already installed as devDependency) |
| Config file | none — default Jest config in package.json |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --runInBand` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | MongoDB removed; app starts without Mongo URI | integration/smoke | `npm test -- --testPathPattern=db` | ❌ Wave 0 |
| DB-02 | All 6 endpoints return same response shapes | integration | `npm test -- --testPathPattern=endpoints` | ❌ Wave 0 |
| DB-03 | Seeded lat/lng has max 2 decimal places; no duplicate (lat,lng) per year+quarter in war_events | unit | `npm test -- --testPathPattern=seed` | ❌ Wave 0 |
| DB-04 | docker-compose.yml file exists and is valid YAML | smoke/manual | manual: `docker-compose config` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=<relevant-test-file> --runInBand`
- **Per wave merge:** `npm test -- --runInBand`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/db-connection.test.js` — verifies Knex connects to test DB, covers DB-01
- [ ] `tests/endpoints.test.js` — uses supertest to call all 6 endpoints, snapshot response shapes, covers DB-02
- [ ] `tests/seed-validation.test.js` — loads seeded DB, checks precision + dedup invariants, covers DB-03
- [ ] Test DB setup: needs `DATABASE_URL` pointing to local Docker postgres for CI; add `TEST_DATABASE_URL` env var

---

## Sources

### Primary (HIGH confidence)
- [knexjs.org/guide/migrations.html](https://knexjs.org/guide/migrations.html) — migration file format, `migrate.latest()`, config options
- [knexjs.org/guide/utility](https://knexjs.org/guide/utility) — `batchInsert` API
- [docs.docker.com/guides/pre-seeding/](https://docs.docker.com/guides/pre-seeding/) — `/docker-entrypoint-initdb.d/` pattern
- [supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — direct vs pooler connection strings, free tier limits
- Codebase analysis of: `dataController.js`, `dataProcessors.js`, `dataRoute.js`, `connection.js`, `Models.js`, all 5 dataset JSON files

### Secondary (MEDIUM confidence)
- [traveling-coderman.net/code/node-architecture/schema-migrations/](https://traveling-coderman.net/code/node-architecture/schema-migrations/) — Knex migration patterns in practice
- [dev.to/saiful7778/setting-up-postgresql-with-docker-compose...](https://dev.to/saiful7778/setting-up-postgresql-with-docker-compose-for-development-and-production-45j8) — Docker Compose Postgres setup patterns
- [neon.com/postgresql/postgresql-json-functions/postgresql-jsonb_agg](https://neon.com/postgresql/postgresql-json-functions/postgresql-jsonb_agg) — jsonb_agg for nested JSON reconstruction

### Tertiary (LOW confidence)
- WebSearch results on Drizzle vs Knex tradeoffs — consensus directional but not deeply verified for this project's CJS/non-TypeScript constraints

---

## Metadata

**Confidence breakdown:**
- Standard stack (Knex + pg + dotenv): HIGH — verified against official docs and project constraints (no TypeScript)
- Architecture (connection singleton, batchInsert seeding): HIGH — official Knex docs pattern
- Schema design: MEDIUM — derived from data inspection; exact column types may need adjustment after first seed run
- Response shape contract: HIGH — directly inspected source JSON and current controller code
- Docker auto-seed pattern: HIGH — verified with official Docker docs
- Pitfalls: HIGH for items verified in source code; MEDIUM for Supabase-specific operational notes

**Research date:** 2026-03-15
**Valid until:** 2026-09-15 (stable ecosystem; 6 months)
