---
phase: 07-start-v2-typescript-migration
plan: 10
subsystem: testing
tags: [typescript, jest, ts-jest, supertest, migration]

requires:
  - phase: 07-start-v2-typescript-migration
    provides: All 21 server .ts files + 39 .tsx components — full TS source

provides:
  - 17 .test.ts server test files replacing all .test.js files
  - Complete TypeScript migration (zero .js files in src/, server/, tests/)
  - @types/jest and @types/supertest installed
  - tsconfig.server.json covers tests/server/**/*

affects:
  - Future test additions — must use .test.ts
  - tsconfig.server.json — now includes tests in type-check scope

tech-stack:
  added:
    - "@types/jest ^30"
    - "@types/supertest"
  patterns:
    - jest.Mock intersection type for mocks with extra properties (jest.fn() as jest.Mock & { destroy: jest.Mock })
    - Explicit type cast to break circular mock initializer (jest.fn() as unknown as MockChain)
    - import syntax for all server test imports (no require())
    - mockDb as jest.MockedFunction<typeof db> for typed mock assertions

key-files:
  created:
    - tests/server/alerter.test.ts
    - tests/server/asylumNormalizer.test.ts
    - tests/server/cbpIngestion.test.ts
    - tests/server/db-connection.test.ts
    - tests/server/endpoints.test.ts
    - tests/server/ingestion-acled.test.ts
    - tests/server/ingestion-eurostat.test.ts
    - tests/server/ingestion-iom.test.ts
    - tests/server/ingestion-unhcr.test.ts
    - tests/server/ingestionHealth.test.ts
    - tests/server/iomNormalizer.test.ts
    - tests/server/rateLimit.test.ts
    - tests/server/retryRunner.test.ts
    - tests/server/seed.test.ts
    - tests/server/ukChannelIngestion.test.ts
    - tests/server/updateCBP.test.ts
    - tests/server/validator.test.ts
  modified:
    - tsconfig.server.json (added jest to types, added tests/server to include)
    - package.json (@types/jest + @types/supertest added)
    - src/components/RefugeeRoute_map.tsx (ESM import fix for d3-canvas-transition)
    - src/components/Conflict.tsx (annotation overlay useEffect fix)
    - src/components/RefugeeRoute_textArea_content_ibcCountry.tsx (Fuse 3.x result shape fix)
    - src/components/globe/GlobeStatsBoard.tsx (::after/::before pseudo-element fix + label restoration)
    - src/components/Annotation.tsx (annotation positioning for renamed label)
    - src/components/Navbar.tsx (transient $currentPage prop)
    - src/components/LoadingBar.tsx (transient $ props)
    - src/components/GlobeTooltips.tsx (transient $ props)
    - src/components/RegionModalContent.tsx (transient $ props)
    - src/components/RefugeeRoute_textArea.tsx (transient $ props)
    - src/components/RefugeeRoute_textArea_content_basicInfo.tsx (transient $ prop + cast)
    - src/components/landing/DesktopLanding.tsx (transient $ props)
    - src/components/landing/MobileLanding.tsx (transient $ props)
    - src/components/asylumApplication/AsyApplicationContainer.tsx (transient $ props)
    - src/components/globe/GlobeContainer.tsx (transient $ props)

key-decisions:
  - "@types/jest and @types/supertest installed as devDependencies — required for ts-jest strict mode in server tests"
  - "tsconfig.server.json types includes jest to expose describe/test/expect globally in server tests"
  - "jest.Mock & { destroy: jest.Mock } intersection type for mock DB with extra destroy property"
  - "Circular mock initializer broken via 'as unknown as MockChain' — required for self-referential knex chain mock"
  - "Annotation overlay moved from render side-effect to useEffect with ref to prevent stale closure crash"
  - "Fuse 3.x search result shape is {item:{key}} not {key} — ibcCountry search was crashing on undefined access"

requirements-completed: [MOD-V2-01]

duration: 45min
completed: 2026-03-21
---

# Phase 7 Plan 10: Server Test Files TypeScript Migration Summary

