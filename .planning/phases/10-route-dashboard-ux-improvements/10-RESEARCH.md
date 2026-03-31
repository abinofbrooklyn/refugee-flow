# Phase 10: Route Dashboard UX Improvements - Research

**Researched:** 2026-03-30 (updated — gap closure for Plan 03)
**Domain:** MapLibre GL JS click handlers, flyTo zoom control, ref-based state pattern, deselect to fitBounds
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `map.fitBounds()` computed from actual data points, NOT static center/zoom values
- Each route needs per-route tuning — pure auto-fit from data bounds is not enough (e.g., English Channel needs tighter framing than the data spread suggests)
- Fallback to static center/zoom only for routes with no data points
- When sidebar is open (55% width), fitBounds must account for the right padding so the data is centered in the visible map area (left 45%)
- When sidebar is collapsed, the map reframes to use full width — fitBounds recalculates with no right padding
- The existing `map.setPadding()` / `map.easeTo({ padding })` system handles this; fitBounds respects map padding automatically
- **Iran-Afghanistan Corridor:** NO CHANGE — current framing is fine
- **South & East Asia:** NO CHANGE — current framing is fine

### Claude's Discretion
- Whether to use fitBounds with per-route padding overrides, or compute custom bounds per route
- How to handle the initial map creation vs route-switch flyTo (both need updated framing)
- Whether to store tuned bounds in the data file or compute from data with adjustments in code

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-FRAMING | Per-route fitBounds framing replacing static zoom:3.5 | Plans 01+02 complete. Plan 03 closes the gap: bubble click zoom too far out + deselect must return to route fitBounds |
</phase_requirements>

---

## Summary

Plans 01 and 02 are complete and user-approved. The `navigateToRouteBounds` helper exists, `fitBounds` with per-route bounds is in production for all 10 routes, and the initial load / route-switch framing works correctly.

Phase 10 was reopened because `handleClick` still uses hardcoded `zoom: 10` / `zoom: 9` (lines 313-315 of `RefugeeRoute_map.tsx`). Clicking a death marker bubble either zooms to street level (zoom 10) or slightly less (zoom 9), both far too close. The desired behavior is: SELECT zooms in moderately (current zoom + 2, capped at 7), SWAP between bubbles pans without zooming, and DESELECT (click same bubble or empty map) returns to the route's `fitBounds` framing via `navigateToRouteBounds`.

The existing Plan 10-03 captures the correct three-mode click logic. One implementation detail needs correction: the new `handleClick` in Plan 10-03 adds `data` and `currentRouteName` directly to the `useCallback` dependency array. This is unsafe in this codebase — the map event listener is registered once in the empty-dep `useEffect([], [])`, so a new `handleClick` reference won't be picked up by the map. The deselect path should read `data` and `currentRouteName` from `dataGroupedRef` and `currentRouteNameRef` (already synced in effects), or use `currentMapParamsRef` directly, consistent with how every other callback in this file avoids stale closures.

**Primary recommendation:** Implement Plan 10-03 as written but route the deselect path through refs instead of prop closure, and reset `selectedPointIdRef.current` on route change.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 2.4.0 (pinned) | Map rendering, flyTo, fitBounds | Already the project's map library |

No additional libraries. This is a logic fix in an existing file.

---

## Architecture Patterns

### Established Component Pattern: Refs for Prop Values

Every callback in `RefugeeRoute_map.tsx` that needs prop values reads from synced refs, not from prop closures. This is the intentional pattern established in Phase 7 (TypeScript migration decision: "Mutable map instance variables migrated to useRef in RefugeeRoute_map — avoids stale closure issues while preserving direct mutation semantics for canvas rendering").

The map event listener registration happens once in `useEffect([], [])`. A new `handleClick` reference created by adding `data` or `currentRouteName` to `useCallback` dependencies would NOT be picked up by the existing listener — the old reference stays registered.

**Available refs for handleClick deselect path:**
- `currentMapParamsRef.current` — current route's `RouteCrossingCount` (has `bounds`, `center_lng`, `center_lat`, `zoom`) — already updated in the `currentRouteName` useEffect
- `dataGroupedRef.current` — grouped data by route — synced in the `data` useEffect
- `currentRouteNameRef.current` — current route name — synced in the `currentRouteName` useEffect

These refs are everything `navigateToRouteBounds` needs. The deselect path becomes:

```typescript
canvas_overlay_render(() =>
  navigateToRouteBounds(
    mapRef.current!,
    currentMapParamsRef.current,
    true,
    Object.values(dataGroupedRef.current).flat(),
    currentRouteNameRef.current
  )
);
```

Or, since `navigateToRouteBounds` already reads `params.bounds` and falls back to `center_lng`/`zoom`, and the bounds were computed from data at setup time, the simpler pattern is sufficient:

