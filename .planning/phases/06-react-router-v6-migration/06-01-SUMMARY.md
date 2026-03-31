---
phase: 06-react-router-v6-migration
plan: 01
subsystem: ui
tags: [react-router, routing, hoc, mobile-detect]

# Dependency graph
requires: []
provides:
  - react-router-dom@6.30.3 installed and importable
  - withRouter6 HOC at src/components/router/withRouter6.jsx (injects params/navigate/location into class components)
  - LandingResolver component at src/components/router/LandingResolver.jsx (MobileDetect-based landing page selection)
affects:
  - 06-react-router-v6-migration plan 02 (Router.jsx rewrite uses LandingResolver and depends on v6 install)
  - 06-react-router-v6-migration plan 03 (consumer components use withRouter6 HOC)

# Tech tracking
tech-stack:
  added:
    - react-router-dom@6.30.3 (upgraded from v4.2.2 via two-step v4→v5→v6)
  patterns:
    - withRouter6 HOC pattern: official React Router v6 FAQ approach for wrapping class components with router hooks
    - LandingResolver pattern: MobileDetect logic extracted into a standalone component for use as a v6 route element

key-files:
  created:
    - src/components/router/withRouter6.jsx
    - src/components/router/LandingResolver.jsx
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Two-step v4→v5→v6 upgrade confirmed no regression: same 11 pre-existing test failures before and after"
  - "Pre-existing test failures (ingestion-unhcr, ingestion-acled, seed, endpoints) confirmed unrelated to router upgrade — documented as out-of-scope"

patterns-established:
  - "Pattern: withRouter6 HOC wraps class components at export — withRouter6 must be outermost wrapper when stacked with connect()"
  - "Pattern: LandingResolver used as route element in v6 Routes, replacing the render callback in v4/v5 routeRegistry"

requirements-completed:
  - MOD-05

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 6 Plan 01: React Router v6 Install + Foundation Files Summary

**react-router-dom upgraded v4→v6 (two-step), withRouter6 HOC and LandingResolver component created as foundation for Plans 02 and 03**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T20:13:10Z
- **Completed:** 2026-03-20T20:15:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Upgraded react-router-dom from v4.2.2 to v6.30.3 via safe two-step (v4→v5→v6), verifying server tests unchanged at each step
- Created withRouter6 HOC (official React Router v6 FAQ pattern) — injects params, navigate, location into class components via functional wrapper
- Created LandingResolver component — encapsulates MobileDetect logic, ready to be used as route element in v6 Router rewrite

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade react-router-dom v4 to v6** - `b9dd2d1` (chore)
2. **Task 2: Create withRouter6 HOC and LandingResolver component** - `df28e31` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/router/withRouter6.jsx` - HOC that injects params/navigate/location into any class component using v6 hooks internally
- `src/components/router/LandingResolver.jsx` - Functional component that uses MobileDetect to render DesktopLanding or MobileLanding
- `package.json` - react-router-dom updated from ^4.2.2 to ^6.30.3
- `package-lock.json` - lockfile updated to reflect v6 dependency tree

## Decisions Made
- Two-step v4→v5→v6 migration confirmed safe: ran server tests after each step, verified same 11 pre-existing failures with no new failures at either step
- Pre-existing test failures (ingestion-unhcr, ingestion-acled, seed, endpoints) confirmed out-of-scope — they existed before this plan and are unrelated to react-router

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `--legacy-peer-deps` flag worked as documented. Pre-existing server test failures were confirmed to be pre-existing via git stash verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- react-router-dom@6 is installed and importable
- withRouter6 HOC is ready for Plans 02 and 03 to consume
- LandingResolver is ready for use as a route element in the Plan 02 Router.jsx rewrite
- No blockers for Plan 02

---
*Phase: 06-react-router-v6-migration*
*Completed: 2026-03-20*
