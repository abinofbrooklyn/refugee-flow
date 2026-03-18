# Refugee Flow

## What This Is

A conflict and refugee data visualization app showing war/conflict events on an interactive 3D globe, refugee migration routes on an interactive map, and asylum application charts. Built for public awareness of global displacement. Currently serving static data; being modernized to pull from live APIs (ACLED, UNHCR, IOM).

## Core Value

Users can explore the human cost of conflict — where wars happen, where people flee, and where they seek asylum — through an interactive, data-accurate visualization.

## Requirements

### Validated

- ✓ 3D globe visualization of war/conflict events by year and country (THREE.js) — existing
- ✓ Interactive refugee migration route map (MapLibre) — existing
- ✓ Asylum application charts by country — existing
- ✓ Landing page with mobile/desktop variants — existing
- ✓ Express REST API serving war data, asylum data, route data — existing
- ✓ Redux state management (selectedYear, currentCountry) — existing
- ✓ Geo precision reduction to prevent GPU overload from overlapping points — existing

### Active

- [x] Security vulnerabilities patched (npm audit) — Phase 1
- [x] Memory leaks fixed (GlobeVisual, landing components) — Phase 1
- [x] Error handling and loading states on all data fetches — Phase 1
- [x] Globe rotation toggle UI — Phase 1
- [x] Deprecated lifecycle methods suppressed — Phase 2
- [x] React 18 upgrade — Phase 2
- [x] Vite replacing Webpack 4 — Phase 2
- [x] THREE.js r150+ upgrade — Phase 2
- [x] Dependency cleanup (remove jquery, underscore, legacy mapbox-gl) — Phase 2
- [x] PostgreSQL/Supabase replacing MongoDB — Phase 3
- [ ] Automated data ingestion from ACLED, UNHCR, IOM APIs
- [ ] Admin CSV upload interface for manual data sources
- [ ] Geo precision pipeline applied at ingestion time
- [ ] Data gap audit and forward-looking data coverage

### Out of Scope

- Historical backfill to 1997 — only ingest from current data forward
- Full authentication system — admin protected by shared secret only
- TypeScript migration — not in v1 scope
- Mobile app — web-first

## Context

Brownfield project. Codebase mapped 2026-03-10. Key issues: React 16 with deprecated lifecycle methods, Webpack 4, THREE.js 0.91, MongoDB (former partner's account), static JSON data files, no tests, security vulnerabilities in dev dependencies. The geo precision reduction (`reduceGeoPercision()`) and `uniqBy` deduplication on `lat,lng` composite key are critical — raw coordinate precision causes GPU crashes in the browser.

## Constraints

- **Data**: No historical backfill — ingest forward from current state only
- **Database**: PostgreSQL via Supabase (owner-controlled, replaces inaccessible MongoDB)
- **Build**: Vite replaces Webpack 4 (drops `NODE_OPTIONS=--openssl-legacy-provider` hack)
- **Admin**: Shared secret auth only — no full auth system
- **Geo**: All lat/lng must be precision-reduced before storage — non-negotiable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PostgreSQL/Supabase over MongoDB | Relational data, time-series queries, owner-controlled free tier | Done (Phase 3) |
| Vite over Webpack 5 | Faster builds, simpler config, drops legacy OpenSSL hack | Done (Phase 2) |
| No historical backfill | Avoid months of data archaeology; ingest forward only | Active |
| Geo precision at ingestion time | Prevent GPU overload; store clean data, not raw API coords | Done (Phase 3) |
| Shared secret admin (no full auth) | Low-traffic app, simple enough, full auth is overkill | Pending (Phase 4) |
| Supabase Edge Functions for ingestion | Co-located with DB, built-in cron, no separate service | Pending (Phase 4) |

---
*Last updated: 2026-03-17 — Phases 1-3 complete*
