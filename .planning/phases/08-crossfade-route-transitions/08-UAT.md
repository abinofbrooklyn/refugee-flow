---
status: complete
phase: 08-crossfade-route-transitions
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-03-29T22:30:00Z
updated: 2026-03-30T02:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Route-to-route switch keeps old data visible
expected: Navigate to any route, then switch to another. Old route's map and text stay visible while new data loads — no blank screen, no spinner, no flash.
result: pass

### 2. Cached route switch is instant
expected: After visiting a route, navigate away, then back. The return should be instant — no loading delay, no animation.
result: pass

### 3. First route visit shows ScaleLoader
expected: Open a fresh browser tab to any route. On first visit, the ScaleLoader spinner should appear briefly before content renders.
result: pass

### 4. Same-route click does nothing
expected: Click the route link you're already viewing. Nothing should happen — no flash, no re-render, no spinner.
result: pass

### 5. canvas_overlay querySelector scoped
expected: No document.querySelector('.canvas_overlay') in RefugeeRoute_map.tsx — uses containerRef.current!.querySelector instead.
result: pass

### 6. TransitionOutlet unit tests pass
expected: npx jest --testPathPatterns=TransitionOutlet passes all tests.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
