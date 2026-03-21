---
phase: 07-start-v2-typescript-migration
plan: 01
subsystem: infra
tags: [typescript, ts-jest, jest, tsconfig, vite, react-redux]

# Dependency graph
requires:
  - phase: 06-react-router-v6-migration
    provides: stable React/router foundation for TypeScript migration
provides:
  - typescript toolchain installed (typescript, ts-jest, @types/*)
  - tsconfig.json for frontend (strict, bundler moduleResolution, allowJs)
  - tsconfig.server.json for server (strict, CommonJS, node moduleResolution)
  - jest.config.js with ts-jest transforms for both client and server projects
  - src/types/redux.ts (RootState, AppDispatch, useAppDispatch, useAppSelector)
  - src/types/api.ts (WarEvent, RouteDeath, AsyApplication, IbcCrossing, CountryRoute, CrossingCountByCountry, WarNote)
affects: [07-02, 07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10]

# Tech tracking
tech-stack:
  added:
    - typescript
    - ts-jest
    - jest-environment-jsdom
    - "@types/react"
    - "@types/react-dom"
    - "@types/node"
    - "@types/react-redux"
    - "@types/lodash"
    - "@types/d3"
    - "@types/react-router-dom"
    - "@types/express"
    - "@types/pg"
    - "@types/three@0.165.0"
    - react-test-renderer
    - "@types/react-test-renderer"
  patterns:
    - Dual tsconfig pattern: tsconfig.json (frontend/bundler) + tsconfig.server.json (Node/CommonJS)
    - RootState/AppDispatch derived from JS store instance using ReturnType/typeof — avoids named import errors on .js files until Plan 02 conversion
    - ts-jest transform coexists with babel-jest for incremental migration (JS files still use babel)

key-files:
  created:
    - tsconfig.json
    - tsconfig.server.json
    - src/types/redux.ts
    - src/types/api.ts
  modified:
    - jest.config.js
    - package.json
    - vite.config.js -> vite.config.ts (renamed)

key-decisions:
  - "Derive RootState/AppDispatch from store instance (ReturnType<typeof store.getState>) rather than named imports — store.js uses default export, named imports caused tsc compile errors before Plan 02 conversion"
  - "jest-environment-jsdom explicitly installed — Jest 28+ removed it from default bundle, required by client test project"
  - "ts-jest and babel-jest coexist in transforms — .ts/.tsx via ts-jest, .js/.jsx via babel-jest, enabling incremental migration without breaking existing JS tests"

patterns-established:
  - "ReturnType<typeof store.getState> pattern for RootState derivation from JS stores"
  - "Dual tsconfig: tsconfig.json (frontend, bundler moduleResolution) and tsconfig.server.json (server, node moduleResolution)"

requirements-completed: [MOD-V2-01]

# Metrics
duration: 4min
completed: 2026-03-21
---

# Phase 7 Plan 01: TypeScript Toolchain Setup Summary

**TypeScript dual-config (frontend bundler + server CommonJS) with ts-jest transforms, @types/* packages, and pre-typed Redux hooks/API interfaces ready for incremental .js-to-.ts file conversion**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-21T19:41:53Z
- **Completed:** 2026-03-21T19:45:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed 15 TypeScript dev packages including typescript, ts-jest, and all @types/* packages
- Created dual tsconfig (frontend `bundler` moduleResolution, server `CommonJS` moduleResolution) both with strict mode and allowJs for incremental migration
- Updated jest.config.js to support .ts/.tsx files in both client and server projects via ts-jest transforms coexisting with babel-jest
- Created src/types/api.ts with 7 typed interfaces matching the live database schema (WarEvent, RouteDeath, AsyApplication, IbcCrossing, CountryRoute, CrossingCountByCountry, WarNote)
- Created src/types/redux.ts with pre-typed useAppDispatch/useAppSelector hooks

## Task Commits

1. **Task 1: Install TypeScript dependencies and create dual tsconfig files** - `1cea79d` (chore)
2. **Task 2: Update Jest config for TypeScript and create foundational type files** - `71fc684` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified

- `tsconfig.json` - Frontend TypeScript config (strict, moduleResolution bundler, allowJs, noEmit)
- `tsconfig.server.json` - Server TypeScript config (strict, CommonJS module, node moduleResolution)
- `vite.config.ts` - Renamed from vite.config.js (content unchanged)
- `jest.config.js` - Updated with ts-jest transforms for both test projects, jsdom environment
- `src/types/api.ts` - API response shape interfaces (7 interfaces matching DB/API contracts)
- `src/types/redux.ts` - Pre-typed Redux hooks using inferred store types
- `package.json` - 15 new devDependencies

## Decisions Made

- **RootState/AppDispatch derived from instance:** store.js uses `export default createStore(...)`, so named imports of RootState/AppDispatch would fail until Plan 02 converts the store to TypeScript. Used `ReturnType<typeof store.getState>` and `typeof store.dispatch` instead — this pattern works with allowJs and avoids compile errors while still providing type safety.
- **jest-environment-jsdom explicitly installed:** Jest 28+ removed jsdom from the default bundle; adding `testEnvironment: 'jsdom'` to the client project required this package.
- **ts-jest + babel-jest coexist:** .ts/.tsx files route to ts-jest, .js/.jsx files route to babel-jest. This allows incremental per-file migration without breaking any existing JS tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed jest-environment-jsdom**
- **Found during:** Task 2 (jest.config.js update)
- **Issue:** Adding `testEnvironment: 'jsdom'` to client project caused immediate test failure — "jest-environment-jsdom cannot be found" since Jest 28+ removed it from the default bundle
- **Fix:** `npm install --save-dev jest-environment-jsdom --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** Tests ran successfully after install
- **Committed in:** `71fc684` (Task 2 commit)

**2. [Rule 1 - Bug] Derive RootState/AppDispatch from store instance instead of named imports**
- **Found during:** Task 2 (src/types/redux.ts creation)
- **Issue:** Plan specified `import type { RootState, AppDispatch } from '../redux/store'` but store.js only has a default export — tsc exited with error TS2614 for both named imports
- **Fix:** Replaced named imports with `ReturnType<typeof store.getState>` and `typeof store.dispatch` inferred from the default-exported store instance
- **Files modified:** src/types/redux.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `71fc684` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes required for the must_have "tsc --noEmit exits 0". No scope creep.

## Issues Encountered

**Pre-existing test failure (not caused by this plan):** `tests/server/iomNormalizer.test.js` — `geoFallback(33, 12)` returns "Central Mediterranean" but test expects "Western Mediterranean". Confirmed pre-existing via git stash verification. 16 of 17 server test suites pass; this failure predates this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TypeScript infrastructure complete — all subsequent plans (02-10) can convert .js files to .ts incrementally
- `src/types/api.ts` and `src/types/redux.ts` ready for import by converted components
- Both tsconfig files compile clean, Vite build succeeds, Jest handles .ts test files

---
*Phase: 07-start-v2-typescript-migration*
*Completed: 2026-03-21*
