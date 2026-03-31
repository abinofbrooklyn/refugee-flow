# Phase 6: React Router v6 Migration - Research

**Researched:** 2026-03-20
**Domain:** React Router v4→v5→v6 migration, HOC patterns for class components, layout routes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Migration Strategy:** Two-step migration — v4→v5 first (minimal changes), then v5→v6 using compatibility layer. Each step is independently testable. App works at every intermediate state.
- **Route Registry Pattern:** Keep centralized `routeRegistry.jsx` pattern, adapted for v6. Rewrite registry entries to use `element` prop instead of `component`/`render`/`children`. The `isExclusive` flag concept maps to v6 layout routes. Landing page: create a `LandingResolver` component that encapsulates MobileDetect logic, used as `element: <LandingResolver/>`.
- **Navbar / Layout Routes:** Use v6 layout route pattern for Navbar. Parent route renders Navbar + `<Outlet/>` for all paths except `/landing`. Replaces current "inclusive route" pattern. Navbar conditionally excluded from `/landing` via route nesting, not pathname checking.
- **Class Component Handling:** Wrapper HOCs only — do NOT convert class components to functional. Create a `withRouter6()` HOC that injects `params`, `navigate`, and `location` as props. All 19 router-using components get the same three props injected. Components continue to use `this.props.params.arg`, `this.props.navigate(...)`, etc.
- **Navigation Cleanup:** Convert `window.open('/route/...', '_self')` calls to `navigate('/route/...')` from injected props. External links stay as `window.open(url, '_blank')`.
- **Default Route:** Keep `/landing` as the default route. v6: Replace `<Redirect to="/landing"/>` with `<Navigate to="/landing" replace/>`.
- **Route Matching:** Audit sub-path usage before setting matching strategy. v6 routes are exact by default. Routes with `exact: false` in current config (conflict, route/:arg, admin) need auditing.

### Claude's Discretion
- Exact HOC implementation details (function signature, prop naming)
- Whether to keep lodash `compact` usage in Router.jsx or simplify
- Order of file migration during the v5→v6 step
- Test strategy for verifying each route works after migration

### Deferred Ideas (OUT OF SCOPE)
- Converting class components to functional with hooks — future phase
- react-router v7 — not in scope, v6 is the target
- Code-splitting with React.lazy() on routes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOD-05 | React Router upgraded to v6 with zero legacy context API warnings | The `childContextTypes` warning comes from v4/v5 internal use of React's legacy context API. v6 uses React.createContext() internally — upgrading eliminates this warning entirely. Research confirms the `withRouter6` HOC pattern and layout route pattern needed to make this work with the all-class-component codebase. |
</phase_requirements>

---

## Summary

React Router v4 to v5 is a zero-code-change upgrade — both versions share the same API (Switch, Route, Redirect, component/render/children props, match/history/location injection). The v5 version bump existed solely to fix internal dependency pinning. This means Step 1 of the migration is purely a package version change.

React Router v5 to v6 is a significant API overhaul: `Switch` → `Routes`, `component`/`render` → `element`, `Redirect` → `Navigate`, `withRouter` removed, `history` → `useNavigate`, `match.params` → `useParams`. All of these are hook-based, which cannot be used directly in class components. The solution is a single `withRouter6` HOC that calls the hooks internally and injects `params`, `navigate`, and `location` as props — officially documented in the React Router v6 FAQ.

A critical pre-existing bug must be resolved: `RefugeeRoute_titleGroup.jsx` contains a `<BrowserRouter>` (`<Router>`) wrapping `<Link>` components. React Router v6 throws a hard error "You cannot render a Router inside another Router" — this is a crash, not a warning. This must be fixed before or during the v6 upgrade. The Link components inside `RefugeeRoute_titleGroup` are already inside the top-level BrowserRouter; the inner Router is redundant and should be removed outright.

