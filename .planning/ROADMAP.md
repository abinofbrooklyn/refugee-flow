# Roadmap: Refugee Flow

## Overview

The project modernizes a brownfield conflict/refugee visualization app from a fragile static-data state to a live, API-driven system. Six phases cover stability, stack modernization, database migration, automated ingestion, data coverage verification, and router migration.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Stabilize** - Fix memory leaks, error handling, security vulnerabilities, and UX gaps in the existing app
- [x] **Phase 2: Modernize Stack** - Replace Webpack 4 with Vite, upgrade React 18 and THREE.js r150+, remove dead dependencies
- [x] **Phase 3: Database Migration** - Move all data from MongoDB to PostgreSQL/Supabase with geo precision baked in (completed 2026-03-17)
- [x] **Phase 4: Data Ingestion Pipeline** - Automate ACLED, UNHCR, and IOM data ingestion plus admin CSV upload; normalize all ingested data at ingestion time (completed 2026-03-21)
- [ ] **Phase 5: Data Coverage** - Audit, validate, and close gaps in data coverage across years and corridors
- [x] **Phase 6: React Router v6 Migration** - Eliminate legacy context API warnings by upgrading react-router-dom to v6 (completed 2026-03-20)

## Phase Details

### Phase 1: Stabilize
**Goal**: The existing app is reliable — no crashes, no silent failures, no security holes, and users have basic UX controls
**Depends on**: Nothing (first phase)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06
**Success Criteria** (what must be TRUE):
  1. User can navigate between all views without triggering memory leaks or browser GPU crashes
  2. User sees a loading indicator while data is fetched and a clear error message if a fetch fails
  3. User can toggle globe rotation on and off with a visible UI control
  4. npm audit reports zero critical or high severity vulnerabilities
  5. API endpoints reject requests from non-whitelisted origins and handle excessive traffic via rate limiting
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Fix THREE.js and interval memory leaks in GlobeVisual, MobileLanding, DesktopLanding
- [x] 01-02-PLAN.md — Add loading spinners and error messages to all data-fetching components
- [x] 01-03-PLAN.md — Add globe rotation toggle button and patch security vulnerabilities
- [x] 01-04-PLAN.md — Add CORS and rate limiting middleware to Express server with integration test

### Phase 2: Modernize Stack
**Goal**: The app builds and runs on a modern, maintainable toolchain with no deprecated warnings or legacy workarounds
**Depends on**: Phase 1
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):
  1. App builds with Vite — no NODE_OPTIONS=--openssl-legacy-provider flag required
  2. React 18 renders the app with zero deprecated lifecycle method warnings in the console
  3. Globe renders correctly using THREE.js r150+ with no regression in behavior
  4. node_modules contains no jquery, underscore, or legacy mapbox-gl packages
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Rename componentWillReceiveProps to UNSAFE_ prefix in all 16 components
- [x] 02-02-PLAN.md — Upgrade THREE.js to r165 and migrate GlobeVisual.jsx to BufferGeometry API
- [x] 02-03-PLAN.md — Replace Webpack 4 with Vite build tool and dev server
- [x] 02-04-PLAN.md — Remove jquery, underscore, and mapbox-gl legacy dependencies

### Phase 3: Database Migration
**Goal**: All app data is served from a Supabase PostgreSQL database the owner controls — MongoDB is fully removed
**Depends on**: Phase 2
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. All 6 existing API endpoints return identical response shapes when pointed at PostgreSQL — no frontend changes needed
  2. The app runs end-to-end in local dev using docker-compose with no external database dependency
  3. Every lat/lng coordinate in the database is precision-reduced and deduplicated — no raw API coordinates stored
  4. Removing MongoDB connection string from the environment causes no startup errors
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — Set up Docker Compose, .env/dotenv config, Knex connection, and schema migration for all 6 tables
- [x] 03-02-PLAN.md — Create idempotent seed script transforming all 5 JSON datasets with geo precision reduction and dedup
- [x] 03-03-PLAN.md — Rewrite all 6 data controller functions for Postgres, update routes, remove Mongoose
- [x] 03-04-PLAN.md — Integration tests for endpoint shapes, geo precision, dedup, and end-to-end verification

