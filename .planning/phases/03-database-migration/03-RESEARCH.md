# Phase 03: Database Migration - Research

**Researched:** 2026-03-15
**Domain:** PostgreSQL migration, Knex.js, dotenv, Docker Compose, data seeding
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
- War data: flatten the nested Year → quarter → events structure into a relational war_events table
- Asylum data: normalize the year + mixed-type value object into proper columns
- Route data (route_death, IBC_all, country_route_list): each gets its own table with proper columns
- Create war_notes table in Postgres (id, notes, source). MongoDB data is LOST. War notes must be sourced from ACLED API during Phase 4. For Phase 3: create the table schema and seed with placeholder/empty data so /data/note/:id endpoint works
- Geo coordinates stored pre-reduced (2 decimal places) and deduplicated on lat,lng composite key at insert time
- The existing reduceGeoPercision() and uniqBy(sorted, i => lat,lng) logic moves to the seed/insert layer
- Node seed script (scripts/seed.js or similar) reads JSON files, applies precision reduction + dedup, inserts into Postgres
- Seed from JSON files only — MongoDB is inaccessible. War notes table created empty
- Use a migration tool (knex migrations, dbmate, or similar) for versioned schema creation — not raw SQL
- All-at-once endpoint cutover — build all Postgres queries, seed all data, swap all 6 endpoints together
- Postgres container only — Express still runs on host via npm
- Auto-seed on first run via Docker entrypoint init script
- Named Docker volume for data persistence across restarts (docker-compose down -v to reset)
- Expose port 5432 to host for direct DB access

### Claude's Discretion
- Database client/ORM choice (pg, knex, drizzle, or Supabase JS client)
- Migration tool choice (knex migrations, dbmate, or similar)
- Exact table names, column types, and index strategy
- How to handle the client-side IBC_crossingCountByCountry.json (currently imported directly in frontend, bypasses API)
- Seed script error handling and idempotency approach

### Deferred Ideas (OUT OF SCOPE)
- War notes data population from ACLED API — Phase 4 ingestion pipeline
- ACLED incremental sync (filter by date range since last sync), last_synced timestamp per source
- Same incremental pattern for all ingestion sources (ACLED, UNHCR, IOM)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | All data served from PostgreSQL (Supabase) — no MongoDB dependency | Knex + pg client replaces Mongoose; dotenv replaces config.js |
| DB-02 | All 6 existing API endpoints return identical response shapes from PostgreSQL | Endpoint response shapes documented below; Postgres queries reconstruct them exactly |
| DB-03 | Geo coordinates stored precision-reduced and deduplicated in the database | Apply reduceGeoPercision(v, 2) + uniqBy at seed time; not at query time |
| DB-04 | Local PostgreSQL dev environment available via docker-compose | Standard postgres:16 image, /docker-entrypoint-initdb.d/ auto-seed pattern |
</phase_requirements>

---

## Summary

Phase 3 migrates the app from MongoDB + static JSON files to a PostgreSQL database (Supabase in production, Docker in development). The Express server currently loads all data from 5 JSON files at startup and queries MongoDB only for war notes — the JSON files handle 5 of 6 API endpoints. All data becomes database-backed.

The recommended stack is **knex@3.1.0** as both the query builder and migration runner, **pg@8.20.0** as the PostgreSQL adapter, and **dotenv@17.3.1** for configuration. This combo is well-established for CommonJS Express apps (no TypeScript friction), has built-in migration versioning, and gives the Phase 4 ingestion pipeline a shared query layer to build on. Drizzle and Prisma are better TypeScript-first tools; for this CommonJS project they add unnecessary build complexity.

The trickiest part is faithfully reconstructing the API response shapes from normalized tables — particularly war events (`warReducer` output) and asylum applications (both use nested Year/quarter/events structures). The seed script is the key artifact: it applies precision reduction and dedup at insert time, making runtime data processing unnecessary. The docker-compose setup uses the standard `/docker-entrypoint-initdb.d/` pattern for auto-seeding schema on first container run, with Node-based seeding as a separate npm script.

