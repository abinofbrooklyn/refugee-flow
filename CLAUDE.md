# Refugee Flow — Project Instructions

## Overview

Interactive conflict/refugee visualization app. React 18 + Express + PostgreSQL (Supabase). Part of the "Places & Spaces: Mapping Science" traveling museum exhibit (https://scimaps.org/macroscopes, Iteration 15). The exhibit travels to museums, libraries, and conferences worldwide — the app runs on kiosks, tablets, and touch screens with arbitrary display sizes.

Users explore the human cost of conflict: where wars happen (3D globe), where people flee (route maps), and where they seek asylum (charts). This is a status/visualization tool — prioritize automation over admin UIs, data display over data management.

## Commands

```bash
# Dev server (frontend + backend)
npm run dev

# Production build (Vite)
npm run build

# TypeScript check
npx tsc --noEmit

# Run all tests
npx jest

# Run specific test file
npx jest tests/server/iomIngestion.test.ts --no-cache

# Run client tests only
npx jest --selectProjects client

# Run server tests only
npx jest --selectProjects server
```

## Stack

- **Frontend:** React 18, Vite, TypeScript, styled-components, MapLibre GL, THREE.js, D3
- **Backend:** Express, TypeScript, Knex (PostgreSQL)
- **Database:** Supabase (PostgreSQL) — free tier, minimize unnecessary writes
- **Deployment:** AWS (ECS Fargate + S3 + CloudFront + ALB), GitHub Actions CI/CD
- **Tests:** Jest (client: jsdom, server: node), ts-jest

## Project Structure

```
src/                    # React frontend
server/                 # Express backend
  ingestion/            # Automated data ingestion pipelines
  controllers/          # API route handlers
  routes/               # Express route definitions
  database/             # Knex connection
  types/                # TypeScript types
tests/
  client/               # Frontend tests (jsdom)
  server/               # Backend tests (node)
infrastructure/         # AWS CloudFormation + task definitions
.planning/              # GSD workflow (not pushed to git)
```

## Key Conventions

- **npm ci requires `--legacy-peer-deps`** due to eslint-config-airbnb peer conflict
- **Never hardcode PII** (emails, passwords, API keys) — always use .env
- **Geo precision reduction** only for war_events (THREE.js globe), NOT route deaths (MapLibre uses full precision)
- **Data ingestion pattern:** fetch → transform → normalize → validate → diff/filter → upsert → log → alert → cache bust
- **Incremental ingestion:** Always filter to new rows before upserting. Never bulk-insert the full dataset — Supabase free tier counts every INSERT attempt
- **MapLibre event handlers:** Use refs for data access inside callbacks registered in useEffect([], []) — props create stale closures. The map registers click/mousemove once; new useCallback refs are never picked up.
- **Quadtree hit radius:** 30px mouse, 50px touch (PointerEvent.pointerType detection). Always pass radius to `find()` — never let it snap to distant points
- **Click debounce:** 300ms between clicks to prevent double-tap toggling on touch exhibits
- **Bubble click logic:** Three modes in `resolveClickAction()` (src/components/mapClickLogic.ts): SELECT (zoom in, cap at 7), SWAP (pan only, no zoom), DESELECT (stay in place). Pure function with 28 tests.
- **Route change resets:** selectedPointIdRef, mouseover_toggleRef, intersectedIdRef all reset + passRemoveClickedPointManager called + mousemove re-registered
- **Detail map zoom:** Slideout map uses zoom 13 for neighborhood-level context
- **Map init:** Use `bounds` option in Map constructor (not deferred fitBounds) to prevent flash on navigation
- **Backup before destructive git ops** — always backup files before filter-repo, reset --hard, etc.
- **Always flag pre-existing test failures** — don't silently ignore them

## Known Issues

- War/conflict data (globe) is static 2010-2018 seed data — needs ACLED API access for live updates
- MongoDB is permanently inaccessible — war notes must come from ACLED when access is granted
- 3 pre-existing snapshot test failures (styled-components hash drift) — not blocking
- API response sizes are large: reduced_war_data 5.5 MB (3.7s TTFB), asy_application_all 10.5 MB (3.6s TTFB) — needs query optimization and gzip compression (noted in Phase 5/9)
- JSON seed files (25 MB) should be removed after ACLED API access is granted

## Blocked Work

- **ACLED API access:** Registered with @centerfortomorrow.com email, emailed access@acleddata.com for Partner-level access. Ingestion code exists (server/ingestion/acledIngestion.ts) but can't run without credentials.
- **refugeeflow.com domain:** Registration failed (new AWS account fraud prevention). Need to contact AWS Support. CloudFormation template has Route 53 + ACM built in — just needs DomainName parameter.

## Data Sources (Automated)

| Source | Schedule | Script |
|--------|----------|--------|
| IOM Missing Migrants | Friday 02:00 UTC | server/ingestion/iomIngestion.ts |
| Eurostat | Wednesday 02:00 UTC | server/ingestion/eurostatIngestion.ts |
| UNHCR | Friday 04:00 UTC | server/ingestion/unhcrIngestion.ts |
| Frontex | 1st of month 03:00 UTC | server/ingestion/frontexIngestion.ts |
| CBP | 15th of month 05:00 UTC | server/ingestion/cbpIngestion.ts |
| UK Channel | 1st of month 05:00 UTC | server/ingestion/ukChannelIngestion.ts |
| ACLED | Monday 02:00 UTC | BLOCKED — waiting on API access |

## Environment Variables

See `.env.example` for all required variables. Key ones:
- `DATABASE_URL` — local PostgreSQL
- `DATABASE_URL_PRODUCTION` — Supabase (port 5432, not 6543)
- `RESEND_API_KEY` — email alerts for ingestion failures
- `ACLED_EMAIL` / `ACLED_PASSWORD` — ACLED API (when access granted)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — AWS CLI

## AWS Deployment

- **CloudFront URL:** https://d1apamzo7oo4z.cloudfront.net
- **Domain:** refugeeflow.com (pending AWS Support — registration blocked on new account)
- **Stack name:** refugee-flow (us-east-1)
- **Architecture:** CloudFront → S3 (static frontend) + ALB → ECS Fargate (Express API)
- **CI/CD:** Push to `main` triggers GitHub Actions (frontend → S3 sync + invalidate, backend → ECR push → ECS deploy)
- **Auth:** GitHub OIDC (no long-lived keys), scoped to abinofbrooklyn/refugee-flow:main
- **Secrets:** AWS Secrets Manager (refugee-flow/production) — DATABASE_URL, ADMIN_SECRET, RESEND_API_KEY
- **GitHub repo secrets:** AWS_ROLE_ARN, S3_BUCKET, CF_DIST_ID
- **Monitoring:** 4 CloudWatch alarms (CPU, task count, Lambda crashes, restart rate), SNS email alerts
- **Billing:** $15/month budget with 80% alert to abin.abraham4@gmail.com
- **CloudFront API cache:** Query strings forwarded (QueryStringBehavior: all), 1h default TTL, ingestion crons invalidate /data/* after successful updates
- **Template:** infrastructure/cloudformation.yaml (~1050 lines)

## Routes (12 total)

All routes defined in src/data/IBC_crossingCountByCountry.json with per-route fitBounds. Route names, slugs, and lists are interconnected across multiple files — see .planning/ for the route interconnections checklist when modifying routes.

## Organization

The Center for Tomorrow Limited (UK nonprofit, Company No. 17032685) — provides institutional email for ACLED API access. Refugee Flow is an independent project, not a Center project.
