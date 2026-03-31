---
phase: 03-database-migration
plan: 02
subsystem: database
tags: [postgres, knex, seed, json, geo-precision, dedup, jest]

# Dependency graph
requires:
  - phase: 03-database-migration
    plan: 01
    provides: All 6 Postgres tables created via knex migration, DATABASE_URL connection module
provides:
  - scripts/seed.js — idempotent seed populating 56154 war_events, 82197 asy_applications, 4736 route_deaths, 12839 ibc_crossings, 73 country_routes
  - tests/server/seed.test.js — 5 automated tests verifying geo precision (2dp) and dedup constraints against live DB
affects:
  - 03-03 (controllers query the seeded data — row counts, column types, and dedup behavior are now established)
  - 03-04 (Supabase seed will use same script via DATABASE_URL swap)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSON reviver at parse time for geo precision reduction (same as dataController.js — consistent approach)
    - TRUNCATE ... RESTART IDENTITY CASCADE pattern for idempotent seeding
    - batchInsert with chunk size 500 for all tables
    - parseFloat() guard for route_deaths lat/lng which are strings in JSON source

key-files:
  created:
    - scripts/seed.js
    - tests/server/seed.test.js

key-decisions:
  - "route_deaths lat/lng require parseFloat() before reduceGeoPercision — source JSON stores them as strings ('41.244376'), not numbers"
  - "Empty string lat/lng ('') treated as null — 2 records in route_death.json have empty strings not null"
  - "IBC row count 12839 (not ~13.8K estimated) — null quarter values are omitted per plan, bringing actual normalized count lower than estimate"

patterns-established:
  - "Pattern: Idempotent seed — TRUNCATE TABLE ... RESTART IDENTITY CASCADE before all inserts"
  - "Pattern: Reuse dataProcessors — seed.js imports dataLoader/reduceGeoPercision/warReducer from existing helpers, no reimplementation"

requirements-completed: [DB-03]

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 3 Plan 02: Seed Script Summary

**Idempotent seed populating all 6 Postgres tables from 5 JSON datasets using existing dataProcessors helpers, with 2dp geo precision reduction and war event deduplication verified by 5 automated tests**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-17T02:46:00Z
- **Completed:** 2026-03-17T02:56:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- scripts/seed.js inserts 56154 war events (precision-reduced, deduplicated), 82197 asylum applications, 4736 route deaths, 12839 IBC crossings, 73 country routes
- Reuses dataLoader/reduceGeoPercision/warReducer from existing dataProcessors.js — no reimplementation of processing logic
- Idempotent: TRUNCATE ... RESTART IDENTITY CASCADE ensures running seed twice produces identical row counts (verified)
- 5 jest tests confirm: lat/lng 2dp precision, no duplicate lat,lng per year+quarter, float8 columns return JS numbers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idempotent seed script for all 5 JSON datasets** - `a6b0d54` (feat)
2. **Task 2: Verify geo precision and dedup in seeded data** - `efe934e` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `scripts/seed.js` - Idempotent seed script: reads 5 JSON datasets, applies geo precision reduction and war dedup, batchInserts into all 6 tables
- `tests/server/seed.test.js` - 5 jest tests verifying lat/lng precision (2dp), no duplicate lat,lng per year+quarter, float8 type as numbers

## Decisions Made
- route_deaths lat/lng are stored as strings in source JSON (`"41.244376"`), not numbers — applied `parseFloat()` before `reduceGeoPercision()` to handle this correctly
- Two route_death records have empty string lat/lng (`""`) rather than null — added `r.lat !== ''` guard to treat these as SQL NULL (matches nullable float8 column)
- IBC crossing count is 12839 rows (not ~13.8K estimated in plan) — null quarter values are correctly omitted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] parseFloat() for route_deaths string lat/lng**
- **Found during:** Task 1 (inspecting route_death.json source data)
- **Issue:** Plan template used `r.lat != null ? reduceGeoPercision(r.lat, 2) : null` but source JSON stores lat/lng as strings (`"41.244376"`), not numbers. Passing a string to lodash `round()` would produce NaN.
- **Fix:** Added `parseFloat(r.lat)` before `reduceGeoPercision()` call
- **Files modified:** scripts/seed.js
- **Verification:** Seed ran successfully, route_deaths populated with 4736 rows
- **Committed in:** a6b0d54 (Task 1 commit)

**2. [Rule 1 - Bug] Empty string guard for route_deaths lat/lng**
- **Found during:** Task 1 (verifying null lat/lng handling)
- **Issue:** 2 records have `lat: ""` (empty string) not `lat: null`. The `!= null` check passes for empty strings, so `parseFloat("")` = NaN would be inserted into float8 column.
- **Fix:** Added `r.lat !== ''` condition alongside `r.lat != null` check
- **Files modified:** scripts/seed.js
- **Verification:** Both records inserted with null lat/lng, no NaN in DB
- **Committed in:** a6b0d54 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for data correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed data handling issues above.

## User Setup Required
None — requires Docker Desktop running and `.env` with DATABASE_URL configured (established in Plan 01).

## Next Phase Readiness
- All 6 tables populated with production-quality data
- War events are precision-reduced (2dp lat/lng) and deduplicated — ready for Plan 03 controller queries
- IBC, asylum, route death data normalized and queryable
- Plan 03 (controller rewrite) can now replace JSON file reads with `db('war_events').where({year, quarter})` queries

---
*Phase: 03-database-migration*
*Completed: 2026-03-17*
