# Phase 7: Start v2 TypeScript Migration - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the entire JavaScript codebase (frontend + server) to TypeScript with strict typing. All 39 JSX components become functional TSX components with hooks. Redux modernized to useSelector/useDispatch. Server ingestion pipelines, Express routes, and Knex queries all typed. Existing test files converted to TypeScript. Comprehensive regression testing at each conversion layer.

</domain>

<decisions>
## Implementation Decisions

### Migration scope
- Full stack: both `src/` (39 JSX + 12 JS) and `server/` (21 JS files) converted
- Test files (17 existing .test.js) converted to .test.ts
- Vendored THREE.js scripts (`src/THREEJSScript/EffectComposer.js`, `Octree.js`) converted to .ts (not left as .js with declarations)

### Conversion strategy
- Incremental, proper types — each file gets real types, no blanket `any`
- Inside-out order: Redux (actions, reducers, store) → utils/api → data dictionaries → components → server
- Mixed codebase during migration: `allowJs: true` in tsconfig, converted .ts/.tsx files coexist with unconverted .js/.jsx files
- Each plan converts a layer; app works throughout

### TypeScript strictness
- `strict: true` from day one (noImplicitAny, strictNullChecks, strictFunctionTypes, strictPropertyInitialization)
- Hard spots use targeted `@ts-expect-error` with a comment explaining WHY — no blanket `any`, no implicit escape hatches
- @ts-expect-error comments are visible, searchable tech debt

### Class components
- All 39 class components converted to functional components + hooks during the TypeScript migration
- Includes GlobeVisual.jsx (THREE.js scene) — useRef for THREE objects, useEffect for animation loop
- Redux modernized: replace connect() + mapStateToProps with useSelector/useDispatch hooks
- Container/presentational split eliminated — components access store directly via hooks

### Regression testing
- Three-layer regression approach applied after each conversion layer:
  1. **Existing tests + build check**: Run all 17 test suites, `tsc --noEmit`, Vite build must succeed
  2. **Snapshot tests**: Add React Test Renderer snapshot before converting each component; diff after conversion catches regressions
  3. **Manual smoke test**: Formalized checklist run per layer (landing, globe, routes, charts, navigation, API)
- React Test Renderer for snapshots (not Enzyme — unmaintained, React 18 issues)
- Formalized smoke test checklist defined and run after each conversion layer

### Claude's Discretion
- Exact tsconfig.json configuration details (module resolution, target, paths)
- Vite TypeScript plugin configuration
- Type definition organization (separate `types/` directory vs co-located)
- How to structure shared types between frontend and server
- Smoke test checklist items (specific pages/interactions to verify)
- Whether to use Redux Toolkit or keep vanilla Redux with TypeScript

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Core value, constraints, key decisions (especially geo precision, class component preservation decisions being reversed here)
- `.planning/REQUIREMENTS.md` — MOD-V2-01 (TypeScript migration), MOD-V2-02 (RTL tests — future phase, but informs snapshot approach)

### Codebase structure
- `.planning/codebase/STRUCTURE.md` — Full directory layout, file locations, naming conventions
- `.planning/codebase/CONVENTIONS.md` — Current coding patterns (PascalCase JSX, camelCase JS, ESLint airbnb, export patterns)
- `.planning/codebase/STACK.md` — Current versions (React 18, Redux 4, Vite 7, Jest 30, Knex 3, Express 4)
- `.planning/codebase/TESTING.md` — Jest/Enzyme setup, test patterns, current coverage gaps

### Prior phase decisions
- `.planning/phases/02-modernize-stack/02-CONTEXT.md` — UNSAFE_ prefix decision (now being superseded by functional conversion)
- `.planning/phases/06-react-router-v6-migration/06-CONTEXT.md` — withRouter6 HOC (will be replaced by useNavigate/useParams hooks)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/redux/` — Redux store, actions, reducers, constants: first conversion target, types flow to all consumers
- `src/utils/api.js` — Fetch wrappers with caching: types define API response shapes reused across components
- `src/data/routeDictionary.js`, `warDictionary.js` — Static metadata: straightforward to type as const objects
- `server/ingestion/*.js` — 12 ingestion modules with consistent patterns (fetch → normalize → upsert): shared ingestion types
- `server/database/connection.js` — Knex instance: typed queries flow to all server modules

### Established Patterns
- Class components with `this.state` and `this.bind()` — all being converted to useState/useEffect
- connect() HOC with mapStateToProps/mapDispatchToProps — being replaced with useSelector/useDispatch
- Promise-based fetch with `.then()` chains — opportunity to type return values
- CommonJS `module.exports` in server — will become ES module `export` in .ts files
- ESLint airbnb config — will need @typescript-eslint plugin additions

### Integration Points
- `src/components/router/withRouter6.jsx` — HOC eliminated when components use useNavigate/useParams directly
- `src/components/router/routeRegistry.jsx` — Route config will need typed route definitions
- `server/routes/dataRoute.js` — Express route handlers get typed Request/Response
- `jest.config.js` — Needs ts-jest or Vite test transform for .ts/.tsx files
- `vite.config.js` — May need minimal changes (Vite handles TS natively)

</code_context>

<specifics>
## Specific Ideas

- User wants all three regression testing approaches (tests + build, snapshots, manual smoke) — not just one
- GlobeVisual conversion to functional is explicitly desired despite complexity — useRef + useEffect pattern for THREE.js
- "TypeScript first, then RTL tests" (from prior session) — this phase is TS conversion, MOD-V2-02 testing comes after

</specifics>

<deferred>
## Deferred Ideas

- React Testing Library component integration tests (MOD-V2-02) — separate phase after TypeScript migration
- Redux Toolkit migration — could happen during TS conversion but not required
- Country-level data completeness indicator on globe (FEAT-V2-01) — separate feature phase
- Offline support / cached data fallback (FEAT-V2-02) — separate feature phase

</deferred>

---

*Phase: 07-start-v2-typescript-migration*
*Context gathered: 2026-03-21*
