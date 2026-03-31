---
phase: 04-data-ingestion-pipeline
plan: 03
subsystem: ingestion
tags: [unhcr, iom, csv-parse, knex, node-fetch, tdd, data-ingestion]

# Dependency graph
requires:
  - phase: 04-data-ingestion-pipeline plan 01
    provides: ingestionLogger, db migrations (ingestion_log, asy_applications unique index, route_deaths)

provides:
  - UNHCR asylum application ingestion module with paginated API fetch and upsert
  - IOM Missing Migrants ingestion module with CSV download, coordinate parsing, and upsert
  - Unit tests for both modules (17 tests total)

affects:
  - 04-data-ingestion-pipeline plan 04 (scheduler that calls runUnhcrIngestion and runIomIngestion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Paginated API fetch loop using page/maxPages from response
    - CSV download + csv-parse/sync for bulk ingestion
    - Batched upsert (500 rows/batch) with knex onConflict
    - TDD Red-Green cycle for ingestion modules

key-files:
  created:
    - server/ingestion/unhcrIngestion.js
    - server/ingestion/iomIngestion.js
    - tests/server/ingestion-unhcr.test.js
    - tests/server/ingestion-iom.test.js
  modified: []

key-decisions:
  - "UNHCR quarter always 'q1' — API provides annual totals only, not per-quarter"
  - "IOM always downloads full CSV with onConflict('id').ignore() — no date-filter API exists"
  - "IOM dead/missing/dead_and_missing stored as TEXT per existing schema convention"

patterns-established:
  - "Ingestion modules export both main runner and sub-functions for unit testing"
  - "parseCoordinates returns null for empty/invalid to avoid DB constraint errors"

requirements-completed: [INGEST-02, INGEST-03, INGEST-04, INGEST-05]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 4 Plan 03: UNHCR and IOM Ingestion Modules Summary

**UNHCR paginated REST API ingestion (annual-to-q1, onConflict merge) and IOM full-CSV download ingestion (coordinate splitting, onConflict ignore) with 17 unit tests**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T16:12:55Z
- **Completed:** 2026-03-17T16:15:27Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- UNHCR ingestion module fetches paginated asylum data from `api.unhcr.org`, transforms with `quarter='q1'`, upserts `asy_applications` using composite unique index conflict handling
- IOM ingestion module downloads full CSV from `missingmigrants.iom.int`, parses with `csv-parse/sync`, splits Coordinates column, applies geo precision, upserts `route_deaths` with `onConflict('id').ignore()`
- Both modules log success/error to `ingestion_log` via shared `logIngestion` interface
- 17 unit tests written via TDD (7 UNHCR + 10 IOM), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: UNHCR ingestion module** - `ce40d0f` (feat)
2. **Task 2: IOM ingestion module** - `83837a9` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks combined test + implementation into single commits per task_

## Files Created/Modified

- `server/ingestion/unhcrIngestion.js` - UNHCR paginated API fetch, transform, upsert; exports runUnhcrIngestion, fetchAllUnhcrApplications, transformUnhcrItems
- `server/ingestion/iomIngestion.js` - IOM CSV download, parse, coordinate split, upsert; exports runIomIngestion, parseCoordinates, transformIomRows, fetchAndParseIomCsv, monthToQuarter
- `tests/server/ingestion-unhcr.test.js` - 7 unit tests for UNHCR module (pagination, transform, logging)
- `tests/server/ingestion-iom.test.js` - 10 unit tests for IOM module (coordinates, quarter mapping, transform, logging)

## Decisions Made

- UNHCR API provides annual totals only — all records stored with `quarter='q1'` (no per-quarter data available)
- IOM has no date-filter API, so the full CSV is always downloaded; `onConflict('id').ignore()` skips existing records efficiently
- IOM `dead/missing/dead_and_missing` fields stored as TEXT to match existing schema convention from Phase 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Both APIs are public (no auth).

## Next Phase Readiness

- UNHCR and IOM ingestion modules complete alongside ACLED (Plan 02)
- All three ingestion modules (`acledIngestion`, `unhcrIngestion`, `iomIngestion`) are ready for the scheduler in Plan 04
- Modules export named functions (`runUnhcrIngestion`, `runIomIngestion`) compatible with the scheduler interface

---
*Phase: 04-data-ingestion-pipeline*
*Completed: 2026-03-17*
