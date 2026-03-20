# Phase 6: React Router v6 Migration - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade react-router-dom from v4.2.2 to v6, eliminating all legacy `childContextTypes` warnings. All routes must navigate correctly. No functional changes to the app — same pages, same behavior, same URL structure.

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- **LOCKED:** Two-step migration: v4→v5 first (minimal changes), then v5→v6 using compatibility layer
- Each step is independently testable — app works at every intermediate state
- Rationale: v4→v6 is too large a jump; v5 is the bridge release that v5-compat assumes as baseline
- 19 files reference router APIs — incremental migration reduces risk for an exhibit app

### Route Registry Pattern
- **LOCKED:** Keep the centralized `routeRegistry.jsx` pattern, adapted for v6
- Rewrite registry entries to use `element` prop instead of `component`/`render`/`children`
- The `isExclusive` flag concept maps to v6 layout routes
- Landing page: create a `LandingResolver` component that encapsulates the MobileDetect logic, used as `element: <LandingResolver/>`

### Navbar / Layout Routes
- **LOCKED:** Use v6 layout route pattern for Navbar
- Parent route renders Navbar + `<Outlet/>` for all paths except `/landing`
- Replaces current "inclusive route" pattern (Route outside Switch)
- Navbar conditionally excluded from `/landing` via route nesting, not pathname checking

### Class Component Handling
- **LOCKED:** Wrapper HOCs only — do NOT convert class components to functional
- Create a `withRouter6()` HOC that injects `params`, `navigate`, and `location` as props
- All 19 router-using components get the same three props injected (no selective injection)
- Matches Phase 2 philosophy: minimal change, preserve working code
- Components continue to use `this.props.params.arg`, `this.props.navigate(...)`, etc.

### Navigation Cleanup
- **LOCKED:** Convert `window.open('/route/...', '_self')` calls to `navigate('/route/...')` from injected props
- Affected files: GlobeRouteButton.jsx, RefugeeRoute_textArea_content_basicInfo.jsx, and any others using window.open for internal navigation
- External links (data sources, donate) stay as `window.open(url, '_blank')`
- Better SPA behavior — no full page reload on route change. Important for exhibit kiosks.

### Default Route
- **LOCKED:** Keep `/landing` as the default route (catch-all redirect)
- v6: Replace `<Redirect to="/landing"/>` with `<Navigate to="/landing" replace/>`

### Route Matching
- **LOCKED:** Audit sub-path usage before setting matching strategy
- v6 routes are exact by default (v4 required `exact` prop for exact matching)
- Routes with `exact: false` in current config (conflict, route/:arg, admin) need auditing
- If sub-paths are used (e.g., /admin/something), add v6 nested routes
- If no sub-paths exist, exact matching is correct and no action needed

### Claude's Discretion
- Exact HOC implementation details (function signature, prop naming)
- Whether to keep lodash `compact` usage in Router.jsx or simplify
- Order of file migration during the v5→v6 step
- Test strategy for verifying each route works after migration

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Router architecture
- `src/components/router/Router.jsx` — Current BrowserRouter/Switch/Route setup with inclusive/exclusive split
- `src/components/router/config/routeRegistry.jsx` — Route config registry with isExclusive flag, component/render/children patterns

### Components using router APIs (audit list)
- `src/components/RefugeeRoute.jsx` — `props.match.params.arg` for route slug resolution
- `src/components/globe/GlobeRouteButton.jsx` — `window.open('/route/...', '_self')` and `this.history`
- `src/components/RefugeeRoute_titleGroup.jsx` — `<Link to={...}>` for route navigation
- `src/components/Navbar.jsx` — `<Link>` components for nav items
- `src/components/landing/DesktopLanding.jsx` — Router context for navigation
- `src/components/Admin/CsvUploader.jsx` — Route-based rendering

### Prior phase decisions
- `.planning/phases/02-modernize-stack/02-CONTEXT.md` — UNSAFE_ prefix philosophy (minimal change over full refactor)

### Project constraints
- `.planning/PROJECT.md` — Core value, out-of-scope items
- `.planning/REQUIREMENTS.md` — MOD-05 requirement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `routeRegistry.jsx` — centralized route definitions, adaptable for v6 element pattern
- `lodash.compact` — used in Router.jsx to filter null entries from registry mapping

### Established Patterns
- All components are class-based — no hooks anywhere in the codebase
- Router props accessed via `this.props.match.params`, `this.props.history`, `<Link>` components
- Some navigation bypasses router entirely via `window.open(url, '_self')`
- Redux `connect()` wraps some components — HOC stacking (connect + withRouter6) needs to work

### Integration Points
- `src/components/router/Router.jsx` — main router mount, entry point for migration
- `src/components/router/config/routeRegistry.jsx` — route definitions, needs element prop adaptation
- Every component in the audit list (19 files) — each needs withRouter6 wrapper where it uses router props

</code_context>

<specifics>
## Specific Ideas

- The exhibit context means the app cannot break between migration steps — each commit must be deployable
- Phase 2's UNSAFE_ approach worked well and should be mirrored here — wrappers over rewrites
- The `window.open` → `navigate` conversion improves kiosk UX (no page reload flash)

</specifics>

<deferred>
## Deferred Ideas

- Converting class components to functional with hooks — future phase (full React modernization)
- react-router v7 (when released) — not in scope, v6 is the target
- Code-splitting with React.lazy() on routes — could be added but not part of this migration

</deferred>

---

*Phase: 06-react-router-v6-migration*
*Context gathered: 2026-03-20*
