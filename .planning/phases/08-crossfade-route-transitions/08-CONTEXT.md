# Phase 8: Crossfade Route Transitions - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate the jarring blank/spinner flash when first loading a `/route/:arg` page by keeping the outgoing route visible while the incoming route loads data, then crossfading between them. Scope: only RefugeeRoute pages (`/route/:arg`), not Conflict, About, or Landing.

</domain>

<decisions>
## Implementation Decisions

### Crossfade style
- Simultaneous crossfade: old route fades out while new route fades in at the same time
- Both layers stacked (position: absolute) during the transition
- Old: opacity 1 → 0, New: opacity 0 → 1

### Timing
- Duration: 400ms (consistent with existing About page fade-in pattern)
- Easing: ease-in-out (natural acceleration/deceleration)

### When to crossfade
- Adaptive behavior based on data loading time
- If data loads in <100ms (cached): skip crossfade, switch instantly
- If data loads in >100ms (uncached/first visit): apply the 400ms crossfade
- This prevents unnecessary animation on fast cached switches while smoothing out initial loads

### Claude's Discretion
- How to keep the outgoing route mounted during transition (wrapper component, portal, etc.)
- Threshold implementation details (timer vs promise race)
- How to coordinate with the existing hybrid loading pattern in RefugeeRoute.tsx
- Whether to add a subtle loading indicator during long loads (>1s) or rely purely on crossfade
- MapLibre map lifecycle handling during stacked render (avoid double-initializing maps)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Route transition architecture
- `src/components/router/Router.tsx` — Current React Router v6 setup with NavbarLayout wrapper
- `src/components/router/config/routeRegistry.tsx` — Route definitions including `/route/:arg`

### Data loading pattern
- `src/components/RefugeeRoute.tsx` — Hybrid loading: current route first, prefetch rest. Loading state triggers full-screen ScaleLoader
- `src/utils/api.ts` — Promise caching for route data (cached_routeDeath, cached_routeIBC, cached_routeDeathByRoute)

### Existing transition patterns
- `src/components/about/About.tsx` — 400ms fade-in on mount (reference for timing consistency)
- `src/components/RefugeeRoute_textArea.tsx` — 400ms transform transition for slideout collapse

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScaleLoader` from react-spinners: currently used for full-screen loading — may be replaced or hidden behind crossfade
- styled-components: available for transition wrapper styling (no new animation library needed)
- API promise caching in `api.ts`: enables the adaptive threshold — cached routes resolve near-instantly

### Established Patterns
- CSS transitions via styled-components (400ms ease timing used in textArea slideout and About fade-in)
- React Router v6 `<Outlet />` pattern in NavbarLayout — transition wrapper likely wraps here or around the `/route/:arg` route
- `useParams` for route slug extraction — RefugeeRoute remounts on URL change

### Integration Points
- `Router.tsx` NavbarLayout — transition wrapper needs to intercept route changes for `/route/:arg` only
- `RefugeeRoute.tsx` loading state — crossfade replaces the ScaleLoader as the visual loading indicator
- `api.ts` cache — cache hit/miss determines whether to animate or switch instantly

</code_context>

<specifics>
## Specific Ideas

- Museum exhibit context: smooth transitions matter for viewer experience on large displays
- The app background is `#1a1a2e` (dark) — crossfade between route pages with this background should look natural
- Existing route-to-route switching (after cache) is already smooth — this phase specifically targets the first-load experience

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-crossfade-route-transitions*
*Context gathered: 2026-03-25*
