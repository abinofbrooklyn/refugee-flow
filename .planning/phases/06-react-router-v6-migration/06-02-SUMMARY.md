---
phase: 06-react-router-v6-migration
plan: 02
subsystem: ui
tags: [react, react-router, routing, v6, layout-routes, navbar]

# Dependency graph
requires:
  - phase: 06-react-router-v6-migration plan 01
    provides: withRouter6 HOC and LandingResolver component created in Plan 01
provides:
  - Router.jsx rewritten with v6 Routes/Route/Outlet/Navigate and NavbarLayout layout route
  - routeRegistry.jsx converted to element-prop format (no v4/v5 patterns)
  - RefugeeRoute_titleGroup.jsx with nested BrowserRouter crash removed
affects: [06-03-react-router-v6-migration, plan 03 wrapping class components with withRouter6]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layout route pattern: NavbarLayout renders Navbar + Outlet, wraps all routes except /landing"
    - "Centralized routeRegistry with element prop format (v6 pattern)"
    - "Catch-all Navigate to /landing with replace for v6 default redirect"

key-files:
  created: []
  modified:
    - src/components/router/Router.jsx
    - src/components/router/config/routeRegistry.jsx
    - src/components/RefugeeRoute_titleGroup.jsx

key-decisions:
  - "NavbarLayout wraps all paths except /landing via v6 route nesting (not pathname checking)"
  - "routeRegistry kept centralized as simple element-prop array; Router.jsx filters landing vs non-landing"
  - "Nested BrowserRouter removed from RefugeeRoute_titleGroup replaced with React Fragment"

patterns-established:
  - "Pattern 1: routeRegistry entries use { path, element } shape only — no callbacks, no flags"
  - "Pattern 2: Layout routes exclude landing by putting it outside NavbarLayout parent route"

requirements-completed: [MOD-05]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 6 Plan 02: React Router v6 Core Routing Infrastructure Summary

**Router.jsx and routeRegistry.jsx fully migrated to v6 Routes/Outlet/Navigate with NavbarLayout pattern; nested BrowserRouter crash in RefugeeRoute_titleGroup removed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T20:18:13Z
- **Completed:** 2026-03-20T20:20:28Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Router.jsx rewritten: BrowserRouter + Routes + Route + Outlet + Navigate, NavbarLayout functional component injects Navbar for all routes except /landing
- routeRegistry.jsx converted from v4/v5 patterns (isExclusive, component/render/children callbacks, MobileDetect) to clean v6 element-prop array
- RefugeeRoute_titleGroup.jsx nested BrowserRouter removed — prevents hard v6 crash "You cannot render a Router inside another Router"

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite Router.jsx and routeRegistry.jsx for v6** - `ca76f57` (feat)
2. **Task 2: Remove nested BrowserRouter from RefugeeRoute_titleGroup.jsx** - `ea0cdcd` (fix)

**Plan metadata:** (final docs commit)

## Files Created/Modified
- `src/components/router/Router.jsx` - Fully rewritten: v6 Routes/Route/Outlet/Navigate, NavbarLayout, LandingResolver, routeRegistry-driven routes
- `src/components/router/config/routeRegistry.jsx` - Converted to { path, element } format; removed isExclusive, MobileDetect, Navbar, render/children callbacks
- `src/components/RefugeeRoute_titleGroup.jsx` - Import reduced to { Link } only; nested BrowserRouter wrapper removed, replaced with React Fragment

## Decisions Made
- Router.jsx imports routeRegistry and filters landing vs non-landing (keeps registry meaningful per locked decision)
- NavbarLayout uses empty fragment wrapper to combine Navbar + Outlet without extra DOM elements
- LandingResolver route placed outside NavbarLayout so landing page has no Navbar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — 11 pre-existing server test failures confirmed unchanged (same failures as before Plan 01, per STATE.md decision log).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Router infrastructure complete for v6
- Plan 03 can now wrap class components (Conflict, RefugeeRoute, About, AdminPage, Navbar) with withRouter6 HOC to inject navigate/location/params props
- No blockers

---
*Phase: 06-react-router-v6-migration*
*Completed: 2026-03-20*
