---
phase: 03-database-migration
plan: 01
subsystem: database
tags: [postgres, knex, docker, dotenv, migration, pg]

# Dependency graph
requires:
  - phase: 02-modernize-stack
    provides: Vite build, clean Express server without legacy hacks
provides:
  - Docker Compose postgres:16 container with named volume and healthcheck
  - knex pg connection module exporting db instance (replaces Mongoose)
  - dotenv loaded as first line of server.js (replaces config.js pattern)
  - db/knexfile.js with dev and production config
  - db/migrations/001_create_tables.js creating all 6 tables (war_events, war_notes, asy_applications, route_deaths, ibc_crossings, country_routes)
  - npm scripts: db:migrate, db:rollback, db:seed, db:reset, db:up
affects:
  - 03-02 (seed script depends on these tables and connection module)
  - 03-03 (controller rewrite depends on knex connection module)
  - 03-04 (Supabase production uses same DATABASE_URL knexfile pattern)

# Tech tracking
tech-stack:
  added:
    - knex@3.1.0 (query builder + migration runner)
    - pg@8.20.0 (PostgreSQL client)
    - dotenv@17.3.1 (env var loading)
  patterns:
    - Single knex instance exported from server/database/connection.js
    - DATABASE_URL from .env drives both connection and migration
    - db/knexfile.js with path-resolved dotenv for CLI migration runs
    - docker compose up -d for local dev database lifecycle

key-files:
  created:
    - docker-compose.yml
    - .env.example
    - db/knexfile.js
    - db/migrations/001_create_tables.js
  modified:
    - server/server.js (dotenv as first line)
    - server/database/connection.js (Mongoose replaced with knex)
    - package.json (knex/pg/dotenv added, db:* scripts added)

key-decisions:
  - "float8 (not NUMERIC/decimal) for lat/lng columns to avoid pg driver returning strings"
  - "dead/missing/dead_and_missing in route_deaths stored as TEXT to preserve API response shape"
  - "ibc_crossings fully normalized (route, year, quarter, count) — no JSONB blobs per locked decision"
  - "war_notes table created empty — MongoDB data lost, ACLED population deferred to Phase 4"
  - "cot column as text[] — pg driver handles JS arrays natively for array columns"

patterns-established:
  - "Pattern: Knex instance — require('./server/database/connection') exports db directly, no Promise wrapping"
  - "Pattern: Dotenv first — require('dotenv').config() as absolute first line of server.js"
  - "Pattern: Migration path — db/knexfile.js uses path.resolve(__dirname, '../.env') for CLI portability"

requirements-completed: [DB-01, DB-04]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 3 Plan 01: Database Foundation Summary

**Docker Compose postgres:16 + knex connection module + 6-table migration replacing Mongoose/config.js with DATABASE_URL-driven pg stack**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T02:42:47Z
- **Completed:** 2026-03-17T02:51:03Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Postgres 16 container running locally via Docker Compose with named volume `pgdata` and healthcheck
- Mongoose connection replaced with knex pg instance — exports `db` directly (no Promise wrapping), reads DATABASE_URL from .env
- All 6 tables created via `npm run db:migrate`: war_events, war_notes, asy_applications, route_deaths, ibc_crossings, country_routes
- dotenv loaded as first line of server.js; config.js pattern eliminated from connection.js

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, Docker Compose, dotenv, knex connection** - `c4e32d4` (feat)
2. **Task 2: Create knex migration with all 6 table schemas** - `777aa84` (feat)

## Files Created/Modified
- `docker-compose.yml` - postgres:16 container with healthcheck, named volume pgdata, port 5432
- `.env.example` - local dev defaults: DATABASE_URL, PORT=2700, NODE_ENV=development
- `db/knexfile.js` - knex CLI config for dev/production, path-resolved dotenv
- `db/migrations/001_create_tables.js` - 6 tables with float8 lat/lng, text[] array columns, indexes on year+quarter
- `server/server.js` - require('dotenv').config() added as first line
- `server/database/connection.js` - Mongoose replaced with knex pg instance
- `package.json` - knex@3, pg@8.20, dotenv@17.3 added; db:migrate, db:rollback, db:seed, db:reset, db:up scripts

## Decisions Made
- Used `float8` (not `t.decimal`) for lat/lng — avoids pg driver returning NUMERIC as strings, which would break THREE.js geometry
- `dead`, `missing`, `dead_and_missing` in route_deaths stored as TEXT — source JSON has string values ("0", "2"), preserving response shape identity
- `war_notes` created empty — MongoDB data is lost; ACLED API population is Phase 4 work
- `cot` column as `text[]` (specificType) — pg driver maps JS arrays to Postgres text[] natively

## Deviations from Plan

None - plan executed exactly as written.

One deviation note: `pg_isready` was not in PATH on the host machine. Verified Postgres readiness via `docker exec refugeeflow-postgres pg_isready -U rfuser -d refugeeflow` instead. Knex SELECT 1 test also confirmed connectivity. The container healthcheck uses this same command internally.

## Issues Encountered
- Docker daemon was not running at execution start — opened Docker Desktop, waited ~8 seconds for daemon to start. This is expected behavior on a development machine where Docker Desktop isn't always running.
- `docker` binary path is `/Applications/Docker.app/Contents/Resources/bin/docker` (not in shell PATH). Used full path for verification commands. The npm `db:up` script runs `docker compose up -d` which will work when Docker Desktop is running and PATH is configured normally.
- `pg_isready` not available on host — used container exec for verification.

## User Setup Required
None for local development. Docker Desktop must be running before `npm run db:up`.

For production (Supabase), set `DATABASE_URL` in `.env` to the Supabase connection string (includes `?sslmode=require`). This is Phase 4 work.

## Next Phase Readiness
- Database foundation complete: Postgres running, knex connected, all 6 tables created
- Plan 02 (seed script) can now insert data into all 6 tables
- Plan 03 (controller rewrite) can import `server/database/connection.js` and query directly
- `npm run db:rollback` + `npm run db:migrate` available for schema iteration

---
*Phase: 03-database-migration*
*Completed: 2026-03-17*