**17 server test files converted to .test.ts, completing the full TypeScript migration — zero JS source files remain; smoke test passed after fixing 5 regressions**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-21T20:49:00Z
- **Completed:** 2026-03-21T21:35:00Z
- **Tasks:** 2 complete (Task 1 automated + Task 2 smoke test approved)
- **Files modified:** 36 (17 test files + tsconfig.server.json + package.json + 16 TSX regression fixes)

## Accomplishments
- Converted all 17 server test files from .test.js to .test.ts with full TypeScript import syntax
- Zero .js files remain in src/, server/, or tests/ (full migration complete)
- tsc --noEmit passes for both frontend and server tsconfig
- Vite build succeeds
- 5 regressions found and fixed during smoke test (ESM compat, annotation overlay, IBC search, pseudo-elements, transient props)
- Manual smoke test approved: landing, globe, routes, IBC search, about, navigation, API all verified

## Task Commits

1. **Task 1: Convert all 17 server test files** - `d9299e5` (feat)
2. **Task 2: Smoke test regression fixes** - `9b64313`, `be95fb1`, `cb982c3`, `27a9f63`, `c922fdd`, `6f50bb8`, `910019f`, `50ef815`, `e575099`, `eed7f7c`, `60eab38`, `82f80f3`, `0de2019`, `ac6b178`, `209b0dd`, `8b26d04`, `13dcf2f` (fix)

## Files Created/Modified
- `tests/server/*.test.ts` (17 files) — All server tests converted from require() to import syntax
- `tsconfig.server.json` — Added jest to types, added tests/server/**/* to include
- `package.json` / `package-lock.json` — @types/jest and @types/supertest added
- `src/components/RefugeeRoute_map.tsx` — ESM import fix for d3-canvas-transition (was require())
- `src/components/Conflict.tsx` — Annotation overlay moved to useEffect to fix stale closure crash
- `src/components/RefugeeRoute_textArea_content_ibcCountry.tsx` — Fuse 3.x result shape fix (item unwrapping)
- `src/components/globe/GlobeStatsBoard.tsx` — ::after/::before pseudo-element restoration + label display
- `src/components/Annotation.tsx` — Annotation positioning for renamed 'Armed Conflict Count' label
- Multiple styled-component files (Navbar, LoadingBar, GlobeTooltips, RegionModalContent, textArea, landing, GlobeContainer) — transient $prop fixes