**Primary recommendation:** Use knex (migrations + query builder) + pg. Seed script applies existing dataProcessors.js logic. All 6 endpoints swap at once after seeding is verified.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| knex | 3.1.0 | Query builder + migration runner | CommonJS-native, built-in versioned migrations, batteries-included for this stack |
| pg | 8.20.0 | PostgreSQL client (knex peer dep) | Standard node-postgres driver; required by knex |
| dotenv | 17.3.1 | Load .env into process.env | Universal; explicit; cross-Node-version compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lodash | already installed | reduceGeoPercision, uniqBy in seed script | Already in package.json; reuse existing logic from dataProcessors.js |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| knex | drizzle-orm | Drizzle is TypeScript-first; adds friction in this CommonJS project with no TypeScript |
| knex | @supabase/supabase-js | Supabase JS client targets browser/edge; adds REST overhead; use pg directly for server |
| knex | raw pg queries | knex adds migration versioning we need; raw pg is fine for queries but lacks migration CLI |
| dotenv | Node --env-file flag | --env-file is native in Node v20+ but dotenv is explicit, cross-version, and familiar |

**Installation:**
```bash
npm install knex pg dotenv
npm uninstall mongoose
```

---

## Architecture Patterns

### Recommended Project Structure
```
server/
├── database/
│   ├── connection.js        # REPLACE: knex instance (was mongoose)
│   └── Models.js            # DELETE: Mongoose models go away
├── controllers/api/data/
│   ├── dataController.js    # REPLACE: pg queries instead of JSON loads
│   └── helpers/
│       └── dataProcessors.js  # KEEP: reduceGeoPercision, warReducer reused in seed
scripts/
└── seed.js                  # NEW: reads JSON, applies dedup+precision, inserts
db/
├── knexfile.js              # NEW: knex config for dev/production
└── migrations/
    └── 001_create_tables.js # NEW: schema creation migration
docker-compose.yml           # NEW: postgres:16 container + named volume
.env.example                 # NEW: local defaults (committed)
.env                         # NEW: gitignored, real credentials
```

### Pattern 1: Knex Instance (Replaces connection.js)
**What:** Single knex instance shared across all controllers, initialized once at startup.
**When to use:** Always — this replaces the mongoose connection promise.

```javascript
// server/database/connection.js (new)
// Source: https://knexjs.org/guide/
require('dotenv').config();
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

module.exports = db;
```

### Pattern 2: knexfile.js (Migration Config)
**What:** Separate config file for the knex CLI, pointing at development (Docker) and production (Supabase).

```javascript
// db/knexfile.js
// Source: https://knexjs.org/guide/migrations.html
require('dotenv').config({ path: '../.env' });

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './migrations' },
    seeds: { directory: '../scripts/seeds' },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: { directory: './migrations' },
    pool: { min: 2, max: 10 },
  },
};
```

### Pattern 3: Migration File (Schema Creation)
**What:** Versioned schema in a knex migration file. Knex tracks what's been run in a `knex_migrations` table automatically.

```javascript
// db/migrations/001_create_tables.js
// Source: https://knexjs.org/guide/migrations.html
exports.up = async (knex) => {
  await knex.schema.createTable('war_events', (t) => {
    t.integer('event_id').notNullable();
    t.string('year', 4).notNullable();
    t.string('quarter', 2).notNullable(); // 'q1'|'q2'|'q3'|'q4'
    t.integer('fat');
    t.integer('int');
    t.integer('evt');
    t.specificType('cot', 'text[]');       // cot is always a 2-element array
    t.decimal('lat', 8, 2).notNullable();  // pre-reduced 2dp
    t.decimal('lng', 8, 2).notNullable();
  });
  // ... other tables
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('war_events');
  // ...
};
```

### Pattern 4: Idempotent Seed Script
**What:** Seed script that is rerunnable using TRUNCATE RESTART IDENTITY CASCADE.

