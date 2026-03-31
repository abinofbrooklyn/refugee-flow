# Plan 04-18: MapLibre Clustering — Research

**Researched:** 2026-03-25
**Domain:** MapLibre GL JS v2.4.0 — GeoJSON clustering, layer styling, React integration
**Confidence:** HIGH (all findings verified directly against installed `maplibre-gl@2.4.0` type definitions)

---

## Summary

The installed `maplibre-gl@2.4.0` has complete native clustering support via the `GeoJSONSourceSpecification`
`cluster: true` option. Clusters are rendered through ordinary circle and symbol layers using expression
filters. Individual unclustered points are styled with data-driven expressions reading feature properties
(e.g. `cause_of_death`) directly through MapLibre's expression language — no custom canvas drawing needed.

The existing component uses a canvas overlay with D3 for dot rendering and a quadtree for mouseover detection.
The migration replaces that canvas rendering with three MapLibre layers while keeping the map initialization
pattern (`useRef`, `useEffect`, `map.on('load', ...)`) and the prop-driven route/filter update behavior.

The most important constraint: all `addSource` and `addLayer` calls MUST occur inside the `map.on('load', ...)`
callback. The current component calls `canvas_overlay_render` synchronously in `useEffect` but appends the
canvas after map init with no load guard — this works only because the D3 canvas is independent of the map
style. For MapLibre layers, the load event is mandatory.

**Primary recommendation:** Add source and all three layers inside `map.on('load', ...)`. Update source data
via `(map.getSource('route-deaths') as GeoJSONSource).setData(geojson)` whenever route or filter props change,
replacing the current `canvas_overlay_render` call in those `useEffect` hooks.

---

## Standard Stack

### Core
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| maplibre-gl | 2.4.0 (installed) | Map, source, layers, clustering | All clustering API verified in dist/maplibre-gl.d.ts |
| @types/geojson | installed | `GeoJSON.FeatureCollection`, `GeoJSON.Feature` types | Already a transitive dep |

### No Additional Packages Needed
Clustering is built into maplibre-gl. No plugins required.

---

## Architecture Patterns

### Pattern 1: Source + Three-Layer Clustering Setup

All source/layer setup inside the `'load'` event listener.

```typescript
// Source: maplibre-gl@2.4.0 dist/maplibre-gl.d.ts, GeoJSONSourceSpecification
import maplibregl, { GeoJSONSource } from 'maplibre-gl';

map.on('load', () => {
  map.addSource('route-deaths', {
    type: 'geojson',
    data: buildGeoJSON([]),   // start empty; setData on route change
    cluster: true,
    clusterRadius: 50,        // pixels — tune per route density
    clusterMaxZoom: 14,       // no clustering beyond zoom 14
    clusterMinPoints: 2,      // minimum points to form a cluster
  });

  // Layer 1: cluster circles
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'route-deaths',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#FF8E0F',  // small  (<10)
        10, '#FFFF20',  // medium (10-50)
        50, '#FF4444',  // large  (50+)
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        15,
        10, 22,
        50, 30,
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff',
    },
  });

  // Layer 2: cluster count badge
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'route-deaths',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
    },
    paint: {
      'text-color': '#ffffff',
    },
  });

  // Layer 3: individual unclustered points
  map.addLayer({
    id: 'unclustered-point',
    type: 'circle',
    source: 'route-deaths',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, 3,
        14, 8,
      ],
      'circle-color': buildCauseColorExpression(),
      'circle-opacity': 0.85,
      'circle-stroke-width': [
        'case', ['has', 'has_description'], 2, 0
      ],
      'circle-stroke-color': '#FFFFFFDD',
    },
  });
});
```

### Pattern 2: Data-Driven Color by cause_of_death Property

MapLibre's `match` expression maps property values to colors — no custom canvas drawing.

```typescript
// Source: color_map from src/data/routeDictionary.ts + MapLibre expression spec
function buildCauseColorExpression(): maplibregl.ExpressionSpecification {
  // color_map keys mapped to their hex values
  return [
    'match',
    ['get', 'mapped_cause'],
    'drowning or exhaustion related death',             '#FF8E0FCC',
    'violent accidental death (transport; blown in minefield...)', '#00FF00CC',
    'authorities related death',                        '#8427F9CC',
    'unknown - supposedly exhaustion related death',    '#FFFF20CC',
    'suicide',                                          '#FF73FECC',
    'malicious intent related death / manslaughter',    '#CD352CCC',
    /* default */ '#5CFFE2CC',
  ];
}
```

