# Phase 8: Crossfade Route Transitions - Research

**Researched:** 2026-03-25
**Domain:** React Router v6 route transitions, CSS opacity crossfade, MapLibre WebGL lifecycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Simultaneous crossfade: old route fades out while new route fades in at the same time
- Both layers stacked (position: absolute) during the transition
- Old: opacity 1 → 0, New: opacity 0 → 1
- Duration: 400ms (consistent with existing About page fade-in pattern)
- Easing: ease-in-out (natural acceleration/deceleration)
- Adaptive behavior based on data loading time
- If data loads in <100ms (cached): skip crossfade, switch instantly
- If data loads in >100ms (uncached/first visit): apply the 400ms crossfade

### Claude's Discretion
- How to keep the outgoing route mounted during transition (wrapper component, portal, etc.)
- Threshold implementation details (timer vs promise race)
- How to coordinate with the existing hybrid loading pattern in RefugeeRoute.tsx
- Whether to add a subtle loading indicator during long loads (>1s) or rely purely on crossfade
- MapLibre map lifecycle handling during stacked render (avoid double-initializing maps)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

This phase eliminates the blank-screen flash when navigating between `/route/:arg` pages. The chosen approach is a simultaneous crossfade: the outgoing route stays rendered at full opacity while the incoming route loads, then both animate (old fades to 0, new fades from 0 to 1) over 400ms. The animation only fires when data takes >100ms to resolve (cache miss); cached routes switch instantly.

The core architectural challenge is **keeping the old route mounted while the new route loads**. React Router v6 does not natively support this — when the URL changes, the old `<Route>` immediately unmounts. The solution is a custom `TransitionOutlet` component in `NavbarLayout` that intercepts the `useOutlet()` snapshot and holds the previous rendered output in state until the incoming route signals it is ready, then triggers the CSS transition.

The second critical challenge is **MapLibre WebGL lifecycle safety**. Two simultaneous MapLibre instances would create two WebGL contexts. Browsers (Chromium) limit concurrent WebGL contexts to 16, and MapLibre itself warns at 8. During a 400ms crossfade, both old and new `RefugeeRoute_map` instances would be live. This must be handled by preventing the incoming map from initializing until it is the active layer, or by deferring map initialization until the crossfade completes.

**Primary recommendation:** Build a `TransitionOutlet` wrapper component in `NavbarLayout`. It holds `prevChild` + `currChild` in state, stacked with `position: absolute`. The new `RefugeeRoute` instance lifts a "ready" signal to the outlet via a `useContext` or `useImperativeHandle` hook. The outlet starts the CSS opacity transition only after receiving that signal. MapLibre map initialization is gated behind the "ready" signal — the incoming `RefugeeRoute_map` defers its `new maplibregl.Map()` call until `loading === false`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | 6.30.3 (already installed) | `useLocation`, `useOutlet` hooks for transition orchestration | Already in project; v6.30 has stable viewTransition API |
| styled-components | 6.3.11 (already installed) | CSS opacity/transition wrapper components | Already used for all existing transitions in this codebase |
| React built-ins | React 18.3 (already installed) | `useRef`, `useState`, `useContext`, `useEffect` for transition state | No new dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-transition-group | 4.x | CSSTransition / TransitionGroup for mount/unmount lifecycle | Use if the DIY approach becomes unwieldy; adds ~10KB |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DIY TransitionOutlet | framer-motion AnimatePresence | framer-motion adds ~30KB; AnimatePresence mode="wait" is sequential not simultaneous; overkill for single-component crossfade |
| DIY TransitionOutlet | View Transitions API (viewTransition prop on NavLink) | See note below — rejected for this use case |
| CSS opacity transition | CSS animation keyframes | Transitions are simpler for two-state (in/out) with known duration; keyframes offer no advantage here |

**View Transitions API note (REJECTED):** React Router v6.30 does support `viewTransition` prop on `<Link>` / `navigate()` which wraps navigation in `document.startViewTransition()`. However: (1) The View Transitions API has a documented opacity bug in current Chrome — opacity is subtracted from the animation's opacity and elements may not become visible; (2) `startViewTransition` does not wait for async data loading — it fires immediately on navigation click, not when data is ready; (3) the adaptive threshold logic (skip animation if cached) requires programmatic control that the declarative `viewTransition` prop cannot provide. Use the DIY approach.

**Installation:** No new packages needed. All required tools (`react-router-dom`, `styled-components`, React 18) are already installed.

---

## Architecture Patterns

### Recommended Component Structure

