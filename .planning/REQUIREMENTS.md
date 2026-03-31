# Requirements: Refugee Flow

**Defined:** 2026-03-11
**Core Value:** Users can explore the human cost of conflict through an interactive, data-accurate visualization.

## v1 Requirements

### Stability

- [x] **STAB-01**: App runs without memory leaks when navigating between views
- [x] **STAB-02**: App shows loading state while data is being fetched
- [x] **STAB-03**: App shows error message when data fetch fails (no silent failures)
- [x] **STAB-04**: Globe rotation can be toggled on/off by the user
- [x] **STAB-05**: No critical or high security vulnerabilities in dependencies (accepted risk: three@0.91.0 HIGH CVE GHSA-fq6p-x6j3-cmmq — DoS only, pinned due to THREE.Geometry removal in 0.125+; fix deferred to Phase 2 MOD-03)
- [x] **STAB-06**: API endpoints have rate limiting and CORS whitelisting

### Modernization

- [x] **MOD-01**: App builds and runs using Vite (no legacy OpenSSL workaround needed)
- [x] **MOD-02**: App uses React 18 with no deprecated lifecycle method warnings
- [x] **MOD-03**: App uses THREE.js r150+ for globe rendering
- [x] **MOD-04**: Unused legacy dependencies removed (jquery, underscore, old mapbox-gl)

### Database

- [x] **DB-01**: All data served from PostgreSQL (Supabase) — no MongoDB dependency
- [x] **DB-02**: All 6 existing API endpoints return identical response shapes from PostgreSQL
- [x] **DB-03**: Geo coordinates stored precision-reduced and deduplicated in the database
- [x] **DB-04**: Local PostgreSQL dev environment available via docker-compose

### Data Ingestion

- [ ] **INGEST-01**: War/conflict data ingested automatically from ACLED API on weekly schedule (BLOCKED: waiting on ACLED API access) — moved to Phase 9
- [x] **INGEST-02**: Asylum application data ingested automatically from UNHCR API on weekly schedule
- [x] **INGEST-03**: Route death data ingested automatically from IOM Missing Migrants API on weekly schedule
- [x] **INGEST-04**: All ingested lat/lng data passes through precision reduction and deduplication before storage
- [x] **INGEST-05**: Ingestion failures are logged to `ingestion_log` table with error details
- [x] **INGEST-06**: Admin can upload CSV data for sources without APIs via password-protected `/admin` route
- [x] **INGEST-07**: CSV uploads show preview before committing to database

### Router Migration

- [x] **MOD-05**: React Router upgraded to v6 with zero legacy context API warnings

### Data Coverage

- [ ] **DATA-01**: Data gap audit identifies missing years and countries in current dataset
- [ ] **DATA-02**: Year range slider reflects actual data coverage after ingestion
- [ ] **DATA-03**: Route data includes all major IOM-tracked migration corridors

### Deployment

- [ ] **DEPLOY-01**: Vite frontend build succeeds and produces dist/ output
- [ ] **DEPLOY-02**: Docker image builds with multi-stage TypeScript compilation (no tsx/pm2 in production)
- [ ] **DEPLOY-03**: Container starts Express server on port 2700 and responds to HTTP requests
- [ ] **DEPLOY-04**: CloudFormation template validates and defines all AWS infrastructure (VPC, ECS, ECR, S3, CloudFront, IAM, monitoring)
- [ ] **DEPLOY-05**: GitHub Actions deploys frontend (S3+CloudFront) and backend (ECR+ECS) on push to main using OIDC
- [ ] **DEPLOY-06**: S3 bucket rejects direct access — only CloudFront OAC can read objects
- [ ] **DEPLOY-07**: CloudFront serves frontend HTML at default domain (d1234.cloudfront.net)
- [ ] **DEPLOY-08**: CloudFront proxies /data/* requests to ECS Fargate and returns JSON
- [ ] **DEPLOY-09**: Secrets stored in AWS Secrets Manager — ECS task definition references ARNs, not plaintext

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
| STAB-01 through STAB-06 | Phase 1 | Complete |
| MOD-01 through MOD-04 | Phase 2 | Complete |
| DB-01 through DB-04 | Phase 3 | Complete |
| INGEST-02 through INGEST-07 | Phase 4 | Complete |
| INGEST-01 | Phase 9 | Blocked (ACLED API access) |
| DATA-01 through DATA-03 | Phase 5 | Pending |
| MOD-05 | Phase 6 | Complete |
| DEPLOY-01 through DEPLOY-09 | Phase 14 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-30 — DEPLOY-01 through DEPLOY-09 added for Phase 14 (AWS CloudFormation Deployment)*