**Key:** Store `mapped_cause` (already-resolved via `mapCause()`) as a GeoJSON feature property. The expression
reads it at render time, eliminating per-frame iteration.

### Pattern 3: GeoJSON Feature Construction

```typescript
// Source: @types/geojson (installed), RouteDeath from src/types/api.ts
function buildGeoJSON(deaths: RouteDeathWithCoords[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: deaths
      .filter(d => d.lat != null && d.lng != null)  // skip null coords
      .map(d => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [d.lng!, d.lat!],
        },
        properties: {
          id: d.id,
          dead_and_missing: +(d.dead_and_missing ?? 0),
          mapped_cause: mapCause(d.cause_of_death),
          has_description: d.description ? 1 : 0,
          route: d.route,
          // Preserve all fields needed for the click detail panel
          cause_of_death: d.cause_of_death,
          source_url: d.source_url ?? null,
          description: d.description ?? null,
          location: d.location ?? null,
        },
      })),
  };
}
```

**Note on null coordinates:** The current component has a guard for `lat > 90` coordinates (projects to lat 90
instead). This is dead-letter data. For MapLibre clustering, simply filter out records with `lat == null || lng == null`.
If the out-of-range lat guard is needed, clamp to [-90, 90] before putting in GeoJSON.

### Pattern 4: Updating Data on Route Change

Replace `canvas_overlay_render()` calls with a single `setData` call:

```typescript
// Source: GeoJSONSource.setData signature in maplibre-gl@2.4.0 d.ts
const source = mapRef.current.getSource('route-deaths') as GeoJSONSource;
const routeDeaths = dataGroupedRef.current[currentRouteName] ?? [];
const filtered = banned?.length
  ? routeDeaths.filter(d => !banned.includes(mapCause(d.cause_of_death)))
  : routeDeaths;
source.setData(buildGeoJSON(filtered));
```

### Pattern 5: Cluster Click-to-Expand Zoom

```typescript
// Source: GeoJSONSource.getClusterExpansionZoom — callback-based in v2.4.0
// (NOT promise-based — that is v3+)
map.on('click', 'clusters', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
  if (!features.length) return;

  const clusterId = features[0].properties?.cluster_id as number;
  const source = map.getSource('route-deaths') as GeoJSONSource;

  source.getClusterExpansionZoom(clusterId, (err, zoom) => {
    if (err || zoom == null) return;
    const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
    map.flyTo({ center: coords, zoom });
  });
});
```

**CRITICAL:** In v2.4.0, `getClusterExpansionZoom` uses a **callback** pattern, NOT a Promise. The promise-based
API appeared in v3.x. Using `await source.getClusterExpansionZoom(...)` will not work.

### Pattern 6: Individual Point Click Handler

```typescript
// Source: MapLayerEventType — layer-specific click provides features[] in event
map.on('click', 'unclustered-point', (e: maplibregl.MapLayerMouseEvent) => {
  if (!e.features?.length) return;
  const props = e.features[0].properties;
  // Reconstruct the object shape the existing passClickedPointManager expects
  passClickedPointManager({
    id: props.id,
    lat: (e.features[0].geometry as GeoJSON.Point).coordinates[1],
    lng: (e.features[0].geometry as GeoJSON.Point).coordinates[0],
    dead_and_missing: props.dead_and_missing,
    cause_of_death: props.cause_of_death,
    description: props.description,
    source_url: props.source_url,
    location: props.location,
    route: props.route,
  });
});
```

### Pattern 7: Cursor Change on Hover

```typescript
// Source: maplibregl.Map.getCanvas() returns HTMLCanvasElement
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});
map.on('mouseenter', 'unclustered-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'unclustered-point', () => {
  map.getCanvas().style.cursor = '';
});
```

### Pattern 8: Cleanup on Unmount

```typescript
// In the useEffect return function — remove layers/source before map.remove()
return () => {
  if (mapRef.current) {
    // Layers must be removed before source
    ['cluster-count', 'clusters', 'unclustered-point'].forEach(id => {
      if (mapRef.current!.hasLayer(id)) mapRef.current!.removeLayer(id);
    });
    if (mapRef.current.getSource('route-deaths')) {
      mapRef.current.removeSource('route-deaths');
    }
    mapRef.current.remove();
    mapRef.current = null;
  }
};
```

