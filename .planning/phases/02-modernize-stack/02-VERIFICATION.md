---
phase: 02-modernize-stack
verified: 2026-03-12T06:30:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Launch `npm run start` (Vite dev server) and open http://localhost:8080. Navigate to a refugee route page."
    expected: "Globe renders with colored data points on the sphere, country border dashed lines are visible, and the timeline slider animates morph targets. No console errors about THREE.js or WebGL."
    why_human: "Globe rendering correctness (data points, colors, dashed borders, morph animation) requires a browser and WebGL — cannot be verified by static analysis."
  - test: "On the route page, hover over a globe data point."
    expected: "A tooltip appears with country/refugee data. Raycasting works despite Octree being replaced with direct THREE.Raycaster."
    why_human: "Raycasting hit detection requires runtime rendering and pointer event interaction."
  - test: "On the route page, check that the map panel and toggle button do not overlap."
    expected: "Map panel and route toggle button are visually separated with correct z-index. (Known issue flagged in project memory as unresolved after Vite migration fix commits.)"
    why_human: "Visual layout overlap requires browser rendering to confirm whether the 3 fix commits (86928b9, 37ba863, 3a1f41d) fully resolved the z-index/opacity issue."
  - test: "Check browser console (DevTools) when the app loads and during globe interaction."
    expected: "Zero warnings containing 'componentWill' — all deprecated lifecycle warnings are suppressed by UNSAFE_ prefixes."
    why_human: "React runtime warning suppression via UNSAFE_ prefix is confirmed in code, but actual absence of console warnings requires browser runtime."
---

# Phase 02: Modernize Stack — Verification Report

**Phase Goal:** The app builds and runs on a modern, maintainable toolchain with no deprecated warnings or legacy workarounds
**Verified:** 2026-03-12T06:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All four observable success criteria are verified by static analysis and build execution. Four items require human browser verification to confirm runtime behavior (globe render quality, tooltip raycasting, layout overlap fix, console warning absence).

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App builds with Vite — no NODE_OPTIONS=--openssl-legacy-provider flag required | VERIFIED | `npx vite build` exits 0 in 9.29s; no `NODE_OPTIONS` or `openssl-legacy` anywhere in `package.json`; webpack dir deleted; Node 22 used (no legacy crypto) |
| 2 | React 18 renders the app with zero deprecated lifecycle method warnings | VERIFIED (code) | React 18.3.1 installed; `createRoot` used in `src/index.jsx`; all 16 `componentWillReceiveProps` occurrences carry `UNSAFE_` prefix; zero unprefixed deprecated lifecycle methods in `src/` |
| 3 | Globe renders correctly using THREE.js r150+ with no regression in behavior | VERIFIED (code) / HUMAN needed (runtime) | `three@0.165.0` installed; `GlobeVisual.jsx` has 10+ `new THREE.BufferGeometry()`/`BufferAttribute` calls; no legacy `THREE.Geometry`; Octree replaced with no-op stub preserving interface; raycasting uses `THREE.Raycaster` directly |
| 4 | node_modules contains no jquery, underscore, or legacy mapbox-gl packages | VERIFIED | `node_modules/jquery` — absent; `node_modules/underscore` — absent; `node_modules/mapbox-gl` — absent; `maplibre-gl` present as replacement; `lodash` used in all `_`-using files |

