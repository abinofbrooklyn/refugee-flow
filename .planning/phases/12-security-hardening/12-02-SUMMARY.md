---
phase: 12-security-hardening
plan: "02"
subsystem: security, middleware, express
tags: [security, helmet, csp, cors, rate-limiting, error-sanitization]
dependency_graph:
  requires: ["12-01"]
  provides: [csp-headers, cors-method-restriction, health-rate-limiter, sanitized-errors, security-tests]
  affects: [server/server.ts, server/routes/dataRoute.ts, server/controllers/api/data/ingestionHealthController.ts, tests/server/security.test.ts]
tech_stack:
  added: []
  removed: []
  patterns: [Helmet v8 contentSecurityPolicy useDefaults:false, healthLimiter exported from dataRoute]
key_files:
  created:
    - tests/server/security.test.ts
  modified:
    - server/server.ts
    - server/routes/dataRoute.ts
    - server/controllers/api/data/ingestionHealthController.ts
decisions:
  - "healthLimiter defined in dataRoute.ts (not server.ts) — server.ts uses export = app (CommonJS interop); avoids changing export pattern"
  - "useDefaults: false for CSP — explicit directives for predictability; no hidden defaults from Helmet"
  - "crossOriginEmbedderPolicy: false — required for map tile cross-origin loading in MapLibre"
  - "apiLimiter raised 200 -> 300 req/15min — museum kiosk single IP for many sequential visitors"
  - "Static analysis in error sanitization test — grep for (err as Error).message in source file; more reliable than triggering runtime errors"
metrics:
  duration: "159 seconds (~2.5 min)"
  completed_date: "2026-03-30"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 02: Security Hardening — CSP, CORS, Error Sanitization, Rate Limiting Summary

Helmet v8 CSP configured with blob: workers and CartoCDN tiles for MapLibre, CORS restricted to GET/HEAD only, /data/ingestion-health rate limited to 10 req/15min, all 6 dataRoute catch blocks and the ingestion health controller sanitized to never expose raw error details, with a 10-test security suite proving each measure.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Harden server — Helmet v8 CSP, CORS GET-only, rate limits, error sanitization | c072979 | server.ts: contentSecurityPolicy + CORS methods + max:300; dataRoute.ts: healthLimiter + 6 catch blocks; ingestionHealthController.ts: try/catch + generic lastError.message |
| 2 | Security tests — CSP, CORS, error sanitization, health rate limit | b5c5c84 | tests/server/security.test.ts: 10 tests covering all security measures |

## Verification Results

- `grep contentSecurityPolicy server/server.ts` — match found
- `grep "methods.*GET.*HEAD" server/server.ts` — match found (CORS restricted)
- `grep -c "Internal server error" server/routes/dataRoute.ts` — returns 6
- `grep "Ingestion error" server/controllers/api/data/ingestionHealthController.ts` — match found
- `grep "healthLimiter" server/routes/dataRoute.ts` — match found
- `grep "(err as Error).message" server/routes/dataRoute.ts` — NO match
- `grep "helmet.referrerPolicy" server/server.ts` — NO match (v3 pattern removed)
- `grep "max: 300" server/server.ts` — match found
- `npm test -- --testPathPatterns=tests/server/security` — 10/10 passed
- `npm test -- --testPathPatterns=tests/server/endpoints` — 11/11 passed (no regression)
- `npm test -- --testPathPatterns=tests/server/rateLimit` — 3/3 passed (no regression)

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `server/server.ts` contains `contentSecurityPolicy` — CONFIRMED
- [x] `server/routes/dataRoute.ts` exports `healthLimiter` — CONFIRMED
- [x] `server/routes/dataRoute.ts` has 6 occurrences of `Internal server error` — CONFIRMED
- [x] `tests/server/security.test.ts` exists — CONFIRMED
- [x] Commit `c072979` exists in git log — CONFIRMED
- [x] Commit `b5c5c84` exists in git log — CONFIRMED

## Self-Check: PASSED