**Primary recommendation:** Install react-router-dom@5 (zero code changes), verify app works, then upgrade to react-router-dom@6 with the withRouter6 HOC, layout route for Navbar, and the Router.jsx/routeRegistry.jsx rewrite.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | 6.30.3 | Client-side routing | Latest stable v6; peer deps are react >=16.8, react-dom >=16.8; project uses React 18 which satisfies this |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router-dom@5 | 5.3.4 | Bridge version for Step 1 | Install temporarily to confirm zero-change upgrade from v4 before making the larger v6 jump |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two-step v4→v5→v6 | Direct v4→v6 | Direct jump skips the safe verification step; the v5 compat layer `react-router-dom-v5-compat` requires v5 as a baseline anyway |
| Custom withRouter6 HOC | react-router-dom-v5-compat package | Compat package adds complexity and is designed for large codebases doing incremental migration; this app has 19 files and a single HOC is simpler |

**Version verification:**
```bash
npm view react-router-dom version       # 7.x latest
npm view react-router-dom@6 version     # 6.30.3 as of 2026-03-20
npm view react-router-dom@5 version     # 5.3.4
```

**Installation (Step 1 — v4→v5):**
```bash
npm install react-router-dom@5 --legacy-peer-deps
```

**Installation (Step 2 — v5→v6):**
```bash
npm install react-router-dom@6 --legacy-peer-deps
```

Note: `--legacy-peer-deps` is required because this project has a pre-existing eslint-config-airbnb peer conflict (documented in Phase 2 decisions).

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
src/
├── components/
│   └── router/
│       ├── Router.jsx                    # rewrite: BrowserRouter+Routes, layout route
│       ├── withRouter6.jsx               # NEW: HOC that injects params/navigate/location
│       ├── LandingResolver.jsx           # NEW: MobileDetect logic extracted from registry
│       └── config/
│           └── routeRegistry.jsx         # rewrite: element prop instead of component/render
```

### Pattern 1: withRouter6 HOC (Official React Router v6 FAQ pattern)
**What:** A functional component wrapper that calls v6 hooks and passes results as props to the class component.
**When to use:** Every class component that reads `this.props.match`, `this.props.history`, or `this.props.location`.
**Example:**
```javascript
// src/components/router/withRouter6.jsx
// Source: https://reactrouter.com/en/main/start/faq (official FAQ)
import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

function withRouter6(Component) {
  function ComponentWithRouterProp(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    return (
      <Component
        {...props}
        navigate={navigate}
        location={location}
        params={params}
      />
    );
  }
  ComponentWithRouterProp.displayName = `withRouter6(${Component.displayName || Component.name})`;
  return ComponentWithRouterProp;
}

export default withRouter6;
```

**Usage with Redux connect (HOC stacking order):**
```javascript
// withRouter6 must be the OUTERMOST wrapper so it has router context
// connect() can be inside or outside — either works, but outer-withRouter6 is conventional
import { connect } from 'react-redux';
import withRouter6 from '../router/withRouter6';

class MyComponent extends React.Component {
  // use this.props.params, this.props.navigate, this.props.location
}

const mapStateToProps = state => ({ ... });
export default withRouter6(connect(mapStateToProps)(MyComponent));
```

**Prop name convention in components after migration:**
- Old: `this.props.match.params.arg` → New: `this.props.params.arg`
- Old: `this.props.history.push('/path')` → New: `this.props.navigate('/path')`
- Old: `this.props.location` → New: `this.props.location` (same name, same shape)

### Pattern 2: Layout Route for Navbar (v6 Outlet pattern)
**What:** A parent Route with no path (or path="/") renders a layout component that includes `<Outlet/>`. All routes nested inside it share the layout. Routes outside skip the layout.
**When to use:** Any shared persistent UI (Navbar, footer) that should appear on some pages but not all.
**Example:**
```javascript
// Source: https://blog.webdevsimplified.com/2022-07/react-router/ (verified with official docs)
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Navbar from '../Navbar';

// Layout component — renders Navbar above current page content
function NavbarLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