**Score:** 4/4 truths verified (automated) | 4 items flagged for human runtime confirmation

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vite.config.js` | Vite build config with React plugin, SVGR, proxy, publicDir | VERIFIED | Contains `defineConfig`, `@vitejs/plugin-react`, `vite-plugin-svgr`, `server.proxy: {'/data': 'http://localhost:2700'}`, `publicDir: 'public'` |
| `index.html` | Root-level HTML with `<script type="module">` entry | VERIFIED | Contains `<script type="module" src="/src/index.jsx">` at line 50 |
| `package.json` (scripts) | `"dev": "vite"` or `"start": "vite"`, no webpack devDeps | VERIFIED | `"start": "vite"`, `"build": "vite build"` — no webpack entries anywhere |
| `src/components/globe/GlobeVisual.jsx` | BufferGeometry API, UNSAFE_ prefix, lodash import | VERIFIED | 10 `new THREE.BufferGeometry()` / `BufferAttribute` calls; `UNSAFE_componentWillReceiveProps` at line 675; `import _ from 'lodash'` at line 4 |
| `package.json` (deps) | `"three": "0.165.0"`, `@brakebein/threeoctree`, `maplibre-gl`, `lodash` — no jquery/underscore/mapbox-gl | VERIFIED | All confirmed present/absent as expected |
| `src/index.jsx` | React 18 `createRoot` entry | VERIFIED | `import { createRoot } from 'react-dom/client'` + `createRoot(...).render(...)` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.html` | `src/index.jsx` | `<script type="module" src="/src/index.jsx">` | WIRED | Exact pattern present at line 50 |
| `src/index.jsx` | React 18 `createRoot` | `import { createRoot } from 'react-dom/client'` | WIRED | Line 2 import + line 12 usage |
| `GlobeVisual.jsx` | `three` | `new THREE.BufferGeometry`, `new THREE.BufferAttribute`, `morphAttributes.position` | WIRED | 10+ usages confirmed |
| `GlobeVisual.jsx` | `@brakebein/threeoctree` | Disabled — import commented out | PARTIAL (intentional) | Import commented out at lines 6-7; replaced with no-op stub `{ update: (cb) => { if (cb) cb(); }, remove: () => {} }` at line 301 that satisfies all `GlobeContainer` calls to `this.gv.octree.update/remove` |
| `RefugeeRoute_map.jsx` | `maplibre-gl` | `import maplibregl from 'maplibre-gl'` + `new maplibregl.Map(...)` | WIRED | Lines 4-5 import CSS + constructor; `NavigationControl` added |
| `RefugeeRoute_textArea_content_currentSelectedPoint.jsx` | `maplibre-gl` | `import maplibregl from 'maplibre-gl'` + `new maplibregl.Map(...)` | WIRED | Line 4 import; line 260 usage |
| All `_`-using components (15 files) | `lodash` | `import _ from 'lodash'` | WIRED | Confirmed across `GlobeVisual`, `GlobeContainer`, `GlobeStatsBoard`, `GlobeRouteButton`, `RegionModalContent`, `RefugeeRoute_textArea_content_ibcCountry`, `RefugeeRoute_titleGroup`, `RefugeeRoute`, `Annotation`, `Conflict` and others |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOD-01 | 02-03-PLAN | App builds and runs using Vite (no legacy OpenSSL workaround) | SATISFIED | `vite.config.js` wired; `npx vite build` exits 0; no `NODE_OPTIONS`/webpack remaining |
| MOD-02 | 02-01-PLAN | App uses React 18 with no deprecated lifecycle method warnings | SATISFIED | All 16 lifecycle methods carry `UNSAFE_` prefix; React 18.3.1 + `createRoot` confirmed |
| MOD-03 | 02-02-PLAN | App uses THREE.js r150+ for globe rendering | SATISFIED | `three@0.165.0` installed; `GlobeVisual.jsx` fully migrated to `BufferGeometry` API; no `THREE.Geometry` usage remains |
| MOD-04 | 02-04-PLAN | Unused legacy dependencies removed (jquery, underscore, old mapbox-gl) | SATISFIED | All three absent from `node_modules`; `lodash` replaces underscore; `maplibre-gl` replaces `mapbox-gl`; native DOM APIs replace jquery |

No orphaned requirements — all MOD-01 through MOD-04 claimed by plans and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/landing/DesktopLanding.jsx` | 7 | `/* TODO Remove window.setInterval(), use keyframes instead */` | Info | Pre-existing cosmetic TODO; unrelated to Phase 2 modernization goals; no impact on phase success criteria |
| `src/components/globe/GlobeVisual.jsx` | 6, 299-301 | Octree disabled with no-op stub | Warning | `@brakebein/threeoctree` import commented out due to browser crash on large merged `BufferGeometry`; replaced with `{ update: (cb) => { if (cb) cb(); }, remove: () => {} }`. This is an **accepted deviation** documented in `02-02-SUMMARY.md` — raycasting works via direct `THREE.Raycaster` |

No blockers. The Octree stub is an intentional architectural decision with documented reasoning, not an unfinished placeholder.

---

### Human Verification Required

#### 1. Globe renders with data points, borders, and morph animation

**Test:** Start the dev server (`npm run start` + `npm run nodemon` for data), open http://localhost:8080, navigate to a refugee route page, advance the timeline.
**Expected:** Colored data point boxes visible on globe sphere; dashed country border lines visible; morph target animation plays when the timeline slider advances; no WebGL console errors.
**Why human:** Globe visual correctness (colors, geometry, animation) requires a running browser with WebGL — cannot be verified by static analysis.

#### 2. Tooltip raycasting works without Octree

**Test:** On the route page, hover a mouse cursor over a visible data point box on the globe.
**Expected:** A tooltip appears with the correct country/refugee count data. Raycasting hit detection works via direct `THREE.Raycaster` (the Octree is a no-op stub).
**Why human:** Raycasting requires runtime pointer events and a rendered 3D scene.

#### 3. Route page layout — map/toggle overlap resolved

**Test:** Navigate to a refugee route page and visually inspect the map panel and the route toggle button.
**Expected:** Map panel and toggle button are visually distinct with no overlap; panel has correct opacity; globe borders visible. (Three fix commits — `86928b9`, `37ba863`, `3a1f41d` — were applied after initial Vite migration.)
**Why human:** Z-index and panel opacity are runtime CSS rendering concerns. The project memory noted this was "still broken" before the fix commits; a human must confirm the fixes are sufficient.

#### 4. Zero "componentWill" warnings in browser console

**Test:** Open browser DevTools console during app load and globe interaction.
**Expected:** Zero React warnings containing "componentWill" — all deprecated lifecycle warnings suppressed by `UNSAFE_` prefix across all 16 components.
**Why human:** React runtime warning emission requires the app running in a browser; `UNSAFE_` prefixes are correct in code but actual warning suppression must be confirmed at runtime.

---

## Gaps Summary

No gaps blocking automated goal verification. All four success criteria have confirmed implementation evidence in the codebase and a passing `vite build`. The phase goal — "app builds and runs on a modern, maintainable toolchain with no deprecated warnings or legacy workarounds" — is achieved at the code level.

The four human verification items are runtime confirmation checks, not missing implementation. The most important one to validate is **item 3** (layout overlap fix) since the project memory explicitly flagged it as a known open issue prior to the fix commits.

---

_Verified: 2026-03-12T06:30:00Z_
_Verifier: Claude (gsd-verifier)_
