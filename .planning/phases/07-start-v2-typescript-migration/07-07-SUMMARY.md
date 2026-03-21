---
phase: 07-start-v2-typescript-migration
plan: "07"
subsystem: globe-components
tags: [typescript, react-hooks, forwardRef, useImperativeHandle, three-js, redux-hooks]
dependency_graph:
  requires: [07-04, 07-05, 07-06]
  provides: [GlobeVisualHandle, typed-globe-family]
  affects: [src/components/Conflict.tsx, src/types/assets.d.ts]
tech_stack:
  added: ["@types/mousetrap"]
  patterns:
    - "React.forwardRef + useImperativeHandle for THREE.js imperative API"
    - "useRef<GlobeVisualHandle> for typed class-instance replacement"
    - "State refs pattern (warDataRef, currentYearRef, etc.) for stale-closure-safe callbacks"
key_files:
  created:
    - src/components/globe/GlobeVisual.tsx
    - src/components/globe/GlobeContainer.tsx
    - src/components/globe/GlobeTimeline.tsx
    - src/components/globe/GlobeStatsBoard.tsx
    - src/components/globe/GlobeTooltips.tsx
    - src/components/globe/GlobeRouteButton.tsx
    - tests/client/snapshots-07-pre.test.tsx
  modified:
    - src/components/Conflict.tsx
    - src/types/assets.d.ts
    - package.json
decisions:
  - "GlobeVisual uses forwardRef + useImperativeHandle: exposes animate/addData/transition/createPoints/setTarget/zoom + scaler/lastIndex/octree/scene/camera/renderer/points/opts as typed GlobeVisualHandle"
  - "GlobeContainer uses useRef<GlobeVisualHandle>(null) replacing class-instance this.gv"
  - "State refs pattern (warDataRef, currentYearRef, etc.) used to prevent stale closures in GlobeContainer callbacks without adding them to useCallback dependencies"
  - "Conflict.tsx withRouter6 wrapper fully removed — GlobeContainer now calls useNavigate() directly"
  - "scroll-js + countup.js declared as untyped modules in assets.d.ts"
  - "@types/mousetrap installed for mousetrap import type safety in GlobeVisual"
metrics:
  duration_minutes: 16
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 9
---

# Phase 07 Plan 07: Globe Family TSX Conversion Summary

Converted all 6 globe components from class-based JSX to typed TSX functional components. GlobeVisual exposes its imperative THREE.js API via forwardRef + useImperativeHandle, GlobeContainer accesses it via typed `useRef<GlobeVisualHandle>`. withRouter6 fully eliminated from all consuming components across the codebase.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | GlobeVisual forwardRef + useImperativeHandle | 1952792 | GlobeVisual.tsx, snapshots-07-pre.test.tsx, package.json |
| 2 | GlobeContainer + 4 remaining globe components | a0deea4 | GlobeContainer.tsx, GlobeTimeline.tsx, GlobeStatsBoard.tsx, GlobeTooltips.tsx, GlobeRouteButton.tsx, Conflict.tsx, assets.d.ts |

## Verification Results

- `npx tsc --noEmit`: PASSED (zero errors)
- `npm run build`: PASSED
- `npm test`: 232/233 passed (1 pre-existing server test failure — iomNormalizer.test.js, unrelated to globe conversion)
- No JSX files remain in `src/components/globe/`
- `grep -r "extends React.Component" src/components/globe/`: empty
- `grep -r "connect(" src/components/globe/` (functional only): import removed, only comment reference
- `grep -r "this.gv" src/components/globe/` (functional only): comment reference only
- `grep -r "withRouter6(" src/components/ --include="*.tsx" --include="*.ts"` (excluding definition file): empty

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Removed withRouter6 from Conflict.tsx**
- **Found during:** Task 2
- **Issue:** After GlobeContainer adopted useNavigate internally, Conflict.tsx's withRouter6 wrapper became dead code — it injected a navigate prop that was no longer passed down or used
- **Fix:** Removed withRouter6 import/wrapper from Conflict.tsx; component now renders directly without HOC
- **Files modified:** src/components/Conflict.tsx
- **Commit:** a0deea4

**2. [Rule 3 - Blocking] Added @types/mousetrap**
- **Found during:** Task 1
- **Issue:** mousetrap import had implicit any causing TS7016
- **Fix:** `npm i --save-dev @types/mousetrap --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Commit:** 1952792

**3. [Rule 3 - Blocking] Added scroll-js + countup.js module declarations**
- **Found during:** Task 2
- **Issue:** scroll-js and countup.js had no TypeScript declarations, causing TS7016
- **Fix:** Added `declare module 'scroll-js'` and `declare module 'countup.js'` to src/types/assets.d.ts
- **Files modified:** src/types/assets.d.ts
- **Commit:** a0deea4

**4. [Rule 1 - Bug] Snapshot test updated after conversion**
- **Found during:** Task 2 test run
- **Issue:** GlobeVisual snapshot changed from null (class component failing in jsdom) to actual rendered structure (functional component succeeds in jsdom)
- **Fix:** Updated snapshot with `--updateSnapshot`
- **Files modified:** tests/client/__snapshots__/snapshots-07-pre.test.tsx.snap
- **Commit:** a0deea4

## Self-Check: PASSED

Files confirmed present:
- src/components/globe/GlobeVisual.tsx: FOUND
- src/components/globe/GlobeContainer.tsx: FOUND
- src/components/globe/GlobeTimeline.tsx: FOUND
- src/components/globe/GlobeStatsBoard.tsx: FOUND
- src/components/globe/GlobeTooltips.tsx: FOUND
- src/components/globe/GlobeRouteButton.tsx: FOUND

Commits confirmed:
- 1952792: FOUND
- a0deea4: FOUND