### Phase 4: Data Ingestion Pipeline
**Goal**: War, asylum, and route death data flows into the database automatically each week; admin can supplement with CSV uploads
**Depends on**: Phase 3
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07
**Success Criteria** (what must be TRUE):
  1. ACLED, UNHCR, and IOM ingestion jobs run on schedule and new data appears in the app without manual intervention
  2. Every lat/lng value from any ingestion source is precision-reduced and deduplicated before reaching the database
  3. Admin can navigate to /admin with a shared-secret password, upload a CSV, preview the parsed rows, and commit or cancel
  4. When an ingestion job fails, an error row with details appears in the ingestion_log table
**Plans**: 16 plans (Plan 07 blocked on ACLED API access)

Plans:
- [x] 04-01-PLAN.md — Database migration (ingestion_log table, event_id type fix), shared utilities, install dependencies
- [x] 04-02-PLAN.md — ACLED ingestion module with OAuth auth, war_events upsert, and war_notes population
- [x] 04-03-PLAN.md — UNHCR and IOM ingestion modules with paginated fetch and CSV download
- [x] 04-04-PLAN.md — Cron scheduling, admin routes (CSV preview/commit, manual trigger), integration tests
- [x] 04-05-PLAN.md — Admin React UI at /admin with login, CSV upload, preview table, and commit flow
- [x] 04-06-PLAN.md — IOM normalization pipeline: extract route normalization from dataController to ingestion time
- [ ] 04-07-PLAN.md — ACLED normalization: populate evt/int/cot fields, map event types and country regions (BLOCKED: waiting on ACLED API access)
- [x] 04-08-PLAN.md — Asylum data normalizer modules: country name canonicalization + quarterly estimation from seasonal ratios
- [x] 04-09-PLAN.md — Integrate asylum normalizers into UNHCR/Eurostat pipelines, backfill seed data, add estimation footnote
- [x] 04-10-PLAN.md — CBP border crossing ingestion + automation for Americas route (diff-based upsert, monthly cron)
- [x] 04-11-PLAN.md — UK Home Office small boat crossing ingestion + automation for English Channel route (quarterly cron)
- [x] 04-12-PLAN.md — DB migration for border breakdown columns, route-aware Data Sources links, route ordering
- [x] 04-13-PLAN.md — Automate Frontex IBC ingestion (server-side cron + admin trigger; IOM already automated in 04-03/04-04)
- [x] 04-14-PLAN.md — UNHCR + Eurostat automation verified (already built in 04-03/04-04/04-08/04-09)
- [ ] 04-15-PLAN.md — Data validation: migration 004 (quarantine table), validator module with TDD (4 rule types)
- [ ] 04-16-PLAN.md — Data validation: alerter extension + integrate validator into all 7 ingestion pipelines

### Phase 5: Data Coverage
**Goal**: The app accurately reflects what data exists — year range and route display match actual database contents with no silent gaps
**Depends on**: Phase 4
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A data gap audit report identifies every missing year and country combination in the current dataset
  2. The year range slider shows only years that have actual data — no empty selections
  3. All major IOM-tracked migration corridors appear on the route map
**Plans**: TBD

### Phase 6: React Router v6 Migration
**Goal**: Eliminate legacy context API warnings by upgrading react-router-dom from v5 to v6, removing all deprecated patterns
**Depends on**: Phase 1 (stabilize)
**Requirements**: MOD-05
**Success Criteria** (what must be TRUE):
  1. Zero `childContextTypes` or `legacy context` warnings in the browser console
  2. All routes navigate correctly — conflict, route, about, admin pages all work
  3. Route parameters (e.g., `/route/:arg`) resolve correctly for all 12 routes
  4. Browser back/forward navigation works without errors
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md — Upgrade react-router-dom to v6, create withRouter6 HOC and LandingResolver component
- [x] 06-02-PLAN.md — Rewrite Router.jsx and routeRegistry.jsx for v6, fix nested BrowserRouter in titleGroup
- [x] 06-03-PLAN.md — Wrap consumer components with withRouter6, thread navigate prop, browser smoke test

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stabilize | 4/4 | Complete | 2026-03-12 |
| 2. Modernize Stack | 4/4 | Complete | 2026-03-12 |
| 3. Database Migration | 4/4 | Complete   | 2026-03-17 |
| 4. Data Ingestion Pipeline | 15/12 | Complete   | 2026-03-21 |
| 5. Data Coverage | 0/TBD | Not started | - |
| 6. React Router v6 Migration | 3/3 | Complete | 2026-03-20 |
| 7. Start v2 TypeScript Migration | 10/10 | Complete   | 2026-03-21 |

