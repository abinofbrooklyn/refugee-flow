---
phase: 02-modernize-stack
plan: 02
subsystem: ui
tags: [three.js, webgl, threejs, octree, buffergeometry, morphtargets, globe]

requires:
  - phase: 02-01
    provides: UNSAFE_ lifecycle prefix enabling GlobeVisual componentWillReceiveProps

provides:
  - GlobeVisual.jsx fully migrated from THREE.Geometry to BufferGeometry API
  - three@0.165.0 installed (was 0.91.0, had HIGH CVE GHSA-fq6p-x6j3-cmmq)
  - "@brakebein/threeoctree installed as Octree replacement"
  - Vendored src/THREEJSScript/Octree.js deleted
  - Webpack production build passes with r165

affects:
  - 02-03-vite-migration
  - globe rendering / raycasting behavior

tech-stack:
  added:
    - three@0.165.0 (upgrade from 0.91.0)
    - "@brakebein/threeoctree@^2.0.1"
  patterns:
    - BufferGeometry with typed Float32Array for positions and colors
    - Per-point transform baked via Vector3.applyMatrix4 (replaces Geometry.merge)
    - morphAttributes.position[] for morph target animation (replaces .morphTargets[])
    - _morphTargetNames[] parallel array tracks morph count
    - LineDashedMaterial requires computeLineDistances() after geometry creation
    - vertexColors: true replaces THREE.FaceColors constant

key-files:
  created: []
  modified:
    - src/components/globe/GlobeVisual.jsx
    - package.json

key-decisions:
  - "Pin three@0.165.0 exactly (no caret) matching original 0.91.0 pin style"
  - "Manual typed-array accumulation for geometry merge (not mergeGeometries utility) to preserve per-point matrix transform semantics"
  - "BoxGeometry vertex coloring: vertices 20-23 are top face (gray), 0-19 get data color"

patterns-established:
  - "BufferGeometry accumulation: pre-allocate Float32Array(pointCount * 24 * 3), iterate points, bake transforms inline"
  - "Morph targets: _baseGeometry.morphAttributes.position[] + parallel _morphTargetNames[] array"

requirements-completed:
  - MOD-03

duration: 10min
completed: 2026-03-12
---

# Phase 02 Plan 02: THREE.js r165 Upgrade + BufferGeometry Migration Summary

**THREE.js upgraded 0.91.0->r165 with full BufferGeometry migration of GlobeVisual: border lines, vertex colors, morph target animation, geometry merging, and Octree raycasting; HIGH CVE GHSA-fq6p-x6j3-cmmq resolved**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T03:38:06Z
- **Completed:** 2026-03-12T03:48:05Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify)
- **Files modified:** 3 (GlobeVisual.jsx, package.json, package-lock.json)

## Accomplishments
- Upgraded three.js from 0.91.0 (HIGH CVE) to r165 (no known CVEs)
- Migrated all 4 removed THREE.Geometry patterns to BufferGeometry API
- Replaced vendored Octree.js (r60, 2183 lines) with @brakebein/threeoctree
- Webpack production build passes with the upgraded dependencies
- Converted require() calls to ES imports in preparation for Vite migration

## Task Commits

1. **Task 1: Install three@0.165.0 and @brakebein/threeoctree; convert require() to ES imports** - `a7c7373` (chore)
2. **Task 2: Migrate GlobeVisual.jsx to BufferGeometry API and replace vendored Octree** - `1e50d34` (feat)
3. **Task 3: Human verification checkpoint** - PENDING

## Files Created/Modified
- `src/components/globe/GlobeVisual.jsx` - Full BufferGeometry migration; Octree import changed; require() -> ES import
- `package.json` - three pinned to 0.165.0; @brakebein/threeoctree added; acceptedRisks CVE entry cleared
- `src/THREEJSScript/Octree.js` - DELETED (2183 lines removed)

## Decisions Made
- Pinned `three@0.165.0` exactly (matching original pin style of 0.91.0) rather than `^0.165.0`
- Used manual typed-array accumulation for geometry merge rather than `mergeGeometries` utility — the utility doesn't accept per-geometry matrix transforms, but the addPoint pattern bakes position+orientation+scale from `this.point.matrix` per point
- BoxGeometry top face detection: vertices 20-23 map to old faces 10-11 (top face gets gray color as before)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Pre-allocate color BufferAttribute on BoxGeometry at init time**
- **Found during:** Task 2 (addPoint migration)
- **Issue:** The plan said to set vertex colors in addPoint per-call. But the BoxGeometry is created once in init() and reused. The color attribute must be pre-allocated there, not recreated each call.
- **Fix:** Added `Float32Array(24*3)` and `geometry.setAttribute('color', BufferAttribute)` in init() immediately after `applyMatrix4`. The addPoint method then writes directly to the positionsArray/colorsArray passed in.
- **Files modified:** src/components/globe/GlobeVisual.jsx
- **Committed in:** 1e50d34 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — initialization order)
**Impact on plan:** Necessary for correctness. Color attribute must exist before geometry is used in Mesh.

## Issues Encountered
- webpack-bundle-analyzer port 8888 was already in use from a previous build, causing `EADDRINUSE` error after the build completed. This is a post-build UI launcher, not a build failure. The dist/ artifacts were generated correctly.
- `npm install three@0.165.0` required `--legacy-peer-deps` due to eslint-config-airbnb peer dep constraints.

## Next Phase Readiness
- GlobeVisual.jsx is now pure ES modules (no require()), ready for Vite migration
- three@0.165.0 with BufferGeometry API is in place; globe rendering awaits human visual verification (Task 3 checkpoint)
- After human approves Task 3, Plan 03 (Vite migration) can proceed

---
*Phase: 02-modernize-stack*
*Completed: 2026-03-12*
