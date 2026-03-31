---
phase: 14-aws-cloudformation-deployment
plan: 01
subsystem: infra
tags: [docker, ecs, cloudfront, typescript, aws-sdk, express, rate-limit]

# Dependency graph
requires:
  - phase: 12-security-hardening
    provides: per-IP rate limiting via express-rate-limit that trust proxy protects
  - phase: 07-start-v2-typescript-migration
    provides: TypeScript server source compiled with tsc
  - phase: 04-data-ingestion-pipeline
    provides: retryRunner.ts wrapping all ingestion cron jobs
provides:
  - production-ready Docker image for ECS Fargate deployment
  - multi-stage Dockerfile compiling TypeScript to JS with node:22-alpine
  - CloudFront cache invalidation wired into ingestion pipeline
  - Express trust proxy for correct per-IP rate limiting behind CloudFront
affects:
  - 14-02 (ECS task definition uses this Dockerfile)
  - 14-03 (CloudFront distribution invalidated by retryRunner)
  - 14-04 (CI/CD pipeline builds and pushes this Docker image)

# Tech tracking
tech-stack:
  added:
    - "@aws-sdk/client-cloudfront@^3.1021.0"
  patterns:
    - multi-stage Docker build (builder + production stages)
    - npm ci --legacy-peer-deps for eslint-config-airbnb peer conflict
    - CF_DIST_ID env var guards CloudFront calls (no-op in local dev)
    - CloudFront cache invalidation as side effect of successful ingestion

key-files:
  created:
    - Dockerfile
    - .dockerignore
  modified:
    - server/server.ts (trust proxy setting)
    - server/ingestion/retryRunner.ts (CloudFront cache invalidation)
    - package.json (added @aws-sdk/client-cloudfront)

key-decisions:
  - "Dockerfile entry point is dist-server/server/server.js — tsc preserves source directory structure in output"
  - "npm ci --legacy-peer-deps in Dockerfile — eslint-config-airbnb@19 requires eslint@^8 but project uses eslint@10"
  - "scripts/ directory copied in builder stage — cbpIngestion.ts imports nationality-map.js from scripts/"
  - "trust proxy 1 = trust first proxy hop (CloudFront only, no ALB between CF and Fargate)"
  - "invalidateCloudFrontCache never throws — data is in DB, cache expires naturally if invalidation fails"

patterns-established:
  - "Docker builds use --legacy-peer-deps for this project's eslint-config-airbnb peer conflict"
  - "CF_DIST_ID env var pattern: set in ECS task definition, unset in local dev, guards all CF SDK calls"

requirements-completed: [DEPLOY-02, DEPLOY-03]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 14 Plan 01: Dockerfile + CloudFront Integration Summary

**Production Docker image on node:22-alpine compiling TypeScript with tsc, plus CloudFront cache invalidation wired into all 7 ingestion cron jobs via retryRunner.ts**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T22:19:39Z
- **Completed:** 2026-03-31T22:25:46Z
- **Tasks:** 4
- **Files modified:** 5 (Dockerfile, .dockerignore, server.ts, retryRunner.ts, package.json)