### Phase 7: Start v2 TypeScript Migration

**Goal:** The entire codebase (frontend + server + tests) is TypeScript with strict: true — all 39 class components converted to functional with hooks, Redux uses useSelector/useDispatch, zero JavaScript source files remain
**Requirements**: MOD-V2-01
**Depends on:** Phase 6
**Success Criteria** (what must be TRUE):
  1. `tsc --noEmit` exits 0 for both frontend and server tsconfig files
  2. `npm run build` (Vite) produces dist/ successfully
  3. All 17 test suites pass with ts-jest
  4. Zero .js/.jsx source files remain in src/, server/, or tests/
  5. All class components are functional components with hooks
  6. Redux uses useAppSelector/useAppDispatch (no connect() HOCs)
  7. GlobeVisual exposes typed GlobeVisualHandle via forwardRef + useImperativeHandle
  8. Manual smoke test confirms no visual or functional regressions
**Plans**: 10 plans

Plans:
- [ ] 07-01-PLAN.md — Install TypeScript toolchain, create dual tsconfig (frontend + server), update Jest for ts-jest, create type foundation files
- [ ] 07-02-PLAN.md — Convert Redux layer to TypeScript (actionConstants, actions, reducers, store, defaults)
- [ ] 07-03-PLAN.md — Convert utilities (api, color-conversion, fetchers), data dictionaries, and vendored THREE.js scripts to TypeScript
- [ ] 07-04-PLAN.md — Convert simple/leaf components to TSX: about, navbar, annotation, landing, router (14 files)
- [ ] 07-05-PLAN.md — Convert RefugeeRoute family to TSX: route page, map, popup, textArea, content panels (10 files)
- [ ] 07-06-PLAN.md — Convert asylum chart, Conflict page, RegionModal, and app entry point to TSX (9 files)
- [ ] 07-07-PLAN.md — Convert globe components to TSX: GlobeVisual (forwardRef), GlobeContainer, timeline, stats, tooltips, route button (6 files)
- [ ] 07-08-PLAN.md — Convert server core to TypeScript: types, connection, controllers, routes, server entry (11 files)
- [ ] 07-09-PLAN.md — Convert all 14 server ingestion modules to TypeScript
- [ ] 07-10-PLAN.md — Convert 17 test files to .test.ts + final smoke test checkpoint

### Phase 8: Crossfade Route Transitions

**Goal:** Eliminate the jarring blank/spinner flash when navigating between /route/:arg pages by keeping the outgoing route visible while the incoming route loads data, then crossfading between them with a 400ms CSS opacity transition
**Requirements**: UX-CROSSFADE
**Depends on:** Phase 7
**Success Criteria** (what must be TRUE):
  1. Navigating from one /route/:arg to another shows old route staying visible while new data loads
  2. After data loads (>100ms), old route fades out and new route fades in over 400ms simultaneously
  3. Cached route switches happen instantly with no visible crossfade
  4. MapLibre map canvas on old route remains fully rendered during fade-out
  5. No ScaleLoader spinner visible during route-to-route transitions
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — Create TransitionContext, TransitionOutlet, update NavbarLayout, fix canvas_overlay querySelector scoping
- [ ] 08-02-PLAN.md — Wire RefugeeRoute into transition signal, suppress ScaleLoader during crossfade, visual verification
