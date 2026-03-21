---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 07-10-PLAN.md — Phase 7 TypeScript migration complete, smoke test approved
last_updated: "2026-03-21T23:00:08.818Z"
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 37
  completed_plans: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can explore the human cost of conflict through an interactive, data-accurate visualization.
**Current focus:** Phase 07 — start-v2-typescript-migration

## Current Position

Phase: 07 (start-v2-typescript-migration) — EXECUTING
Plan: 8 of 10

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 03-database-migration P01 | 8 | 2 tasks | 7 files |
| Phase 01-stabilize P04 | 15 | 2 tasks | 4 files |
| Phase 01-stabilize P03 | 25 | 2 tasks | 2 files |
| Phase 02-modernize-stack P01 | 17 | 2 tasks | 16 files |
| Phase 02-modernize-stack P02 | 10 | 2 tasks | 3 files |
| Phase 02-modernize-stack P03 | 7 | 2 tasks | 13 files |
| Phase 02-modernize-stack P04 | 7 | 2 tasks | 21 files |
| Phase 03-database-migration P02 | 10 | 2 tasks | 2 files |
| Phase 03-database-migration P03 | 15 | 2 tasks | 5 files |
| Phase 03-database-migration P04 | 15 | 2 tasks (checkpoint approved) | 3 files |
| Phase 04-data-ingestion-pipeline P01 | 3 | 2 tasks | 6 files |
| Phase 04-data-ingestion-pipeline P02 | 2 | 1 tasks | 2 files |
| Phase 04-data-ingestion-pipeline P03 | 3 | 2 tasks | 4 files |
| Phase 04-data-ingestion-pipeline P04 | 2 | 2 tasks | 4 files |
| Phase 04-data-ingestion-pipeline P05 | 2 | 2 tasks | 4 files |
| Phase 04 P06 | 24 | 2 tasks | 5 files |
| Phase 04 P08 | 2 | 2 tasks | 4 files |
| Phase 04 P09 | 4 | 2 tasks | 5 files |
| Phase 06-react-router-v6-migration P01 | 2 | 2 tasks | 4 files |
| Phase 06-react-router-v6-migration P02 | 2 | 2 tasks | 3 files |
| Phase 04 P15 | 219 | 1 tasks | 4 files |
| Phase 04 P16 | 4 | 2 tasks | 10 files |
| Phase 07-start-v2-typescript-migration P01 | 4 | 2 tasks | 7 files |
| Phase 07-start-v2-typescript-migration P02 | 4 | 2 tasks | 12 files |
| Phase 07-start-v2-typescript-migration P03 | 6 | 2 tasks | 8 files |
| Phase 07-start-v2-typescript-migration P08 | 12 | 2 tasks | 11 files |
| Phase 07-start-v2-typescript-migration P05 | 20 | 2 tasks | 20 files |
| Phase 07-start-v2-typescript-migration P04 | 19 | 2 tasks | 23 files |
| Phase 07-start-v2-typescript-migration P06 | 22 | 2 tasks | 11 files |
| Phase 07-start-v2-typescript-migration P09 | 13 | 2 tasks | 14 files |
| Phase 07-start-v2-typescript-migration P07 | 16 | 2 tasks | 9 files |
| Phase 07-start-v2-typescript-migration PP10 | 14 | 1 tasks | 19 files |
| Phase 07-start-v2-typescript-migration P10 | 45 | 2 tasks | 36 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- PostgreSQL/Supabase over MongoDB — owner-controlled, relational, free tier
- Vite over Webpack 5 — drops legacy OpenSSL hack, faster builds
- Geo precision at ingestion time — store clean data, prevent GPU overload
- Shared secret admin only — full auth is overkill for this traffic level
- [Phase 01-stabilize]: CORS allows all origins via cors() with no whitelist — general internet traffic permitted
- [Phase 01-stabilize]: Rate limit scoped to /data routes only at 200 req/15min/IP using express-rate-limit v8 API
- [Phase 01-stabilize]: npm overrides (nth-check >=2.0.1, d3-color >=3.1.0) to resolve nested CVEs where upstream packages are stuck in circular --force loops
- [Phase 02-modernize-stack]: Use UNSAFE_ prefix (not componentDidUpdate refactor) — preserves identical behavior, defers full lifecycle migration to later phase
- [Phase 02-modernize-stack]: Pin three@0.165.0 exactly (no caret); manual typed-array accumulation for geometry merge to preserve per-point matrix transforms
- [Phase 02-modernize-stack]: d3-canvas-transition broken module field pinned via vite alias to CJS build — no behavioral change
- [Phase 02-modernize-stack]: warDictionary.js and routeDictionary.js converted from module.exports to named ES exports for Rollup/Vite strict ESM compliance
- [Phase 02-modernize-stack]: NODE_OPTIONS=--openssl-legacy-provider hack eliminated — Vite uses modern crypto stack
- [Phase 02-modernize-stack]: Replace mapbox:// style URL with CartoCDN dark-matter public style for maplibre-gl compatibility (no token required)
- [Phase 02-modernize-stack]: Use npm --legacy-peer-deps for uninstalls in this project due to pre-existing eslint-config-airbnb peer conflict
- [Phase 03-database-migration]: Use float8 (not NUMERIC/decimal) for lat/lng — avoids pg driver returning strings, which would break THREE.js geometry
- [Phase 03-database-migration]: dead/missing/dead_and_missing in route_deaths stored as TEXT — source JSON has string values, must preserve API response shape
- [Phase 03-database-migration]: war_notes table created empty for Phase 3; ACLED API population deferred to Phase 4
- [Phase 03-database-migration]: cot column as text[] (specificType) — pg driver maps JS arrays natively
- [Phase 03-database-migration]: route_deaths lat/lng require parseFloat() — source JSON stores them as strings not numbers
- [Phase 03-database-migration]: Empty string lat/lng in route_deaths treated as null — 2 records have empty strings not null
- [Phase 03-database-migration]: float8 lat/lng returns as JS number from pg driver — no parseFloat() needed in query layer
- [Phase 03-database-migration]: IBC null-count rows omitted at seed time; Node reconstructs null quarterly values for missing year-quarter combos
- [Phase 04-data-ingestion-pipeline]: Deduplicate asy_applications at migration time — existing seeded data had duplicates preventing unique index creation
- [Phase 04-data-ingestion-pipeline]: war_notes upsert uses onConflict merge (not ignore) — allows notes to update if ACLED corrects them on re-ingest
- [Phase 04-data-ingestion-pipeline]: NaN lat/lng filtered at ingestion time before DB insert, consistent with seed.js pattern
- [Phase 04-data-ingestion-pipeline]: UNHCR quarter always 'q1' — API provides annual totals only, not per-quarter
- [Phase 04-data-ingestion-pipeline]: IOM always downloads full CSV with onConflict('id').ignore() — no date-filter API exists
- [Phase 04-data-ingestion-pipeline]: Cron scheduling inside require.main block — prevents cron timers from running during test execution
- [Phase 04-data-ingestion-pipeline]: Admin routes mounted before express.static — prevents SPA fallback intercepting POST /admin requests
- [Phase 04-data-ingestion-pipeline]: CSV commit applies reduceGeoPercision(parseFloat(val), 2) to lat/lng columns before insert
- [Phase 04-data-ingestion-pipeline]: Admin route added to routeRegistry.jsx (not App.jsx) — this project uses a registry-based router pattern with no App.jsx
- [Phase 04-data-ingestion-pipeline]: Auth probe pattern: POST /admin/csv/preview without file body; 400=auth passed, 401=wrong secret
- [Phase 04]: Remove 'Others' from ROUTE_MAP -- dead code since resolveRoute handles unmapped routes via geoFallback
- [Phase 04]: Ingestion-time normalization: all route mapping, geo-fallback, bounds correction, dedup happens at write time not read time
- [Phase 04]: Cote d'Ivoire canonical form kept as ASCII (no accent) matching Eurostat source
- [Phase 04]: SY duplicate removed from CITIZEN_CODES; Syrian Arab Rep variant handled by countryNormalizer at integration time
- [Phase 04]: UNHCR ingestion skips EU/EEA destinations to prevent double-counting; annual totals distributed into quarterly using Eurostat seasonal ratios
- [Phase 06-react-router-v6-migration]: Two-step v4→v5→v6 upgrade confirmed no regression: same 11 pre-existing test failures before and after
- [Phase 06-react-router-v6-migration]: withRouter6 HOC must be outermost wrapper when stacked with Redux connect()
- [Phase 06-react-router-v6-migration]: NavbarLayout wraps all non-landing routes via v6 layout route pattern; landing excluded via route nesting
- [Phase 06-react-router-v6-migration]: routeRegistry centralized as element-prop array; Router.jsx filters landing vs non-landing routes
- [Phase 06-react-router-v6-migration]: Nested BrowserRouter in RefugeeRoute_titleGroup removed (was redundant; v6 hard crash prevented)
- [Phase 04]: Türkiye-Europe land route remapped to Eastern Mediterranean (not Western Balkans) in ROUTE_MAP
- [Phase 04]: Central Med bounds: lng cap tightened 55→37, Western Balkans lng cap 50→35 and lat cap 55→50
- [Phase 04]: Validator graceful fallback: DB failure never blocks ingestion, all rows pass through as clean
- [Phase 04]: quarantineCount returned from ingestCbpData/ingestUkChannelData since validation is inside combined transform+upsert function
- [Phase 04]: ACLED cleanNoteRows filtered by clean war event IDs to keep war_notes sync with quarantined war_events
- [Phase 07-start-v2-typescript-migration]: Derive RootState/AppDispatch from store instance (ReturnType<typeof store.getState>) — store.js uses default export, named imports caused tsc errors before Plan 02 conversion
- [Phase 07-start-v2-typescript-migration]: ts-jest + babel-jest coexist in transforms for incremental migration: .ts/.tsx via ts-jest, .js/.jsx via babel-jest
- [Phase 07-start-v2-typescript-migration]: jest-environment-jsdom explicitly installed — Jest 28+ removed from default bundle, required by client test project
- [Phase 07-start-v2-typescript-migration]: Cast window as any for Redux DevTools extension in store.ts — @ts-expect-error insufficient for multi-line ternary
- [Phase 07-start-v2-typescript-migration]: CrossingCountByCountry type corrected to RouteCrossingCount[] — IBC_crossingCountByCountry.json is an array of route objects, not a string-keyed number map
- [Phase 07-start-v2-typescript-migration]: Octree.ts created as typed stub — Octree.js never existed; disabled per browser crash issue with large BufferGeometry
- [Phase 07-start-v2-typescript-migration]: Use export = pattern for CommonJS-interop TypeScript files (connection.ts, server.ts) — JS test files use require() via babel-jest, not ts-jest, so esModuleInterop doesn't apply; export = compiles to module.exports = x
- [Phase 07-start-v2-typescript-migration]: WarNoteRow.id is string (text) after migration 002 — findWarNote converts numeric query param to String() before where clause
- [Phase 07-start-v2-typescript-migration]: tsx installed as dev runtime transpiler for nodemon; noEmit tsconfig means no compiled output
- [Phase 07-start-v2-typescript-migration]: D3 v5 mouse API preserved via (d3 as any).mouse(this) — project uses D3 v5.16.0 which has d3.mouse() removed from TypeScript types but present at runtime
- [Phase 07-start-v2-typescript-migration]: MapLibre NavigationControl({}) — constructor requires NavigationOptions object; empty object equivalent to no-arg call
- [Phase 07-start-v2-typescript-migration]: Mutable map instance variables migrated to useRef in RefugeeRoute_map — avoids stale closure issues while preserving direct mutation semantics for canvas rendering
- [Phase 07-start-v2-typescript-migration]: Navbar uses useLocation hook directly instead of withRouter6 — functional components can consume hooks natively, withRouter6 bridging not needed
- [Phase 07-start-v2-typescript-migration]: SVG imports cast through unknown for TypeScript 5.9 bundler mode — TS5 bundler moduleResolution does not resolve *.svg wildcards; cast through unknown is correct idiomatic pattern
- [Phase 07-start-v2-typescript-migration]: styled.video.attrs() replaced with CSS template interpolation — styled-components v6 attrs only accepts valid HTML attributes; inline template interpolation used for dynamic opacity/filter
- [Phase 07-start-v2-typescript-migration]: React.forwardRef + useImperativeHandle for AsyApplicationChart imperative D3 API
- [Phase 07-start-v2-typescript-migration]: Upgrade react-redux 7.0.3 -> 7.2.9: hooks API required by types/redux.ts was missing in v7.0.3 ES module
- [Phase 07-start-v2-typescript-migration]: Add src/types/assets.d.ts for declare module *.png/*.svg — fixes static asset TS2307 errors
- [Phase 07-start-v2-typescript-migration]: Ingestion pipeline modules return Promise<IngestionResult> for uniform health reporting
- [Phase 07-start-v2-typescript-migration]: Omit<RowType, 'pk'> pattern for pre-insert objects — pk is DB-generated serial not supplied by ingestion code
- [Phase 07-start-v2-typescript-migration]: GlobeVisual uses forwardRef + useImperativeHandle exposing GlobeVisualHandle; GlobeContainer uses useRef<GlobeVisualHandle>
- [Phase 07-start-v2-typescript-migration]: State refs pattern (warDataRef, etc.) prevents stale closures in GlobeContainer callbacks without bloating dependency arrays
- [Phase 07-start-v2-typescript-migration]: Conflict.tsx withRouter6 removed — GlobeContainer uses useNavigate() directly; withRouter6 fully eliminated from all consumers
- [Phase 07-start-v2-typescript-migration]: @types/jest and @types/supertest installed as devDependencies for ts-jest strict mode compliance
- [Phase 07-start-v2-typescript-migration]: jest.Mock intersection type for mocks with extra properties (jest.fn() as jest.Mock & { destroy: jest.Mock })
- [Phase 07-start-v2-typescript-migration]: Annotation overlay moved from render side-effect to useEffect with ref to prevent stale closure crash on initial navigation
- [Phase 07-start-v2-typescript-migration]: Fuse 3.x search result shape is {item:{key}} not {key} — ibcCountry search destructuring fixed with .item unwrapping

### Roadmap Evolution

- Phase 7 added: Start v2 TypeScript migration

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-21T23:00:08.812Z
Stopped at: Completed 07-10-PLAN.md — Phase 7 TypeScript migration complete, smoke test approved
Resume file: None