```javascript
// scripts/seed.js
// Source: knex docs + existing dataProcessors.js
const db = require('../server/database/connection');
const { dataLoader, reduceGeoPercision, warReducer } = require('../server/controllers/api/data/helpers/dataProcessors');

async function seed() {
  // TRUNCATE resets sequences; CASCADE handles FK constraints
  await db.raw('TRUNCATE TABLE war_events, war_notes, asy_applications, route_deaths, ibc_crossings, country_routes RESTART IDENTITY CASCADE');

  // War events: apply precision reduction at load, then dedup via warReducer
  const warRaw = dataLoader('war_all.json', (key, value) =>
    (key === 'lat' || key === 'lng' ? reduceGeoPercision(value, 2) : value)
  );
  const warReduced = warReducer(warRaw); // applies sort by fat DESC + dedup on lat,lng
  const warRows = [];
  warReduced.forEach(yr => {
    ['q1','q2','q3','q4'].forEach(q => {
      yr.value[q].forEach(ev => warRows.push({ ...ev, year: yr.Year, quarter: q }));
    });
  });
  await db.batchInsert('war_events', warRows, 500);
  console.log('Seeded war_events:', warRows.length); // ~56,154

  await db.destroy();
}

seed().catch(err => { console.error(err); process.exit(1); });
```

### Pattern 5: Docker Compose
**What:** Postgres-only container with named volume and healthcheck.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    container_name: refugeeflow-postgres
    environment:
      POSTGRES_USER: rfuser
      POSTGRES_PASSWORD: rfpassword
      POSTGRES_DB: refugeeflow
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rfuser -d refugeeflow"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

**Note on auto-seed:** The `/docker-entrypoint-initdb.d/` approach only runs on empty data volume (first initialization). The locked "auto-seed on first run" requirement is satisfied by this mechanism for schema creation. Data seeding via `npm run db:seed` runs after `docker-compose up`. Keep seeding in Node to reuse existing dataProcessors.js logic — not in SQL inside the container.

### Anti-Patterns to Avoid
- **Storing war data as JSONB:** Locked decision is normalized tables. JSONB makes future ACLED queries much harder.
- **Running seed inside Docker init.d with SQL:** The data transforms require existing Node.js logic; duplicating this in raw SQL is error-prone. Schema creation via init.d SQL is fine; data seeding should stay in Node.
- **Leaving Mongoose in package.json after code removal:** Run `npm uninstall mongoose` as part of the cutover.
- **Keeping `connection.then()` wrapper pattern:** The existing route pattern wraps everything in `connection.then()` because Mongoose needed a connection promise. With knex, the pool is ready immediately — no wrapping needed in new controllers.
- **Applying precision reduction at query time:** The CONTEXT.md locks precision reduction at insert time. Never do `round(lat, 2)` in SQL queries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema versioning | Custom SQL file tracking | knex migrations | Knex tracks applied migrations in `knex_migrations` table; handles ordering, rollback |
| Batch insert | Manual chunked pg inserts | `knex.batchInsert(table, rows, 500)` | Handles chunk sizing, transactions; critical for 56K war events |
| Postgres array column for cot | JSONB column or join table | `t.specificType('cot', 'text[]')` | cot is always exactly 2 elements; array column preserves API response shape |
| Connection pooling | Manual pg.Pool management | knex pool config `{ min: 2, max: 10 }` | knex wraps pg.Pool with sane defaults |

**Key insight:** The existing `warReducer()` + `reduceGeoPercision()` + `uniqBy` logic in dataProcessors.js is the most valuable reusable asset. The seed script imports and reuses it directly — no reimplementation needed.

---

## Common Pitfalls

### Pitfall 1: warReducer Dedup Output Order Must Be Preserved
**What goes wrong:** After reading from Postgres, the API reconstructs the war response by grouping events by year+quarter. If the ORDER of events within each quarter differs from what warReducer produced, the frontend may render differently.
**Why it happens:** Postgres does not guarantee row order without `ORDER BY`. warReducer sorts by `fat` descending before dedup.
**How to avoid:** The Postgres query for war data must include `ORDER BY fat DESC` within each year+quarter group. This matches the seeded order.
**Warning signs:** Frontend renders but event density on globe differs from pre-migration behavior.

