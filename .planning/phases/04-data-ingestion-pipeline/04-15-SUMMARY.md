---
phase: 04-data-ingestion-pipeline
plan: 15
subsystem: validation-layer
tags: [validation, quarantine, tdd, geo-bounds, iom-normalizer]
dependency_graph:
  requires: []
  provides: [data_quarantine-table, validator-module, geo-bounds-corrections]
  affects: [server/ingestion/iomNormalizer.js, db/migrations/004_data_quarantine.js, server/ingestion/validator.js]
tech_stack:
  added: []
  patterns: [tdd-red-green, quarantine-pattern, graceful-fallback]
key_files:
  created:
    - db/migrations/004_data_quarantine.js
    - server/ingestion/validator.js
    - tests/server/validator.test.js
  modified:
    - server/ingestion/iomNormalizer.js
decisions:
  - "ROUTE_MAP fix: Türkiye-Europe land route → Eastern Mediterranean (was Western Balkans) — deep Turkey/Caucasus (lng 30-47) is geographically Eastern Mediterranean"
  - "Central Med bounds tightened: lng > 55 → lng > 37 to exclude Qatar/UAE corridor"
  - "Western Balkans bounds tightened: lng ≤ 50 → lng ≤ 35, lat ≤ 55 → lat ≤ 50 to exclude Caucasus and Russia"
  - "Graceful fallback: validator never blocks ingestion — all rows pass through on DB failure"
  - "Known-bad IOM seeded as accepted in data_quarantine; suppression via acceptedIds Set at validation time"
metrics:
  duration_seconds: 219
  completed_at: "2026-03-21T00:33:57Z"
  tasks_completed: 1
  files_created: 3
  files_modified: 1
---

# Phase 4 Plan 15: Data Quarantine Migration + Validator Module Summary

**One-liner:** PostgreSQL quarantine table (JSONB), three-rule validator module covering all 7 ingestion sources, and tightened IOM geo bounds with ROUTE_MAP Türkiye-Europe fix — all TDD GREEN in 31 tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| RED | validator tests (failing) | 6264207 | tests/server/validator.test.js |
| GREEN | validator + migration + bounds fixes | 03c02b9 | server/ingestion/validator.js, db/migrations/004_data_quarantine.js, server/ingestion/iomNormalizer.js |

## Decisions Made

1. **ROUTE_MAP fix (locked decision):** `'Türkiye-Europe land route'` remapped from `'Western Balkans'` to `'Eastern Mediterranean'`. Records with this IOM source label have coordinates in deep Turkey/Caucasus (lng 30-47) — geographically Eastern Mediterranean, not Western Balkans. Added inline comment explaining the rationale.

2. **Central Mediterranean bounds (locked decision):** Upper longitude tightened from 55 to 37. This excludes Qatar (lng ~51) which was incorrectly passing through as Central Mediterranean — the actual Libya/Tunisia → Italy corridor ends well west of Egypt.

3. **Western Balkans bounds (locked decision):** Upper longitude tightened from 50 to 35 (excludes Caucasus/Azerbaijan), upper latitude tightened from 55 to 50 (excludes Russia at lat 53-54). Records in Turkey at lng 35-44 with lat 37-43 (legitimate Turkey-Europe transit corridor) are now correctly routed to Eastern Mediterranean via geoFallback.

4. **Graceful fallback:** The entire `validateRows` function body is wrapped in try/catch. DB failure loading accepted IOM IDs degrades gracefully (empty acceptedIds, continues validation). Any unexpected error returns `{ clean: rows, quarantined: [] }` — validation failure never blocks ingestion.

5. **Known-bad IOM suppression:** Migration seeds known-bad IOM records (geo-label source errors) as `status='accepted'` in `data_quarantine`. The query identifies them by coordinate anomalies (e.g. lng > 60 not South/East Asia, lat < 15 Eastern Med, etc.). Empty DB is handled silently.

## Deviations from Plan

### Auto-fixed Issues

None beyond the locked decisions from 04-CONTEXT-validation.md.

### Implementation Notes

- The `runRules` function is exported indirectly via the module but not in the public API (only `validateRows`, `quarantineRows`, `SOURCE_CONFIG` are exported). Tests cover all rule logic through `validateRows`.
- The null island check (lat===0 && lng===0) is evaluated before the range check to provide a more specific error message.
- Accepted IDs are loaded as a `Set<string>` for O(1) per-row lookup. `String(row.id)` coercion handles both numeric and string IDs.
- `violation_detail` is stored as a JSON string (not raw JSONB object) so Knex writes it correctly to the JSONB column.

## Test Results

```
Tests: 31 passed, 31 total
Suites: 1 passed
```

Covers: SOURCE_CONFIG exports (7 keys), geo-label mismatch (3 tests), outlier coordinates (3 tests), value anomalies (11 tests across all 7 sources), known-bad suppression (3 tests), quarantineRows (3 tests), graceful fallback (2 tests), non-geo source geo skip (3 tests).

## Self-Check: PASSED

Verified:
- `db/migrations/004_data_quarantine.js` — FOUND
- `server/ingestion/validator.js` — FOUND
- `tests/server/validator.test.js` — FOUND
- Commit 6264207 (RED: failing tests) — FOUND
- Commit 03c02b9 (GREEN: implementation) — FOUND
- `npx jest tests/server/validator.test.js --no-coverage` exits 0 — VERIFIED
