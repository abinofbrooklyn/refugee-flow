---
phase: 04
plan: 19
status: complete
completed: 2026-03-25
commit: c14e1ce
---

# Plan 04-19 Summary

**One-liner:** Hybrid route death loading — current route loads first for fast initial render, rest prefetched in background for instant switching.

## Problem

Previously, navigating to any route page fetched ALL route death data (~21k rows) before rendering. This made every route page load wait for the full dataset, even though only one route's data was needed immediately.

## What changed

| File | Change |
|------|--------|
| `server/controllers/api/data/dataController.ts` | Added `?route=X` query param filtering to `/data/route_death` endpoint (backwards compatible — no param returns all) |
| `server/routes/dataRoute.ts` | Updated route handler for query param |
| `src/utils/api.ts` | Added `get_routeDeathByRoute(route)` with per-route promise cache (`cached_routeDeathByRoute[route]`) |
| `src/components/RefugeeRoute.tsx` | Hybrid loading: Step 1 loads current route deaths + IBC in parallel (fast render), Step 2 prefetches all routes in background via `get_routeDeath()` |
| `tests/server/endpoints.test.ts` | 3 new TDD tests: filtered route returns only matching data, no param returns all, unknown route returns empty |

## How it works

1. User navigates to `/route/CentralMediterranean`
2. **Step 1 (fast):** `get_routeDeathByRoute("Central Mediterranean")` + `get_routeIBC()` load in parallel — only current route's deaths fetched
3. `setLoading(false)` — page renders immediately with current route data
4. **Step 2 (background):** `get_routeDeath()` prefetches all routes — cached for instant switching later
5. Subsequent route switches hit the cache — no additional network requests

## Key decision

Server-side filtering via query param rather than client-side filter of full dataset. This reduces initial payload from ~21k rows to ~1-5k rows per route. The `allDataLoadedRef` ref prevents duplicate background fetches.

## Notes
- Commit: `c14e1ce` — "feat(04-19): hybrid route death loading — current route first, prefetch rest"
- This became the foundation for Phase 8's smooth route transitions (keeping old data visible while new loads)
- Summary created retroactively — work was done outside GSD execution tracking