## Decisions Made
- Installed `@types/jest` and `@types/supertest` as devDependencies — ts-jest strict mode requires these for `describe`/`test`/`expect` globals and supertest type safety
- Used `jest.Mock & { destroy: jest.Mock }` intersection type to assign extra properties (like `.destroy`) onto jest mock functions without type errors
- Used `as unknown as MockChain` to break circular type initializer in eurostat mock (self-referential `() => mockKnex`)
- Added `jest` to `types` array in tsconfig.server.json to expose Jest globals project-wide
- Annotation overlay moved to useEffect with ref — render-time side effects in strict mode can cause stale closures; useEffect ensures DOM is ready
- Fuse 3.x search returns `{item}` wrapper objects; ibcCountry was destructuring the result object directly causing undefined crashes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @types/jest and @types/supertest**
- **Found during:** Task 1 (test file compilation)
- **Issue:** ts-jest strict mode requires @types/jest for describe/test/expect globals; supertest import failed without @types/supertest
- **Fix:** `npm install --save-dev @types/jest @types/supertest --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** All test files compile with ts-jest
- **Committed in:** d9299e5

**2. [Rule 1 - Bug] Fixed TS7022 circular mock initializer in ingestion-eurostat**
- **Found during:** Task 1 (eurostat test TypeScript compilation)
- **Issue:** `const mockKnex = jest.fn(() => mockKnex)` gives TS7022 because the variable is referenced in its own initializer
- **Fix:** Defined explicit `MockChain` type, cast with `as unknown as MockChain`
- **Files modified:** tests/server/ingestion-eurostat.test.ts
- **Verification:** Eurostat test compiles and all 13 tests pass
- **Committed in:** d9299e5

**3. [Rule 1 - Bug] Fixed TS2339 property assignment on jest.fn()**
- **Found during:** Task 1 (ingestion-iom, ingestion-unhcr, validator test compilation)
- **Issue:** `mockDb.destroy = jest.fn()` fails type check — jest.fn() return type doesn't include custom properties
- **Fix:** Cast as `jest.Mock & { destroy: jest.Mock }` in mock factory
- **Files modified:** tests/server/ingestion-iom.test.ts, tests/server/ingestion-unhcr.test.ts, tests/server/validator.test.ts
- **Verification:** All 3 test suites compile and pass
- **Committed in:** d9299e5

---

**Total deviations (Task 1):** 3 auto-fixed (1 blocking dependency, 2 type bugs)

**Smoke test regressions fixed (Task 2):** 5 regressions found and fixed:

**4. [Rule 1 - Bug] ESM compat crash in RefugeeRoute_map — require() for d3-canvas-transition**
- **Found during:** Task 2 smoke test
- **Issue:** d3-canvas-transition was imported via require() inside TSX — crashed at runtime in ESM context
- **Fix:** Converted to `import` syntax
- **Files modified:** src/components/RefugeeRoute_map.tsx
- **Committed in:** 9b64313

**5. [Rule 1 - Bug] Annotation overlay not appearing — stale closure + render side-effect**
- **Found during:** Task 2 smoke test
- **Issue:** Annotation overlay logic ran during render (not in effect), causing stale ref and missing overlay on initial navigation from landing
- **Fix:** Moved annotation trigger into `useEffect` with ref dependency
- **Files modified:** src/components/Conflict.tsx
- **Committed in:** cb982c3

**6. [Rule 1 - Bug] IBC country search crashing — Fuse 3.x result shape mismatch**
- **Found during:** Task 2 smoke test
- **Issue:** Fuse 3.x returns `{item: {key}}` objects; ibcCountry was treating results as `{key}` directly, causing undefined crashes
- **Fix:** Added `.item` unwrapping + null guard before accessing result properties
- **Files modified:** src/components/RefugeeRoute_textArea_content_ibcCountry.tsx
- **Committed in:** be95fb1

**7. [Rule 1 - Bug] GlobeStatsBoard pseudo-elements lost — ::after/::before labels disappeared**
- **Found during:** Task 2 smoke test
- **Issue:** TSX conversion dropped the CSS ::after/::before content strings for stat box labels
- **Fix:** Restored pseudo-element CSS in styled-components template; adjusted breakpoints for MacBook displays
- **Files modified:** src/components/globe/GlobeStatsBoard.tsx, src/components/Annotation.tsx
- **Committed in:** e575099, eed7f7c, 60eab38, 82f80f3, 0de2019, ac6b178, 209b0dd, 8b26d04, 13dcf2f

**8. [Rule 1 - Bug] styled-components transient prop warnings — ~10 files forwarding non-HTML props**
- **Found during:** Task 2 smoke test
- **Issue:** Styled-components v6 forwards all props to DOM unless prefixed with `$`; pre-existing pattern caused console noise and potential DOM attribute errors
- **Fix:** Renamed affected props to transient `$prop` format across Navbar, LoadingBar, GlobeTooltips, RegionModalContent, textArea, landing, GlobeContainer
- **Files modified:** 10 component files
- **Committed in:** c922fdd, 6f50bb8, 910019f, 50ef815, 27a9f63

---

**Total deviations:** 8 auto-fixed (1 blocking dependency, 7 bugs found during migration + smoke test)
**Impact on plan:** All auto-fixes necessary for correctness and regression-free smoke test. No scope creep.

**Pre-existing bugs documented (not fixed — out of scope):**
- Link button navigates to /route/null when source_url missing
- MapLibre compass button appears non-functional at default pitch
- Syria 2015 war events sparse in seed data

## Issues Encountered
- Pre-existing test failure: `iomNormalizer.test.ts` geoFallback(33, 12) — test expects 'Western Mediterranean' but function returns 'Central Mediterranean'. This failure existed in the original .js file and is preserved as-is in .ts form. Not introduced by migration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete TypeScript migration achieved: zero .js/.jsx in src/, server/, tests/
- All type checks pass (tsc --noEmit for both frontend and server)
- Vite build succeeds
- Smoke test approved — landing, globe, routes, IBC search, about, navigation, API all verified working
- Phase 7 is complete; project is ready for v2 feature work

---
*Phase: 07-start-v2-typescript-migration*
*Completed: 2026-03-21*

## Self-Check: PASSED
