---
phase: 04-data-ingestion-pipeline
plan: 16
subsystem: ingestion-validation
tags: [validation, quarantine, alerting, data-quality]
dependency_graph:
  requires: [04-15]
  provides: [validation-wired-all-pipelines]
  affects: [iomIngestion, acledIngestion, eurostatIngestion, unhcrIngestion, frontexIngestion, cbpIngestion, ukChannelIngestion]
tech_stack:
  added: []
  patterns: [validate-then-upsert, quarantine-and-alert, graceful-fallback]
key_files:
  created: []
  modified:
    - server/ingestion/alerter.js
    - server/ingestion/ingestionLogger.js
    - tests/server/alerter.test.js
    - server/ingestion/iomIngestion.js
    - server/ingestion/acledIngestion.js
    - server/ingestion/eurostatIngestion.js
    - server/ingestion/unhcrIngestion.js
    - server/ingestion/frontexIngestion.js
    - server/ingestion/cbpIngestion.js
    - server/ingestion/ukChannelIngestion.js
decisions:
  - "quarantineCount returned from ingestCbpData/ingestUkChannelData since validation is inside the combined transform+upsert function"
  - "ACLED: cleanNoteRows filtered by clean war event IDs to keep notes/events in sync"
  - "Eurostat: totalQuarantineCount accumulated across all per-destination loops, single logIngestion call at end"
metrics:
  duration: 4 minutes
  completed: "2026-03-21"
  tasks: 2
  files: 10
---

# Phase 4 Plan 16: Validation Integration Summary

**One-liner:** Validator wired into all 7 pipelines — bad rows quarantined to data_quarantine, owner alerted via email, quarantine counts logged per ingestion run.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend alerter + logIngestion + add tests | 41778ad | alerter.js, ingestionLogger.js, alerter.test.js |
| 2 | Integrate validator into all 7 pipelines | 1b5bba0 | 7 ingestion pipeline files |

## What Was Built

### Task 1: alerter.js + ingestionLogger.js + tests

- `sendQuarantineAlert(source, quarantinedItems)` added to alerter.js — sends HTML email table showing every quarantined row with its raw values, the rule violated, expected vs found, and the SQL query to review pending quarantines
- Early-exit guard: returns immediately on empty array (no email sent)
- API key guard: logs error and returns if RESEND_API_KEY not set
- `logIngestion()` extended with `quarantineCount = 0` parameter, writes to `quarantine_count` column in ingestion_log
- 4 new tests in `sendQuarantineAlert()` describe block: no-op on empty, no send without key, email with full details, no throw on API failure
- All 11 alerter tests pass

### Task 2: Validator integration (all 7 pipelines)

Each pipeline now follows the same pattern after transform/dedup and before upsert:

```javascript
let cleanRows = rows;
let quarantineCount = 0;
try {
  const { clean, quarantined } = await validateRows('source', rows);
  cleanRows = clean;
  quarantineCount = quarantined.length;
  if (quarantined.length > 0) {
    await quarantineRows('source', quarantined);
    await sendQuarantineAlert('source', quarantined);
  }
} catch (valErr) {
  console.error('[Source] Validation failed, proceeding with all rows:', valErr.message);
}
```

Pipeline-specific details:
- **IOM**: validation on normalized+deduped rows; batch loop uses `cleanRows`
- **ACLED**: validation on `validWarRows` (NaN-filtered); `cleanNoteRows` filtered by clean event IDs to keep war_notes in sync with war_events
- **Eurostat**: validation per destination inside the nested loop; `totalQuarantineCount` accumulates across all 30+ destinations; single logIngestion at end
- **UNHCR**: validation on final deduped quarterly rows; batch loop uses `cleanRows`
- **Frontex**: validation on `upsertRows` (XLSX-parsed); `upsertFrontexData` called with `cleanRows`
- **CBP**: validation inside `ingestCbpData` after building `newData` Map; `ingestCbpData` returns `quarantineCount`; diff uses `cleanNewRows`; `country_routes` update uses `cleanNewRows`
- **UK Channel**: same pattern as CBP — validation inside `ingestUkChannelData`, returns `quarantineCount`

## Decisions Made

1. **quarantineCount returned from combined functions**: CBP and UK Channel have a single `ingestCbpData`/`ingestUkChannelData` function that both transforms and upserts. Rather than refactoring these, the quarantine count is returned from these functions and passed to `logIngestion` in the caller.

2. **ACLED note sync**: After quarantining ACLED war_events, the corresponding war_notes are filtered to only include notes for clean event IDs. This prevents orphaned notes in war_notes for events that were quarantined from war_events.

3. **Eurostat accumulation**: Eurostat runs validation inside a per-destination loop (30+ destinations × 64 origins). The quarantine count accumulates across all destinations, and a single alert email is sent per destination batch if rows are quarantined. The total is passed to logIngestion once at the end.

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- All 217 server tests pass (including 11 alerter tests, 4 new sendQuarantineAlert tests)
- `npx jest tests/server/ --no-coverage` exits 0

## Self-Check: PASSED

Files verified:
- server/ingestion/alerter.js — contains sendQuarantineAlert, exports both functions
- server/ingestion/ingestionLogger.js — contains quarantineCount = 0 in signature, quarantine_count in insert
- tests/server/alerter.test.js — contains sendQuarantineAlert describe block
- All 7 pipeline files contain require('./validator'), validateRows(, quarantineRows(, sendQuarantineAlert(, quarantineCount

Commits verified:
- 41778ad (feat(04-16): extend alerter...)
- 1b5bba0 (feat(04-16): integrate validator...)
