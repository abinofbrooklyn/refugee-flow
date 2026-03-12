---
phase: 02-modernize-stack
plan: 03
subsystem: infra
tags: [vite, webpack, esm, build-tool, bundler]

# Dependency graph
requires:
  - phase: 02-02
    provides: THREE.js r165 migration complete — stable codebase to migrate build tooling on

provides:
  - Vite 7 build system replacing Webpack 4/5
  - vite.config.js with React plugin, SVGR, port 8080, /data proxy
  - Root-level index.html with module script tag
  - Full ESM source tree (no more require() or module.exports in src/)

affects:
  - 02-04-PLAN (dep removal now starts from a Vite codebase)
  - Any CI/CD or deployment scripts referencing webpack commands

# Tech tracking
tech-stack:
  added:
    - vite@7.3.1
    - "@vitejs/plugin-react"
    - vite-plugin-svgr
  patterns:
    - Root index.html as Vite entry point (not HtmlWebpackPlugin template)
    - vite.config.js alias used to work around d3-canvas-transition broken module field

key-files:
  created:
    - vite.config.js
    - index.html
  modified:
    - package.json (scripts + devDependencies)
    - src/utils/api.js
    - src/components/RefugeeRoute_map.jsx
    - src/components/RefugeeRoute_titleGroup.jsx
    - src/components/RefugeeRoute_textArea_content_currentSelectedPoint.jsx
    - src/components/RefugeeRoute_textArea_content_basicInfo.jsx
    - src/components/globe/GlobeContainer.jsx
    - src/data/warDictionary.js
    - src/data/routeDictionary.js
    - src/components/RegionModalCreator.jsx

key-decisions:
  - "d3-canvas-transition has a broken module field (points to ui/js/main which does not exist); fixed via vite.config.js resolve.alias to pin to the CJS build/d3-canvas-transition.js"
  - "warDictionary.js and routeDictionary.js used module.exports — converted to named ES exports to satisfy Rollup strict ESM checking"
  - "NODE_OPTIONS=--openssl-legacy-provider hack fully eliminated; Vite uses modern crypto stack"

patterns-established:
  - "All src/ files now use ES import/export syntax — no require() or module.exports remain"

requirements-completed:
  - MOD-01

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 2 Plan 03: Webpack to Vite Migration Summary

**Replaced Webpack 4/5 with Vite 7 as build tool and dev server, eliminated NODE_OPTIONS=--openssl-legacy-provider hack, converted all src/ require() calls to ES imports, and removed 16 webpack devDependencies**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T04:45:48Z
- **Completed:** 2026-03-12T04:53:28Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Vite 7 installed and configured with React plugin, SVGR, port 8080, and /data proxy to localhost:2700
- Root index.html created with `<script type="module" src="/src/index.jsx">` as Vite entry point
- 7 files converted from require() to ES imports; warDictionary.js and routeDictionary.js converted from module.exports to ES named exports
- 16 webpack devDependencies uninstalled; webpack/ directory and src/index.template.html deleted
- `npx vite build` exits 0; `npx jest` 3/3 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Vite, create config, convert require() to ESM, update scripts** - `ba64e49` (feat)
2. **Task 2: Remove webpack config files and devDependencies** - `57ca99f` (chore)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `vite.config.js` - Vite build config with React plugin, SVGR, port 8080, /data proxy, and d3-canvas-transition alias fix
- `index.html` - Root HTML entry point with module script tag pointing to /src/index.jsx
- `package.json` - Scripts updated to vite/vite build/vite preview; 16 webpack devDeps removed
- `src/utils/api.js` - require() -> import for IBC_crossingCountByCountry.json
- `src/components/RefugeeRoute_map.jsx` - require() -> import for IBC_crossingCountByCountry.json
- `src/components/RefugeeRoute_titleGroup.jsx` - require() -> import for IBC_crossingCountByCountry.json
- `src/components/RefugeeRoute_textArea_content_currentSelectedPoint.jsx` - require('mapbox-gl') -> import
- `src/components/RefugeeRoute_textArea_content_basicInfo.jsx` - require() -> import for route_desc.json
- `src/components/globe/GlobeContainer.jsx` - require() -> import for scroll-js and cot_latLng.json
- `src/data/warDictionary.js` - module.exports -> named ES exports
- `src/data/routeDictionary.js` - module.exports -> named ES exports
- `src/components/RegionModalCreator.jsx` - CSS default import -> side-effect import
- `src/index.template.html` - Deleted (replaced by root index.html)
- `webpack/` directory - Deleted (webpack.common.js, webpack.dev.js, webpack.prod.js)

## Decisions Made

- Aliased d3-canvas-transition to its CJS build in vite.config.js because its `module` field points to a non-existent path (`ui/js/main`); this is the minimal fix with no behavioral change.
- Converted warDictionary.js and routeDictionary.js from module.exports to ES exports because Rollup (Vite's bundler) enforces strict ESM for named imports — webpack was more lenient here.
- Fixed RegionModalCreator.jsx unused CSS default import to side-effect import (Rollup warned about missing default export from CSS module).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] d3-canvas-transition broken module field causes Vite build failure**
- **Found during:** Task 1 (Vite build verification)
- **Issue:** d3-canvas-transition package.json has `"module": "ui/js/main"` pointing to a non-existent path; Vite resolves the module field before main and fails with "Failed to resolve entry for package"
- **Fix:** Added `resolve.alias` in vite.config.js to pin the import to `build/d3-canvas-transition.js` (the actual CJS UMD file)
- **Files modified:** vite.config.js
- **Verification:** npx vite build exits 0 after fix
- **Committed in:** ba64e49 (Task 1 commit)

**2. [Rule 1 - Bug] warDictionary.js and routeDictionary.js use module.exports — Rollup strict ESM check fails**
- **Found during:** Task 1 (Vite build verification after d3-canvas-transition fix)
- **Issue:** Multiple components import `{ year }`, `{ eventDict }`, `{ countryList }`, `{ color_map }` as named ES imports from these files, but both files used `module.exports = {...}`. Rollup (unlike webpack) enforces strict ESM named export resolution.
- **Fix:** Converted both files from `module.exports = {...}` to `export { ... }` named exports
- **Files modified:** src/data/warDictionary.js, src/data/routeDictionary.js
- **Verification:** npx vite build exits 0; no more "not exported by" errors
- **Committed in:** ba64e49 (Task 1 commit)

**3. [Rule 1 - Bug] RegionModalCreator.jsx imports CSS file as default named import**
- **Found during:** Task 1 (Vite build verification — Rollup warning)
- **Issue:** `import GlobalModal from '../stylesheets/GlobeModal.css'` — CSS files don't export a default; variable was also unused
- **Fix:** Changed to side-effect import `import '../stylesheets/GlobeModal.css'`
- **Files modified:** src/components/RegionModalCreator.jsx
- **Verification:** Warning eliminated from build output
- **Committed in:** ba64e49 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs caused by webpack's lenient module handling that Rollup/Vite enforces strictly)
**Impact on plan:** All auto-fixes required for Vite build to succeed. No scope creep.

## Issues Encountered

- First npm install failed with peer dependency conflict (eslint-config-airbnb); resolved with `--legacy-peer-deps` (consistent with prior phase approach)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Vite build and dev server fully operational; app ready for 02-04 (remove jquery, underscore, mapbox-gl)
- No blockers. The chunk size warning (4.2 MB bundle) is pre-existing and out of scope for this phase.

---
*Phase: 02-modernize-stack*
*Completed: 2026-03-12*
