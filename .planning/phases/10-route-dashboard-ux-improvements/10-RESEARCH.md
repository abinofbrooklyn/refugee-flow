# Phase 10: Route Dashboard UX Improvements - Research

**Researched:** 2026-03-25
**Domain:** MapLibre GL JS fitBounds, per-route map framing, sidebar-aware viewport
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

### Per-route target framing (locked)
- **Eastern Mediterranean:** Tight on Aegean Sea — Greek islands, Turkish coast
- **Central Mediterranean:** Tunisia to southern Italy/Greece, Algeria coast visible. Libya-Italy sea cluster centered
- **Western Mediterranean:** Morocco-Spain-Alboran corridor. Strait of Gibraltar centered
- **English Channel:** Dover Strait tight — London/Oxford to Calais/Bruges/Lille
- **Western Balkans:** Athens/Istanbul up through Balkans to Vienna
- **Eastern Land Borders:** Poland-Lithuania-Belarus border corridor down to Hungary/Slovakia
- **Americas:** US-Mexico border corridor. Denver at top, Mexico City at bottom
- **Western African:** Senegal/Mauritania/Morocco Atlantic coast. Canary Islands approach centered
- **Horn of Africa:** Djibouti/Yemen/Gulf of Aden corridor
- **East & Southern Africa:** DRC/Congo to South Africa/Eswatini, east to Madagascar

### Claude's Discretion
- Whether to use fitBounds with per-route padding overrides, or compute custom bounds per route
- How to handle the initial map creation vs route-switch flyTo (both need updated framing)
- Whether to store tuned bounds in the data file or compute from data with adjustments in code

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 10 replaces the static `zoom: 3.5` / generic center-point approach used for all 12 route pages with per-route tuned map framing using MapLibre `fitBounds`. Two routes (Iran-Afghanistan Corridor, South & East Asia) are confirmed fine as-is and require no changes.

The core challenge is that pure auto-fit from data bounding box is insufficient for several routes. The English Channel route's data points extend into Germany, but the desired view is the tight Dover Strait. The solution is a hybrid: compute data bounds from `RouteDeath[]` lat/lng points, then apply per-route override bounds stored in `IBC_crossingCountByCountry.json`. The override bounds are the canonical truth for each route's framing; auto-computed bounds serve as fallback only for routes without overrides.

The sidebar-aware padding system already works correctly. MapLibre `fitBounds` respects the map's current padding state set by `map.setPadding()` — no additional work needed for sidebar integration. The same framing logic must be applied at two points: (1) initial map creation (currently `new maplibregl.Map({ center, zoom })`), and (2) route-switch navigation (currently `map.flyTo({ center, zoom })`). Both sites read from `currentMapParamsRef.current` which in turn reads from `IBC_crossingCountByCountry.json`.

**Primary recommendation:** Add `bounds` array (`[sw_lng, sw_lat, ne_lng, ne_lat]`) to each `RouteCrossingCount` entry in `IBC_crossingCountByCountry.json`. Replace `flyTo` and initial map positioning with a `fitBounds` helper that reads from these per-route bounds when present, falling back to center/zoom for the two unchanged routes. The `fitBounds` call passes `{ animate: false }` on initial load and normal animation options on route switch.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| maplibre-gl | 2.4.0 (installed) | Map rendering and viewport control | Already the project's map library |

No additional libraries needed. This is a configuration and data-tuning phase, not a new library phase.

**MapLibre fitBounds signature (verified from installed types):**
```typescript
fitBounds(bounds: LngLatBoundsLike, options?: FitBoundsOptions, eventData?: any): this;
```

**FitBoundsOptions (verified from installed types):**
```typescript
type FitBoundsOptions = FlyToOptions & {
  linear?: boolean;
  offset?: PointLike;
  maxZoom?: number;
  maxDuration?: number;
  padding?: number | RequireAtLeastOne<PaddingOptions>;
};
```

**LngLatBoundsLike (verified):**
```typescript
type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];
// [number, number, number, number] = [sw_lng, sw_lat, ne_lng, ne_lat]
```

**Key finding:** `fitBounds` accepts an optional `padding` parameter that **adds** to the map's existing padding state set by `setPadding`. Since `setPadding` already accounts for the sidebar's 55% right offset, passing no `padding` to `fitBounds` is the correct approach — the map's viewport awareness is already configured.

---

## Architecture Patterns

### Recommended Data Structure Change

Extend `IBC_crossingCountByCountry.json` with a `bounds` field per route entry. The `center_lng`, `center_lat`, and `zoom` fields remain for the two unchanged routes (used as fallback).

```json
{
  "route": "English Channel",
  "total_cross": 190118,
  "center_lng": 1.5,
  "center_lat": 49.0,
  "zoom": 3.5,
  "bounds": [0.5, 50.5, 2.5, 51.5]
}
```

