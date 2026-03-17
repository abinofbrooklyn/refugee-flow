---
phase: 4
slug: data-ingestion-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (or vitest if already configured) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx jest --testPathPattern=server/ingestion` |
| **Full suite command** | `npx jest --testPathPattern="server/(ingestion|routes/admin)"` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --testPathPattern=server/ingestion`
- **After every plan wave:** Run `npx jest --testPathPattern="server/(ingestion|routes/admin)"`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | INGEST-05 | unit | `npx jest ingestion_log` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | INGEST-01, INGEST-04 | integration | `npx jest acled` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | INGEST-02, INGEST-04 | integration | `npx jest unhcr` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | INGEST-03, INGEST-04 | integration | `npx jest iom` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 3 | INGEST-06, INGEST-07 | integration | `npx jest admin` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/ingestion/__tests__/` — test directory for ingestion modules
- [ ] Jest or Vitest configured for server-side tests
- [ ] Test database connection setup (can use Supabase or local Docker Postgres)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin CSV upload UI | INGEST-06, INGEST-07 | React component rendering | Navigate to /admin, enter password, upload CSV, verify preview table renders, commit/cancel works |
| Cron schedule fires | INGEST-01-03 | Timing-dependent | Set cron to 1-minute interval, wait, check ingestion_log for new entry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
