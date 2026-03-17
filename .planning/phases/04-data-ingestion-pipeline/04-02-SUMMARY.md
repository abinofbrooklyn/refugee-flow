---
phase: 04-data-ingestion-pipeline
plan: 02
subsystem: ingestion
tags: [acled, oauth, conflict-data, knex, jest, tdd, war-events, war-notes]

# Dependency graph
requires:
  - phase: 04-data-ingestion-pipeline/04-01
    provides: ingestionLogger.js with logIngestion() and getLastSyncDate()
  - phase: 03-database-migration
    provides: war_events and war_notes tables with text event_id/id and unique indexes
provides:
  - ACLED ingestion module with OAuth auth, paginated fetch, incremental sync, geo precision, war_events upsert, war_notes population
  - runAcledIngestion() export callable from scheduled jobs or admin routes
  - 10 unit tests covering all behavior paths with mocked fetch and mocked db
affects:
  - 04-03 (UNHCR ingestion — same logger/db pattern)
  - 04-05 (ingestion scheduler — calls runAcledIngestion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OAuth POST to /oauth/token with email/password/grant_type/client_id body
    - Paginate API at 5000/page, stop when response length < limit
    - Math.ceil(month/3) for month-to-quarter mapping
    - onConflict('event_id').ignore() for war_events (no overwrite of existing events)
    - onConflict('id').merge() for war_notes (update notes if event already ingested)
    - Filter out NaN lat/lng rows before DB insert
    - Batch inserts at 500 rows via knex slice loop

key-files:
  created:
    - server/ingestion/acledIngestion.js
    - tests/server/ingestion-acled.test.js
  modified: []

key-decisions:
  - "war_notes upsert uses onConflict merge (not ignore) — allows notes to update if ACLED corrects them on re-ingest"
  - "NaN lat/lng filtered at ingestion time — malformed coordinates excluded before DB insert, consistent with seed.js pattern"
  - "war_notes batch validity derived from warRows NaN check — both tables processed from same event array so indices align"

patterns-established:
  - "ACLED module: getToken -> getLastSyncDate -> fetchAll (paginated) -> transform -> batchUpsert -> logIngestion"
  - "TDD: tests/server/ingestion-*.test.js with jest.mock for db and ingestionLogger"

requirements-completed: [INGEST-01, INGEST-04, INGEST-05]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 4 Plan 02: ACLED Ingestion Summary

**OAuth-authenticated ACLED conflict event ingestion: paginated fetch with incremental sync, geo precision reduction, war_events + war_notes upsert, and full TDD coverage**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T16:12:54Z
- **Completed:** 2026-03-17T16:14:39Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- ACLED OAuth token retrieval via POST to `acleddata.com/oauth/token` with email/password credentials
- Paginated event fetch at 5000 events/page with automatic stop when results are exhausted
- Incremental sync: appends `event_date=FROM|TO&event_date_where=BETWEEN` when prior successful sync date exists
- `monthToQuarter()` maps month number 1-12 to q1-q4 via `Math.ceil(month / 3)`
- `transformAcledEvents()` reduces lat/lng to 2 decimal places using existing `reduceGeoPercision` helper
- `runAcledIngestion()` upserts war_events (ignore conflicts) and war_notes (merge conflicts) in 500-row batches
- Error path logs to ingestion_log and re-throws; success path logs rowsAffected
- All 10 TDD unit tests pass with mocked fetch and mocked Knex db

## Task Commits

Each task was committed atomically:

1. **Task 1: ACLED ingestion module with OAuth, transform, upsert, and war_notes** - `b354b9b` (feat)

**Plan metadata:** _(docs commit to follow)_

_Note: TDD — tests written first (RED confirmed module missing), then implementation written until all 10 tests pass (GREEN)._

## Files Created/Modified
- `server/ingestion/acledIngestion.js` - ACLED ingestion module: getAcledToken, fetchAcledEvents, monthToQuarter, transformAcledEvents, runAcledIngestion
- `tests/server/ingestion-acled.test.js` - 10 unit tests with mocked fetch and mocked db covering all behavior paths

## Decisions Made
- `war_notes` upsert uses `onConflict('id').merge()` rather than `.ignore()` — if ACLED corrects notes on a re-ingestion, the updated notes should propagate
- NaN lat/lng rows are filtered before DB insert (matching the pattern in seed.js), keeping coordinate data clean
- Note rows filtered by corresponding warRow NaN check since both arrays are built from same event index

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

ACLED API credentials must be set before `runAcledIngestion()` can be called in production:
- `ACLED_EMAIL` — ACLED account email
- `ACLED_PASSWORD` — ACLED account password

These are consumed in `getAcledToken()` via `process.env`.

## Next Phase Readiness
- `runAcledIngestion()` is ready to call from an ingestion scheduler or admin endpoint
- Module follows same logger/db pattern as Plan 01 — UNHCR and IOM ingestion modules (Plans 03-04) can use it as a reference

---
*Phase: 04-data-ingestion-pipeline*
*Completed: 2026-03-17*
