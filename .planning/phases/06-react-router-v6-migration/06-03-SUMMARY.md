---
phase: 06-react-router-v6-migration
plan: 03
subsystem: ui
tags: [react-router, withRouter6, SPA-navigation, class-components]

requires:
  - phase: 06-01
    provides: withRouter6 HOC, react-router-dom v6
  - phase: 06-02
    provides: v6 Router.jsx with layout routes
provides:
  - All consumer components wrapped with withRouter6 for v6 compatibility
  - SPA navigation via navigate() replacing window.open(_self)
  - Navbar location-aware highlight updates
  - Annotation show-once-from-landing logic
affects: []

tech-stack:
  added: []
  patterns: [withRouter6 HOC wrapping for class components, navigate prop threading]

key-files:
  created: []
  modified:
    - src/components/RefugeeRoute.jsx
    - src/components/Conflict.jsx
    - src/components/globe/GlobeContainer.jsx
    - src/components/globe/GlobeRouteButton.jsx
    - src/components/Navbar.jsx
    - src/components/router/LandingResolver.jsx

key-decisions:
  - "Thread navigate prop from Conflict → GlobeContainer → GlobeRouteButton instead of wrapping each with withRouter6"
  - "Wrap Navbar with withRouter6 to react to SPA location changes (componentDidUpdate)"
  - "Annotation shows only when coming from landing page, not when navigating back from route pages"

patterns-established:
  - "withRouter6 wrapping: export default withRouter6(Component) at bottom of file"
  - "navigate prop threading: parent wraps with withRouter6, children receive navigate as prop"

requirements-completed: [MOD-05]

duration: 8min
completed: 2026-03-20
---

# Plan 06-03: Consumer Component Migration Summary

**Wrapped RefugeeRoute/Conflict with withRouter6, converted window.open to SPA navigate(), fixed Navbar highlight + annotation show-once**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- RefugeeRoute wrapped with withRouter6, match.params.arg → params.arg migration
- Conflict wrapped with withRouter6, navigate prop threaded to GlobeContainer → GlobeRouteButton
- GlobeRouteButton uses navigate() for SPA routing (no page reload on globe click)
- Navbar wrapped with withRouter6 for location-aware highlight updates on SPA navigation
- Annotation overlay only shows when arriving from landing page, not when returning from routes

## Task Commits

1. **Task 1: Wrap consumer components + thread navigate** - `c8eb753`
2. **Task 2: Browser smoke test + fixes** - `363ca69`

## Files Created/Modified
- `src/components/RefugeeRoute.jsx` - withRouter6 wrap, params.arg migration
- `src/components/Conflict.jsx` - withRouter6 wrap, navigate threading, annotation logic
- `src/components/globe/GlobeContainer.jsx` - navigate prop instead of history
- `src/components/globe/GlobeRouteButton.jsx` - navigate() instead of window.open(_self)
- `src/components/Navbar.jsx` - withRouter6 wrap, componentDidUpdate for location tracking
- `src/components/router/LandingResolver.jsx` - sessionStorage lastPage tracking

## Decisions Made
- Wrapped Navbar with withRouter6 to fix SPA navigation highlight regression (not in original plan)
- Used sessionStorage for annotation show-once tracking with lastPage awareness
- LandingResolver sets lastPage='/landing' so Conflict can detect landing→conflict navigation

## Deviations from Plan

### Auto-fixed Issues

**1. Navbar highlight not updating on SPA navigation**
- **Found during:** Task 2 (browser smoke test)
- **Issue:** Globe route button click navigated via SPA (navigate) but Navbar stayed on "conflict" highlight
- **Fix:** Wrapped Navbar with withRouter6, added componentDidUpdate to track location changes
- **Files modified:** src/components/Navbar.jsx
- **Verification:** Navigate via globe button, Navbar correctly highlights "Route"

**2. Annotation overlay reappearing on every conflict visit**
- **Found during:** Task 2 (browser smoke test)
- **Issue:** _.once() is per-instance, Conflict remount creates new instance
- **Fix:** sessionStorage tracking — show only when coming from landing page
- **Files modified:** src/components/Conflict.jsx, src/components/router/LandingResolver.jsx
- **Verification:** Landing→conflict shows annotation; route→conflict does not

---

**Total deviations:** 2 auto-fixed (both SPA navigation regressions from window.open conversion)
**Impact on plan:** Essential fixes for correct UX after migration. No scope creep.

## Issues Encountered
None beyond the deviations above.

## Next Phase Readiness
- React Router v6 migration complete — all routes work, zero legacy context warnings
- All class components use withRouter6 HOC pattern

---
*Phase: 06-react-router-v6-migration*
*Completed: 2026-03-20*