The `RouteCrossingCount` TypeScript type in `src/types/api.ts` must be updated to include the optional field:
```typescript
export interface RouteCrossingCount {
  route: string;
  total_cross: number;
  center_lng: number;
  center_lat: number;
  zoom: number;
  bounds?: [number, number, number, number]; // [sw_lng, sw_lat, ne_lng, ne_lat]
}
```

### Pattern 1: fitBounds Helper Replacing flyTo

**What:** A `navigateToRouteBounds` helper that checks for per-route `bounds` in `currentMapParamsRef`, calls `fitBounds` if present, falls back to `flyTo` if not.

**When to use:** Both at initial map creation and on route switch.

```typescript
// Source: verified from maplibre-gl 2.4.0 types
const navigateToRouteBounds = (
  map: maplibregl.Map,
  params: RouteCrossingCount,
  animate: boolean
) => {
  if (params.bounds) {
    map.fitBounds(params.bounds, {
      animate,
      duration: animate ? 1500 : 0,
      maxZoom: 8,
    });
  } else {
    map.flyTo({
      center: [params.center_lng, params.center_lat],
      zoom: params.zoom,
      animate,
    });
  }
};
```

**Key detail:** Pass `animate: false` on initial map load (inside the `useEffect(() => {}, [])` after `map.on('load')` or after `setPadding`). Pass `animate: true` (with duration) on route-switch navigation.

### Pattern 2: Initial Map Creation Change

Current code (line ~261-271 in `RefugeeRoute_map.tsx`):
```typescript
mapRef.current = new maplibregl.Map({
  container: containerRef.current,
  style: '...',
  center: [params.center_lng, params.center_lat],
  zoom: params.zoom,
});
mapRef.current.setPadding({ top: 0, bottom: 0, left: 0, right: slideoutWidth });
```

The `new maplibregl.Map()` constructor does not accept `bounds` — it only accepts `center`/`zoom`. The pattern is:
1. Create map with any valid center/zoom (the static values work fine as placeholders)
2. After `setPadding`, call `fitBounds` once the map style is loaded

The correct hook is the map's `'load'` event, OR (since the map renders immediately) calling `fitBounds` after `setPadding` synchronously works in MapLibre 2.x when the style loads synchronously via CDN cache.

**Safe pattern using 'load' event:**
```typescript
// Source: maplibre-gl 2.4.0 docs pattern
mapRef.current.once('load', () => {
  navigateToRouteBounds(mapRef.current!, params, false);
});
```

### Pattern 3: Route-Switch Navigation Change

Current code (line ~118 in `RefugeeRoute_map.tsx`):
```typescript
canvas_overlay_render(() =>
  mapRef.current!.flyTo({
    center: [currentMapParamsRef.current.center_lng, currentMapParamsRef.current.center_lat],
    zoom: currentMapParamsRef.current.zoom,
  })
);
```

Replacement: pass the `fitBounds` call as the callback to `canvas_overlay_render`:
```typescript
canvas_overlay_render(() =>
  navigateToRouteBounds(mapRef.current!, currentMapParamsRef.current, true)
);
```

### Per-Route Bounds Values

These are the tuned bounds to store in `IBC_crossingCountByCountry.json` based on user-specified target framing. Coordinate values are `[sw_lng, sw_lat, ne_lng, ne_lat]`:

| Route | SW (lng, lat) | NE (lng, lat) | Notes |
|-------|--------------|--------------|-------|
| Eastern Mediterranean | 22.0, 34.0 | 32.0, 42.0 | Aegean Sea tight — Turkey to Greek islands |
| Central Mediterranean | 8.0, 30.0 | 20.0, 40.0 | Libya coast to southern Italy/Greece |
| Western Mediterranean | -6.0, 33.0 | 10.0, 42.0 | Morocco-Alboran-Sardinia corridor |
| English Channel | -0.5, 50.5 | 3.5, 52.0 | Dover Strait — London to Calais/Bruges |
| Western Balkans | 14.0, 37.0 | 30.0, 49.0 | Athens to Vienna corridor |
| Eastern Land Borders | 14.0, 46.0 | 32.0, 56.0 | Poland-Belarus border to Hungary |
| Americas | -118.0, 15.0 | -88.0, 40.0 | US-Mexico border corridor, Denver to Mexico City |
| Western African | -18.0, 15.0 | 0.0, 36.0 | Senegal/Mauritania to Morocco, Canaries approach |
| Horn of Africa | 38.0, 5.0 | 50.0, 16.0 | Djibouti/Yemen/Gulf of Aden |
| East & Southern Africa | 25.0, -30.0 | 50.0, -5.0 | DRC to S. Africa, Madagascar visible |
| Iran-Afghanistan Corridor | (no change) | (no change) | Use existing center/zoom |
| South & East Asia | (no change) | (no change) | Use existing center/zoom |

