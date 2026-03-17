---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
stopped_at: Completed 03-01-PLAN.md
last_updated: "2026-03-17T02:51:03Z"
last_activity: 2026-03-17 — Phase 3 Plan 01 complete
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
  percent: 42
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** Users can explore the human cost of conflict through an interactive, data-accurate visualization.
**Current focus:** Phase 3 — Database Migration

## Current Position

Phase: 3 of 5 (Database Migration)
Plan: 1 of 4 in current phase
Status: In progress
Last activity: 2026-03-17 — Phase 3 Plan 01 complete

Progress: [████░░░░░░] 42%

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-17T02:51:03Z
Stopped at: Completed 03-01-PLAN.md
Resume file: .planning/phases/03-database-migration/03-01-SUMMARY.md