const Router = () => (
  <BrowserRouter>
    <Routes>
      {/* Routes that show Navbar */}
      <Route element={<NavbarLayout />}>
        <Route path="/conflict" element={<Conflict />} />
        <Route path="/route/:arg" element={<RefugeeRouteWithRouter />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      {/* Routes without Navbar */}
      <Route path="/landing" element={<LandingResolver />} />
      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  </BrowserRouter>
);
```

### Pattern 3: routeRegistry.jsx — v6 element prop format
**What:** Registry entries use `element` (a React element) instead of `component`, `render`, or `children` props.
**Example:**
```javascript
// v4/v5 format (current):
{
  isExclusive: true,
  component: Conflict,
  path: '/conflict',
  exact: false,
}

// v6 format:
{
  path: '/conflict',
  element: <Conflict />,
}
```

Note: The `isExclusive` flag and `children` callback (for Navbar conditional rendering) are no longer needed in v6 — the layout route pattern handles this structurally.

### Pattern 4: LandingResolver component
**What:** Extracts the MobileDetect logic from the routeRegistry into a simple component used as the route element.
**Example:**
```javascript
// src/components/router/LandingResolver.jsx
import React from 'react';
import MobileDetect from 'mobile-detect';
import DesktopLanding from '../landing/DesktopLanding';
import MobileLanding from '../landing/MobileLanding';

function LandingResolver() {
  const isMobile = new MobileDetect(window.navigator.userAgent).mobile() !== null;
  return isMobile ? <MobileLanding /> : <DesktopLanding />;
}

export default LandingResolver;
```

### Pattern 5: Navigate for default catch-all redirect
```javascript
// v4/v5 (inside Switch):
<Redirect to="/landing" />

// v6 (inside Routes, path="*"):
<Route path="*" element={<Navigate to="/landing" replace />} />
```
Note: `replace` is needed to match v4/v5 `<Redirect>` behavior (which uses replace by default). Without `replace`, `<Navigate>` does a push, which adds an entry to the history stack — undesirable for a catch-all.

### Anti-Patterns to Avoid
- **Nested BrowserRouter inside a component:** `RefugeeRoute_titleGroup.jsx` has `<Router>` (BrowserRouter) wrapping its `<Link>` components. In v5 this caused warnings. In v6 it throws a hard crash: "You cannot render a Router inside another Router." Remove the inner `<Router>` — Link components work without their own Router when they are already inside the top-level BrowserRouter.
- **Using `component` or `render` props on Route in v6:** These no longer exist. Only `element` works.
- **Omitting `replace` on Navigate catch-all:** Without `replace`, navigating to an unknown URL pushes landing to history twice.
- **Passing `history` prop down to child components:** GlobeContainer and Conflict receive `this.props.history`. In v6 there is no `history` prop from the router — it does not exist. withRouter6 injects `navigate` instead. Any code that does `history.push(x)` must use `navigate(x)`.
- **Using `exact` prop on Route in v6:** The `exact` prop is removed — all routes are exact by default. Wildcard sub-path matching requires a trailing `/*`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessing params in class components | Custom context consumer or static contextType | `withRouter6` HOC using `useParams` | useParams is the official API; custom context access would break on React Router internals changes |
| Detecting active route for Navbar highlight | Manual `window.location.pathname` check (already done in Navbar.componentDidMount) | Can keep as-is for now since Navbar doesn't need to be reactive | No router API needed; existing regex checks work fine |
| Excluding Navbar from /landing | Conditional rendering in Navbar checking pathname | v6 layout route nesting | Structural exclusion is more maintainable and doesn't require Navbar to know about routes |
| Navigate function | `window.open(url, '_self')` | `this.props.navigate(url)` from withRouter6 | SPA navigation — no full page reload, preserves React state, important for kiosk exhibit |

**Key insight:** The withRouter6 HOC is the linchpin. Every class component that needs router access gets wrapped once. The HOC is minimal (~15 lines) and follows the official React Router v6 FAQ exactly.

---

## Common Pitfalls

### Pitfall 1: Nested BrowserRouter Hard Crash (HIGH SEVERITY)
**What goes wrong:** `RefugeeRoute_titleGroup.jsx` mounts its own `<BrowserRouter>` to give `<Link>` components context. In v4/v5 this caused warnings. In v6 it throws an uncaught error: "You cannot render a Router inside another Router." The app white-screens.
**Why it happens:** v6 enforces single-router architecture. The inner Router sees that a Router context already exists and throws.
**How to avoid:** Remove the `<Router>` and its surrounding `<div>` wrapper from `RefugeeRoute_titleGroup.jsx`. The `<Link>` components already have access to the top-level BrowserRouter context — they don't need their own Router.
**Warning signs:** White screen on navigation to `/route/:arg`; console error "You cannot render a Router inside another Router".

### Pitfall 2: `this.props.history` is Undefined After v6 Upgrade
**What goes wrong:** `Conflict.jsx` passes `history={this.props.history}` to `GlobeContainer`. `GlobeContainer` stores `this.history = props.history`. In v6, Route-rendered components no longer receive `history` as a prop — only components wrapped with withRouter6 receive `navigate`/`params`/`location`. Components that receive `history` as a forwarded prop will receive `undefined`.
**Why it happens:** v6 removed prop injection entirely — router state is only accessible via hooks or HOC.
**How to avoid:** Wrap `Conflict` with `withRouter6`, then change `history={this.props.history}` to `navigate={this.props.navigate}`. Update `GlobeContainer` and `GlobeRouteButton` to use `this.props.navigate` (passed down from Conflict) instead of `this.history`.
**Warning signs:** `window.open('/route/...', '_self')` stops working silently (since GlobeRouteButton falls back to window.open anyway), or navigate calls throw "this.history is not a function".

### Pitfall 3: `props.match.params.arg` is Undefined
**What goes wrong:** `RefugeeRoute.jsx` accesses `props.match.params.arg` in the constructor and `checkCurrentRouteName`. After v6 upgrade, `match` prop is no longer injected by the router — the component gets `undefined` for `props.match` and the app crashes or shows no route name.
**Why it happens:** v6 removed all prop injection (match, history, location) from Route-rendered components.
**How to avoid:** Wrap `RefugeeRoute` with `withRouter6`. Change `props.match.params.arg` → `props.params.arg` throughout the component.
**Warning signs:** RefugeeRoute component shows blank or default route; constructor throws "Cannot read properties of undefined (reading 'params')".

### Pitfall 4: Route Matching Regression for `/conflict` and `/admin`
**What goes wrong:** Current registry has `exact: false` for `/conflict` and `/admin`. In v4/v5 this means `/conflict/anything` would also match. In v6, all routes are exact by default, but `/conflict` without a trailing `/*` will NOT match `/conflict/anything`. This could be a silent behavior change or could break sub-path navigation.
**Why it happens:** v6 changed the default from "prefix matching" to "exact matching".
**How to avoid:** Audit whether `/conflict/something`, `/admin/upload`, etc. are used before migrating. If no sub-paths exist, exact-by-default is correct and no action needed. If sub-paths exist, add `/*` to the path: `path="/admin/*"`.
**Warning signs:** Routes that previously matched on partial paths now return 404 / redirect to `/landing`.

### Pitfall 5: `<Route children>` Callback Pattern Silently Dropped
**What goes wrong:** The Navbar entry in `routeRegistry.jsx` uses the `children` callback pattern: `children: ({ location }) => location.pathname !== '/landing' && <Navbar />`. In v6, the `children` prop on `<Route>` is for nested route elements, not a render callback. Passing a function as `children` will be ignored or throw.
**Why it happens:** v6 removed all three v4/v5 render patterns (component, render, children function) in favor of the single `element` prop.
**How to avoid:** The entire Navbar row in routeRegistry should be deleted. Navbar is handled structurally via the layout route.
**Warning signs:** Navbar fails to render; or if `children` is accidentally passed through to a `<Route>`, React throws "children is not a function" at runtime.

### Pitfall 6: `--legacy-peer-deps` Required
**What goes wrong:** This project has a pre-existing peer dependency conflict with `eslint-config-airbnb`. Running `npm install react-router-dom@6` without `--legacy-peer-deps` will fail with ERESOLVE errors.
**Why it happens:** Documented in Phase 2 decisions: all npm installs and uninstalls require `--legacy-peer-deps` in this project.
**How to avoid:** Always use `npm install react-router-dom@X --legacy-peer-deps`.

### Pitfall 7: RefugeeRoute_titleGroup Imports Unused Router Symbols
**What goes wrong:** `RefugeeRoute_titleGroup.jsx` imports `{ BrowserRouter as Router, Route, Switch, Redirect, Link }` from `react-router-dom`. In v6, `Switch` and `Redirect` are not exported — this will cause a module import error or runtime crash.
**Why it happens:** v6 removed these exports (`Switch`, `Redirect`). `Route` and `BrowserRouter` still exist but shouldn't be used as nested routers.
**How to avoid:** Replace the import line with just `import { Link } from 'react-router-dom'`. Remove the `<Router>` wrapper and its contents (keeping only the Links).

---

## Code Examples

Verified patterns from official sources:

### withRouter6 HOC (Complete Implementation)
```javascript
// src/components/router/withRouter6.jsx
// Source: https://reactrouter.com/en/main/start/faq
import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

function withRouter6(Component) {
  function ComponentWithRouterProp(props) {
    const navigate = useNavigate();
    const location = useLocation();
    const params = useParams();
    return (
      <Component
        {...props}
        navigate={navigate}
        location={location}
        params={params}
      />
    );
  }
  ComponentWithRouterProp.displayName =
    `withRouter6(${Component.displayName || Component.name || 'Component'})`;
  return ComponentWithRouterProp;
}

export default withRouter6;
```

### Router.jsx Complete v6 Rewrite
```javascript
// src/components/router/Router.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';

import Navbar from '../Navbar';
import LandingResolver from './LandingResolver';
import ConflictWithRouter from '../Conflict';      // wrapped with withRouter6 elsewhere
import RefugeeRouteWithRouter from '../RefugeeRoute'; // wrapped with withRouter6
import About from '../about/About';
import AdminPage from '../Admin/AdminPage';

function NavbarLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}

const Router = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<NavbarLayout />}>
        <Route path="/conflict" element={<ConflictWithRouter />} />
        <Route path="/route/:arg" element={<RefugeeRouteWithRouter />} />
        <Route path="/about" element={<About />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/landing" element={<LandingResolver />} />
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  </BrowserRouter>
);

export default Router;
```

### RefugeeRoute.jsx — Applying withRouter6
```javascript
// At bottom of src/components/RefugeeRoute.jsx
import withRouter6 from './router/withRouter6';

// class RefugeeRoute extends React.Component { ... }
// Inside constructor: was props.match.params.arg → now props.params.arg
// Inside checkCurrentRouteName: was this.props.match.params.arg → this.props.params.arg

export default withRouter6(RefugeeRoute);
```

### GlobeRouteButton.jsx — window.open → navigate
```javascript
// Before:
onClick={() => window.open('/route/' + d.replace(/[^a-zA-Z0-9]/g, ''), '_self')}

// After (navigate prop passed down from Conflict → GlobeContainer → GlobeRouteButton):
onClick={() => this.props.navigate('/route/' + d.replace(/[^a-zA-Z0-9]/g, ''))}
```

### RefugeeRoute_titleGroup.jsx — Remove nested Router
```javascript
// Before (causes hard crash in v6):
import { BrowserRouter as Router, Route, Switch, Redirect, Link } from 'react-router-dom'
// ...
<Router>
  <div>
    <Button_previous ...>
      <Link to={"/route/" + this.handleRouting('previous')}>...</Link>
    </Button_previous>
    <Button_next ...>
      <Link to={"/route/" + this.handleRouting('next')}>...</Link>
    </Button_next>
  </div>
</Router>

// After:
import { Link } from 'react-router-dom'
// ...
<>
  <Button_previous ...>
    <Link to={"/route/" + this.handleRouting('previous')}>...</Link>
  </Button_previous>
  <Button_next ...>
    <Link to={"/route/" + this.handleRouting('next')}>...</Link>
  </Button_next>
</>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Switch>` with ordered route matching | `<Routes>` with best-match algorithm | v6 (2021) | Routes no longer need to be ordered; best match wins |
| `component`/`render`/`children` on Route | `element` prop with a React element | v6 (2021) | Simpler API; props passed explicitly not via route injection |
| `withRouter` HOC (built-in) | Custom HOC using hooks | v6 (2021) | Must build it yourself; official FAQ provides the pattern |
| `history.push()` | `navigate()` from useNavigate | v6 (2021) | Same semantics; `navigate(-1)` replaces `history.goBack()` |
| `<Redirect>` (replace by default) | `<Navigate replace>` (push by default) | v6 (2021) | Must add `replace` prop to preserve v5 behavior |
| Routes exact-opt-in (loose by default) | Routes exact by default | v6 (2021) | `exact` prop removed; add `/*` for sub-path matching |
| `match.params` prop injection | `useParams()` hook | v6 (2021) | No more implicit prop injection from Route |
| `<Route children={fn}>` render callback | Layout routes with `<Outlet>` | v6 (2021) | Structural nesting replaces conditional render callbacks |

**Deprecated/outdated:**
- `Switch`: Removed in v6 — use `Routes`
- `Redirect`: Removed in v6 — use `Navigate`
- `withRouter`: Removed in v6 — build your own from hooks (see Code Examples)
- `component`, `render`, `children` function props on Route: Removed in v6 — use `element`
- `exact` prop on Route: Removed in v6 — now default behavior
- `useHistory()`: Removed in v6 — use `useNavigate()`
- `useRouteMatch()`: Removed in v6 — use `useMatch()`
- `history` prop on Route-rendered components: Removed in v6 — no more prop injection

---

## Open Questions

1. **Does `/admin` have any sub-paths in the Express server that the frontend navigates to?**
   - What we know: `routeRegistry.jsx` has `exact: false` for `/admin`. AdminPage uses auth-gated state — no visible sub-routes in the frontend component code.
   - What's unclear: Whether server-side rendering or Express routing creates any `/admin/something` navigable URLs.
   - Recommendation: Assume no sub-paths (AdminPage is self-contained). Use `path="/admin"` without `/*`. If a 404 occurs on admin sub-routes after migration, add `path="/admin/*"`.

2. **Does DesktopLanding need withRouter6?**
   - What we know: `DesktopLanding.jsx` imports `{ Link }` from react-router-dom and has one `<Link to="/">`. It does not use `match`, `history`, or `location`.
   - What's unclear: Whether it receives any router props indirectly.
   - Recommendation: Do NOT wrap with withRouter6 — `<Link>` works fine without it. Only wrap components that read `this.props.match`, `this.props.history`, or `this.props.location`.

3. **HOC stacking order for GlobeContainer (withRouter6 + no Redux connect)**
   - What we know: GlobeContainer uses `props.history` (passed from Conflict, not from router). It does not use Redux connect.
   - What's unclear: Whether GlobeContainer needs its own withRouter6 wrap, or whether navigate should be threaded via props from the already-wrapped Conflict.
   - Recommendation: Thread `navigate` prop from Conflict → GlobeContainer → GlobeRouteButton (as a prop, not via withRouter6). Only wrap at the point where the router context boundary is needed. GlobeContainer does not need to be a Route element directly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 (server tests only; no frontend test infrastructure) |
| Config file | package.json `"test": "jest"` — currently runs `tests/server/` only |
| Quick run command | `npm test` (server tests, ~5s) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOD-05 | Zero `childContextTypes` warnings in browser console | manual-smoke | Manual: open browser, check console on all routes | N/A — browser console check |
| MOD-05 | All routes navigate correctly: `/`, `/landing`, `/conflict`, `/route/EasternMediterranean`, `/about`, `/admin` | manual-smoke | Manual: click each nav link, verify page renders | N/A |
| MOD-05 | No "You cannot render a Router inside another Router" error | manual-smoke | Manual: navigate to `/route/:arg` page, check console | N/A |
| MOD-05 | withRouter6 HOC injects params/navigate/location | unit | ❌ Wave 0 — `tests/frontend/withRouter6.test.jsx` | ❌ |
| MOD-05 | LandingResolver renders DesktopLanding on non-mobile | unit | ❌ Wave 0 — `tests/frontend/LandingResolver.test.jsx` | ❌ |

### Sampling Rate
- **Per task commit:** `npm test` (server tests must remain green throughout migration)
- **Per wave merge:** `npm test` + manual smoke test of all 6 routes in browser
- **Phase gate:** All routes work + zero console errors before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/frontend/withRouter6.test.jsx` — unit test that withRouter6 injects props — requires jsdom + React Testing Library setup
- [ ] `tests/frontend/LandingResolver.test.jsx` — test MobileDetect branching logic

**Note on frontend testing:** No frontend test infrastructure exists. The project uses Jest but only for server tests. Adding React Testing Library for frontend unit tests is v2 scope (MOD-V2-02). For this phase, validation is manual browser smoke testing. The server tests (`npm test`) must continue to pass as a regression gate.

---

## Complete File Audit: Which Files Need Changes

Based on source code inspection, the exact change needed per file:

| File | Change Needed | Complexity |
|------|--------------|------------|
| `src/components/router/Router.jsx` | Full rewrite: BrowserRouter+Routes+layout route | Medium |
| `src/components/router/config/routeRegistry.jsx` | Full rewrite: element prop, remove Navbar row | Medium |
| `src/components/router/withRouter6.jsx` | NEW file | Low |
| `src/components/router/LandingResolver.jsx` | NEW file | Low |
| `src/components/RefugeeRoute.jsx` | Wrap with withRouter6; change `match.params.arg` → `params.arg` (2 places) | Low |
| `src/components/RefugeeRoute_titleGroup.jsx` | Remove `<Router>` wrapper; remove unused imports (Switch, Redirect, Route, BrowserRouter); keep Link import | Low |
| `src/components/Conflict.jsx` | Wrap with withRouter6; pass `navigate` instead of `history` to GlobeContainer | Low |
| `src/components/globe/GlobeContainer.jsx` | Change `props.history` → `props.navigate`; update `this.history.push` → `this.props.navigate` | Low |
| `src/components/globe/GlobeRouteButton.jsx` | Change `window.open('/route/...', '_self')` → `this.props.navigate('/route/...')` | Low |
| `src/components/landing/DesktopLanding.jsx` | `Link` import stays; no other changes needed | None |
| `src/components/Navbar.jsx` | `Link` import stays; no other changes needed | None |

Files that appeared in the grep but do NOT need changes:
- `RefugeeRoute_textArea_content_basicInfo.jsx` — uses only `window.open(_blank)` (external links, keep as-is)
- `Admin/AdminPage.jsx`, `Admin/CsvUploader.jsx` — no router imports or usage
- All other component files — no react-router-dom imports

---

## Sources

### Primary (HIGH confidence)
- [React Router v6 FAQ — withRouter official replacement](https://reactrouter.com/en/main/start/faq) — withRouter6 HOC pattern
- [React Router v6.30.3 upgrading from v5](https://reactrouter.com/6.30.3/upgrading/v5) — complete API diff, Switch→Routes, component→element, Redirect→Navigate, withRouter removal
- `npm view react-router-dom@6 peerDependencies` — verified: react/react-dom >=16.8; project uses React 18, satisfies requirement
- `npm view react-router-dom@6 version` — verified: 6.30.3 is latest stable v6 as of 2026-03-20
- `npm view react-router-dom@5 peerDependencies` — verified: react >=15 only; project satisfies

### Secondary (MEDIUM confidence)
- [whereisthemouse.com withRouter HOC for v6](https://whereisthemouse.com/how-to-use-withrouter-hoc-in-react-router-v6-with-typescript) — TypeScript version of same HOC pattern; confirms the official FAQ approach is idiomatic
- [reacttraining.com v5 announcement](https://reacttraining.com/blog/react-router-v5) — confirms v4→v5 is zero breaking changes; major bump was dependency pinning only
- [webdevsimplified.com React Router v6 guide](https://blog.webdevsimplified.com/2022-07/react-router/) — layout route pattern with Outlet verified against official docs

### Tertiary (LOW confidence — for awareness)
- [GitHub issue #8146 — v6 class component support](https://github.com/remix-run/react-router/issues/8146) — Michael Jackson (maintainer) confirmed class components are not dropped; HOC pattern is the supported approach
- [GitHub discussion #9989 — nested Router error](https://github.com/remix-run/react-router/discussions/9989) — confirms v6 throws hard error for nested Routers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm registry; peer deps confirmed
- Architecture patterns: HIGH — withRouter6 HOC from official FAQ; layout route from official docs
- Pitfalls: HIGH — nested Router confirmed crash from GitHub issue; `history` prop removal confirmed from official upgrade guide; `match` prop removal confirmed from official docs
- File audit: HIGH — based on direct code inspection of all 40 .jsx files in the project

**Research date:** 2026-03-20
**Valid until:** 2026-09-20 (v6 is stable; no breaking changes expected within major version)