**Note:** These bounds are starting estimates based on user-specified geographic descriptions. They MUST be validated visually against actual app rendering during implementation. Treat as first-pass targets, not final values.

### Anti-Patterns to Avoid

- **Do not call `fitBounds` before `setPadding`:** The padding must be set first or the viewport centering will be wrong (data will appear behind the sidebar).
- **Do not use `maxZoom` too high:** Routes with sparse data (Western African, East & Southern Africa) need a ceiling to prevent extreme zoom on a single cluster. Recommend `maxZoom: 7` for sparse routes.
- **Do not call `fitBounds` in the constructor:** `new maplibregl.Map({ bounds })` constructor exists but doesn't respect `setPadding` (padding isn't set yet). Always call `fitBounds` after `setPadding`.
- **Do not remove center/zoom from JSON entries:** Routes without bounds (`Iran-Afghanistan Corridor`, `South & East Asia`) still need center/zoom for the fallback path. Keep all existing fields.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Computing pixel-perfect zoom from bounds | Custom zoom calculator | `map.fitBounds()` | MapLibre handles projection, tile density, DPI, and padding math; manual computation will be wrong on non-standard aspect ratios and exhibit displays |
| Sidebar-aware viewport offset | Re-implementing padding math | Existing `map.setPadding()` | Already implemented at line ~270-271; `fitBounds` respects this automatically |
| Animated transitions | Custom easing | `fitBounds` with `duration` / `flyTo` | MapLibre provides smooth flyTo-style easing internally |

---

## Common Pitfalls

### Pitfall 1: fitBounds Called Before Map Style Loads
**What goes wrong:** Calling `fitBounds` synchronously after `new maplibregl.Map()` can silently fail or produce wrong zoom on initial render if the style hasn't loaded yet.
**Why it happens:** MapLibre's style loading is async; viewport calculations depend on tile metadata.
**How to avoid:** Use `map.once('load', () => { fitBounds(...) })` for the initial frame. Route-switch `fitBounds` is safe to call immediately because the map is already initialized.
**Warning signs:** Map renders at constructor center/zoom instead of fitBounds target on hard page load.

### Pitfall 2: fitBounds Doesn't Account for Sidebar Padding
**What goes wrong:** Data appears centered in the full map container, not the visible left-45% area.
**Why it happens:** If `setPadding` is called AFTER `fitBounds`, the padding is applied but the viewport center doesn't shift to compensate.
**How to avoid:** Always call `map.setPadding(...)` before any `fitBounds` call.
**Warning signs:** Data cluster appears visually shifted right, partially hidden behind sidebar.

### Pitfall 3: Bounds Too Tight for Sparse Routes
**What goes wrong:** Routes with few data points (East & Southern Africa: only 135 crossings) zoom to maxZoom on a single location cluster, losing geographic context.
**Why it happens:** `fitBounds` will zoom to whatever level fits the bounding box — a single point fits at any zoom level.
**How to avoid:** Always set `maxZoom` in `FitBoundsOptions`. Recommend `maxZoom: 7` as a global cap; loosen per route if needed.
**Warning signs:** Map zooms to street level on a route page.

### Pitfall 4: canvas_overlay Callback Not Firing After fitBounds
**What goes wrong:** The D3 canvas overlay doesn't redraw after `fitBounds` because the callback pattern wraps `flyTo`, not `fitBounds`.
**Why it happens:** `canvas_overlay_render(cb)` calls `cb()` at the end — it doesn't listen to map events. The canvas redraws on every `'move'` event (registered at line ~296), so this is actually fine for route switches. The callback pattern is only needed to sequence the animation start.
**How to avoid:** Pass `navigateToRouteBounds` as the callback to `canvas_overlay_render` — same pattern as the current `flyTo`. No special handling needed; `'move'` events fire during `fitBounds` animation just as they do for `flyTo`.

### Pitfall 5: TypeScript Error on New `bounds` Field
**What goes wrong:** TypeScript errors on `params.bounds` because `RouteCrossingCount` in `src/types/api.ts` doesn't have the field.
**Why it happens:** Strict TypeScript; `RouteCrossingCount` is defined at line 55-61 of `src/types/api.ts`.
**How to avoid:** Add `bounds?: [number, number, number, number]` to `RouteCrossingCount` before using it in the map component.

---

## Code Examples

Verified patterns from MapLibre 2.4.0 installed types.

### Adding bounds to RouteCrossingCount type
```typescript
// src/types/api.ts — extend existing interface
export interface RouteCrossingCount {
  route: string;
  total_cross: number;
  center_lng: number;
  center_lat: number;
  zoom: number;
  bounds?: [number, number, number, number]; // [sw_lng, sw_lat, ne_lng, ne_lat]
}
```

