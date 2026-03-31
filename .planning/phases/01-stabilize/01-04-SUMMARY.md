---
phase: 01-stabilize
plan: 04
subsystem: api
tags: [cors, rate-limiting, express-rate-limit, supertest, middleware, security]

# Dependency graph
requires: []
provides:
  - CORS headers on all Express routes (all origins allowed)
  - Rate limiting on /data routes (200 req/15min/IP, 429 on breach)
  - Integration test suite for rate limiting behavior
affects: [any phase that adds new Express routes or modifies server.js middleware]

# Tech tracking
tech-stack:
  added: [cors, express-rate-limit]
  patterns:
    - Middleware registration order: cors() -> compression() -> apiLimiter -> dataRoutes
    - Self-contained express app in tests (no real server port) for rate limit integration tests
    - Babel env override for test environment (targets node:current) to support async/await in Jest

key-files:
  created:
    - tests/server/rateLimit.test.js
  modified:
    - server/server.js
    - .babelrc
    - package.json

key-decisions:
  - "CORS allows all origins via cors() with no whitelist — general internet traffic permitted per locked decision"
  - "Rate limit scoped to /data routes only, not health checks or static files"
  - "Test uses self-contained express app with max:3 limiter — does not start real server on a port"
  - "Babel test env override (targets node:current) added to fix regeneratorRuntime without new dependencies"

patterns-established:
  - "Rate limit middleware registered before route handlers on same path prefix"
  - "Integration tests for middleware use supertest with in-process express apps (no port binding)"

requirements-completed: [STAB-06]

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 1 Plan 04: CORS and Rate Limiting Summary

**express-rate-limit and cors middleware added to server.js with 200 req/15min/IP limit on /data routes and a passing 3-test integration suite**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-11T23:02:00Z
- **Completed:** 2026-03-11T23:17:00Z
- **Tasks:** 2 (Task 1 pre-committed as fead1e7, Task 2 executed now)
- **Files modified:** 4 (server/server.js, .babelrc, package.json, package-lock.json)

## Accomplishments

- CORS headers sent on all routes (no origin whitelist, general internet access)
- Rate limiter configured at 200 req/15min per IP on /data routes with RFC-compliant RateLimit-* headers
- 429 response returns JSON body `{ error: "Rate limit exceeded. Try again in 15 minutes." }`
- Integration test (3 assertions) passes green: 200 on normal request, 429 on limit breach, error key in body

## Task Commits

Each task was committed atomically:

1. **Task 1: Write rate limit integration test** - `fead1e7` (test)
2. **Task 2: Add CORS and rate limiting middleware to server.js** - `a137668` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `tests/server/rateLimit.test.js` - Self-contained integration test with test-scoped limiter (max:3), verifies 200/429 behavior and error body shape
- `server/server.js` - Added cors() middleware app-wide and apiLimiter on /data routes before dataRoutes
- `.babelrc` - Added test env override with `targets: { node: "current" }` to fix async/await in Jest
- `package.json` / `package-lock.json` - Added cors and express-rate-limit as production dependencies

## Decisions Made

- CORS allows all origins (no whitelist) per locked project decision for general internet traffic
- Rate limit applied only to /data routes — not to health checks, static files, or SPA fallback
- Test uses self-contained express app rather than the real server, keeping tests fast and isolated
- Fixed Babel async/await in Jest via env override rather than adding `@babel/plugin-transform-runtime` (no new dependencies needed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed regeneratorRuntime error blocking async/await in Jest tests**
- **Found during:** Task 2 (running rate limit test to verify green)
- **Issue:** `.babelrc` targeted browsers only; Jest (NODE_ENV=test) did not get node-compatible async/await transpilation, causing `ReferenceError: regeneratorRuntime is not defined`
- **Fix:** Added `env.test` override in `.babelrc` with `@babel/preset-env` targeting `node: "current"` — standard Babel pattern, no new dependencies
- **Files modified:** `.babelrc`
- **Verification:** All 3 rate limit tests pass after fix
- **Committed in:** `a137668` (Task 2 commit)

**2. [Rule 3 - Blocking] Installed cors and express-rate-limit with --legacy-peer-deps**
- **Found during:** Task 2 (npm install)
- **Issue:** Pre-existing peer dep conflict between eslint@10 and eslint-config-airbnb@19 (requires eslint@8) blocked default `npm install`
- **Fix:** Used `--legacy-peer-deps` flag — conflict is in devDependencies only and does not affect runtime
- **Files modified:** package.json, package-lock.json
- **Verification:** Packages installed successfully, tests pass
- **Committed in:** `a137668` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking)
**Impact on plan:** Both fixes required to unblock task execution. No scope creep. The eslint peer dep conflict is pre-existing and out of scope for this plan.

## Issues Encountered

- Jest 30 renamed `--testPathPattern` to `--testPathPatterns` — used correct flag for verification commands.

## User Setup Required

None - no external service configuration required. CORS and rate limiting are fully in-process.

## Next Phase Readiness

- CORS and rate limiting are in place; any new /data sub-routes inherit the rate limiter automatically
- The Babel test env fix enables future async/await tests in tests/server/ without additional setup
- Pre-existing eslint peer dep conflict (airbnb@19 vs eslint@10) should be addressed in a future stabilization plan

---
*Phase: 01-stabilize*
*Completed: 2026-03-11*