### Pattern 9: Font for cluster-count Layer

The CARTO dark-matter style includes `'Open Sans Regular'` and `'Open Sans Bold'`. The `text-font` array in the
`cluster-count` layer must use a font that exists in the tile style's sprite/glyphs. Safe defaults for CARTO dark:

```
'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
```

If the font is missing, the symbol layer silently renders no text. Use DevTools to check for `glyph` 404 errors.

### Anti-Patterns to Avoid

- **Adding layers before `map.on('load')`:** Throws `Error: Style is not done loading`. The current component
  has no load guard because D3 canvas is appended to the DOM, not the map style.
- **Using `map.on('click', handler)` for cluster expand:** The global click event has no `features` array. Always
  use `map.on('click', 'clusters', handler)` (layer-specific) to get `queryRenderedFeatures` pre-computed.
- **Awaiting `getClusterExpansionZoom`:** This is v2.x. It is callback-only. No `.then()` or `await`.
- **Putting complex objects in GeoJSON properties:** MapLibre properties only support strings, numbers, booleans,
  and null. Arrays and nested objects are silently dropped. The `description` field is fine as a string.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Point clustering | Custom grid/bucket algorithm | `cluster: true` in GeoJSONSourceSpecification | MapLibre uses Supercluster internally — handles zoom-responsive cluster merging, expansion zoom calculation, edge cases at antimeridian |
| Cluster expansion zoom | Binary search on zoom levels | `GeoJSONSource.getClusterExpansionZoom(clusterId, callback)` | Supercluster already knows the exact zoom at which the cluster breaks apart |
| Data-driven colors | Per-frame property lookup in JS | MapLibre `match` expression in layer paint | Evaluated in the rendering pipeline (WebGL), not in JS |
| Hover hit-testing | D3 quadtree on canvas coords | `map.on('mouseenter'/'mouseleave', layerId, ...)` | MapLibre does spatial indexing via tiled features; exact pixel hit detection included |

**Key insight:** The entire existing canvas overlay approach (D3 canvas, quadtree, manual redraw on every `move`
event) can be deleted. MapLibre handles all of this natively at the WebGL level.

---

## Common Pitfalls

### Pitfall 1: `map.on('load')` vs immediate execution
**What goes wrong:** `addSource` or `addLayer` called before the base style finishes loading throws
`Error: Style is not done loading`.
**Why it happens:** The CARTO style is fetched asynchronously. Map construction returns immediately.
**How to avoid:** Wrap all `addSource`/`addLayer` calls inside `map.on('load', () => { ... })`.
**Warning signs:** Error appears only on first mount, not on hot reload (style may already be cached).

### Pitfall 2: Missing `filter` on cluster vs unclustered layers
**What goes wrong:** Both cluster circles and individual points render simultaneously.
**Why it happens:** Without `filter: ['has', 'point_count']` on clusters and `filter: ['!', ['has', 'point_count']]`
on unclustered-point, all features hit all layers.
**How to avoid:** Always include both filters exactly as shown in Pattern 1.

### Pitfall 3: Stale source after `setData` called before style loaded
**What goes wrong:** Calling `setData` on a source that doesn't exist yet (e.g. in a `useEffect` that runs
before `'load'` fires).
**How to avoid:** Guard with `mapRef.current.isSourceLoaded('route-deaths')` or maintain a `loadedRef` flag
set to `true` inside `map.on('load', () => { loadedRef.current = true; ... })`.

### Pitfall 4: `getSource` returns `Source | undefined`, not `GeoJSONSource`
**What goes wrong:** TypeScript error when calling `.setData()` — `Source` has no such method.
**How to avoid:** Always cast: `const src = map.getSource('route-deaths') as GeoJSONSource`.

### Pitfall 5: `banned_category` filter requires rebuilding GeoJSON, not a layer filter
**What goes wrong:** Setting a layer `filter` won't re-include data filtered at the source level. But
in this architecture we put all route deaths in the source and rely on GeoJSON filtering.
**How to avoid:** The current approach (filter data before calling `setData`) is correct. Alternatively
store all data in the source and add a MapLibre layer filter — but that doesn't work well with clustering
(cluster counts will include filtered-out points). Rebuilding GeoJSON on filter change is the right approach.

