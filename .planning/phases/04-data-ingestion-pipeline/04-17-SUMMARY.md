---
phase: 04
plan: 17
status: complete
completed: 2026-03-25
commit: 8e0211b
---

# Plan 04-17 Summary

**One-liner:** Removed geo precision reduction from IOM route_deaths — was incorrectly losing 4.5x the actual data points.

## Problem

The `reduceGeoPercision()` function and `deduplicateRows()` call were being applied to route_deaths during IOM ingestion. This was wrong — geo reduction was designed for war_events on the THREE.js globe to prevent GPU crashes from overlapping points. Route deaths display on MapLibre's 2D map which handles full precision fine.

The result: only 4,736 rows were stored instead of the actual 21,561 — a 4.5x data loss. Coordinates were being rounded to 2 decimal places and then deduplicated, collapsing nearby but distinct death records into single points.

## What changed

| File | Change |
|------|--------|
| `server/ingestion/iomIngestion.ts` | Removed `reduceGeoPercision` from `parseCoordinates`, removed `deduplicateRows` call — full precision preserved |
| `tests/server/ingestion-iom.test.ts` | Added TDD tests: full precision preservation, no dedup |
| `scripts/seed.js` | Fixed asy_applications duplicate handling |
| `server/database/connection.ts` | Added `DATABASE_URL_PRODUCTION` for Supabase, `DATABASE_URL` for local dev |

## Key decision

Geo precision reduction only applies to `war_events` (THREE.js globe). All other data (route_deaths, IBC crossings, asylum applications) keeps full-precision coordinates for MapLibre display.

## Notes
- Commit: `8e0211b` — "fix(04-17): remove geo precision reduction from IOM route deaths"
- Summary created retroactively — work was done outside GSD execution tracking
