---
phase: 01-stabilize
plan: 02
subsystem: ui, api
tags: [react, error-handling, loading-states, fetch, spinners]

# Dependency graph
requires: []
provides:
  - Error propagation in api.js (get_routeDeath, get_routeIBC, get_routeCountryList)
  - Error propagation in fetchers.js
  - Loading spinner + error message in GlobeContainer.jsx
  - Loading spinner + error message in RefugeeRoute.jsx
  - Error message in GlobeRouteButton.jsx
affects: [02-modernize]

# Tech tracking
tech-stack:
  added: []
  patterns: [Every fetch chain must have .catch() that either propagates or sets error state; loading state set true before fetch, false in both .then() and .catch()]

key-files:
  created: []
  modified:
    - src/utils/api.js
    - src/components/utils/fetchers.js
    - src/components/globe/GlobeContainer.jsx
    - src/components/RefugeeRoute.jsx
    - src/components/globe/GlobeRouteButton.jsx

key-decisions:
  - "api.js .catch() re-throws errors so callers handle UI — utilities do not swallow errors"
  - "ScaleLoader used for RefugeeRoute loading state (consistent with existing GlobeContainer pattern)"
  - "Error messages are inline red text — no toast library, no retry button (per locked decisions)"
  - "GlobeContainer uses loadingError state field; RefugeeRoute and GlobeRouteButton use error state field"

patterns-established:
  - "Fetch error pattern: .catch(err => this.setState({ loading: false, error: message }))"
  - "Error display pattern: inline <p> with red color, same font family as surrounding elements"

requirements-completed: [STAB-02, STAB-03]

# Metrics
completed: 2026-03-11
---

# Phase 1 Plan 2: Loading & Error States Summary

**Added loading spinners and error messages to all data-fetching components so users always see app state — no blank or frozen views on API failure.**

## Accomplishments

- **api.js**: All 3 fetch functions (get_routeDeath, get_routeIBC, get_routeCountryList) now have `.catch()` that re-throws errors for caller handling
- **fetchers.js**: Error propagation added via `.catch(err => { throw err; })`
- **GlobeContainer.jsx**: Added `loadingError` state; `.catch()` on fetchData() sets `loadingStatus: false` and `loadingError`; render shows error message when set
- **RefugeeRoute.jsx**: Added `loading` and `error` state; ScaleLoader spinner during fetch; error message on failure; Promise.all with single `.catch()`
- **GlobeRouteButton.jsx**: Added `error` state; `.catch()` on country list fetch; inline red error message on failure

## Verification

- All automated tests pass (3/3)
- `.catch()` present in all 5 modified files
- `loadingError` state + render present in GlobeContainer
- Human checkpoint **approved** — spinner visible during slow load, error messages visible when backend is down across all three components

## Deviations from Plan

None.

## Human Checkpoint Result

Approved — all loading and error states verified in browser:
- Loading spinners appear on slow network
- Error messages appear when backend is stopped
- No blank or frozen views on API failure

---
*Phase: 01-stabilize*
*Completed: 2026-03-11*
