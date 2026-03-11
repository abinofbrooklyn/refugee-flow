# Refugee Flow — v1.0 Design Spec

**Date:** 2026-03-11
**Approach:** Sequential phases — Stabilize → Modernize → Migrate DB → Ingest → New Features

---

## Project Context

Refugee Flow is a conflict and refugee data visualization app:
- 3D globe (THREE.js) showing war/conflict events by year and country
- Interactive map (MapLibre) showing refugee migration routes and deaths
- Asylum application charts by country
- Full-stack: React + Redux frontend, Express backend, currently MongoDB + static JSON data

**Core constraint:** The globe renders geo points on the GPU. Lat/lng precision must be reduced using `reduceGeoPercision()` and deduplicated by composite key (`lat,lng` string) **before** data reaches the database. Raw precision data causes overlapping invisible points that overwhelm the GPU and crash the browser.

---

## Phase 1: Stabilize

**Goal:** Production-safe, reliable app. No functionality changes.

### Security
- `npm audit fix` — patch `@babel/traverse` (arbitrary code execution), `acorn` (ReDoS), `ansi-regex` (ReDoS)
- Force-upgrade packages that can't be auto-patched
- Add CORS whitelisting to Express `/data` routes
- Add rate limiting to `/data` endpoints

### Memory Leaks
- `GlobeVisual.jsx` — implement `componentWillUnmount`: remove all event listeners (mousemove, mousedown, mousewheel, keydown, mouseover, mouseout), dispose THREE.js geometries/materials, cancel animation frame loop
- `MobileLanding.jsx` + `DesktopLanding.jsx` — store `setInterval` IDs, call `clearInterval` on unmount

### Error Handling & Loading States
- Wrap all `fetch` calls in try/catch with error state UI
- Add loading spinners to `GlobeContainer`, `RefugeeRoute`, `AsyApplicationContainer`

### Bug Fixes
- Globe rotation toggle — add missing UI button, wire to existing `rotatePause` prop
- Rename 16 `componentWillReceiveProps` → `UNSAFE_componentWillReceiveProps`
- Remove non-compliant `console.log` calls (subset of the 61 total console statements — `console.warn`, `console.error`, `console.info` are permitted by ESLint and must be kept)

### Tests
- Unit tests for `dataProcessors.js` (prevent `uniqBy` regression)
- Unit tests for Redux actions and reducer

---

## Phase 2: Modernize Stack

**Goal:** Replace aging tooling, bring React up to date. No new features.

### Webpack 4 → Vite
- Replace `webpack/` config with `vite.config.js`
- Remove 15+ webpack dev dependencies
- Drop `NODE_OPTIONS=--openssl-legacy-provider` hack
- Express continues serving Vite-built `dist/` unchanged

### React 16 → React 18
- Upgrade `react`, `react-dom`, `react-redux`, `react-router-dom`
- Replace `ReactDOM.render` with `createRoot` in `src/index.jsx`
- Migrate all 16 `UNSAFE_componentWillReceiveProps` components to `getDerivedStateFromProps` or `useEffect`
- Refactor smaller class components (landing, tooltips, buttons) to function components
- Keep `GlobeVisual` + `GlobeContainer` as class components — THREE.js lifecycle migration happens with the THREE.js upgrade

### THREE.js 0.91 → r150+
- Upgrade `three` package
- Update import paths to named imports
- Fix breaking API changes in scene setup, geometry, materials
- Replace legacy `Octree.js` (2141 lines, `src/THREEJSScript/Octree.js`) with `three/addons/math/Octree.js` from THREE.js r150+ examples. Audit all raycasting calls in `GlobeVisual.jsx` against the new API before merging — the old and new Octree APIs differ.

### Dependency Cleanup
- Remove `underscore` (superseded by lodash)
- Remove `jquery` (unused in React app)
- Remove `mapbox-gl 0.45.0` (replaced by `maplibre-gl`) — audit all `mapbox-gl` import paths in frontend components and replace with `maplibre-gl` equivalents; verify `mapboxToken` in `config.js` is still correctly passed to MapLibre's constructor
- ~~Upgrade `mongoose` 5 → 7~~ — skipped; Mongoose is removed entirely in Phase 3, upgrading first is wasted effort
- Upgrade `styled-components` 3 → 6

### Testing Infrastructure
- Replace Enzyme with React Testing Library (`@testing-library/react`) — Enzyme has no official React 18 adapter. Update `enzyme.config.js` and `jest.config.js` accordingly.

### Tests
- Integration tests for refactored components using React Testing Library
- Snapshot tests to catch visual regressions

---

## Phase 3: Database Migration

**Goal:** Move from MongoDB + static JSON to PostgreSQL on Supabase. API response shapes stay identical — zero frontend changes.

