---
phase: 04-data-ingestion-pipeline
plan: 09
subsystem: api
tags: [normalization, ingestion, quarterly-estimation, country-names, unhcr, eurostat, backfill, frontend]

# Dependency graph
requires:
  - phase: 04-data-ingestion-pipeline
    provides: countryNormalizer.js and quarterlyEstimator.js pure-function modules (Plan 08)
provides:
  - UNHCR ingestion with country normalization, EU-skip, and quarterly distribution
  - Eurostat ingestion with country normalization
  - Cron schedule ensuring Eurostat runs before UNHCR
  - Backfill script for existing seed data (name normalization + quarterly redistribution)
  - Frontend estimation footnote for non-EU quarterly data
affects: [asylum-chart-frontend, data-quality]

# Tech tracking
tech-stack:
  added: []
  patterns: [ingestion-normalization-at-write-time, estimation-disclosure-footnote]

key-files:
  created:
    - scripts/normalizeAsyApplications.js
  modified:
    - server/ingestion/unhcrIngestion.js
    - server/ingestion/eurostatIngestion.js
    - server/server.js
    - src/components/asylumApplication/AsyApplicationContainer.jsx

key-decisions:
  - "UNHCR ingestion skips EU/EEA destinations entirely (Eurostat owns that data) to prevent double-counting"
  - "UNHCR annual totals expanded into 4 quarterly rows using Eurostat seasonal ratios at ingestion time"
  - "UNHCR cron moved to Friday 04:00 to avoid collision with IOM at Friday 02:00"

patterns-established:
  - "Estimation disclosure: footnotes on charts that use estimated/distributed data"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 04 Plan 09: Asylum Normalization Integration Summary

**UNHCR/Eurostat ingestion pipelines with country normalization, EU-skip dedup, quarterly distribution, backfill script, and estimation footnote**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T03:12:37Z
- **Completed:** 2026-03-20T03:16:51Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- UNHCR ingestion now normalizes country names, skips EU/EEA destinations, and distributes annual totals into q1-q4 using Eurostat seasonal ratios
- Eurostat ingestion normalizes country names before writing to DB
- Cron schedule reordered: Eurostat Wednesday 02:00, UNHCR Friday 04:00 (ensuring ratios available)
- Created idempotent backfill script for existing seed data (Phase 1: name normalization, Phase 2: quarterly redistribution)
- Added estimation footnote below asylum chart for data transparency

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate normalizers into UNHCR and Eurostat ingestion modules and update cron schedule** - `0bcc972` (feat)
2. **Task 2: Create backfill script for existing seed data and add frontend estimation footnote** - `280eb37` (feat)

## Files Created/Modified
- `server/ingestion/unhcrIngestion.js` - Added normalizeCountryName, EU_DESTINATIONS skip, distributeByQuarter quarterly expansion
- `server/ingestion/eurostatIngestion.js` - Added normalizeCountryName to sumToQuarters origin/destination
- `server/server.js` - Reordered cron: Eurostat Wednesday before UNHCR Friday
- `scripts/normalizeAsyApplications.js` - Two-phase backfill: name normalization + quarterly redistribution
- `src/components/asylumApplication/AsyApplicationContainer.jsx` - Estimation footnote styled-component

## Decisions Made
- UNHCR ingestion skips EU/EEA destinations entirely to prevent double-counting with Eurostat quarterly data
- UNHCR annual totals expanded into 4 quarterly rows using Eurostat seasonal ratios at ingestion time (not read time)
- UNHCR cron moved to Friday 04:00 (staggered 2 hours after IOM at 02:00) to avoid collision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All asylum data normalization pipeline complete end-to-end
- Backfill script ready to run against production database: `node scripts/normalizeAsyApplications.js`
- Frontend transparently discloses quarterly estimation methodology

---
*Phase: 04-data-ingestion-pipeline*
*Completed: 2026-03-20*
