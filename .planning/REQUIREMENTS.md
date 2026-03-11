# Requirements: Refugee Flow

**Defined:** 2026-03-11
**Core Value:** Users can explore the human cost of conflict through an interactive, data-accurate visualization.

## v1 Requirements

### Stability

- [ ] **STAB-01**: App runs without memory leaks when navigating between views
- [ ] **STAB-02**: App shows loading state while data is being fetched
- [ ] **STAB-03**: App shows error message when data fetch fails (no silent failures)
- [x] **STAB-04**: Globe rotation can be toggled on/off by the user
- [x] **STAB-05**: No critical or high security vulnerabilities in dependencies
- [x] **STAB-06**: API endpoints have rate limiting and CORS whitelisting

### Modernization

- [ ] **MOD-01**: App builds and runs using Vite (no legacy OpenSSL workaround needed)
- [ ] **MOD-02**: App uses React 18 with no deprecated lifecycle method warnings
- [ ] **MOD-03**: App uses THREE.js r150+ for globe rendering
- [ ] **MOD-04**: Unused legacy dependencies removed (jquery, underscore, old mapbox-gl)

### Database

- [ ] **DB-01**: All data served from PostgreSQL (Supabase) — no MongoDB dependency
- [ ] **DB-02**: All 6 existing API endpoints return identical response shapes from PostgreSQL
- [ ] **DB-03**: Geo coordinates stored precision-reduced and deduplicated in the database
- [ ] **DB-04**: Local PostgreSQL dev environment available via docker-compose

### Data Ingestion

- [ ] **INGEST-01**: War/conflict data ingested automatically from ACLED API on weekly schedule
- [ ] **INGEST-02**: Asylum application data ingested automatically from UNHCR API on weekly schedule
- [ ] **INGEST-03**: Route death data ingested automatically from IOM Missing Migrants API on weekly schedule
- [ ] **INGEST-04**: All ingested lat/lng data passes through precision reduction and deduplication before storage
- [ ] **INGEST-05**: Ingestion failures are logged to `ingestion_log` table with error details
- [ ] **INGEST-06**: Admin can upload CSV data for sources without APIs via password-protected `/admin` route
- [ ] **INGEST-07**: CSV uploads show preview before committing to database

### Data Coverage

- [ ] **DATA-01**: Data gap audit identifies missing years and countries in current dataset
- [ ] **DATA-02**: Year range slider reflects actual data coverage after ingestion
- [ ] **DATA-03**: Route data includes all major IOM-tracked migration corridors

## v2 Requirements

### Modernization

- **MOD-V2-01**: TypeScript migration for Redux and data layer
- **MOD-V2-02**: React Testing Library component integration tests

### Features

- **FEAT-V2-01**: Country-level data completeness indicator on globe
- **FEAT-V2-02**: Offline support / cached data fallback

## Out of Scope

| Feature | Reason |
|---------|--------|
| Historical backfill to 1997 | Only ingest forward from current data |
| Full authentication system | Shared secret admin is sufficient |
| TypeScript migration | Deferred to v2 |
| Mobile app | Web-first |
| Real-time data updates | Weekly schedule sufficient for this data type |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAB-01 through STAB-06 | Phase 1 | Pending |
| MOD-01 through MOD-04 | Phase 2 | Pending |
| DB-01 through DB-04 | Phase 3 | Pending |
| INGEST-01 through INGEST-07 | Phase 4 | Pending |
| DATA-01 through DATA-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initialization*