### Helper function for unified navigation
```typescript
// Source: maplibre-gl 2.4.0 fitBounds/flyTo API (verified from installed types)
const navigateToRouteBounds = (
  map: maplibregl.Map,
  params: RouteCrossingCount,
  animate: boolean
): void => {
  if (params.bounds) {
    map.fitBounds(params.bounds, {
      animate,
      duration: animate ? 1500 : 0,
      maxZoom: 7,
    });
  } else {
    // Fallback for routes without bounds (Iran-Afghanistan Corridor, South & East Asia)
    map.flyTo({
      center: [params.center_lng, params.center_lat],
      zoom: params.zoom,
      animate,
    });
  }
};
```

### Initial map creation — use 'load' event for fitBounds
```typescript
// After new maplibregl.Map(...) and setPadding(...)
mapRef.current.once('load', () => {
  navigateToRouteBounds(mapRef.current!, params, false);
  canvas_overlay_render();
});
```

### Route-switch — replace flyTo in canvas_overlay_render callback
```typescript
// Replace current flyTo callback at line ~117-122
canvas_overlay_render(() =>
  navigateToRouteBounds(mapRef.current!, currentMapParamsRef.current, true)
);
```

### JSON entry format for IBC_crossingCountByCountry.json
```json
{
  "route": "English Channel",
  "total_cross": 190118,
  "center_lng": 1.5,
  "center_lat": 49.0,
  "zoom": 3.5,
  "bounds": [-0.5, 50.5, 3.5, 52.0]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static center/zoom per route | Per-route fitBounds from data | Phase 10 | Routes show the story, not empty map |
| `flyTo` for route switches | `fitBounds` with per-route bounds | Phase 10 | Correct zoom for each route's geographic spread |

---

## Open Questions

1. **Exact bounds values need visual validation**
   - What we know: User-specified geographic descriptions for each route (e.g., "Dover Strait — London to Calais")
   - What's unclear: The exact coordinate values in the table above are first-pass estimates. They need to be validated in-browser against actual data point rendering.
   - Recommendation: Implementation plan should include a dedicated tuning task where each route's bounds are tested visually and adjusted. Treat the table values as starting points.

2. **`'load'` event timing on route hot-reloads**
   - What we know: MapLibre fires `'load'` once when the style loads. On SPA navigation to the same route component (sidebar toggle, year filter change), the map is not destroyed/re-created.
   - What's unclear: Whether `once('load')` is safe if the style is already loaded when the hook fires (e.g., cached style from previous render).
   - Recommendation: Check `map.isStyleLoaded()` — if `true`, call `fitBounds` synchronously; if `false`, use `once('load')`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + ts-jest 29.4.6 |
| Config file | `jest.config.js` |
| Quick run command | `npm test -- --testPathPattern=client --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 10 has no formal v1 requirement IDs (it's a UX improvement phase, not tracked in REQUIREMENTS.md). Testing is behavioral/visual by nature.

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| `navigateToRouteBounds` calls `fitBounds` when `bounds` present | unit | Pure function, testable |
| `navigateToRouteBounds` falls back to `flyTo` when `bounds` absent | unit | Pure function, testable |
| TypeScript compiles cleanly with new `bounds?` field | build check | `tsc --noEmit` |
| Visual framing per route | manual | Cannot automate map rendering in jsdom |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compile check)
- **Per wave merge:** `npm test`
- **Phase gate:** Visual check of all 10 updated routes in browser before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/client/routeBounds.test.ts` — unit tests for `navigateToRouteBounds` helper function (covers fallback logic and fitBounds/flyTo dispatch)

---

## Sources

### Primary (HIGH confidence)
- Installed `node_modules/maplibre-gl/dist/maplibre-gl.d.ts` — `FitBoundsOptions`, `LngLatBoundsLike`, `fitBounds` signature, `PaddingOptions` verified directly from the installed 2.4.0 package
- `src/components/RefugeeRoute_map.tsx` — current map init (line ~261), route switch (line ~118), sidebar padding (line ~97-107, ~270-271), `canvas_overlay_render` callback pattern (line ~171-222) — all read directly
- `src/data/IBC_crossingCountByCountry.json` — current static center/zoom values for all 12 routes — read directly
- `src/types/api.ts` — `RouteCrossingCount` interface at lines 55-61 — read directly

### Secondary (MEDIUM confidence)
- MapLibre GL JS 2.x documentation pattern: `fitBounds` respects existing map padding set by `setPadding` — consistent with the type definition showing padding as an additive override in `FitBoundsOptions`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from installed package types
- Architecture: HIGH — patterns derived directly from existing code + verified API signatures
- Pitfalls: HIGH — derived from code inspection (ordering constraints, TypeScript types)
- Bounds values: LOW — coordinate estimates based on geographic descriptions; require visual validation

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (MapLibre 2.4.0 is pinned; stable API)