```
src/components/router/
├── Router.tsx                    # BrowserRouter + Routes (unchanged)
├── NavbarLayout.tsx              # Extract from Router.tsx; add TransitionOutlet
├── TransitionOutlet.tsx          # NEW: holds prev/curr children stacked
├── TransitionContext.tsx         # NEW: React context for "ready" signal from RefugeeRoute
└── config/routeRegistry.tsx      # Unchanged
```

```
src/components/
├── RefugeeRoute.tsx              # MODIFIED: reads TransitionContext, signals ready
└── RefugeeRoute_map.tsx          # MODIFIED: defers map init until signaled ready
```

### Pattern 1: DIY TransitionOutlet with useOutlet + location key

React Router v6's `useOutlet()` returns the current outlet element. By storing the previous outlet snapshot in a ref and rendering it alongside the new outlet (both stacked with `position: absolute`), we keep the old route visible during the transition period.

```tsx
// Source: DIY pattern from https://dev.to/fazliddin04/react-router-v6-animated-transitions-diy-3e6l
// Adapted for simultaneous crossfade (not sequential)

import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';

type TransitionState = 'idle' | 'loading' | 'transitioning';

const TransitionOutlet: React.FC = () => {
  const location = useLocation();
  const currentOutlet = useOutlet();
  const [state, setState] = useState<TransitionState>('idle');
  const prevOutletRef = useRef<React.ReactElement | null>(null);
  const [prevOutlet, setPrevOutlet] = useState<React.ReactElement | null>(null);
  const [currOutlet, setCurrOutlet] = useState<React.ReactElement | null>(currentOutlet);

  // On location change: stash old outlet, begin loading phase
  useEffect(() => {
    if (state === 'idle') return;
    // triggered from TransitionContext when incoming route signals ready
  }, [location.pathname]);

  // ... (full implementation in Plan 01)
};
```

**Key insight:** The `location` prop passed to `<Routes>` can be frozen at the previous value, keeping the old `<Route>` rendered while the new URL is already set. This is the same trick that powers react-transition-group's Router integration.

### Pattern 2: TransitionContext for "ready" signal

The incoming `RefugeeRoute` needs to signal the `TransitionOutlet` when data has loaded and it is ready to show. A React context provides a clean bidirectional channel.

```tsx
// src/components/router/TransitionContext.tsx
import React, { createContext, useContext, useRef } from 'react';

interface TransitionContextValue {
  signalReady: (loadDurationMs: number) => void;  // called by RefugeeRoute when data loaded
  onReady: (cb: (loadDurationMs: number) => void) => void;  // subscribed by TransitionOutlet
}

export const TransitionContext = createContext<TransitionContextValue | null>(null);
export const useTransitionSignal = () => useContext(TransitionContext)!;
```

### Pattern 3: Adaptive threshold via Promise.race + timestamp

The 100ms threshold distinguishes cache hits from cache misses. The correct implementation uses a timestamp, not a timer race:

```tsx
// Inside RefugeeRoute.tsx fetchRefugeeRoutes:
const startTime = performance.now();

Promise.all([deathPromise, get_routeIBC()])
  .then(([d, _d]) => {
    const loadDurationMs = performance.now() - startTime;
    setLoading(false);
    // ...existing data setup...
    signalReady(loadDurationMs);  // TransitionContext call
  });
```

The `TransitionOutlet` checks `loadDurationMs < 100` to decide: instant switch or animate.

### Pattern 4: MapLibre init gating

The incoming `RefugeeRoute_map` must not create a `new maplibregl.Map()` until its container is actually the visible layer. This avoids having two concurrent WebGL contexts during the 400ms overlap.

```tsx
// RefugeeRoute_map.tsx — gate map init
const isActive = useTransitionReady();  // false until TransitionOutlet switches active layer

useEffect(() => {
  if (!isActive || !containerRef.current) return;
  mapRef.current = new maplibregl.Map({ ... });
  return () => { mapRef.current?.remove(); mapRef.current = null; };
}, [isActive]);  // only runs when isActive flips true
```

**Alternative if gating is complex:** Let the incoming map initialize normally but with `visibility: hidden` on the wrapping div (CSS `visibility: hidden` stops rendering but the map still initializes). This trades one concurrent WebGL context for map-ready-on-reveal. Acceptable since total active maps at any moment = 2 (well within the 8-map warning threshold, far below the 16-context browser limit).

### Stacking Layout for Crossfade