### Supabase Setup
- New Supabase project under owner's account
- Connection string in `.env` (`.gitignore`'d, `.env.example` provided)
- Replace `config.js` pattern with `dotenv`

### Schema

```sql
war_events (
  id, year, country_iso, lat, lng, deaths, conflict_type, source, created_at
)
war_notes (
  id, war_event_id, note_text, created_at
)
asylum_applications (
  id, year, origin_country, dest_country, applicant_count, status, created_at
)
routes (
  id, name, region, description
)
route_deaths (
  id, route_id, year, month, deaths, cause, source
)
route_ibc_countries (
  id, route_id, country_iso, displaced_count, year
)
```

Indexes on `year`, `country_iso`, and composite `(year, country_iso)` for visualization query patterns.

### Endpoint-to-Table Mapping

| Endpoint | Table(s) | Query type |
|----------|----------|------------|
| `GET /data/note/:id` | `war_notes` | Select by id |
| `GET /data/reduced_war_data` | `war_events` | Select all (pre-reduced at insert time) |
| `GET /data/asy_application_all` | `asylum_applications` | Select all |
| `GET /data/route_death` | `route_deaths` | Select all |
| `GET /data/route_IBC_country_list` | `route_ibc_countries` | Distinct country list |
| `GET /data/route_IBC` | `route_ibc_countries` | Select all |

### Data Migration
- Export MongoDB collections + static JSON to CSV
- Migration scripts must apply `reduceGeoPercision()` and deduplicate by `lat,lng` composite key before inserting `war_events` — do not load raw coordinates directly
- Validate row counts and spot-check against current API responses

### Server Layer Swap
- Replace Mongoose models with `pg` (node-postgres) queries
- Update all 6 API endpoints to query PostgreSQL
- Keep identical response shapes
- Remove Mongoose entirely

### Local Development
- `docker-compose.yml` with local PostgreSQL container for dev

### Tests
- Integration tests for all 6 API endpoints against test database
- Migration validation script comparing old vs new response shapes

---

## Phase 4: Data Ingestion Pipeline

**Goal:** Replace manual data loading with automated API pulls + admin CSV upload.

### Data Sources

| Source | Data | Method |
|--------|------|--------|
| ACLED | War events, conflict locations, deaths | Scheduled API pull |
| UNHCR | Asylum applications, refugee displacement | Scheduled API pull |
| IOM Missing Migrants | Route deaths by corridor | Scheduled API pull |

### Geo Precision Pipeline (Critical)
All incoming lat/lng data — from both API pulls and CSV uploads — passes through:
1. `reduceGeoPercision()` — reduce to established decimal precision
2. Deduplicate by composite key (`lat,lng` string) using `uniqBy`
3. Only then upsert into PostgreSQL

This prevents GPU overload from stacked invisible points on the globe.

**Deno compatibility:** `reduceGeoPercision()` and deduplication logic currently live in `server/controllers/api/data/helpers/dataProcessors.js` as CommonJS (`module.exports`). Supabase Edge Functions run on Deno and cannot import CommonJS modules. This logic must be extracted into a shared ES module (`lib/geoUtils.mjs`) before it can be used inside Edge Functions.

### Scheduled Ingestion (Supabase Edge Functions)
- One Edge Function per source: `ingest-acled`, `ingest-unhcr`, `ingest-iom`
- Supabase cron: weekly triggers (sources update monthly at most)
- Each function: fetch → validate schema → geo normalize → upsert
- `ingestion_log` table: source, timestamp, rows_inserted, error

### Admin Upload Interface
- Password-protected `/admin` route (shared secret in `.env`)
- The `/admin` route must be registered in `server/routes/` **before** the SPA catch-all handler in `server/server.js` — otherwise Express serves the React app instead
- CSV upload → parse → validate → geo normalize → preview (first 10 rows) → upsert
- Supports: war events, asylum applications, route deaths

### Data Validation (zod)
- Shared validation schemas for API pulls and CSV uploads
- Required fields enforced, ISO country codes validated
- Duplicate detection via upsert on composite keys

### Tests
- Unit tests for validation schemas
- Integration tests for CSV upload parsing
- Mock API responses for ingestion function tests

---

## Phase 5: Data Gaps & New Features

**Goal:** Fill missing data coverage and improve visualizations. Forward-looking only — no historical backfill.

### Data Gap Audit
- Compare current coverage (years, countries, routes) against what ACLED, UNHCR, IOM provide
- Gap report: missing years, countries, routes with incomplete death data
- Prioritize by visualization impact (blank globe areas first)

### Globe Improvements
- Extend year range slider to reflect actual data coverage
- Country-level data completeness indicator (visual cue for sparse vs. complete data)

### Route Data Improvements
- Add missing migration corridors not currently in the app
- Update IBC country displacement counts with fresh UNHCR data
- Ensure route death data is current through latest IOM update

### Tests
- Integration tests validating data completeness thresholds
- Visual regression tests for globe and map with new data ranges

---

## Key Constraints

1. **Geo precision must be reduced before storage** — `reduceGeoPercision()` + `uniqBy` on `lat,lng` are non-negotiable pipeline steps
2. **API response shapes are stable** — frontend should not need changes when backend data source changes
3. **No historical backfill** — ingest from current data forward only
4. **No full auth system** — admin upload protected by shared secret only

---

## Technology Decisions

| Concern | Choice | Reason |
|---------|--------|--------|
| Database | PostgreSQL via Supabase | Relational data, time-series queries, free tier, owner-controlled |
| Build tool | Vite | Replaces Webpack 4, faster HMR, simpler config |
| Validation | zod | Shared schemas for API + CSV ingestion |
| DB client | node-postgres (`pg`) | Lightweight, direct SQL, no ORM overhead |
| Ingestion runtime | Supabase Edge Functions | Co-located with DB, built-in cron, no separate service |
