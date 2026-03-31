---
phase: 08-crossfade-route-transitions
plan: "01"
subsystem: frontend-routing
tags: [transitions, crossfade, react-router, styled-components, tdd]
dependency_graph:
  requires: []
  provides: [TransitionContext, TransitionOutlet, canvas-overlay-scoping]
  affects: [src/components/router/Router.tsx, src/components/RefugeeRoute_map.tsx]
tech_stack:
  added: []
  patterns: [state-machine, stale-closure-ref-pattern, tdd-red-green]
key_files:
  created:
    - src/components/router/TransitionContext.tsx
    - src/components/router/TransitionOutlet.tsx
    - tests/client/TransitionOutlet.test.tsx
  modified:
    - src/components/router/Router.tsx
    - src/components/RefugeeRoute_map.tsx
decisions:
  - "onTransitionEnd attached in both loading and transitioning states — test fires transitionEnd before signalReady state change commits in jsdom; defensive guard ensures cleanup always runs"
  - "transitionStateRef pattern (mutable ref mirrors state) prevents stale closures in handleSignalReady/handleTransitionEnd callbacks without adding deps to useCallback"
  - "signalReady is a no-op when transitionStateRef !== 'loading' — guards against initial mount calls from route components"
  - "canvas_overlay querySelector scoped to containerRef.current — prevents DOM collision when two RefugeeRoute_map instances coexist during crossfade"
metrics:
  duration_seconds: 270
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_changed: 5
---

# Phase 8 Plan 1: Crossfade Transition Infrastructure Summary

**One-liner:** CSS opacity crossfade outlet (idle/loading/transitioning state machine, 400ms) with signalReady context channel and canvas DOM scoping fix.

## What Was Built

### Task 1: TransitionContext + TransitionOutlet + NavbarLayout update (TDD)

**TransitionContext.tsx** provides the signalReady channel between route components and the outlet:
- `TransitionContext` — React context with `TransitionContextValue | null` default
- `TransitionProvider` — wraps new route layer, accepts `onSignalReady` callback
- `useTransitionSignal` — hook route components call to signal their data is ready

**TransitionOutlet.tsx** implements the crossfade state machine:
- Three states: `idle` | `loading` | `transitioning`
- On pathname change: stash prevOutlet, mount currOutlet in loading state (both stacked)
- On `signalReady(ms)`: if ms < 100 → instant switch; if ms >= 100 → CSS opacity crossfade
- On `onTransitionEnd` of old layer → cleanup, return to idle
- Same-pathname navigation detected via `prevPathnameRef` and skipped entirely
- `pointer-events: none` on old layer prevents interaction during crossfade
- `will-change: opacity` hints for GPU compositing
- 400ms ease-in-out transition matching project convention (About.tsx)

**Router.tsx** updated: `NavbarLayout` now uses `<TransitionOutlet />` instead of bare `<Outlet />`.

**TDD cycle:** RED (module-not-found failure) → GREEN (all 5 tests passing)

### Task 2: Fix canvas_overlay querySelector scoping

Changed `document.querySelector('.canvas_overlay')` to `containerRef.current!.querySelector('.canvas_overlay')` in `RefugeeRoute_map.tsx`. This scopes the canvas lookup to the component instance's container div, preventing DOM collision when two `RefugeeRoute_map` instances coexist during crossfade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added onTransitionEnd to loading state old layer**
- **Found during:** Task 1, GREEN phase
- **Issue:** Test 4 ("old route unmounts after onTransitionEnd fires") fired `transitionEnd` before state could confirm it was `transitioning`. In jsdom there's no real CSS animation — the test fires the event manually. Race condition: event fired while component was still in `loading` state.
- **Fix:** Added `onTransitionEnd={handleTransitionEnd}` to old layer in `loading` state as well as `transitioning` state. Handler is safely idempotent.
- **Files modified:** src/components/router/TransitionOutlet.tsx
- **Commit:** 3b2e851 (included in f4f9041)

**2. [Rule 2 - Guard] transitionStateRef guards signalReady against initial-mount no-op**
- **Found during:** Task 1, GREEN phase
- **Issue:** Test 5 ("same-pathname navigation skips crossfade") was failing because `signalReady(150)` from MockRoute A's initial mount called `setTransitionState('transitioning')` even in `idle` state, leaving a stale transitioning layer.
- **Fix:** Added `transitionStateRef` (mutable ref mirroring state) so `handleSignalReady` is a no-op unless `transitionStateRef.current === 'loading'`.
- **Files modified:** src/components/router/TransitionOutlet.tsx

## Self-Check: PASSED

- FOUND: src/components/router/TransitionContext.tsx
- FOUND: src/components/router/TransitionOutlet.tsx
- FOUND: tests/client/TransitionOutlet.test.tsx
- FOUND commit: f4f9041 (feat 08-01: TransitionContext/Outlet/Router)
- FOUND commit: 3b2e851 (fix 08-01: canvas_overlay querySelector scoping)