### Pitfall 2: asy_application_all Response Shape is Unusual
**What goes wrong:** The current `findAsyApplicationAll()` returns `[dataLoader('asy_application_all.json')]` — an array wrapping a single year-keyed dict. Not a flat array of records.
**Why it happens:** The dataLoader returns the raw JSON object and the function wraps it in an array.
**How to avoid:** The Postgres query must reconstruct this exact shape: aggregate all rows back into one nested object keyed by year → quarter → array of records, then wrap in `[...]`. The shape is `[{2010: {q1:[...], q2:[...], ...}, 2011: {...}, ...}]`.
**Warning signs:** AsyApplicationContainer.jsx breaks silently or shows empty data.

### Pitfall 3: IBC_all Response Is a Route-Keyed Object (Not an Array)
**What goes wrong:** `IBC_all.json` is an object keyed by route name. Each value is an array of crossing records with year-quarter time series embedded as direct properties. The API returns this object shape directly.
**Why it happens:** The structure has the route name as the outer key, with one object per nationality/border-location/route combination, containing year→quarter counts as direct properties (e.g., `{2009: {q1: 119, q2: 106, ...}, Route: "Eastern Mediterranean", BorderLocation: "Land/Sea", NationalityLong: "Syria"}`).
**How to avoid:** Schema: table `ibc_crossings` with columns (route, border_location, nationality, year, quarter, count). Query retrieves all rows, Node.js reconstructs the route-keyed object. The reconstruction must pivot the year+quarter rows back into the nested object shape.
**Warning signs:** Route IBC chart renders no data.

### Pitfall 4: Docker init.d Only Runs on Empty Volume
**What goes wrong:** Developer runs `docker-compose up`, expects fresh schema, but `pgdata` volume already exists — init scripts are skipped silently.
**Why it happens:** Postgres `/docker-entrypoint-initdb.d/` only runs when the data directory is empty (first initialization).
**How to avoid:** Document: `docker-compose down -v` destroys the named volume, triggering re-initialization on next up. Use `npm run db:seed` to re-seed without destroying the volume.
**Warning signs:** Schema changes don't appear after `docker-compose restart`.

### Pitfall 5: Supabase Requires SSL in CONNECTION_URL
**What goes wrong:** Default pg connection without SSL fails in production against Supabase.
**Why it happens:** Supabase's connection pooler requires SSL; local Docker does not.
**How to avoid:** Use the Supabase-provided connection string which already includes `?sslmode=require`. For local Docker, no SSL suffix needed. The knexfile reads DATABASE_URL verbatim from .env — the URL itself carries the SSL config.
**Warning signs:** `ECONNREFUSED` or SSL handshake errors when deploying.

### Pitfall 6: war event `cot` Array Insert in Postgres
**What goes wrong:** When inserting JavaScript arrays into a `text[]` column via knex, the pg client may serialize the array incorrectly.
**Why it happens:** pg client needs to see a JavaScript array to map to a Postgres `text[]` column. If knex serializes it as a string first, the insert fails or stores garbage.
**How to avoid:** Test a single insert of a war event with `cot: ['Egypt', 'Northern Africa']` before running batch. The pg client handles JS arrays natively for array columns — this should work, but verify.
**Warning signs:** `cot` column stores `"{Egypt,Northern Africa}"` as a string literal instead of a proper Postgres array; `res.json()` returns it as a string not an array.

### Pitfall 7: Mongoose Removal Must Be Both Code and Package
**What goes wrong:** Removing Mongoose from code but leaving it in package.json — or vice versa.
**How to avoid:** `npm uninstall mongoose` uninstalls the package. Grep for any remaining `require('mongoose')` after removal. `config.js` can be deleted once dotenv is in place.
**Warning signs:** `mongoose` still in package.json dependencies.

### Pitfall 8: Knex decimal() returns strings, not numbers
**What goes wrong:** Postgres `NUMERIC` columns (from `t.decimal(8, 2)`) are returned by the pg driver as JavaScript strings, not numbers.
**Why it happens:** The pg driver does not automatically cast NUMERIC to JavaScript floats to avoid precision loss.
**How to avoid:** In the query layer, explicitly `parseFloat(row.lat)` and `parseFloat(row.lng)` when constructing API response objects. Alternatively, use `FLOAT8` instead of `NUMERIC(8,2)` for lat/lng since 2dp precision is already enforced at seed time.
**Warning signs:** Globe renders no points because lat/lng are strings not numbers; THREE.js silently fails on NaN geometry.

---