```typescript
canvas_overlay_render(() =>
  navigateToRouteBounds(
    mapRef.current!,
    currentMapParamsRef.current,
    true,
    [],             // data only needed if route has no bounds; both no-bounds routes don't need deselect reset
    currentRouteNameRef.current
  )
);
```

The safest approach is to pass the data from refs — `Object.values(dataGroupedRef.current).flat()` — to avoid any edge case for future routes added without bounds.

### Pattern: selectedPointIdRef for Three-Mode Click State

Add `const selectedPointIdRef = useRef<number | null>(null);` after line 142 (after `mouseover_toggleRef`).

Reset this ref on route change in the `currentRouteName` useEffect (after `currentMapParamsRef.current` update), so switching routes doesn't leave a stale selected point ID from the previous route.

```typescript
// In the currentRouteName useEffect, add after currentMapParamsRef.current assignment:
selectedPointIdRef.current = null;
mouseover_toggleRef.current = true; // ensure hover mode is restored on route switch
```

### Three-Mode Click Logic

| State | Condition | Action |
|-------|-----------|--------|
| SELECT | No point selected, clicked a bubble | Set `selectedPointIdRef`, disable mousemove, zoom to `min(currentZoom + 2, 7)` |
| SWAP | Point selected, clicked a DIFFERENT bubble | Update `selectedPointIdRef`, update sidebar info, `flyTo` center only (no zoom change) |
| DESELECT | Point selected, clicked same bubble OR clicked empty map | Clear `selectedPointIdRef`, restore `mouseover_toggleRef = true`, re-enable mousemove, call `navigateToRouteBounds` |

The existing `mouseover_toggleRef.current === false` means "a point is locked/selected" and `true` means "hover mode". This semantic is preserved.

### Pattern: getZoom() for Context-Relative Zoom

`mapRef.current.getZoom()` returns the current zoom level as a `number`. For SELECT:

```typescript
const currentZoom = mapRef.current.getZoom();
const clickZoom = Math.min(currentZoom + 2, 7);
```

This prevents zooming past zoom 7 (the same cap used by `fitBounds` in `navigateToRouteBounds`), maintaining regional context. If the map is already at zoom 6 (common for dense routes), click zoom is capped at 7 — a moderate zoom-in without going to street level.

### Anti-Patterns to Avoid

- **Do not add `data` or `currentRouteName` props directly to `useCallback` deps for `handleClick`:** The map listener is registered once; React won't re-register it when the callback identity changes. Access via refs instead.
- **Do not use `mouseover_toggleRef` as a simple toggle for the new three-mode logic:** The toggle pattern `!mouseover_toggleRef.current` breaks when a point is already selected and a different point is clicked. The `selectedPointIdRef` id-comparison is the correct discriminant.
- **Do not forget to reset `selectedPointIdRef` on route switch:** If a user clicks a bubble on Eastern Mediterranean, then navigates to Americas, the old selected point ID would cause the first click on Americas to be treated as a SWAP instead of a SELECT.
- **Do not omit `mapRef.current.on('mousemove', handleMousemove)` on DESELECT:** The mousemove listener is removed on SELECT. DESELECT must re-add it. Missing this leaves the map in a broken hover state after deselect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zoom level for bubble click | Custom projection math | `map.getZoom() + 2`, capped with `Math.min` | MapLibre's zoom is already in the right unit; simple arithmetic is correct |
| Return-to-route animation | Custom easing | `navigateToRouteBounds` (already exists) | The helper already handles fitBounds vs flyTo fallback, animation duration, and maxZoom cap |
| Sidebar-aware deselect framing | Re-implementing padding | Existing `map.setPadding()` state + `navigateToRouteBounds` | Padding is already set on the map instance; fitBounds respects it automatically |

---

## Common Pitfalls

### Pitfall 1: Stale Closure on data/currentRouteName in handleClick

**What goes wrong:** Adding `data` and `currentRouteName` to `useCallback` deps creates a new `handleClick` reference on every prop change. But the MapLibre event listener registered in `useEffect([], [])` holds the original reference — the new one is never bound to the map.

**Why it happens:** MapLibre event listeners are registered imperatively (`map.on('click', handleClick)`). React's dependency array creates a new function identity, but there is no effect that calls `map.off` / `map.on` when `handleClick` changes.

**How to avoid:** Read `data` and `currentRouteName` from `dataGroupedRef.current` and `currentRouteNameRef.current` — both are synced to props via effects. Keep `handleClick` deps minimal: `[canvas_overlay_render, handleMousemove, passClickedPointManager, passRemoveClickedPointManager]`.

**Warning signs:** Deselect does not return to correct route bounds after navigating between routes — it returns to the bounds of the route that was active when the component mounted.

