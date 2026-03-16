# Phase 3: Database Migration - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Move all app data from static JSON files and MongoDB to a PostgreSQL database on hosted Supabase. All 6 existing API endpoints must return identical response shapes from PostgreSQL. MongoDB and Mongoose are fully removed. A local dev environment runs via docker-compose with no external database dependency.

</domain>

<decisions>
## Implementation Decisions

### Supabase Setup
- **LOCKED:** Hosted Supabase (supabase.com free tier) — no self-hosting
- **LOCKED:** Remove MongoDB and Mongoose entirely — clean break, no fallback
- **LOCKED:** Switch from config.js to .env + dotenv for all configuration
- **LOCKED:** .env.example ships with local docker-compose defaults; production .env points to Supabase
- Claude's discretion on connection library (pg, knex, drizzle, or @supabase/supabase-js) — pick what works best

### Schema Design
- **LOCKED:** Normalize ALL 5 JSON datasets into proper relational tables — no JSONB blobs
- War data: flatten the nested Year → quarter → events structure into a relational war_events table (or similar)
- Asylum data: normalize the year + mixed-type value object into proper columns
- Route data (route_death, IBC_all, country_route_list): each gets its own table with proper columns
- **LOCKED:** Create war_notes table in Postgres (id, notes, source). MongoDB data is LOST (former partner's account inaccessible). War notes must be sourced from ACLED API during Phase 4 ingestion. For Phase 3: create the table schema and seed with placeholder/empty data so the /data/note/:id endpoint works
- **LOCKED:** Geo coordinates stored pre-reduced (2 decimal places) and deduplicated on lat,lng composite key at insert time — no runtime precision reduction needed
- The existing `reduceGeoPercision()` and `uniqBy(sorted, i => lat,lng)` logic moves to the seed/insert layer

### Migration & Seeding
- **LOCKED:** Node seed script (scripts/seed.js or similar) reads JSON files, applies precision reduction + dedup, inserts into Postgres
- **LOCKED:** Seed from JSON files only — MongoDB is inaccessible, no export possible. War notes table created empty (ACLED sourcing deferred to Phase 4 ingestion)
- **LOCKED:** Use a migration tool (knex migrations, dbmate, or similar) for versioned schema creation — not raw SQL
- **LOCKED:** All-at-once endpoint cutover — build all Postgres queries, seed all data, swap all 6 endpoints together
- Claude's discretion on specific migration tool choice

### Docker-Compose Local Dev
- **LOCKED:** Postgres container only — Express still runs on host via npm
- **LOCKED:** Auto-seed on first run via Docker entrypoint init script
- **LOCKED:** Named Docker volume for data persistence across restarts (docker-compose down -v to reset)
- **LOCKED:** Expose port 5432 to host for direct DB access (psql, pgAdmin, GUI tools)

### Claude's Discretion
- Database client/ORM choice (pg, knex, drizzle, or Supabase JS client)
- Migration tool choice (knex migrations, dbmate, or similar)
- Exact table names, column types, and index strategy
- How to handle the client-side IBC_crossingCountByCountry.json (currently imported directly in frontend, bypasses API)
- Seed script error handling and idempotency approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current database layer
- `server/database/connection.js` — Current MongoDB/Mongoose connection pattern (to be replaced)
- `server/database/Models.js` — Mongoose models: war_all_note, asy_application_all (schemas to migrate)

### Current data controller
- `server/controllers/api/data/dataController.js` — All 6 data query functions, JSON file loading, geo precision reduction at load time
- `server/controllers/api/data/helpers/dataProcessors.js` — `reduceGeoPercision()`, `warReducer()`, `dataLoader()`, `uniqBy` dedup logic

### API routes
- `server/routes/dataRoute.js` — All 6 Express route handlers that must return identical response shapes after migration

### Static data files (seed sources)
- `server/controllers/api/data/datasets/war_all.json` — War conflict data (nested year/quarter/events)
- `server/controllers/api/data/datasets/asy_application_all.json` — Asylum application statistics
- `server/controllers/api/data/datasets/route_death.json` — Route death statistics
- `server/controllers/api/data/datasets/IBC_all.json` — IBC route data
- `server/controllers/api/data/datasets/country_route_list.json` — Country route list

### Frontend API layer
- `src/utils/api.js` — Client-side fetch wrappers with caching (should NOT need changes if response shapes are preserved)

### Configuration
- `config.js` / `config.example.js` — Current config pattern (to be replaced with .env + dotenv)

### Project constraints
- `.planning/PROJECT.md` — Geo precision non-negotiable, Supabase decision, shared secret admin
- `.planning/REQUIREMENTS.md` — DB-01 through DB-04 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reduceGeoPercision(num, 2)` in dataProcessors.js — precision reduction logic to reuse in seed script
- `warReducer()` in dataProcessors.js — war data transformation that must produce identical output from Postgres
- `uniqBy(sorted, i => lat,lng)` pattern — dedup logic to apply at seed/insert time instead of read time
- `dataLoader()` — JSON file reader, useful as seed script input

### Established Patterns
- All 6 endpoints follow identical pattern: `connection.then(() => findX().then(d => res.json(d)))` — new Postgres queries slot into same shape
- Client-side caching in api.js means frontend is resilient to slightly different response timing
- The app already gracefully degrades without MongoDB — good foundation for clean cutover

### Integration Points
- `server/server.js` — mounts routes, initializes middleware, where new DB connection init goes
- `server/routes/dataRoute.js` — route handlers that call controller functions (thin layer, just needs controller swap)
- `config.js` required by `server/database/connection.js` — replace with dotenv in server.js
- `src/data/IBC_crossingCountByCountry.json` — client-side data import that bypasses the API entirely

</code_context>

<specifics>
## Specific Ideas

- The endpoint response shapes are the contract — if frontend doesn't change, migration is correct
- The war data's nested structure (Year → value → {q1,q2,q3,q4} → [{lat,lng,fat,...}]) is the trickiest part to normalize while preserving the exact API response shape
- Seed script should be rerunnable (idempotent) for developer convenience

</specifics>

<deferred>
## Deferred Ideas

- War notes data population from ACLED API — Phase 4 ingestion pipeline will source notes/descriptions for war events

</deferred>

---

*Phase: 03-database-migration*
*Context gathered: 2026-03-15*
