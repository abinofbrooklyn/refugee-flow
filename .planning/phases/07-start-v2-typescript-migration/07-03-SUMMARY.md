---
phase: 07-start-v2-typescript-migration
plan: 03
subsystem: infra
tags: [typescript, api, data-dictionaries, three-js, color-conversion, fetch]

# Dependency graph
requires:
  - phase: 07-start-v2-typescript-migration
    plan: 01
    provides: TypeScript toolchain, tsconfig.json, src/types/api.ts with response interfaces
affects: [07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10]

# Dependency provides
provides:
  - src/utils/api.ts — typed fetch wrappers returning Promise<RouteDeath[]>, Promise<CountryRoute[]>, etc.
  - src/utils/color-conversion-algorithms.ts — typed color math functions with tuple return types
  - src/components/utils/fetchers.ts — typed fetchData helper
  - src/data/routeDictionary.ts — typed ColorMapEntry[] array
  - src/data/warDictionary.ts — typed year[], countryList tuples, countryCode, eventDict
  - src/THREEJSScript/EffectComposer.ts — typed vendored THREE.js effect composer class
  - src/THREEJSScript/Octree.ts — typed stub for disabled octree with OctreeHandle interface
  - src/types/api.ts — RouteCrossingCount interface added; CrossingCountByCountry corrected to RouteCrossingCount[]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Tuple return types for pure math functions ([number, number, number] for RGB/HSL/HSV)
    - Typed fetch cache pattern — Promise<T> | null cache variables with typed return functions
    - Vendored legacy THREE.js code converted with typed class structure; @ts-expect-error for renderer.context (deprecated API not in @types/three@0.165.0)
    - Disabled feature stub pattern — Octree.ts is a typed no-op stub with OctreeHandle interface

key-files:
  created:
    - src/utils/api.ts
    - src/utils/color-conversion-algorithms.ts
    - src/components/utils/fetchers.ts
    - src/data/routeDictionary.ts
    - src/data/warDictionary.ts
    - src/THREEJSScript/EffectComposer.ts
    - src/THREEJSScript/Octree.ts
  modified:
    - src/types/api.ts (RouteCrossingCount interface added; CrossingCountByCountry type corrected)
  deleted:
    - src/utils/api.js
    - src/utils/color-conversion-algorithms.js
    - src/components/utils/fetchers.js
    - src/data/routeDictionary.js
    - src/data/warDictionary.js
    - src/THREEJSScript/EffectComposer.js

key-decisions:
  - "CrossingCountByCountry type corrected from index signature to RouteCrossingCount[] — IBC_crossingCountByCountry.json is an array of route objects, not a string-keyed number map"
  - "Octree.ts created as stub (Octree.js never existed) — disabled per RESEARCH.md note about browser crash on large BufferGeometry"
  - "EffectComposer.ts uses @ts-expect-error only for renderer.context access (deprecated WebGL1 API path) — all other typing done properly"

patterns-established:
  - "Tuple return type [number, number, number] for RGB/HSL/HSV color conversion functions"
  - "Typed fetch cache: Promise<T> | null variable, function returns Promise<T>"
  - "Vendored THREE.js scripts use typed class structure with @ts-expect-error only at unavoidable API boundaries"

requirements-completed: [MOD-V2-01]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 7 Plan 03: Utilities, Data Dictionaries, and Vendored Scripts TypeScript Conversion Summary

**7 files converted from .js to .ts with proper types — typed API fetch cache, color math tuple returns, route/war data interfaces, and vendored THREE.js EffectComposer class; CrossingCountByCountry type corrected to match actual JSON array shape**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-21T19:48:11Z
- **Completed:** 2026-03-21T19:54:52Z
- **Tasks:** 2
- **Files modified:** 8 (7 created, 1 type fix)

## Accomplishments

- Converted `src/utils/api.ts` with typed Promise<RouteDeath[]>, Promise<CountryRoute[]>, Promise<IbcCrossing[]>, Promise<CrossingCountByCountry> return types and typed null-able cache variables
- Converted `src/utils/color-conversion-algorithms.ts` with tuple return types `[number, number, number]` for all RGB/HSL/HSV functions
- Converted `src/components/utils/fetchers.ts` with typed url/setter/setLoader parameters
- Converted `src/data/routeDictionary.ts` with typed `ColorMapEntry` interface and typed `color_map` array
- Converted `src/data/warDictionary.ts` with typed `CountryEntry` interface, `year: string[]`, `countryList: [string, string][]`, `eventDict: string[]`
- Converted `src/THREEJSScript/EffectComposer.ts` — vendored legacy code with typed class structure; `@ts-expect-error` only for `renderer.context` (WebGL1 deprecated path not in @types/three@0.165.0)
- Created `src/THREEJSScript/Octree.ts` — typed stub with `OctreeHandle` interface (Octree.js never existed; disabled per crash issue documented in RESEARCH.md)
- Fixed `CrossingCountByCountry` type in `src/types/api.ts` — was incorrect `{[country: string]: number}` index signature, corrected to `RouteCrossingCount[]` matching the actual JSON array structure

