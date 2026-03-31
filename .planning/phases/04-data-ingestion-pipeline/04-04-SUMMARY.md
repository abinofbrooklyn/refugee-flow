---
phase: 04-data-ingestion-pipeline
plan: "04"
subsystem: api
tags: [node-cron, multer, csv-parse, express, admin, ingestion]

requires:
  - phase: 04-01
    provides: adminAuth middleware and ingestionLogger
  - phase: 04-02
    provides: runAcledIngestion function
  - phase: 04-03
    provides: runUnhcrIngestion and runIomIngestion functions

provides:
  - Admin routes for CSV preview (POST /admin/csv/preview)
  - Admin routes for CSV commit (POST /admin/csv/commit)
  - Admin manual trigger routes (POST /admin/trigger/:source)
  - Cron-scheduled ingestion (ACLED Mon, UNHCR Wed, IOM Fri at 02:00)
  - Integration tests for admin auth gating and CSV preview

affects:
  - frontend admin UI (Phase 5)
  - ingestion pipeline operations

tech-stack:
  added: []
  patterns:
    - Cron scheduling inside require.main block prevents test execution
    - multer memory storage for CSV file uploads
    - Admin routes mounted before express.static to avoid SPA fallback interception
    - Batch inserts of 500 rows with onConflict().ignore() for idempotent CSV commits

key-files:
  created:
    - server/routes/adminRoute.js
    - server/controllers/admin/adminController.js
    - tests/server/admin.test.js
  modified:
    - server/server.js

key-decisions:
  - "Cron scheduling inside require.main block — prevents cron from running during tests"
  - "Admin routes mounted before express.static — prevents SPA fallback intercepting /admin POST requests"
  - "CSV commit applies reduceGeoPercision(parseFloat(val), 2) to lat/lng columns before insert"

patterns-established:
  - "Pattern 1: Admin controller pattern — pure async handler functions exported from controller, wired in route file"
  - "Pattern 2: Cron isolation — all cron.schedule() calls inside require.main === module block"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-06, INGEST-07]

duration: 2min
completed: "2026-03-17"
---

# Phase 04 Plan 04: Admin Routes and Cron Scheduling Summary

**node-cron weekly schedules wired into server.js, Express admin backend with multer CSV upload (preview + commit) and manual ingestion trigger, all routes gated by shared-secret Bearer auth**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T16:18:12Z
- **Completed:** 2026-03-17T16:20:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created adminController.js with three handlers: csvPreview (multer+csv-parse), csvCommit (batched insert with geo precision reduction), triggerIngestion (maps source to runner)
- Created adminRoute.js with multer memory storage, adminAuth middleware applied globally to all routes
- Updated server.js to mount /admin routes before static handler and wire node-cron schedules inside require.main block
- Added 7 integration tests covering auth rejection, CSV preview success/failure, and trigger source validation

## Task Commits

1. **Task 1: Create admin routes and controller** - `76ec404` (feat)
2. **Task 2: Wire cron and server.js, add integration tests** - `b27e020` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/controllers/admin/adminController.js` - csvPreview, csvCommit, triggerIngestion handlers
- `server/routes/adminRoute.js` - Express router with multer upload and adminAuth middleware
- `server/server.js` - Added /admin mount and node-cron weekly schedule block
- `tests/server/admin.test.js` - 7 integration tests for admin route auth and CSV flow

## Decisions Made

- Cron scheduling placed inside `require.main === module` block — prevents cron timers from running during test execution
- Admin routes mounted before `express.static` — POST requests to /admin would otherwise be intercepted by the SPA fallback
- CSV commit geo precision applied via `reduceGeoPercision(parseFloat(val), 2)` consistent with ingestion pipeline pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four ingestion pipeline plans complete — ACLED, UNHCR, IOM ingestors are built and cron-scheduled
- Admin backend API ready for a frontend admin UI in Phase 5 if desired
- ADMIN_SECRET env var must be set in production for admin routes to be accessible

---
*Phase: 04-data-ingestion-pipeline*
*Completed: 2026-03-17*