## Accomplishments
- Multi-stage Dockerfile: builder compiles TS with `tsc --noEmit false --outDir dist-server`, production stage uses `npm ci --omit=dev`; verified with `docker build` and HTTP 200 smoke test
- Express trust proxy set to 1 before rate limiting middleware — ensures `req.ip` reflects real visitor IP through CloudFront's X-Forwarded-For header
- `invalidateCloudFrontCache()` added to `runWithRetry` success path — all 7 ingestion cron jobs automatically bust `/data/*` CloudFront cache after successful updates
- Pre-existing snapshot test failure documented (not introduced by this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create multi-stage Dockerfile and .dockerignore** - `fa377a23` (chore)
2. **Task 2: Verify container starts and serves API responses** - `608091ab` (fix — entry point path)
3. **Task 3: Add trust proxy setting for CloudFront** - `5db310f1` (feat)
4. **Task 4: Add CloudFront cache invalidation to ingestion pipeline** - `49eeca42` (feat)

## Files Created/Modified
- `Dockerfile` - Multi-stage node:22-alpine build; builder compiles TypeScript, production serves compiled JS
- `.dockerignore` - Excludes node_modules, dist, src, .env, .planning, tests, coverage
- `server/server.ts` - Added `app.set('trust proxy', 1)` after Express app creation, before middleware
- `server/ingestion/retryRunner.ts` - Added `invalidateCloudFrontCache()` with CF_DIST_ID guard and try/catch
- `package.json` + `package-lock.json` - Added `@aws-sdk/client-cloudfront@^3.1021.0`

## Decisions Made
- **Dockerfile CMD path:** `dist-server/server/server.js` not `dist-server/server.js` — tsc preserves source directory structure in output (`server/server.ts` → `dist-server/server/server.js`)
- **--legacy-peer-deps in Docker:** Project-wide pre-existing peer conflict between eslint-config-airbnb@19 (requires eslint@^8) and eslint@10; all `npm ci` calls in Dockerfile use `--legacy-peer-deps`
- **Copy scripts/ in builder:** `cbpIngestion.ts` imports from `../../scripts/nationality-map.js`; builder must include `scripts/` for tsc to resolve the module
- **trust proxy 1:** Single proxy hop (CloudFront → Fargate directly, no ALB); value 1 is correct for this topology
- **CF_DIST_ID guard:** Cache invalidation is a no-op when `CF_DIST_ID` is unset — safe in local dev, active in ECS where the env var is set via task definition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added --legacy-peer-deps to Dockerfile npm ci commands**
- **Found during:** Task 1 (docker build)
- **Issue:** `npm ci` failed in container — eslint-config-airbnb@19 requires eslint@^8 but project has eslint@10; same conflict that exists locally
- **Fix:** Added `--legacy-peer-deps` to both `npm ci` calls (builder and production stages)
- **Files modified:** Dockerfile
- **Verification:** `docker build` succeeded after adding flag
- **Committed in:** fa377a23 (Task 1 commit)

**2. [Rule 3 - Blocking] Added scripts/ directory copy to builder stage**
- **Found during:** Task 1 (docker build — tsc compilation step)
- **Issue:** `tsc` failed with `Cannot find module '../../scripts/nationality-map.js'` because cbpIngestion.ts imports from scripts/ which wasn't copied into the build context
- **Fix:** Added `COPY scripts/ ./scripts/` to builder stage
- **Files modified:** Dockerfile
- **Verification:** `tsc` compilation succeeded after copying scripts/
- **Committed in:** fa377a23 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed Dockerfile CMD entry point path**
- **Found during:** Task 2 (container smoke test)
- **Issue:** `node dist-server/server.js` failed with "Cannot find module" — tsc preserves directory structure, so compiled output is at `dist-server/server/server.js` not `dist-server/server.js`
- **Fix:** Updated CMD to `["node", "dist-server/server/server.js"]`
- **Files modified:** Dockerfile
- **Verification:** Container started, `docker logs` showed "App running in production at port :2700", `curl localhost:2700/data/war` returned HTTP 200
- **Committed in:** 608091ab (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes required for Docker build and container startup. No scope creep.

## Issues Encountered
- Pre-existing snapshot test failure in `tests/client/snapshots-04-pre.test.tsx` (className hash mismatch in styled-component). Verified pre-existing: identical failure count before and after this plan's changes. Not introduced by this plan.

## User Setup Required
None — no external service configuration required for this plan. CF_DIST_ID will be set by CloudFormation in plan 02/03.

## Next Phase Readiness
- Dockerfile is ready for ECR push in plan 02 (ECS infrastructure)
- `trust proxy` is active — rate limiting will work correctly behind CloudFront
- CloudFront cache invalidation is wired in — will activate once CF_DIST_ID is set in ECS task definition (plan 03)
- Pre-existing snapshot test failure should be addressed before going live

## Self-Check: PASSED

- Dockerfile: FOUND
- .dockerignore: FOUND
- 14-01-SUMMARY.md: FOUND
- fa377a23 (Task 1 commit): FOUND
- 608091ab (Task 2 commit): FOUND
- 5db310f1 (Task 3 commit): FOUND
- 49eeca42 (Task 4 commit): FOUND

---
*Phase: 14-aws-cloudformation-deployment*
*Completed: 2026-03-31*
