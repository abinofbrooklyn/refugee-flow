# Phase 4: Data Ingestion Pipeline - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Automate weekly data ingestion from three external APIs (ACLED, UNHCR, IOM Missing Migrants) into the existing PostgreSQL/Supabase database. Admin can supplement automated sources with CSV uploads via a password-protected `/admin` route. All ingested data passes through geo precision reduction and deduplication before storage. Failures are logged to an `ingestion_log` table.

</domain>

<decisions>
## Implementation Decisions

### Ingestion Runtime
- **LOCKED:** Node scripts running within the Express server process — not Supabase Edge Functions
- Rationale: keeps everything in one codebase, Knex already set up, no separate deployment pipeline
- One ingestion module per data source (ACLED, UNHCR, IOM) in a `server/ingestion/` directory
- Each module exports a function that fetches from the API, transforms data, applies geo precision, and upserts into the database
- Overrides PROJECT.md's pending "Supabase Edge Functions" decision — simpler for this project's scale

### Scheduling Mechanism
- **LOCKED:** node-cron within the Express server for weekly schedule
- Jobs run when the server is running — acceptable for this low-traffic app
- Each source has its own cron schedule (all weekly, but staggered to avoid concurrent API calls)
- Manual trigger available via admin API endpoint (for testing and on-demand re-runs)

### Admin UI
- **LOCKED:** React route within the existing SPA at `/admin`
- Shared-secret password check via API middleware (not full auth)
- Flow: enter password → upload CSV → preview parsed rows in table → commit or cancel
- CSV parser runs server-side; preview returns parsed rows as JSON
- Admin route only needs to support CSV upload for data sources without APIs (supplemental data)

### Geo Precision & Dedup
- **LOCKED (from Phase 3):** All lat/lng values precision-reduced to 2 decimal places before storage
- Deduplication on lat,lng composite key at insert time — same pattern as seed script
- Reuse `reduceGeoPercision()` logic from `server/controllers/api/data/helpers/dataProcessors.js`
- Applied uniformly to all ingestion sources (ACLED, UNHCR, IOM) and CSV uploads

### Failure & Retry Policy
- **LOCKED:** Log failures to `ingestion_log` table with error details — no automatic retry
- Weekly schedule provides natural retry (next week's run picks up where last failed)
- `ingestion_log` schema: id, source, status (success/error), rows_affected, error_message, started_at, completed_at
- Manual re-run available via admin endpoint for immediate recovery

### Incremental Sync
- Track `last_synced` timestamp per source in the database (or `ingestion_log`)
- After initial full pull, subsequent runs fetch only data newer than `last_synced`
- Minimizes API load and processing time on weekly runs

### War Notes Population
- **LOCKED (from Phase 3 deferred):** Populate the empty `war_notes` table from ACLED API
- ACLED provides event descriptions/notes that map to war event IDs
- This is part of the ACLED ingestion module, not a separate task

### Claude's Discretion
- Specific ACLED, UNHCR, and IOM API endpoint URLs and query parameters
- API key management approach (env vars)
- CSV parsing library choice
- node-cron schedule expressions (weekly, staggered)
- Exact `ingestion_log` table migration design
- Admin UI component structure and styling
- Whether to add an ingestion status dashboard to admin page
- Upsert strategy (INSERT ON CONFLICT vs DELETE+INSERT)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database layer (Phase 3 output)
- `db/knexfile.js` — Knex configuration with Supabase SSL handling
- `db/migrations/001_create_tables.js` — Current schema: war_events, war_notes (empty), asy_applications, route_deaths, ibc_crossings, country_routes
- `server/database/connection.js` — Knex connection instance used by all controllers

### Data controllers (response shapes to preserve)
- `server/controllers/api/data/dataController.js` — All 6 query functions; ingestion must produce data these queries can serve unchanged
- `server/controllers/api/data/helpers/dataProcessors.js` — `reduceGeoPercision()` and `uniqBy` dedup logic to reuse in ingestion modules

### API routes
- `server/routes/dataRoute.js` — Express routes; admin routes will be added alongside these

### Server entry point
- `server/server.js` — Where node-cron initialization and admin route mounting will be added

### Seed script (reference pattern)
- `scripts/seed.js` — Existing seed script showing JSON→Postgres ingestion pattern with geo precision and dedup

### Project constraints
- `.planning/PROJECT.md` — Geo precision non-negotiable, shared secret admin, no historical backfill
- `.planning/REQUIREMENTS.md` — INGEST-01 through INGEST-07 requirements

### Prior phase context
- `.planning/phases/03-database-migration/03-CONTEXT.md` — Schema decisions, deferred war_notes and incremental sync ideas

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reduceGeoPercision(num, 2)` in dataProcessors.js — precision reduction to reuse in all ingestion modules
- `uniqBy(sorted, keyFn)` pattern in dataProcessors.js — dedup logic for ingested coordinates
- `scripts/seed.js` — reference implementation for JSON→Postgres ingestion with Knex
- Knex connection in `server/database/connection.js` — shared by controllers, will be shared by ingestion modules

### Established Patterns
- Express routes follow try/catch with `res.status(500).json({ error })` — admin routes should match
- Knex query builder used throughout (no raw SQL) — ingestion should follow same pattern
- dotenv for configuration — API keys go in .env with .env.example documentation
- Helmet + CORS + rate limiting middleware already in place

### Integration Points
- `server/server.js` — mount admin routes, initialize node-cron schedules
- `db/migrations/` — new migration for `ingestion_log` table
- `server/routes/` — new `adminRoute.js` for admin endpoints
- `server/controllers/` — new ingestion controller/module directory
- `.env` / `.env.example` — ACLED, UNHCR, IOM API keys and admin shared secret

</code_context>

<specifics>
## Specific Ideas

- The ACLED ingestion must populate the currently-empty `war_notes` table — this is the primary motivation for the ACLED module
- Ingestion modules should follow the same geo precision pipeline as the seed script: fetch → transform → reduce precision → dedup → upsert
- The admin CSV upload is for supplemental data only — the three API sources are the primary ingestion path
- Stagger cron schedules to avoid hitting all three APIs simultaneously

</specifics>

<deferred>
## Deferred Ideas

- Ingestion status dashboard in admin UI — could show last run times, row counts, errors (nice-to-have, not required for Phase 4)
- Email/Slack alerting on ingestion failure — out of scope, ingestion_log is sufficient for v1
- Historical backfill from ACLED/UNHCR archives — explicitly out of scope per PROJECT.md

</deferred>

---

*Phase: 04-data-ingestion-pipeline*
*Context gathered: 2026-03-17*
