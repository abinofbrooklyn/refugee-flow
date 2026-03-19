---
phase: 04-data-ingestion-pipeline
plan: 06
subsystem: api, ingestion
tags: [iom, normalization, route-mapping, geo-fallback, data-quality]

requires:
  - phase: 04-data-ingestion-pipeline
    provides: iomIngestion.js with CSV download and batch insert pipeline
provides:
  - iomNormalizer.js pure-function module with 7 exported normalization functions
  - Normalized route_deaths DB rows (12302 updated, 1714 duplicates removed)
  - Simplified dataController.js findRouteDeath (plain SELECT, ~180 lines removed)
  - Backfill script for normalizing existing DB data
affects: [data-quality, api-performance, future-iom-ingestion]

tech-stack:
  added: []
  patterns: [ingestion-time-normalization, pure-function-pipeline, geo-bounds-correction]

key-files:
  created:
    - server/ingestion/iomNormalizer.js
    - scripts/normalizeRouteDeaths.js
    - tests/server/iomNormalizer.test.js
  modified:
    - server/ingestion/iomIngestion.js
    - server/controllers/api/data/dataController.js

key-decisions:
  - "Remove 'Others' from ROUTE_MAP -- dead code since resolveRoute handles unmapped routes via !mapped check"
  - "Bulk SQL UPDATE with VALUES clause for backfill performance over remote Supabase connection"
  - "normalizeRow returns _wasFallback and _rawRoute tracking fields stripped before DB insert"

patterns-established:
  - "Ingestion-time normalization: all data cleaning happens at write time, not read time"
  - "Pure-function pipeline: normalizeRow composes fixSwappedLatLng -> resolveRoute -> applyGeoBoundsCorrections"

requirements-completed: [INGEST-03, INGEST-04]

duration: 24min
completed: 2026-03-19
---

# Phase 04 Plan 06: IOM Normalization Pipeline Summary

**Pure-function iomNormalizer.js module with route mapping, geo-fallback, and bounds correction -- moves ~180 lines of runtime normalization from API reads to ingestion time**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-19T22:35:02Z
- **Completed:** 2026-03-19T22:59:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted all normalization logic from dataController.js into pure-function iomNormalizer.js module (7 exports)
- Backfilled 25,984 existing DB rows: 12,302 route corrections, 1,714 duplicate removals
- Reduced findRouteDeath from ~200 lines to ~20 lines (plain SELECT + field mapping)
- 33 unit tests for normalization functions, all passing
- iomIngestion.js now applies normalization at ingestion time automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Create iomNormalizer.js with unit tests (TDD)**
   - `2e7def6` (test) - Failing tests for all 7 normalization functions
   - `d6d4853` (feat) - Implementation passing all 33 tests
2. **Task 2: Integrate normalizer, backfill script, simplify dataController** - `bca7a5a` (feat)

## Files Created/Modified
- `server/ingestion/iomNormalizer.js` - Pure-function normalization pipeline (ROUTE_MAP, geoFallback, fixSwappedLatLng, resolveRoute, applyGeoBoundsCorrections, normalizeRow, deduplicateRows)
- `tests/server/iomNormalizer.test.js` - 33 unit tests covering all normalization functions
- `scripts/normalizeRouteDeaths.js` - One-time backfill script using bulk SQL UPDATE
- `server/ingestion/iomIngestion.js` - Added normalizeRow + deduplicateRows to transformIomRows pipeline
- `server/controllers/api/data/dataController.js` - Removed ~180 lines of inline normalization, findRouteDeath is now plain SELECT

## Decisions Made
- Removed 'Others' from ROUTE_MAP: dead code since resolveRoute's !mapped check naturally handles unmapped routes via geoFallback
- Used bulk SQL UPDATE with VALUES clause for backfill: individual row updates over Supabase were too slow (~600 rows/min); bulk approach completed in ~2 minutes
- normalizeRow adds _wasFallback and _rawRoute tracking fields for logging, stripped before DB insert

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed variable shadowing in backfill script**
- **Found during:** Task 2 (backfill script execution)
- **Issue:** Destructuring `{ original, normalized }` from loop variable shadowed outer `const normalized` array, causing ReferenceError
- **Fix:** Renamed outer variable to `pairs` with inner property `cleaned`
- **Files modified:** scripts/normalizeRouteDeaths.js
- **Verification:** Script completed successfully
- **Committed in:** bca7a5a

**2. [Rule 1 - Bug] Optimized backfill for remote DB performance**
- **Found during:** Task 2 (backfill execution)
- **Issue:** Individual UPDATE queries over remote Supabase connection extremely slow (~600 rows/min for 19K rows)
- **Fix:** Switched to bulk SQL UPDATE using FROM (VALUES ...) clause with 500-row batches
- **Files modified:** scripts/normalizeRouteDeaths.js
- **Verification:** Backfill completed in ~2 minutes, 12302 rows updated, 1714 duplicates removed
- **Committed in:** bca7a5a

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for script to run correctly and complete in reasonable time. No scope creep.

## Issues Encountered
- Pre-existing SSL certificate errors in integration tests (seed-data-integrity, endpoint-shapes) unrelated to this plan's changes -- these tests connect to live Supabase and fail with "self-signed certificate in certificate chain"

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IOM normalization pipeline complete and operational
- All future IOM ingestion automatically normalizes routes at write time
- Database contains clean, deduplicated route_deaths data
- API response shape preserved (backward compatible)

---
*Phase: 04-data-ingestion-pipeline*
*Completed: 2026-03-19*
