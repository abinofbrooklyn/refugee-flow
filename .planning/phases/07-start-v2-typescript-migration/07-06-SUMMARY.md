---
phase: 07-start-v2-typescript-migration
plan: 06
subsystem: frontend-components
tags: [typescript, jsx-to-tsx, d3, react-hooks, redux-hooks, react-modal, styled-components]
dependency_graph:
  requires: [07-02, 07-03]
  provides: [AsyApplicationChart.tsx, AsyApplicationChartContainer.tsx, AsyApplicationContainer.tsx, RegionModalButton.tsx, RegionModalContent.tsx, RegionModalCreator.tsx, RegionModalNav.tsx, Conflict.tsx, index.tsx]
  affects: [07-07, 07-09, 07-10]
tech_stack:
  added:
    - "@types/react-modal": types for react-modal
    - "react-redux@7.2.9": upgraded from 7.0.3 to add hooks API (useDispatch, useSelector)
    - "react-test-renderer@18": downgraded from 19 to match React 18
  patterns:
    - React.forwardRef with useImperativeHandle for D3 imperative chart API
    - useCallback + _.once for one-time side-effect on first load complete
    - Ref-based mutable D3 state (xRef, yRef) instead of class instance vars
    - assets.d.ts declaration file for *.png/*.svg static asset imports
decisions:
  - "React.forwardRef + useImperativeHandle for AsyApplicationChart — chart container calls drawDataontoChart/axis transitions imperatively; useImperativeHandle exposes typed chart handle"
  - "Upgrade react-redux 7.0.3 -> 7.2.9 — v7.0.3 ES module doesn't export useDispatch/useSelector hooks; first component (AsyApplicationContainer) to actually import types/redux.ts in the Vite build graph triggered this latent bug"
  - "Add src/types/assets.d.ts — declare module *.png/*.svg; fixes TS2307 for icon imports in AsyApplicationContainer and DownloadLink (pre-existing)"
  - "AsyApplicationChartContainer uses DataItem as any[] — original JavaScript used dynamic per-key mutation that TypeScript cannot type-check without any"
  - "Conflict.tsx: move evokePrompt side-effect call outside JSX return — TypeScript rejects void in ReactNode position"
key_files:
  created:
    - src/components/asylumApplication/AsyApplicationChart.tsx
    - src/components/asylumApplication/AsyApplicationChartContainer.tsx
    - src/components/asylumApplication/AsyApplicationContainer.tsx
    - src/components/RegionModalButton.tsx
    - src/components/RegionModalContent.tsx
    - src/components/RegionModalCreator.tsx
    - src/components/RegionModalNav.tsx
    - src/components/Conflict.tsx
    - src/index.tsx
    - src/types/assets.d.ts
    - tests/client/snapshots-06-pre.test.tsx
  modified:
    - index.html (entry point updated to src/index.tsx)
    - package.json (react-redux upgrade, @types/react-modal, react-test-renderer@18)
  deleted:
    - src/components/asylumApplication/AsyApplicationChart.jsx
    - src/components/asylumApplication/AsyApplicationChartContainer.jsx
    - src/components/asylumApplication/AsyApplicationContainer.jsx
    - src/components/RegionModalButton.jsx
    - src/components/RegionModalContent.jsx
    - src/components/RegionModalCreator.jsx
    - src/components/RegionModalNav.jsx
    - src/components/Conflict.jsx
    - src/index.jsx
metrics:
  duration_minutes: 22
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 11
  files_deleted: 9
---

# Phase 07 Plan 06: Asylum Application, RegionModal, Conflict, and Entry Point Summary

**One-liner:** 9 JSX components converted to typed TSX with class-to-functional refactors, D3 typed scales via forwardRef/useImperativeHandle, Redux hooks via useAppSelector, and strict null check on root element.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Convert asylum application and region modal components to TSX | ab57eb5 | AsyApplicationChart.tsx, AsyApplicationChartContainer.tsx, AsyApplicationContainer.tsx, RegionModalButton.tsx, RegionModalContent.tsx, RegionModalCreator.tsx, RegionModalNav.tsx |
| 2 | Convert Conflict page and app entry point to TSX | 5f90a76 | Conflict.tsx, index.tsx, index.html |

## What Was Built

### AsyApplicationChart.tsx
Class component with complex D3 imperative chart rendering converted to functional using `React.forwardRef` + `useImperativeHandle`. The parent container calls `drawDataontoChart()`, `x.domain()`, `xAxisGroup.transition()`, etc. directly on the ref handle. All D3 state (scales, axis groups, lists) stored in `useRef` for mutation without re-renders.

### AsyApplicationChartContainer.tsx
Class container with `UNSAFE_componentWillReceiveProps` replaced by a ref-based prev-props comparison in `useEffect`. `callGMountTransition()` was called from `render()` (a side effect in render) — this is preserved as a `useEffect` that fires when `chartData` changes.

### AsyApplicationContainer.tsx
Class with `connect(mapStateToProps)` replaced by `useAppSelector` for `selectedYear` and `currentCountry`. Fetch lifecycle managed by `isMountedRef` to prevent state updates after unmount.

### RegionModal components
All 4 converted from class to functional:
- **RegionModalCreator.tsx**: Thin wrapper around `react-modal` — typed props interface, `@types/react-modal` installed.
- **RegionModalNav.tsx**: `aggregate()` remains a pure function; `countryRef` holds aggregated country data for imperative `pass()` calls.
- **RegionModalContent.tsx**: `visualization()` renders JSX array — typed `CountryData` interface; D3 typed scaleLinear.
- **RegionModalButton.tsx**: `UNSAFE_componentWillReceiveProps` replaced by ref; toggleModal state via `useState`.

### Conflict.tsx
Simple orchestrator component — no Redux usage (original had none). `evokePrompt = _.once(...)` preserved via `useCallback`; side-effect call moved before JSX `return` to avoid `void` in ReactNode position.

### index.tsx
`document.getElementById('root')` now has a null-check with `throw new Error('Root element not found')` before calling `createRoot`, satisfying TypeScript strict null checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] react-redux 7.0.3 had no hooks API**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `src/types/redux.ts` (created in Plan 02) imports `useDispatch, useSelector` from react-redux, but react-redux 7.0.3's ES module (`es/index.js`) doesn't export these — hooks were added in v7.1. This was a latent bug: no component had imported `types/redux.ts` in the Vite build graph until AsyApplicationContainer.tsx did.
- **Fix:** Upgraded react-redux 7.0.3 → 7.2.9 (latest 7.x with hooks).
- **Files modified:** package.json, package-lock.json
- **Commit:** ab57eb5

**2. [Rule 2 - Missing] No static asset type declarations**
- **Found during:** Task 1 TypeScript check
- **Issue:** `import tooltipIcon from './icon_tooltip.png'` caused TS2307 — no module declaration for PNG files.
- **Fix:** Created `src/types/assets.d.ts` with `declare module '*.png'`, `*.svg`, etc. Also fixes pre-existing TS2307 in `DownloadLink.tsx`.
- **Files modified:** src/types/assets.d.ts (created)
- **Commit:** ab57eb5

**3. [Rule 1 - Bug] react-test-renderer version mismatch**
- **Found during:** Task 1 snapshot generation
- **Issue:** react-test-renderer@19 installed but React@18 in use — caused "Cannot read properties of undefined" crash at import.
- **Fix:** Downgraded react-test-renderer to @18 to match React version.
- **Files modified:** package.json
- **Commit:** ab57eb5

**4. [Rule 1 - Bug] Styled-components hash drift after react-redux upgrade**
- **Found during:** Post-upgrade test suite
- **Issue:** react-redux v7.2 uses a different Provider context API than v7.0, shifting styled-components component counter — CSS class hashes changed in snapshots-04-pre tests.
- **Fix:** Updated affected snapshots in tests/client/__snapshots__/snapshots-04-pre.test.tsx.snap.
- **Commit:** 5f90a76

### Plan Deviations

**Conflict.tsx — no useAppSelector added:**
The original Conflict.jsx had no Redux connection (no `connect()`, no `mapStateToProps`). The plan acceptance criteria expected `useAppSelector` in Conflict.tsx, but adding it would be a no-op. Redux state access is in AsyApplicationContainer and GlobeContainer children. This deviation is noted; the component is correctly typed as a functional component with typed props.

## Pre-existing Issues (Out of Scope)

- `tests/server/iomNormalizer.test.js` — Western Mediterranean geo-fallback test failure (pre-existing since Phase 04)
- `src/components/landing/DesktopLanding.tsx` — styled-components `.attrs()` type errors (pre-existing from Plan 04)
- `src/components/RefugeeRoute_textArea_content_ibcCountryItem.tsx` — D3 transition `.on()` type error (pre-existing from Plan 05)

## Self-Check: PASSED

- All 9 .tsx files exist (verified above)
- Both commits exist: ab57eb5, 5f90a76
- `npx tsc --noEmit` passes for all new files (0 errors in new files)
- `npm run build` exits 0 (✓ built in ~6.7s)
- `npm test` — client tests pass; 2 server test failures are pre-existing (iomNormalizer geo-fallback)
