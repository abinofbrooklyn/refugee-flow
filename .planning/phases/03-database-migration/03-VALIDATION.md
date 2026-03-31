---
phase: 03
slug: database-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-15
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 24.x (existing) |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest --testPathPattern=server` |
| **Full suite command** | `npx jest` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=server`
- **After every plan wave:** Run `npx jest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | DB-04 | integration | `docker compose up -d && npm run db:migrate` | N/A (infra) | pending |
| 03-01-T2 | 03-01 | 1 | DB-01 | integration | `npx knex migrate:latest && node -e "require('./server/database/connection').raw('SELECT 1').then(()=>console.log('ok'))"` | N/A (infra) | pending |
| 03-02-T1 | 03-02 | 2 | DB-03 | unit | `npx jest --testPathPattern=geo` | W0 | pending |
| 03-02-T2 | 03-02 | 2 | DB-03 | integration | `node scripts/seed.js && node -e "..."` | W0 | pending |
| 03-03-T1 | 03-03 | 3 | DB-01 | integration | `npx jest --testPathPattern=endpoints` | W0 | pending |
| 03-03-T2 | 03-03 | 3 | DB-02 | integration | `npx jest --testPathPattern=endpoints` | W0 | pending |
| 03-04-T1 | 03-04 | 4 | DB-01,DB-02,DB-03,DB-04 | integration | `npx jest --testPathPattern=server` | W0 (this plan creates them) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `server/__tests__/endpoints.test.js` — response shape parity tests for all 6 endpoints
- [ ] `server/__tests__/geo.test.js` — precision reduction and dedup verification
- [ ] `server/__tests__/startup.test.js` — app starts without MongoDB connection string
- [ ] `server/__tests__/helpers/testDb.js` — test database setup/teardown utilities

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| docker-compose up starts Postgres and auto-seeds | DB-04 | Requires Docker runtime | Run `docker-compose up -d`, verify `psql -h localhost -U refugeeflow -d refugeeflow -c '\dt'` shows tables |
| Supabase hosted connection works | DB-01 | Requires live Supabase project | Set production .env, start server, verify endpoints return data |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
