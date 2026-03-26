# Phase 10: Route Dashboard UX Improvements - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize the initial map framing for each of the 12 route pages so the data concentration area is front and center on load. The framing must also work correctly when the sidebar is collapsed (full-width map). Currently every route uses a static `zoom: 3.5` with a generic center point, leaving most routes poorly framed with too much empty map visible.

</domain>

<decisions>
## Implementation Decisions

### Approach
- Use `map.fitBounds()` computed from actual data points, NOT static center/zoom values
- Each route needs per-route tuning — pure auto-fit from data bounds is not enough (e.g., English Channel needs tighter framing than the data spread suggests)
- Fallback to static center/zoom only for routes with no data points

### Sidebar-aware framing
- When sidebar is open (55% width), fitBounds must account for the right padding so the data is centered in the visible map area (left 45%)
- When sidebar is collapsed, the map reframes to use full width — fitBounds recalculates with no right padding
- The existing `map.setPadding()` / `map.easeTo({ padding })` system handles this; fitBounds respects map padding automatically

### Per-route target framing (from user screenshots)
- **Eastern Mediterranean:** Tight on Aegean Sea — Greek islands, Turkish coast. Not the wider basin.
- **Central Mediterranean:** Tunisia to southern Italy/Greece, Algeria coast visible. The big orange cluster (Libya-Italy sea) centered.
- **Western Mediterranean:** Morocco-Spain-Alboran corridor. Portugal to Sardinia, Casablanca to Madrid visible. Strait of Gibraltar centered.
- **English Channel:** Dover Strait tight — London/Oxford to Calais/Bruges/Lille. Channel crossing and Calais cluster centered.
- **Western Balkans:** Athens/Istanbul up through Balkans to Vienna. Full corridor: Greece, N. Macedonia, Serbia, Bosnia, Croatia, Slovenia, Austria, Hungary, Bulgaria.
- **Eastern Land Borders:** Poland-Lithuania-Belarus border corridor down to Hungary/Slovakia. Stockholm to Romania, Berlin to Kyiv visible.
- **Americas:** US-Mexico border corridor. Denver at top, Mexico City at bottom. Dense Arizona/Texas border band and Gulf coast clusters centered.
- **Western African:** Senegal/Mauritania/Morocco Atlantic coast. Casablanca to Guinea-Bissau. Canary Islands approach and coastal cluster centered.
- **Horn of Africa:** Djibouti/Yemen/Gulf of Aden corridor. Eritrea to Somalia, Addis Ababa visible. Red Sea and Gulf crossings centered.
- **East & Southern Africa:** DRC/Congo to South Africa/Eswatini, east to Madagascar. Malawi/Zambia/Mozambique and Madagascar clusters both visible.
- **Iran-Afghanistan Corridor:** NO CHANGE — current framing is fine.
- **South & East Asia:** NO CHANGE — current framing is fine.

### Claude's Discretion
- Whether to use fitBounds with per-route padding overrides, or compute custom bounds per route
- How to handle the initial map creation vs route-switch flyTo (both need updated framing)
- Whether to store tuned bounds in the data file or compute from data with adjustments in code

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Map initialization and route switching
- `src/components/RefugeeRoute_map.tsx` — Map init (line ~261), route switch flyTo (line ~118), sidebar padding (line ~97-107)
- `src/data/IBC_crossingCountByCountry.json` — Current static center_lng/center_lat/zoom values per route (all zoom: 3.5)

### Data flow
- `src/components/RefugeeRoute.tsx` — Passes `data` (RouteDeath[]) and `currentRouteName` to map component
- `src/types/api.ts` — RouteDeath interface with lat/lng fields

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `map.setPadding()` already handles sidebar-aware viewport — fitBounds respects this padding automatically
- `map.easeTo({ padding })` on sidebar collapse/expand already works (400ms duration)
- `dataDict` from `IBC_crossingCountByCountry.json` has per-route entries with center/zoom — could be extended with bounds

### Established Patterns
- Route switch uses `flyTo` with center/zoom from dataDict (line ~118)
- Initial map creation uses same static center/zoom (line ~265)
- Sidebar padding is computed as `containerRef.current.offsetWidth * 0.55` (line ~270, 101)

### Integration Points
- `currentMapParamsRef` stores the current route's map params — needs to include bounds or the framing logic
- `canvas_overlay_render()` wraps map movement to ensure D3 canvas redraws after — fitBounds needs same wrapper

</code_context>

<specifics>
## Specific Ideas

- User provided screenshots for 10 of 12 routes showing exact desired framing
- The framing should feel like "zooming into where the story is" — the data concentration, not empty geography
- Museum exhibit context: visitors should immediately see the human impact, not have to zoom in themselves

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-route-dashboard-ux-improvements*
*Context gathered: 2026-03-25*
