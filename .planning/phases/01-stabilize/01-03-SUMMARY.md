---
phase: 01-stabilize
plan: 03
subsystem: ui, infra
tags: [security, npm-audit, vulnerability-patch, globe, react, webpack]

# Dependency graph
requires: []
provides:
  - Globe rotation toggle button wired to rotatePause state in GlobeContainer
  - Zero npm critical/high vulnerabilities via package.json overrides for nth-check and d3-color
  - Security baseline for Phase 2 stack changes
affects: [02-migrate, phase-2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "npm overrides field to pin transitive dependency versions to safe ranges"
    - "GlobeControllerButton styled-component reused for globe toggle button consistency"

key-files:
  created: []
  modified:
    - src/components/globe/GlobeContainer.jsx
    - package.json

key-decisions:
  - "Use npm overrides (nth-check >=2.0.1, d3-color >=3.1.0) to resolve nested CVEs where upstream packages have no patched release"
  - "Accept that d3-canvas-transition and react-svg-loader cannot be fixed via normal npm audit fix due to circular breaking-change loops; resolved via overrides instead"

patterns-established:
  - "npm overrides for transitive dependency CVEs when upstream is unmaintained or stuck in a loop"

requirements-completed: [STAB-04, STAB-05]

# Metrics
duration: 25min
completed: 2026-03-11
---

# Phase 1 Plan 03: Globe Rotation Toggle + Security Patches Summary

**Globe auto-rotation toggle button added to GlobeContainer, plus zero critical/high CVEs achieved via npm overrides pinning nth-check >=2.0.1 and d3-color >=3.1.0**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-11T23:00:00Z
- **Completed:** 2026-03-11T23:25:00Z
- **Tasks:** 2 (Task 1 pre-committed; Task 2 executed this session)
- **Files modified:** 2 (GlobeContainer.jsx, package.json)

## Accomplishments
- Globe rotation toggle button in GlobeNavPanel using GlobeControllerButton styled-component, wired to `this.state.rotatePause` via functional setState
- Reduced npm vulnerabilities from 4 critical / 11 high / 33 moderate to **0 critical / 0 high**
- Security baseline established before Phase 2 dependency migrations

## Task Commits

Each task was committed atomically:

1. **Task 1: Add globe rotation toggle button** - `577c1a5` (feat)
   - Toggle button using GlobeControllerButton styled-component
   - Positioned at top: 110px in GlobeNavPanel near compass/zoom controls
   - Play/pause unicode icons (u25B6 / u23F8) with aria-label and title

2. **Task 2: Patch security vulnerabilities** - `a137668` (included in prior session's 01-04 commit)
   - npm overrides added: nth-check >=2.0.1, d3-color >=3.1.0
   - npm audit fix --legacy-peer-deps resolved 4 critical, several high
   - npm install --legacy-peer-deps applied overrides for remaining 7 high
   - Final: 0 critical, 0 high, 0 moderate

**Plan metadata commit:** (included in final docs commit)

## Files Created/Modified
- `src/components/globe/GlobeContainer.jsx` - Globe rotation toggle button in GlobeNavPanel; loadingError state and catch handler
- `package.json` - Added npm `overrides` field to pin nth-check >=2.0.1 and d3-color >=3.1.0

## Decisions Made

**Use npm overrides for transitive dependency CVEs:**
The following vulnerabilities had no standard npm audit fix path:
- `d3-color < 3.1.0` (HIGH) — all d3-canvas-transition versions (0.1.0 - 0.3.7) bundle old d3-color. Running --force alternated between two breaking-change versions in a circular loop. Resolution: `overrides: { "d3-color": ">=3.1.0" }`.
- `nth-check < 2.0.1` (HIGH) — react-svg-loader -> react-svg-core -> svgo@1.x -> nth-check. react-svg-core@3.0.3 (latest) still uses svgo@^1.2.2. No npm registry update available. Resolution: `overrides: { "nth-check": ">=2.0.1" }`.

Both overrides force safe transitive versions without breaking the consuming packages.

## Security Patch Details

**Before patching:**
- 4 critical (babel-traverse)
- 11 high (d3-color, nth-check, is-svg, js-yaml, json5, semver)
- 33 moderate (color-string, postcss)

**After `npm audit fix --legacy-peer-deps`:**
- 0 critical (babel-traverse resolved)
- 11 high (remaining)
- 32 moderate

**After `npm audit fix --force --legacy-peer-deps`:**
- 0 critical
- 7 high (d3-color and nth-check chains - npm circular loop)
- 0 moderate (postcss, optimize-css-assets-webpack-plugin upgraded to v6)

**After adding package.json overrides + npm install:**
- 0 critical
- 0 high
- 0 moderate

**Verification:** `npm audit --audit-level=high` exits 0. All 3 existing tests pass.

## Rotation Toggle Position

- **Component:** `GlobeControllerButton` (existing styled-component, lines 98-132)
- **Location in render():** Inside `<GlobeNavPanel>` next to Compass, ZoomIn, ZoomOut (line ~950)
- **State wiring:** `onClick={() => this.setState(prev => ({ rotatePause: !prev.rotatePause }))}`
- **No new imports or state fields added** — rotatePause state and prop flow were already complete

## Webpack-Dev-Server Config Changes

No config changes were required. The project already had `webpack-dev-server@^5.2.3` in devDependencies from a prior commit. The `npm start` command (webpack-dev-server --config webpack/webpack.dev.js) was not broken by the security patches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used --legacy-peer-deps for npm audit fix**
- **Found during:** Task 2 (npm audit fix)
- **Issue:** `npm audit fix` failed with ERESOLVE due to `optimize-css-assets-webpack-plugin@4.0.3` requiring `webpack@^4` but project has webpack@5
- **Fix:** Added `--legacy-peer-deps` flag to all npm audit fix calls
- **Files modified:** none (flag only)
- **Verification:** npm install succeeded, 0 vulnerabilities

**2. [Rule 1 - Bug] npm audit fix --force entered circular upgrade loop for d3-canvas-transition**
- **Found during:** Task 2 (npm audit fix --force)
- **Issue:** `--force` alternated between d3-canvas-transition@0.3.7 and @0.1.0, both with d3-color CVE
- **Fix:** Used `package.json` overrides field to pin d3-color and nth-check to safe versions
- **Files modified:** package.json
- **Verification:** `npm audit --audit-level=high` exits 0

---

**Total deviations:** 2 auto-fixed (1 blocking flag, 1 bug workaround)
**Impact on plan:** Both auto-fixes essential to achieve zero high/critical vulns. The overrides approach is the correct npm v7+ solution for locked transitive CVEs.

## Issues Encountered

- `npm audit fix` without `--legacy-peer-deps` failed due to peer dep conflict between webpack@5 and optimize-css-assets-webpack-plugin@4 (dev dependency). Resolved with legacy-peer-deps flag.
- `d3-canvas-transition`'s bundled old d3-color versions create a circular --force upgrade loop. No published version of d3-canvas-transition ships d3-color >=3.1.0. Resolved via npm overrides.
- `react-svg-loader` depends on `react-svg-core@3.0.3` which still uses `svgo@^1.x` (unmaintained), pulling in vulnerable nth-check. Resolved via npm overrides.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Globe rotation toggle is functional (commit 577c1a5)
- Security baseline: 0 critical/high CVEs - ready for Phase 2 stack changes
- Note: react-svg-loader and d3-canvas-transition are potential Phase 2 removal candidates (both have deeply nested legacy deps requiring overrides workaround)

---
*Phase: 01-stabilize*
*Completed: 2026-03-11*