### Pitfall 2: selectedPointIdRef Not Reset on Route Switch

**What goes wrong:** User clicks a bubble on Route A, then switches to Route B. The first click on a bubble on Route B is evaluated as `isDifferentPoint` (SWAP) instead of SELECT, because `selectedPointIdRef.current` still holds the ID from Route A.

**Why it happens:** The ref persists across route prop changes. Route changes trigger a re-render and prop update but do not reset the ref unless explicitly cleared.

**How to avoid:** In the `currentRouteName` useEffect, after updating `currentMapParamsRef.current`, also reset `selectedPointIdRef.current = null` and `mouseover_toggleRef.current = true`.

**Warning signs:** First bubble click on a new route shows SWAP behavior (no zoom change, just pan) instead of SELECT behavior (zoom in).

### Pitfall 3: mousemove Not Re-registered After Deselect

**What goes wrong:** After deselecting a bubble, hover highlighting stops working — hovering over points no longer highlights them.

**Why it happens:** SELECT calls `mapRef.current.off('mousemove', handleMousemove)`. If DESELECT omits `mapRef.current.on('mousemove', handleMousemove)`, the listener is never restored.

**How to avoid:** Every DESELECT branch must call `mapRef.current.on('mousemove', handleMousemove)` before the `canvas_overlay_render` call.

**Warning signs:** Hover highlights work until first bubble click, then stop permanently until page reload.

### Pitfall 4: SWAP Branch Missing passClickedPointManager Update

**What goes wrong:** Clicking a different bubble while one is selected pans the map but the sidebar still shows the old point's data (dead count, cause, location).

**Why it happens:** SELECT calls `passClickedPointManager(p)` to update the sidebar. SWAP must also call it with the new point.

**How to avoid:** SWAP branch must call `passClickedPointManager(p)` before or alongside the `canvas_overlay_render` call.

**Warning signs:** Sidebar shows stale data after clicking between bubbles in dense areas.

### Pitfall 5: Empty-Map Click Does Not Deselect

**What goes wrong:** Clicking empty map while a bubble is selected does nothing — or worse, causes an error.

**Why it happens:** The current handleClick only acts when `p` (nearest point) is truthy. If `p` is falsy (no nearby point), the handler exits early. With the new three-mode logic, a falsy `p` should trigger DESELECT when a point is already selected.

**How to avoid:** Check `!p || isSamePoint` as the DESELECT condition — not just `isSamePoint`. The plan 10-03 already has this correct: `if (!p || isSamePoint)`.

---

## Code Examples

### Complete Updated handleClick

```typescript
// Source: derived from existing RefugeeRoute_map.tsx patterns
// Deps intentionally minimal — data/routeName accessed via refs to avoid stale listener problem
const handleClick = useCallback((e: maplibregl.MapMouseEvent) => {
  if (!treeRef.current || !mapRef.current) return;
  const p = treeRef.current.find(e.point.x, e.point.y) as RouteDeathWithCoords | undefined;

  const isSelected = !mouseover_toggleRef.current; // true when a point is locked
  const isSamePoint = isSelected && p != null && p.id === selectedPointIdRef.current;
  const isDifferentPoint = isSelected && p != null && p.id !== selectedPointIdRef.current;

  if (!p || isSamePoint) {
    // DESELECT: clicked same bubble again, or clicked empty map
    mouseover_toggleRef.current = true;
    selectedPointIdRef.current = null;
    mapRef.current.on('mousemove', handleMousemove);
    passRemoveClickedPointManager();
    canvas_overlay_render(() =>
      navigateToRouteBounds(
        mapRef.current!,
        currentMapParamsRef.current,
        true,
        Object.values(dataGroupedRef.current).flat(),
        currentRouteNameRef.current
      )
    );
  } else if (isDifferentPoint) {
    // SWAP: clicked a different bubble while one is selected — pan, no zoom change
    selectedPointIdRef.current = p.id;
    passClickedPointManager(p);
    canvas_overlay_render(() =>
      mapRef.current!.flyTo({ center: [p.lng ?? 0, p.lat ?? 0] })
    );
  } else {
    // SELECT: clicked a bubble when nothing is selected
    mouseover_toggleRef.current = false;
    selectedPointIdRef.current = p.id;
    mapRef.current.off('mousemove', handleMousemove);
    passClickedPointManager(p);
    const currentZoom = mapRef.current.getZoom();
    const clickZoom = Math.min(currentZoom + 2, 7);
    canvas_overlay_render(() =>
      mapRef.current!.flyTo({ center: [p.lng ?? 0, p.lat ?? 0], zoom: clickZoom })
    );
  }
}, [canvas_overlay_render, handleMousemove, passClickedPointManager, passRemoveClickedPointManager]);
```

### Route Change Reset (in currentRouteName useEffect)

