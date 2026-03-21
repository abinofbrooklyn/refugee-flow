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

key-decisions:
  - "@types/jest and @types/supertest installed as devDependencies — required for ts-jest strict mode in server tests"
  - "tsconfig.server.json types includes jest to expose describe/test/expect globally in server tests"
  - "jest.Mock & { destroy: jest.Mock } intersection type for mock DB with extra destroy property"
  - "Circular mock initializer broken via 'as unknown as MockChain' — required for self-referential knex chain mock"

requirements-completed: [MOD-V2-01]

duration: 14min
completed: 2026-03-21
---

# Phase 7 Plan 10: Server Test Files TypeScript Migration Summary

**17 server test files converted from .test.js to .test.ts, completing the full TypeScript migration — zero JS source files remain**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-21T20:49:00Z
- **Completed:** 2026-03-21T21:03:00Z
- **Tasks:** 1 complete (Task 2 checkpoint pending manual smoke test)
- **Files modified:** 19 (17 test files + tsconfig.server.json + package.json)

## Accomplishments
- Converted all 17 server test files from .test.js to .test.ts with full TypeScript import syntax
- Zero .js files remain in tests/server/ (migration complete)
- tsc --noEmit passes for both frontend and server tsconfig
- Vite build succeeds
- 16/17 test suites pass; 1 pre-existing test assertion bug preserved

## Task Commits

1. **Task 1: Convert all 17 server test files** - `d9299e5` (feat)

## Files Created/Modified
- `tests/server/*.test.ts` (17 files) — All server tests converted from require() to import syntax
- `tsconfig.server.json` — Added jest to types, added tests/server/**/* to include
- `package.json` / `package-lock.json` — @types/jest and @types/supertest added

## Decisions Made
- Installed `@types/jest` and `@types/supertest` as devDependencies — ts-jest strict mode requires these for `describe`/`test`/`expect` globals and supertest type safety
- Used `jest.Mock & { destroy: jest.Mock }` intersection type to assign extra properties (like `.destroy`) onto jest mock functions without type errors
- Used `as unknown as MockChain` to break circular type initializer in eurostat mock (self-referential `() => mockKnex`)
- Added `jest` to `types` array in tsconfig.server.json to expose Jest globals project-wide

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

**Total deviations:** 3 auto-fixed (1 blocking dependency, 2 type bugs)
**Impact on plan:** All auto-fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered
- Pre-existing test failure: `iomNormalizer.test.ts` geoFallback(33, 12) — test expects 'Western Mediterranean' but function returns 'Central Mediterranean'. This failure existed in the original .js file and is preserved as-is in .ts form. Not introduced by migration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete TypeScript migration achieved: zero .js/.jsx in src/, server/, tests/
- All type checks pass (tsc --noEmit for both frontend and server)
- Vite build succeeds
- Manual smoke test (Task 2 checkpoint) still pending user verification

---
*Phase: 07-start-v2-typescript-migration*
*Completed: 2026-03-21*

## Self-Check: PASSED