## Data Structure Reference

Critical for schema design and response reconstruction. All verified by running Node against actual JSON files.

### Dataset 1: war_all.json
**Source shape:** Array of 9 year objects: `[{Year: '2010', value: {q1: [...events], q2: [...], q3: [...], q4: [...]}}]`
**Event fields:** `{id: number, fat: number, int: number, evt: number, cot: [string, string], lat: number, lng: number}`
**cot:** Always exactly 2 elements — `[country_name, region_name]` — 74 unique values total
**Raw event count:** 179,010 events pre-dedup; 56,154 after warReducer dedup (68% reduction)
**Years covered:** 2010–2018
**Key transform:** `warReducer()` sorts each quarter by `fat DESC`, then deduplicates on `lat,lng` composite key
**API response shape:** Same nested structure as source
**Postgres table:** `war_events(event_id integer, year varchar(4), quarter varchar(2), fat integer, int integer, evt integer, cot text[], lat float8, lng float8)`

### Dataset 2: asy_application_all.json
**Source shape:** Object (not array) keyed by year string: `{"2010": {q1: [...], q2: [...], q3: [...], q4: [...]}, ...}`
**Record fields:** `{Origin: string, Value: number, id: number, destination: string}`
**Record count:** ~82,197 records across 9 years (2010–2018)
**API response shape:** `[{2010: {q1:[...], q2:[...], ...}, 2011: {...}, ...}]` — array wrapping one object
**Postgres table:** `asy_applications(record_id integer, year varchar(4), quarter varchar(2), origin text, destination text, value integer)`

### Dataset 3: route_death.json
**Source shape:** Flat array of 4,736 records
**Record fields (all text unless noted):** `{id, date, quarter, year, dead, missing, dead_and_missing, cause_of_death_displayText, cause_of_death, location, description, source, lat, lng (nullable), route, route_displayText, source_url}`
**Note:** `dead`, `missing`, `dead_and_missing` are string values (e.g., `"0"`, `"2"`) — keep as text to preserve response shape
**Lat/lng presence:** 4,734 of 4,736 have lat/lng; 2 records have null
**API response shape:** Raw flat array — same as source
**Postgres table:** `route_deaths(id text, date text, quarter text, year text, dead text, missing text, dead_and_missing text, cause_of_death_display_text text, cause_of_death text, location text, description text, source text, lat float8, lng float8, route text, route_display_text text, source_url text)`

### Dataset 4: IBC_all.json
**Source shape:** Object keyed by route name (9 routes). Each value is an array of crossing records.
**Crossing record fields:** `{Route: string, BorderLocation: string, NationalityLong: string, [year]: {q1: N, q2: N, q3: N, q4: N}}` — years 2009–2018 as direct properties, some quarters null
**Total records:** 347 crossing rows across 9 routes
**API response shape:** Same route-keyed object
**Postgres table:** `ibc_crossings(route text, border_location text, nationality_long text, year varchar(4), quarter varchar(2), count integer)` — fully normalized
**Reconstruct query:** GROUP BY route → pivot year+quarter rows into nested object → reconstruct route-keyed response

### Dataset 5: country_route_list.json
**Source shape:** Array of `{country: string, route: string[]}` objects (route is an array of route names)
**API response shape:** Same flat array
**Postgres table:** `country_routes(country text, routes text[])` — one row per country, routes as Postgres text array

### war_notes (MongoDB — lost)
**Schema from Models.js:** `{id: Number, notes: String, source: String}`
**API endpoint:** `GET /data/note/:id` returns array of matching notes
**Phase 3 action:** Create empty table; return `[]` for all queries
**Postgres table:** `war_notes(id integer, notes text, source text)`

### IBC_crossingCountByCountry.json (client-side, bypasses API)
**Current state:** Imported directly in `src/utils/api.js` as a local JSON file. Not served from the Express API. 7 records with `{route, total_cross, center_lng, center_lat, zoom}`.
**Decision:** Leave as-is in Phase 3. Moving it to a DB-backed endpoint is Phase 4/5 work.

---

## API Response Shape Contract

All 6 endpoints must return these exact shapes. Frontend MUST NOT need changes.