## Task Commits

1. **Task 1: Convert API utilities and color conversion to TypeScript** - `ea431de` (feat)
2. **Task 2: Convert data dictionaries and vendored THREE.js scripts to TypeScript** - `be498a9` (included in prior docs commit)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `src/utils/api.ts` - Typed fetch wrappers with cache, imports from src/types/api
- `src/utils/color-conversion-algorithms.ts` - Pure math color conversion with tuple returns
- `src/components/utils/fetchers.ts` - Typed fetchData with url/setter/setLoader params
- `src/data/routeDictionary.ts` - ColorMapEntry interface and color_map array
- `src/data/warDictionary.ts` - CountryEntry interface, year[], countryList tuples, eventDict
- `src/THREEJSScript/EffectComposer.ts` - Typed vendored EffectComposer + Pass classes
- `src/THREEJSScript/Octree.ts` - OctreeHandle interface + disabled stub implementation
- `src/types/api.ts` - Added RouteCrossingCount interface; corrected CrossingCountByCountry type

## Decisions Made

- **CrossingCountByCountry type correction:** Plan 01 defined this type as `{ [country: string]: number }` based on the name, but the actual `IBC_crossingCountByCountry.json` is an array of `{ route, total_cross, center_lng, center_lat, zoom }` objects. Added `RouteCrossingCount` interface and set `CrossingCountByCountry = RouteCrossingCount[]` to match reality. This prevents a runtime type mismatch and aligns with how `GlobeRouteButton.jsx` uses the data (stores the whole array in state).
- **Octree.ts as stub:** `Octree.js` never existed in the codebase (was presumably never added when the Octree feature was disabled). Created a minimal typed stub with `OctreeHandle` interface exposing `update()` and `remove()` — both no-ops. This satisfies the locked decision that all files in `src/THREEJSScript/` be `.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected CrossingCountByCountry type to match actual JSON data shape**
- **Found during:** Task 1 (src/utils/api.ts creation)
- **Issue:** `CrossingCountByCountry` was defined as `{ [country: string]: number }` in src/types/api.ts (Plan 01), but `IBC_crossingCountByCountry.json` is actually an array of route objects with `route`, `total_cross`, `center_lng`, `center_lat`, `zoom` fields. TypeScript error TS2352 — cast fails because array doesn't satisfy index signature.
- **Fix:** Added `RouteCrossingCount` interface in src/types/api.ts and changed `CrossingCountByCountry` type to `RouteCrossingCount[]`
- **Files modified:** src/types/api.ts
- **Verification:** `tsc --noEmit` exits 0 after fix
- **Committed in:** `ea431de` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type mismatch bug)
**Impact on plan:** Required for tsc --noEmit to pass. Corrects a type mismatch between the declared type and actual data without changing runtime behavior.

## Issues Encountered

**Task 2 files were pre-committed:** The data dictionaries (routeDictionary.ts, warDictionary.ts) and THREE.js scripts (EffectComposer.ts, Octree.ts) were already committed as part of the `be498a9` docs(07-02) commit from the previous session. Task 2 verification confirmed all files were correct and passing before the task executed. No re-work was needed.

**Pre-existing test failure (not caused by this plan):** `tests/server/iomNormalizer.test.js` — `geoFallback(33, 12)` returns "Central Mediterranean" but test expects "Western Mediterranean". This is documented in Plan 01 SUMMARY as a pre-existing failure predating this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All utility and data dictionary files are now TypeScript with proper types
- `src/utils/api.ts` provides typed fetch wrappers that component conversions can import
- `src/data/routeDictionary.ts` and `warDictionary.ts` provide typed data that globe components consume
- `src/THREEJSScript/EffectComposer.ts` typed; `OctreeHandle` interface available for GlobeVisual typing
- Ready for Plan 04: component layer conversion (components can now import typed utilities)

---
*Phase: 07-start-v2-typescript-migration*
*Completed: 2026-03-21*