```tsx
// Position wrappers so old and new routes overlap exactly
const TransitionWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;

const RouteLayer = styled.div<{ $opacity: number; $isOld: boolean }>`
  position: ${props => props.$isOld ? 'absolute' : 'relative'};
  top: 0;
  left: 0;
  width: 100%;
  opacity: ${props => props.$opacity};
  transition: opacity 400ms ease-in-out;
  will-change: opacity;
  pointer-events: ${props => props.$isOld ? 'none' : 'auto'};
`;
```

**Critical:** The old (outgoing) layer must have `pointer-events: none` during and after the transition — without this, the fading-out route captures click events on the museum display, which would confuse visitors.

### Anti-Patterns to Avoid

- **Wrapping `<Routes>` with animation state:** `<Routes>` expects to be the top-level controller of route matching; wrapping it breaks `useOutlet` and `useMatch` child hooks.
- **Keeping old route's MapLibre map alive during crossfade:** The old route IS fading out with its full map; if its map's `remove()` is called immediately on location change (before fade completes), the canvas goes blank during the animation. Call `map.remove()` only after fade-out completes (`onTransitionEnd`).
- **`opacity` in View Transitions API:** Documented Chrome bug where opacity is subtracted from animation opacity. Do not use the native View Transitions API for this feature.
- **Using `visibility: hidden` on the OLD layer:** Use `opacity: 0` + `pointer-events: none` not `visibility: hidden` — visibility:hidden causes a layout reflow and the old map canvas collapses immediately.
- **Querying `.canvas_overlay` by class name in double-render:** `RefugeeRoute_map` uses `document.querySelector('.canvas_overlay')` to get the canvas context. With two instances mounted simultaneously, this selector returns the first match (the old map's canvas). The incoming map must use `containerRef.current.querySelector('.canvas_overlay')` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS opacity transition timing | Custom requestAnimationFrame loop | CSS `transition: opacity 400ms ease-in-out` | CSS transitions are GPU-composited, zero JS thread involvement |
| Detecting transition end | setTimeout(400) | `onTransitionEnd` DOM event | setTimeout can drift; onTransitionEnd fires exactly when CSS transition completes |
| Keeping old component alive during navigation | React portals or DOM cloning | `useOutlet()` snapshot stored in state | Portals cannot render inside the React router context tree; state ref is idiomatic |
| Loading time threshold | Promise.race with setTimeout | `performance.now()` timestamp delta | Race approach requires two competing async tasks; timestamp is simpler and accurate |

**Key insight:** CSS transitions (`opacity 400ms ease-in-out`) run entirely on the compositor thread — zero JS frame budget consumed during the animation. This matters on the museum exhibit's display hardware.

---

## Common Pitfalls

### Pitfall 1: MapLibre document.querySelector('.canvas_overlay') collision

**What goes wrong:** `RefugeeRoute_map` appends a `<canvas class="canvas_overlay">` inside the MapLibre canvas container, then queries it with `document.querySelector('.canvas_overlay')`. When two `RefugeeRoute_map` instances exist simultaneously (old fading out, new fading in), `querySelector` returns the first match in DOM order — the old instance's canvas — so the new map draws on the wrong canvas.

**Why it happens:** The selector is document-global, not scoped to the component's container.

**How to avoid:** Change to `containerRef.current!.querySelector('.canvas_overlay')` in the new map instance. This is a required code change in the plan.

**Warning signs:** The new route's map renders visually correct but click interactions on data points do nothing; the old route's D3 canvas continues to update after mount.

### Pitfall 2: Old map's cleanup runs before fade-out completes

**What goes wrong:** React Router unmounts the old `<Route>` synchronously on URL change. `RefugeeRoute_map`'s `useEffect` cleanup (`map.remove()`) runs immediately, destroying the MapLibre canvas. The old route layer goes blank during its fade-out animation.

**Why it happens:** The `useEffect` cleanup in `RefugeeRoute_map` depends on when React unmounts the component, which is normally immediate.

**How to avoid:** The `TransitionOutlet` must keep the old route's React tree **mounted** for the full fade duration. The outgoing `RouteLayer` div must stay in the DOM with the old outlet's React element until `onTransitionEnd` fires on the old layer (opacity 0). Only then switch the prevOutlet state to null (triggering React unmount and map cleanup).

**Warning signs:** Old route's map goes solid dark color (blank) immediately when navigating away, then fades out as a black box.

### Pitfall 3: TransitionOutlet keeps re-running on same-route navigation

**What goes wrong:** The Navbar's route links use `<Link to="/route/EasternMediterranean">`. If the user clicks the same route they are already on, `useLocation` key changes (React Router always changes the key on Link click), triggering the transition machinery even though the destination is the same component with the same data already loaded.

**Why it happens:** `useLocation().key` changes on every navigation, even same-path navigations.

**How to avoid:** Check `location.pathname` not `location.key`. If the new pathname === old pathname, skip the crossfade entirely.

**Warning signs:** Visible flash/transition when clicking the current route link a second time.

### Pitfall 4: Stacked routes causing double scroll overflow

**What goes wrong:** During the transition, two full-height (`height: 100vh`) route layers are absolutely positioned. The `TransitionWrapper` parent may collapse to zero height (absolute children don't contribute to flow height), causing the Navbar to float over nothing.

**Why it happens:** `position: absolute` removes elements from normal flow.

**How to avoid:** The `TransitionWrapper` must set `position: relative; height: 100vh; overflow: hidden` so it is a positioned containing block for the absolute children and maintains its own height.

**Warning signs:** Navbar collapses to top of viewport, or a scroll bar appears mid-transition.

### Pitfall 5: signalReady called before React state updates flush

**What goes wrong:** `signalReady(loadDurationMs)` is called from inside a `.then()` handler in `fetchRefugeeRoutes`, before `setLoading(false)` has caused a re-render. The `TransitionOutlet` receives the signal, starts the crossfade, but the new route is still rendering the loading spinner (ScaleLoader) for one frame.

**Why it happens:** React batches state updates; `setLoading(false)` and `signalReady()` happen in the same microtask.

**How to avoid:** Call `signalReady()` inside a `useEffect` that depends on `loading === false`:

```tsx
useEffect(() => {
  if (!loading && signalReadyRef.current) {
    signalReadyRef.current(loadDurationMsRef.current);
    signalReadyRef.current = null;
  }
}, [loading]);
```

**Warning signs:** One-frame flash of ScaleLoader visible at the start of the new route during crossfade.

---

## Code Examples

Verified patterns from project source and official documentation:

### Existing About.tsx fade-in pattern (reference for timing)
```tsx
// Source: src/components/about/About.tsx
const Wrapper = styled.div<{ animate: boolean }>`
  transition: all 400ms;
  opacity: ${props => (props.animate ? 1 : 0)};
`;

useEffect(() => {
  const timer = window.setTimeout(() => setAnimate(true), 300);
  return () => clearTimeout(timer);
}, []);
```

### Existing RefugeeRoute_textArea slideout (reference for transition syntax)
```tsx
// Source: src/components/RefugeeRoute_textArea.tsx
const Wrapper = styled.div<{ $toggle?: boolean }>`
  transition: transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1), background 400ms ease;
  will-change: transform;
`;
```

### React Router v6 useOutlet snapshot pattern
```tsx
// Source: https://dev.to/fazliddin04/react-router-v6-animated-transitions-diy-3e6l
// Pattern: pass frozen location to <Routes> to keep old route rendered

import { useLocation, useOutlet } from 'react-router-dom';

const AnimatedOutlet: React.FC = () => {
  const location = useLocation();
  const element = useOutlet();
  // Store element in state so it doesn't change immediately on navigation
  const [currentElement, setCurrentElement] = useState(element);
  // ... transition logic
};
```

### MapLibre cleanup (existing pattern, must be preserved)
```tsx
// Source: src/components/RefugeeRoute_map.tsx
return () => {
  if (mapRef.current) {
    mapRef.current.remove();
    mapRef.current = null;
  }
};
```

### Canvas overlay querySelector scope fix
```tsx
// CURRENT (buggy when two instances exist):
const canvasEl = document.querySelector('.canvas_overlay') as HTMLCanvasElement | null;

// FIXED (scoped to this component's container):
const canvasEl = containerRef.current?.querySelector('.canvas_overlay') as HTMLCanvasElement | null;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v5 `<Switch location={frozenLoc}>` | React Router v6 `useOutlet()` snapshot in state | v6.0 (2021) | No location prop on Routes; outlet must be stored in React state |
| framer-motion AnimatePresence (dominant 2021-2023) | DIY useOutlet + CSS transitions | 2023-2024 | DIY is lighter; framer-motion mode="wait" is sequential not simultaneous |
| View Transitions API (Chrome 111+, 2023) | Available but has opacity bug | 2023-present | Not suitable for opacity-based crossfades until bug fixed |
| `document.startViewTransition()` manual | React Router `viewTransition` prop | v6.29 (2024) | Declarative; but cannot wait for async data load — not suitable here |

**Deprecated/outdated:**
- `<AnimatedSwitch>` from react-router-transition: abandoned, not compatible with RR v6
- `withRouter` HOC for transition access: removed in RR v6, replaced by hooks

---

## Open Questions

1. **Long-load indicator (>1s loads)**
   - What we know: The 400ms crossfade hides normal first-load (typically 200-600ms). Some routes could take 1-2s on slow connections.
   - What's unclear: Whether a subtle progress indicator (thin top bar or pulsing old route) is needed, or whether keeping the old route visible is sufficient feedback.
   - Recommendation: Claude's discretion — start with pure crossfade (no extra indicator). The old route remains fully visible and interactive during the load, which is better UX than a spinner. Add a subtle indicator in a follow-up if testing reveals confusion.

2. **Stale old-route interactivity during load**
   - What we know: The old route's map remains functional (pan, click data points) while the new route loads behind it.
   - What's unclear: Whether this is confusing (user clicks a data point on old route while new route is loading) or acceptable.
   - Recommendation: Apply `pointer-events: none` to the old layer as soon as the transition starts (not when it finishes), so the old route is visually present but non-interactive during the load phase.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + react-test-renderer 18 (jsdom) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- --testPathPattern=tests/client` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs in REQUIREMENTS.md (it is a UX/quality-of-life feature). The following behaviors should be verified:

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| TransitionOutlet renders current outlet normally (no navigation) | unit | Test that outlet content appears unchanged when location is stable |
| Crossfade triggers when loadDurationMs > 100 | unit | Mock signalReady with 150ms; assert both layers stacked briefly |
| Instant switch when loadDurationMs < 100 | unit | Mock signalReady with 50ms; assert no animation class applied |
| Old route unmounts after onTransitionEnd | unit | Simulate transitionend event; assert prevOutlet is null |
| querySelector scoped to container (regression) | unit | Assert two RefugeeRoute_map mounts don't share canvas |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=tests/client`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/client/TransitionOutlet.test.tsx` — covers outlet render + crossfade trigger logic
- [ ] `tests/client/useTransitionSignal.test.tsx` — covers context signalReady/onReady contract

*(No framework install needed — Jest + jsdom already configured)*

---

## Sources

### Primary (HIGH confidence)
- Source code: `src/components/router/Router.tsx` — NavbarLayout structure confirmed
- Source code: `src/components/RefugeeRoute.tsx` — hybrid loading pattern, loading state, `setLoading(false)` location
- Source code: `src/utils/api.ts` — module-level promise cache, cache hit means near-instant resolution
- Source code: `src/components/RefugeeRoute_map.tsx` — MapLibre init in useEffect, `map.remove()` cleanup, `document.querySelector('.canvas_overlay')` bug
- Source code: `src/components/about/About.tsx` — 400ms ease timing reference
- `package.json` — react-router-dom 6.30.3 confirmed installed; no animation library present

### Secondary (MEDIUM confidence)
- [React Router v6 View Transitions docs (v6.30.3)](https://reactrouter.com/6.30.3/hooks/use-view-transition-state) — viewTransition prop confirmed; opacity bug not in RR docs but confirmed via Chrome docs
- [Chrome View Transitions docs — opacity caveat](https://developer.chrome.com/docs/web-platform/view-transitions/same-document) — mix-blend-mode: plus-lighter used for crossfade; opacity subtraction bug is a documented issue
- [MapLibre WebGL context discussion](https://github.com/maplibre/maplibre-gl-js/discussions/3065) — 8-map warning threshold, 16-context Chromium limit confirmed via community gist

### Tertiary (LOW confidence)
- [DIY animated transitions DEV post](https://dev.to/fazliddin04/react-router-v6-animated-transitions-diy-3e6l) — useOutlet snapshot pattern confirmed as working by multiple community sources; not official RR docs
- [React Router discussion #8604](https://github.com/remix-run/react-router/discussions/8604) — confirms RR team does not provide first-class exit animation; DIY is recommended approach

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json; no new installs needed
- Architecture: HIGH — code paths traced through actual source files; patterns validated against existing codebase
- MapLibre pitfall: HIGH — WebGL context limit confirmed; canvas_overlay querySelector bug identified from reading actual source
- View Transitions rejection: HIGH — opacity bug confirmed in Chrome docs; async-data-wait limitation is fundamental
- Pitfalls: MEDIUM — most derived from reading code + community patterns; full manifestation depends on implementation order

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (90 days — React Router v6.30 stable, no API churn expected; MapLibre WebGL behavior is stable)