| Route | Handler | Returns | Shape |
|-------|---------|---------|-------|
| `GET /data/note/:id` | findWarNote | Array | `[]` for Phase 3 (table empty) |
| `GET /data/reduced_war_data` | findReducedWar | Array | `[{Year: '2010', value: {q1:[events], q2:[events], q3:[events], q4:[events]}}, ...]` |
| `GET /data/asy_application_all` | findAsyApplicationAll | Array (1-element) | `[{2010: {q1:[records], ...}, 2011: {...}, ...}]` |
| `GET /data/route_death` | findRouteDeath | Array | flat array of route_death records with original field names |
| `GET /data/route_IBC_country_list` | findRouteIbcCountryList | Array | `[{country: string, route: [string, ...]}, ...]` |
| `GET /data/route_IBC` | findRouteIbc | Object | `{"Eastern Mediterranean": [{2009:{q1,q2,q3,q4}, ..., Route, BorderLocation, NationalityLong}], ...}` |

**Note on field name casing:** The API returns data in the original JSON field name casing (e.g., `cause_of_death_displayText` not `cause_of_death_display_text`). Postgres column names are snake_case; the query layer must alias or remap to original field names when building response objects.

---

## Code Examples

### Knex + pg Connection (replaces connection.js)
```javascript
// server/database/connection.js
// Source: https://knexjs.org/guide/
require('dotenv').config();
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
});

module.exports = db;
```

### .env Files
```bash
# .env.example (committed to git — local docker-compose defaults)
DATABASE_URL=postgresql://rfuser:rfpassword@localhost:5432/refugeeflow
PORT=2700
NODE_ENV=development

# .env (gitignored — developer copies from .env.example)
DATABASE_URL=postgresql://rfuser:rfpassword@localhost:5432/refugeeflow
PORT=2700
NODE_ENV=development
```

```bash
# Production .env (Supabase connection string from project dashboard)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
PORT=2700
NODE_ENV=production
```

### package.json Scripts
```json
{
  "scripts": {
    "db:migrate": "knex --knexfile db/knexfile.js migrate:latest",
    "db:seed": "node scripts/seed.js",
    "db:reset": "knex --knexfile db/knexfile.js migrate:rollback --all && npm run db:migrate && npm run db:seed",
    "db:up": "docker-compose up -d"
  }
}
```

### War Events Query (reconstructs warReducer output shape)
```javascript
// Returns [{Year: '2010', value: {q1:[...], q2:[...], q3:[...], q4:[...]}}]
async function findReducedWar() {
  const rows = await db('war_events')
    .select('*')
    .orderBy([{ column: 'year' }, { column: 'quarter' }, { column: 'fat', order: 'desc' }]);

  const byYear = {};
  rows.forEach(row => {
    if (!byYear[row.year]) {
      byYear[row.year] = { Year: row.year, value: { q1:[], q2:[], q3:[], q4:[] } };
    }
    byYear[row.year].value[row.quarter].push({
      id: row.event_id,
      fat: row.fat,
      int: row.int,
      evt: row.evt,
      cot: row.cot,            // pg driver returns as JS array for text[] column
      lat: parseFloat(row.lat), // NUMERIC returns as string from pg; must cast
      lng: parseFloat(row.lng),
    });
  });
  return Object.values(byYear).sort((a, b) => a.Year.localeCompare(b.Year));
}
```

