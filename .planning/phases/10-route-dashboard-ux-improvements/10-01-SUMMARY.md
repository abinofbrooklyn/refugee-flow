---
phase: 10-route-dashboard-ux-improvements
plan: 01
subsystem: ui
tags: [maplibre-gl, fitBounds, react, typescript, map-viewport]

# Dependency graph
requires:
  - phase: 07-start-v2-typescript-migration
    provides: RouteCrossingCount type in src/types/api.ts, RefugeeRoute_map.tsx as functional React component with useRef pattern

provides:
  - Per-route map framing via fitBounds for 10 of 12 routes
  - navigateToRouteBounds helper unifying initial load and route-switch navigation
  - Optional bounds field on RouteCrossingCount type

affects:
  - 10-02 (visual tuning of bounds values)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "navigateToRouteBounds helper: checks params.bounds -> fitBounds, falls back to flyTo for routes without bounds"
    - "isStyleLoaded() guard pattern for safe fitBounds on map init (handles cached vs fresh style loads)"
    - "dataDict cast to RouteCrossingCount[] at import to preserve tuple type for bounds JSON arrays"

key-files:
  created: []
  modified:
    - src/types/api.ts
    - src/data/IBC_crossingCountByCountry.json
    - src/components/RefugeeRoute_map.tsx

key-decisions:
  - "Cast dataDict JSON import to RouteCrossingCount[] to resolve TypeScript inferring bounds as number[] instead of tuple [number, number, number, number]"
  - "navigateToRouteBounds placed outside component (not in useCallback) — pure function with no closure dependencies"
  - "fitBounds called after setPadding via isStyleLoaded() guard — handles both cached and fresh CDN style loads"
  - "maxZoom:7 cap on fitBounds to prevent extreme zoom on sparse routes (East & Southern Africa: 135 crossings)"

patterns-established:
  - "navigateToRouteBounds(map, params, animate): unified route navigation — fitBounds if bounds present, flyTo fallback"
  - "JSON import casting pattern: import rawData from '*.json'; const typedData = rawData as TypedInterface[]"

requirements-completed: [UX-FRAMING]

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 10 Plan 01: Route Dashboard UX Improvements — fitBounds Map Framing Summary

**Per-route fitBounds framing for 10 routes using maplibre-gl fitBounds, replacing static zoom:3.5/center-point with geographically tuned viewport bounds stored in IBC_crossingCountByCountry.json**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-25T00:20:00Z
- **Completed:** 2026-03-25T00:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added optional `bounds?: [number, number, number, number]` field to `RouteCrossingCount` type
- Populated bounds arrays for 10 of 12 routes in `IBC_crossingCountByCountry.json` (Iran-Afghanistan Corridor and South & East Asia unchanged per user decision)
- Replaced route-switch `flyTo` and initial map creation with `navigateToRouteBounds` helper that dispatches to `fitBounds` (with bounds) or `flyTo` fallback (without bounds)
- Initial map load uses `animate:false`; route switches use `animate:true` with 1500ms duration
- fitBounds called after `setPadding` in both paths, so sidebar-aware padding is respected

## Task Commits

1. **Task 1: Add bounds type and per-route bounds data** - `56a1b46` (feat)
2. **Task 2: Replace flyTo with fitBounds in map component** - `8d84a36` (feat)

## Files Created/Modified

- `src/types/api.ts` — Added `bounds?: [number, number, number, number]` to `RouteCrossingCount` interface
- `src/data/IBC_crossingCountByCountry.json` — Added bounds arrays to 10 route entries (Eastern Mediterranean through East & Southern Africa)
- `src/components/RefugeeRoute_map.tsx` — Added `navigateToRouteBounds` helper, replaced route-switch flyTo, added fitBounds on initial map load with isStyleLoaded() guard; cast dataDict import to RouteCrossingCount[]

## Decisions Made

- **Cast dataDict to RouteCrossingCount[]:** TypeScript infers JSON array bounds as `number[]`, not `[number, number, number, number]`. Cast at import resolves all three call sites without per-call assertions.
- **navigateToRouteBounds outside component:** Pure function with no closure state — no useCallback needed.
- **isStyleLoaded() guard on init:** Handles both cached CDN styles (synchronous) and fresh loads (async 'load' event), preventing silent fitBounds failure on first page load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript tuple type mismatch for JSON bounds field**
- **Found during:** Task 2 (map component implementation)
- **Issue:** TypeScript inferred `bounds` from JSON as `number[]`, not `[number, number, number, number]`. Three call sites to `navigateToRouteBounds` all failed with TS2345.
- **Fix:** Cast `dataDictRaw` JSON import to `RouteCrossingCount[]` at the import line (`const dataDict = dataDictRaw as RouteCrossingCount[]`).
- **Files modified:** `src/components/RefugeeRoute_map.tsx`
- **Verification:** `npx tsc --noEmit` exits 0 after fix
- **Committed in:** `8d84a36` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type inference bug)
**Impact on plan:** Fix required for correct typing. No scope creep.

## Issues Encountered

None beyond the TypeScript tuple inference issue above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 01 complete: bounds data and fitBounds logic are in place
- Plan 02 (visual tuning): each route's bounds values need visual validation in-browser and coordinate adjustment
- Routes without bounds (`Iran-Afghanistan Corridor`, `South & East Asia`) continue to use existing `flyTo` fallback

---
*Phase: 10-route-dashboard-ux-improvements*
*Completed: 2026-03-25*
