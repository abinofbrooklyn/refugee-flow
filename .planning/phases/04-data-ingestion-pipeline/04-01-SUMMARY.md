---
phase: 04-data-ingestion-pipeline
plan: "01"
subsystem: data-ingestion
tags: [database, migration, ingestion, middleware, dependencies]
dependency_graph:
  requires: []
  provides:
    - ingestion_log table (all ingestion plans log here)
    - war_events.event_id as text (ACLED upsert)
    - war_notes.id as text (ACLED event_id_cnty)
    - asy_applications unique index (UNHCR upsert)
    - server/ingestion/ingestionLogger.js
    - server/middleware/adminAuth.js
  affects:
    - db/migrations/001_create_tables.js (schema evolved by 002)
    - All Phase 4 ingestion plans depend on these utilities
tech_stack:
  added: [node-cron, csv-parse, multer]
  patterns: [knex migrations, shared-secret middleware, ingestion logging]
key_files:
  created:
    - db/migrations/002_ingestion_log_and_schema_updates.js
    - server/ingestion/ingestionLogger.js
    - server/middleware/adminAuth.js
  modified:
    - .env.example
    - package.json
    - package-lock.json
decisions:
  - Deduplicate asy_applications at migration time — existing seeded data had duplicate (year, quarter, origin, destination) rows preventing unique index creation
  - Use --legacy-peer-deps for npm install — pre-existing eslint-config-airbnb peer conflict in this project
metrics:
  duration_minutes: 3
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 3
---

# Phase 4 Plan 1: Ingestion Foundation Summary

**One-liner:** Database schema migration adding ingestion_log table, text-type fixes for ACLED IDs, asy_applications deduplication + unique index, plus ingestionLogger/adminAuth shared utilities and new npm dependencies.

## What Was Built

### Task 1: Migration, dependencies, and .env.example

Created `db/migrations/002_ingestion_log_and_schema_updates.js` which:
- Alters `war_events.event_id` from integer to text (ACLED uses string event IDs)
- Adds unique index `war_events_event_id_unique` for safe upserts
- Alters `war_notes.id` from integer to text (ACLED event_id_cnty linkage)
- Deduplicates `asy_applications` (existing seeded data had duplicates), then adds unique index `asy_applications_year_quarter_origin_dest_unique` for UNHCR `onConflict().merge()` support
- Creates `ingestion_log` table with columns: id, source, status, rows_affected, error_message, started_at, completed_at

Migration applied successfully to Supabase database (Batch 2).

Installed new dependencies: `node-cron`, `csv-parse`, `multer` (using `--legacy-peer-deps` due to pre-existing eslint-config-airbnb peer conflict).

Added `ACLED_EMAIL`, `ACLED_PASSWORD`, and `ADMIN_SECRET` to `.env.example`.

### Task 2: Shared utilities

Created `server/ingestion/ingestionLogger.js`:
- `logIngestion({ source, status, rowsAffected, errorMessage, startedAt })` — inserts a row to ingestion_log
- `getLastSyncDate(source)` — queries last successful run date for incremental sync

Created `server/middleware/adminAuth.js`:
- `adminAuth(req, res, next)` — validates `Authorization: Bearer <ADMIN_SECRET>` header, returns 401 on failure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deduplicate asy_applications before unique index creation**
- **Found during:** Task 1 — migration failed with "could not create unique index"
- **Issue:** Existing seeded data contained 10+ duplicate groups on (year, quarter, origin, destination) (e.g., Afghanistan/Australia q1 2010 appeared 3 times)
- **Fix:** Added a `DELETE FROM asy_applications WHERE pk NOT IN (SELECT MIN(pk) FROM asy_applications GROUP BY year, quarter, origin, destination)` step before the `CREATE UNIQUE INDEX` statement in the migration
- **Files modified:** db/migrations/002_ingestion_log_and_schema_updates.js
- **Commit:** 510870a

**2. [Rule 3 - Blocking] Use --legacy-peer-deps for npm install**
- **Found during:** Task 1 — `npm install node-cron csv-parse multer` failed with ERESOLVE
- **Issue:** Pre-existing eslint-config-airbnb peer conflict (documented in STATE.md decisions)
- **Fix:** Used `npm install node-cron csv-parse multer --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Commit:** 510870a

## Self-Check: PASSED

- db/migrations/002_ingestion_log_and_schema_updates.js: FOUND
- server/ingestion/ingestionLogger.js: FOUND
- server/middleware/adminAuth.js: FOUND
- Commit 510870a (Task 1): FOUND
- Commit 31cd73e (Task 2): FOUND
