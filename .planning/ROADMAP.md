# Roadmap: Refugee Flow

## Overview

The project modernizes a brownfield conflict/refugee visualization app from a fragile static-data state to a live, API-driven system. Five phases follow the natural dependency chain: stabilize the existing app first, then upgrade the stack, then migrate to a new database, then build automated ingestion, then verify data coverage is complete.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Stabilize** - Fix memory leaks, error handling, security vulnerabilities, and UX gaps in the existing app
- [ ] **Phase 2: Modernize Stack** - Replace Webpack 4 with Vite, upgrade React 18 and THREE.js r150+, remove dead dependencies
- [ ] **Phase 3: Database Migration** - Move all data from MongoDB to PostgreSQL/Supabase with geo precision baked in
- [ ] **Phase 4: Data Ingestion Pipeline** - Automate ACLED, UNHCR, and IOM data ingestion plus admin CSV upload
- [ ] **Phase 5: Data Coverage** - Audit, validate, and close gaps in data coverage across years and corridors

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
- [ ] 01-01-PLAN.md — Fix THREE.js and interval memory leaks in GlobeVisual, MobileLanding, DesktopLanding
- [ ] 01-02-PLAN.md — Add loading spinners and error messages to all data-fetching components
- [ ] 01-03-PLAN.md — Add globe rotation toggle button and patch security vulnerabilities
- [ ] 01-04-PLAN.md — Add CORS and rate limiting middleware to Express server with integration test

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
- [ ] 02-01-PLAN.md — Rename componentWillReceiveProps to UNSAFE_ prefix in all 16 components
- [ ] 02-02-PLAN.md — Upgrade THREE.js to r165 and migrate GlobeVisual.jsx to BufferGeometry API
- [ ] 02-03-PLAN.md — Replace Webpack 4 with Vite build tool and dev server
- [ ] 02-04-PLAN.md — Remove jquery, underscore, and mapbox-gl legacy dependencies

### Phase 3: Database Migration
**Goal**: All app data is served from a Supabase PostgreSQL database the owner controls — MongoDB is fully removed
**Depends on**: Phase 2
**Requirements**: DB-01, DB-02, DB-03, DB-04
**Success Criteria** (what must be TRUE):
  1. All 6 existing API endpoints return identical response shapes when pointed at PostgreSQL — no frontend changes needed
  2. The app runs end-to-end in local dev using docker-compose with no external database dependency
  3. Every lat/lng coordinate in the database is precision-reduced and deduplicated — no raw API coordinates stored
  4. Removing MongoDB connection string from the environment causes no startup errors
**Plans**: TBD

### Phase 4: Data Ingestion Pipeline
**Goal**: War, asylum, and route death data flows into the database automatically each week; admin can supplement with CSV uploads
**Depends on**: Phase 3
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06, INGEST-07
**Success Criteria** (what must be TRUE):
  1. ACLED, UNHCR, and IOM ingestion jobs run on schedule and new data appears in the app without manual intervention
  2. Every lat/lng value from any ingestion source is precision-reduced and deduplicated before reaching the database
  3. Admin can navigate to /admin with a shared-secret password, upload a CSV, preview the parsed rows, and commit or cancel
  4. When an ingestion job fails, an error row with details appears in the ingestion_log table
**Plans**: TBD

### Phase 5: Data Coverage
**Goal**: The app accurately reflects what data exists — year range and route display match actual database contents with no silent gaps
**Depends on**: Phase 4
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A data gap audit report identifies every missing year and country combination in the current dataset
  2. The year range slider shows only years that have actual data — no empty selections
  3. All major IOM-tracked migration corridors appear on the route map
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stabilize | 3/4 | In Progress|  |
| 2. Modernize Stack | 3/4 | In Progress|  |
| 3. Database Migration | 0/TBD | Not started | - |
| 4. Data Ingestion Pipeline | 0/TBD | Not started | - |
| 5. Data Coverage | 0/TBD | Not started | - |
