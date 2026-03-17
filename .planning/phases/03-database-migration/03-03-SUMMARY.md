---
phase: 03-database-migration
plan: "03"
subsystem: api
tags: [knex, postgres, express, mongodb, mongoose]

# Dependency graph
requires:
  - phase: 03-02
    provides: Postgres tables seeded with all 5 datasets (war_events, asy_applications, route_deaths, ibc_crossings, country_routes, war_notes)
  - phase: 03-01
    provides: knex connection instance at server/database/connection.js, Postgres schema migrations
provides:
  - All 6 API endpoints return data from Postgres queries via knex
  - Mongoose removed from codebase and package.json
  - dataRoute.js uses async/await pattern (no connection.then() wrapper)
  - dataController.js queries Postgres with correct response shape reconstruction
affects: [04-ingestion-pipeline, frontend-api-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async/await route handlers with try/catch error handling"
    - "knex query builder with response shape reconstruction in Node.js"
    - "snake_case DB columns aliased to original camelCase API field names in controller layer"

key-files:
  created: []
  modified:
    - server/controllers/api/data/dataController.js
    - server/routes/dataRoute.js
    - package.json
  deleted:
    - server/database/Models.js
    - config.js
    - config.example.js

key-decisions:
  - "No parseFloat() needed for war event lat/lng — float8 columns return as JS numbers from pg driver (unlike NUMERIC)"
  - "IBC ibc_crossings pivot done in Node: rows with null counts omitted at seed time; Node reconstructs {q1:null,...} for missing years"

patterns-established:
  - "Controller pattern: import db from connection.js, query table, map snake_case rows to camelCase API shape"
  - "Route pattern: async (req, res) => { try { const data = await findX(); res.json(data); } catch (err) { res.status(500).json({ error: err.message }); } }"

requirements-completed: [DB-01, DB-02]

# Metrics
duration: 15min
completed: 2026-03-16
---

# Phase 3 Plan 03: Endpoint Cutover Summary

**All 6 Express data endpoints rewritten to query Postgres via knex, with Mongoose and config.js removed entirely from the codebase**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-16T10:00:00Z
- **Completed:** 2026-03-16T10:15:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 rewritten, 3 deleted)

## Accomplishments
- Rewrote all 6 controller functions (findWarNote, findReducedWar, findAsyApplicationAll, findRouteDeath, findRouteIbcCountryList, findRouteIbc) to query Postgres
- Verified all 6 endpoints return correct response shapes: 9 war years, array-wrapped asy object, 4736 death records, 73 country routes, 9 IBC routes
- Removed Mongoose from code and package.json, deleted Models.js, config.js, config.example.js
- Updated dataRoute.js to use async/await with try/catch (removed connection.then() Mongoose pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite dataController.js with Postgres queries** - `dc7c8c6` (feat)
2. **Task 2: Update route handlers, delete Mongoose files, uninstall mongoose** - `1b4d006` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `server/controllers/api/data/dataController.js` - Replaced: now queries 6 Postgres tables via knex, reconstructs exact API response shapes
- `server/routes/dataRoute.js` - Replaced: async/await handlers, no Mongoose connection dependency
- `package.json` - Mongoose removed from dependencies
- `server/database/Models.js` - Deleted: Mongoose models no longer needed
- `config.js` / `config.example.js` - Deleted: replaced by .env + dotenv

## Decisions Made
- float8 lat/lng returns as JS number from pg driver (no parseFloat() needed) — consistent with Plan 01 decision to use float8
- IBC reconstruction: null-count rows were omitted at seed time; Node reconstructs `{q1:null,...}` objects for years present but fills only non-null quarters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 6 data endpoints are fully Postgres-backed — no JSON files or MongoDB references remain in server code
- Mongoose is uninstalled; server starts without MONGODB_URI
- Phase 4 (ingestion pipeline) can build on the knex connection and existing table schemas
- No blockers

---
*Phase: 03-database-migration*
*Completed: 2026-03-16*

## Self-Check: PASSED

- dataController.js: FOUND
- dataRoute.js: FOUND
- Models.js deleted: CONFIRMED
- config.js deleted: CONFIRMED
- 03-03-SUMMARY.md: FOUND
- commit dc7c8c6: FOUND
- commit 1b4d006: FOUND