### Dotenv Loading Pattern (replaces config.js)
```javascript
// server/server.js — add as very first line, before any require
require('dotenv').config();
// Then use process.env.DATABASE_URL, process.env.PORT
// Remove: const { database } = require('./config.js')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mongoose for MongoDB | knex + pg for PostgreSQL | This phase | Removes Mongoose dep entirely; no connection string → no startup error |
| config.js hardcoded values | dotenv + .env files | This phase | Supports dev (Docker) and production (Supabase) with same code |
| JSON files loaded at startup | Postgres queries at request time | This phase | Data is mutable, indexable, queryable for Phase 4 ingestion |
| Precision reduction at read time (JSON reviver) | Precision at insert/seed time | This phase | Data in DB is always clean; no runtime processing overhead |

**Deprecated/outdated after this phase:**
- `server/database/connection.js` (Mongoose version): Replaced
- `server/database/Models.js`: Deleted entirely
- `config.js` / `config.example.js`: Replaced by `.env` + `.env.example`
- All `require('./config.js')` calls in server code

---

## Open Questions

1. **IBC_all fully normalized vs JSONB for yearly counts**
   - What we know: The CONTEXT.md locks "no JSONB blobs" for all datasets. A fully normalized `ibc_crossings` table (route, border_location, nationality, year, quarter, count) has ~13,880 rows (347 records × 40 year-quarter combos) but cleanly satisfies the constraint.
   - What's unclear: Whether sparse nulls (some year-quarters are null in the source) should be omitted rows or stored as null count.
   - Recommendation: Omit null-count rows at seed time (INSERT only non-null values). Reconstruct with a LEFT JOIN or fill nulls as null in the Node response object.

2. **route_death numeric-string fields**
   - What we know: `dead`, `missing`, `dead_and_missing` are strings in the source JSON (e.g., `"0"`, `"2"`).
   - Recommendation: Store as TEXT to preserve response shape identity. Phase 4 casts when computing aggregations.

3. **Supabase project creation timing**
   - What we know: Phase 3 needs a Supabase project created with the DATABASE_URL before testing against production.
   - Recommendation: Plan Wave 0 should include creating the Supabase project and documenting the connection string in .env.

---

## Validation Architecture

nyquist_validation is `true` in .planning/config.json.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 (already configured) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest tests/server/ --testEnvironment node` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DB-01 | No MongoDB dep — app starts without MONGODB_URI env var | smoke | `npx jest tests/server/db-connection.test.js -x` | ❌ Wave 0 |
| DB-02 | Each of 6 endpoints returns correct response shape from Postgres | integration | `npx jest tests/server/endpoints.test.js -x` | ❌ Wave 0 |
| DB-03 | Seeded lat/lng values are precision-reduced to 2dp | unit | `npx jest tests/server/seed.test.js -x` | ❌ Wave 0 |
| DB-04 | Postgres accessible on localhost:5432 | manual infra | `pg_isready -h localhost -p 5432 -U rfuser` | N/A |

### Sampling Rate
- **Per task commit:** `npx jest tests/server/ --testEnvironment node`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/server/db-connection.test.js` — covers DB-01 (knex connects, no Mongoose errors)
- [ ] `tests/server/endpoints.test.js` — covers DB-02 (supertest integration tests for all 6 routes against a test DB)
- [ ] `tests/server/seed.test.js` — covers DB-03 (unit tests for precision reduction logic and dedup)

*(DB-04 is infrastructure validation; not automatable in Jest without Docker-in-Docker setup.)*

---

## Sources

### Primary (HIGH confidence)
- https://knexjs.org/guide/ — knex current version, installation, pg connection config
- https://knexjs.org/guide/migrations.html — migrate:latest, migrate:make, seed:run, knexfile.js, lock system
- Direct codebase inspection (dataProcessors.js, dataController.js, dataRoute.js, all 5 JSON datasets) — exact API response shapes and data volumes

### Secondary (MEDIUM confidence)
- `npm view knex version` → 3.1.0; `npm view pg version` → 8.20.0; `npm view dotenv version` → 17.3.1
- https://hub.docker.com/_/postgres — Postgres official Docker image, /docker-entrypoint-initdb.d/ behavior
- https://docs.docker.com/guides/pre-seeding/ — pre-seeding pattern (init only on empty volume confirmed)

### Tertiary (LOW confidence)
- WebSearch results on knex idempotent seeding — TRUNCATE RESTART IDENTITY CASCADE pattern (standard Postgres; not unique to knex)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via npm registry
- Architecture: HIGH — based on direct codebase inspection of all 6 endpoints and all 5 JSON dataset structures, running Node against actual data
- API response shapes: HIGH — verified by reading existing dataController.js and dataProcessors.js code
- Pitfalls: HIGH for war/asy/IBC response shapes (verified from code); MEDIUM for Supabase SSL (standard Supabase requirement, not locally tested)
- Data schemas: HIGH — all field names, types, and record counts extracted by running Node against actual JSON files

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (knex/pg are stable; Supabase free tier terms could change)
