# Refugee Flow — Project Instructions

## SECURITY FIRST — MANDATORY

**This is a security-first project. These rules are absolute and override all other instructions.**

### Before EVERY git push, commit, or PR:

Run a security check. If ANY of the following are found in staged files, **STOP and alert the user**:

1. **Secrets & credentials:** API keys, passwords, tokens, access keys, secret keys, connection strings with passwords
2. **AWS identifiers:** Account IDs, ARNs, resource IDs (distribution IDs, bucket names with account numbers, role ARNs)
3. **Infrastructure code:** CloudFormation templates, Terraform files, task definitions, Lambda source, Dockerfiles with secrets — these expose architecture and account details
4. **PII:** Email addresses, phone numbers, personal names in code (not in git author metadata)
5. **Internal URLs:** Supabase connection strings, CloudFront distribution URLs, S3 bucket URLs, ALB DNS names

### What is NEVER committed to this public repo:

- `infrastructure/` — CloudFormation, task definitions, Lambda code (in .gitignore)
- `.env` — credentials and secrets (in .gitignore)
- `.planning/` — internal project planning (filtered by pre-push hook)
- Any file containing AWS account IDs, ARNs, or resource identifiers
- Any file containing database connection strings or API keys
- Hardcoded emails, passwords, or tokens anywhere in source code

### How to check before pushing:

```bash
# Scan staged files for secrets patterns
git diff --cached --name-only | xargs grep -l -iE '(AKIA|aws_secret|password|api_key|token|secret|\.supabase\.com|dkr\.ecr\.|cloudfront\.net/|s3\.amazonaws)' 2>/dev/null
```

If this returns ANY files, do not push. Fix the files first.

### If you created a file and aren't sure if it's safe:

**Ask the user before committing.** The cost of asking is zero. The cost of leaking credentials is catastrophic.

---

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
infrastructure/         # LOCAL ONLY — never in git (contains AWS account IDs, ARNs)
.planning/              # LOCAL ONLY — filtered by pre-push hook
.env                    # LOCAL ONLY — credentials and secrets
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

- **ACLED API access:** Registered with institutional email, awaiting Partner-level access approval. Ingestion code exists (server/ingestion/acledIngestion.ts) but can't run without credentials.
- **refugeeflow.com domain:** Registration failed (new AWS account). Need to contact AWS Support. Template supports custom domain — just needs DomainName parameter.

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

See `.env.example` for all required variables. Never log, print, or commit actual values. Key ones:
- `DATABASE_URL` — local PostgreSQL
- `DATABASE_URL_PRODUCTION` — Supabase (port 5432, not 6543)
- `RESEND_API_KEY` — email alerts for ingestion failures
- `ACLED_EMAIL` / `ACLED_PASSWORD` — ACLED API (when access granted)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — AWS CLI

## AWS Deployment

- **Architecture:** CloudFront → S3 (static frontend) + ALB → ECS Fargate (Express API)
- **CI/CD:** Push to `main` triggers GitHub Actions (frontend + backend deploy)
- **Auth:** GitHub OIDC (no long-lived keys)
- **Secrets:** Stored in AWS Secrets Manager and GitHub repo secrets — never in code
- **Template:** infrastructure/cloudformation.yaml (LOCAL ONLY — never committed, contains account-specific config)
- **Details:** See infrastructure/ directory locally for full config. Never share publicly.

## Routes (12 total)

All routes defined in src/data/IBC_crossingCountByCountry.json with per-route fitBounds. Route names, slugs, and lists are interconnected across multiple files — see .planning/ for the route interconnections checklist when modifying routes.

## Organization

Affiliated with The Center for Tomorrow (UK nonprofit) for institutional API access. Refugee Flow is an independent project.
