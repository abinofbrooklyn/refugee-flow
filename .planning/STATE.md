---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-08-PLAN.md
last_updated: "2026-03-20T03:11:42.910Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 20
  completed_plans: 19
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can explore the human cost of conflict through an interactive, data-accurate visualization.
**Current focus:** Phase 04 — data-ingestion-pipeline

## Current Position

Phase: 04 (data-ingestion-pipeline) — EXECUTING
Plan: 8 of 8 (COMPLETE)

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-20T03:11:42.905Z
Stopped at: Completed 04-08-PLAN.md
Resume file: None