```typescript
// In the existing useEffect(() => { ... }, [currentRouteName]) — add after currentMapParamsRef update:
selectedPointIdRef.current = null;
mouseover_toggleRef.current = true;
// Note: mousemove listener re-registration is handled by DESELECT path; on route switch
// the map is already in hover mode (mouseover_toggleRef was reset here), so mousemove
// is already registered from the original map init. No re-registration needed here.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static zoom:3.5 per route | Per-route fitBounds | Plans 01+02 (complete) | Routes frame data correctly on load |
| Toggle-on-click zoom:10/9 | Three-mode: select/swap/deselect with bounded zoom | Plan 03 (this work) | Dense cluster exploration without zoom cycling; deselect restores route view |

**Deprecated in handleClick:**
- `zoom: 10` — replaced with `Math.min(currentZoom + 2, 7)` for SELECT
- `zoom: 9` — removed; SWAP has no zoom change
- Toggle pattern (`!mouseover_toggleRef.current` as action discriminant) — replaced with id-comparison three-mode logic

---

## Open Questions

1. **Should SWAP also call `intersectedIdRef.current = p.id`?**
   - What we know: `intersectedIdRef` drives the white-highlight ring drawn in `canvas_overlay_drawCall`. On hover, `handleMousemove` updates it. On SELECT, mousemove is disabled so `intersectedIdRef` stays at the selected point's id — the ring persists correctly.
   - What's unclear: On SWAP, since mousemove is still off, `intersectedIdRef.current` holds the old point's id. The ring would appear on the old point, not the new one.
   - Recommendation: In the SWAP branch, also set `intersectedIdRef.current = p.id` before `canvas_overlay_render`. This keeps the highlight ring on the newly selected point.

2. **Does navigateToRouteBounds in deselect need the data array?**
   - What we know: `navigateToRouteBounds` calls `computeDataBounds(data, routeName, params.bounds)`. For routes with `params.bounds` set (all 10 active routes), `computeDataBounds` uses the data array only to compute the inner data extent — the outer max bounds clamp it. If data is an empty array, `computeDataBounds` returns `maxBounds` directly (line 35: `if (valid.length === 0) return maxBounds ?? null`).
   - What's unclear: Whether passing an empty array `[]` is safe vs. passing the full flat data.
   - Recommendation: Pass `Object.values(dataGroupedRef.current).flat()` for correctness. The data is already grouped in `dataGroupedRef` — flattening is O(n) and only happens on deselect click, not on every render.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (installed) |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern=client --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-FRAMING | Three-mode click logic (select/swap/deselect) | manual | visual browser check | N/A |
| UX-FRAMING | navigateToRouteBounds called on deselect | unit | `npx tsc --noEmit && npm run build` | build check only |
| UX-FRAMING | TypeScript compiles with selectedPointIdRef | build | `npx tsc --noEmit` | ✅ checked after task |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check) + `npm run build` (bundle check)
- **Per wave merge:** `npm test`
- **Phase gate:** Visual browser check of all three click modes before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers build validation. Click behavior is inherently manual-visual.

---

## Sources

### Primary (HIGH confidence)
- `src/components/RefugeeRoute_map.tsx` (read directly, 2026-03-30) — actual handleClick at lines 297-320, all ref declarations at lines 130-150, navigateToRouteBounds at lines 57-81, canvas_overlay_render at lines 237-288
- `.planning/phases/10-route-dashboard-ux-improvements/10-03-PLAN.md` (read directly) — existing plan approach, interfaces, and task actions
- `.planning/phases/10-route-dashboard-ux-improvements/10-01-SUMMARY.md` and `10-02-SUMMARY.md` (read directly) — confirmed plans 01+02 complete, current state of codebase
- `.planning/STATE.md` — Phase 07 TypeScript migration decision: "Mutable map instance variables migrated to useRef in RefugeeRoute_map — avoids stale closure issues while preserving direct mutation semantics for canvas rendering"

### Secondary (MEDIUM confidence)
- MapLibre GL JS 2.4.0 API: `map.getZoom()` returns current zoom as number; `flyTo({ center })` without zoom keeps current zoom level — consistent with installed types and MapLibre documentation behavior

---

## Metadata

**Confidence breakdown:**
- Existing code state: HIGH — read directly from source file
- Plan 10-03 approach soundness: HIGH — logic is correct; one ref/stale-closure fix identified
- Stale closure risk: HIGH — established project pattern documented in STATE.md explicitly calls this out
- MapLibre flyTo behavior (no zoom param = keep current): MEDIUM — consistent with docs and installed types but not re-verified from Context7 for this update

**Research date:** 2026-03-30 (gap closure update; original research 2026-03-25)
**Valid until:** 2026-06-30 (maplibre-gl 2.4.0 pinned; stable API)