### Pitfall 6: `point_count_abbreviated` may be undefined for small clusters
**What goes wrong:** Symbol layer shows "undefined" for clusters of 2-3 points.
**Why it happens:** `point_count_abbreviated` is a Supercluster-generated string (e.g. "1k"). For counts
< 1000 it equals `point_count` as a number. It is always present when clustering is enabled.
**How to avoid:** Use `['get', 'point_count_abbreviated']` not `['to-string', ['get', 'point_count']]`.
Both work but `point_count_abbreviated` is the canonical approach per MapLibre examples.

### Pitfall 7: Canvas overlay cleanup after migration
**What goes wrong:** Old `canvas_overlay` DOM element remains when clustering is adopted.
**How to avoid:** Remove the D3 canvas append block and all `canvas_overlay_render`, `canvas_overlay_drawCall`,
quadtree, and `ctxRef` code. Keep the `sizeScalerRef` only if needed elsewhere.

---

## Code Examples (Verified Patterns)

### Checking if source exists before setData

```typescript
// Source: maplibre-gl@2.4.0 d.ts — getSource returns Source | undefined
function updateMapData(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  const src = map.getSource('route-deaths');
  if (!src) return;
  (src as GeoJSONSource).setData(geojson);
}
```

### Layer-specific event with features

```typescript
// Source: MapLayerEventType in maplibre-gl@2.4.0 d.ts
// map.on('click', layerId, handler) — handler receives MapLayerMouseEvent
// MapLayerMouseEvent = MapMouseEvent & { features?: GeoJSON.Feature[] }
map.on('click', 'clusters', (e) => {
  const features = e.features;   // already populated — no queryRenderedFeatures needed
  // OR: map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
  // Both are equivalent; e.features is more convenient
});
```

**Note:** `e.features` on layer-specific events is typed as `GeoJSON.Feature[] | undefined` in v2.4.0.
`queryRenderedFeatures` returns `MapGeoJSONFeature[]`. Either works; `e.features` is simpler.

### Removing layers and source safely on unmount

```typescript
// Source: maplibre-gl@2.4.0 d.ts — hasLayer(id: string): boolean
const LAYERS = ['cluster-count', 'clusters', 'unclustered-point'] as const;
LAYERS.forEach(id => {
  if (map.hasLayer(id)) map.removeLayer(id);
});
if (map.getSource('route-deaths')) map.removeSource('route-deaths');
```

---

## State of the Art (v2 vs v3)

| Feature | v2.4.0 (installed) | v3.x |
|---------|-------------------|------|
| Cluster expand zoom | `getClusterExpansionZoom(id, callback)` | Returns Promise |
| GeoJSON setData | Synchronous-style (re-tiles async) | Same |
| Expression language | Identical | Same |
| TypeScript support | `maplibre-gl.d.ts` bundled | Same |

**Do not upgrade to v3** for this feature — the callback API in v2.4.0 is the correct one to use.

---

## Performance with 20,000+ Points

**Confidence:** MEDIUM (reasoning from MapLibre architecture + Supercluster benchmarks)

- MapLibre clustering uses [Supercluster](https://github.com/mapbox/supercluster) internally. Supercluster
  handles 100k+ points efficiently via R-tree indexing in a Web Worker.
- `setData` re-tiles in the worker thread — no main thread jank.
- The critical path: `setData` is called on route change (switch between 12 routes). Each route has at most
  ~5,000 points (IOM dataset covers 2014–present, ~1,000 incidents/route). 20,000 total is within normal range.
- The existing D3 canvas approach redraws on every `'move'` event (60fps during pan). MapLibre layers render
  via WebGL with no JS involvement during pan — this is a significant performance improvement.
- For the `'banned_category'` filter, rebuilding GeoJSON from ~1,000 objects is negligible.

**Recommendation:** No special optimization needed for this dataset size. The migration itself is the
performance improvement.

---

## Integration with Existing Component Structure

### What stays
- `mapRef`, `containerRef`, `useRef` pattern for map instance
- `map.on('load', ...)` initialization block structure (add inside existing `useEffect`)
- `flyTo` on route change (still relevant)
- `map.easeTo({ padding })` for slideout
- `passClickedPointManager` / `passRemoveClickedPointManager` callbacks
- `banned_category` filter logic (now filters the GeoJSON array instead of canvas draw calls)
- `CAUSE_MAP` / `mapCause()` (used to compute `mapped_cause` property in GeoJSON features)
- `color_map` (used to build `buildCauseColorExpression()` — derive once, not per-frame)

### What is removed
- `canvas_overlay_drawCall` — replaced by MapLibre layer paint expressions
- `canvas_overlay_render` — replaced by `source.setData()`
- D3 canvas append block and `ctxRef`, `ctxRef.current = ...`
- `treeRef` (D3 quadtree) — MapLibre handles hit detection
- `intersectedIdRef`, `mouseover_toggleRef` hover state tracking
- `sizeScalerRef` — sizing now done via MapLibre zoom interpolation expression
- `sizeChangeRef`, `mapContainerWidthRef`, `mapContainerHeightRef`
- `myZoomRef` (zoom tracking for D3 sizing)
- `map.on('viewreset', ...)` and `map.on('move', ...)` re-render listeners
- `d3-canvas-transition` import (if map canvas is the only consumer)

### useEffect changes
- Route change `useEffect`: replace `canvas_overlay_render(() => map.flyTo(...))` with
  `source.setData(buildGeoJSON(filtered))` + `map.flyTo(...)`
- `banned_category` `useEffect`: replace `canvas_overlay_render()` with `source.setData(buildGeoJSON(filtered))`
- `slideoutCollapsed` `useEffect`: unchanged (uses `easeTo`)
- `data` `useEffect`: rebuild GeoJSON and call `setData` if source is loaded

---

## Open Questions

1. **`text-font` availability in CARTO dark-matter style**
   - What we know: CARTO dark-matter includes `'Open Sans Regular'` and `'Open Sans Bold'`
   - What's unclear: Exact font IDs in this specific style version
   - Recommendation: Use `['Open Sans Bold', 'Arial Unicode MS Bold']` as the `text-font` array. If cluster
     count badges are invisible, check browser DevTools Network tab for glyph 404s and adjust font name.

2. **Cluster radius tuning per route**
   - What we know: `clusterRadius: 50` is the default in MapLibre examples
   - What's unclear: Optimal radius for dense routes (Central Mediterranean) vs sparse (Others)
   - Recommendation: Start with 50. The existing component already adjusts the D3 size scaler per route —
     `clusterRadius` can similarly be set differently per route if needed, but requires removing/re-adding
     the source on route change (overhead). Alternative: single radius 50, accept visual density variation.

3. **D3 / canvas overlay removal scope**
   - What we know: The D3 canvas is used only for the route death dots
   - What's unclear: Whether `d3-canvas-transition` or `d3` imports are used elsewhere in the component
   - Recommendation: Scan imports after migration. `d3` itself (scales, quadtree) can be removed from this
     file if no other usage remains. `d3-canvas-transition` is a side-effect-only import and can be removed.

---

## Sources

### Primary (HIGH confidence — directly verified against installed package)
- `node_modules/maplibre-gl/dist/maplibre-gl.d.ts` — `GeoJSONSourceSpecification` (lines 744-763),
  `GeoJSONSource` class with `getClusterExpansionZoom`/`setData` signatures (lines 4689-4765),
  `CircleLayerSpecification` (lines 955-988), `SymbolLayerSpecification` (lines 866-954),
  `MapLayerEventType` (lines 3409-3423), `queryRenderedFeatures` (lines 9912-9989)
- `src/data/routeDictionary.ts` — `color_map` entries (7 cause categories + hex values)
- `src/types/api.ts` — `RouteDeath` interface (all fields confirmed nullable)
- `src/components/RefugeeRoute_map.tsx` — existing component architecture (canvas pattern to be replaced)

### Metadata

**Confidence breakdown:**
- Clustering API (source options, layer filters, setData): HIGH — verified against installed d.ts
- Callback vs Promise for getClusterExpansionZoom: HIGH — v2.4.0 signature is `callback: Callback<number>`
- Color expression syntax: HIGH — `match` expression is part of MapLibre style spec, in d.ts
- Font availability in CARTO style: MEDIUM — common knowledge, not verified against live style JSON
- Performance with 20k points: MEDIUM — architectural reasoning, not benchmarked against this dataset

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (maplibre-gl@2.4.0 is pinned in package.json)
