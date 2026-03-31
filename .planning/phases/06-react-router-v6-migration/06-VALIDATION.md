---
phase: 6
slug: react-router-v6-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 (server tests only; no frontend test infrastructure) |
| **Config file** | package.json `"test": "jest"` — runs `tests/server/` only |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (server tests must stay green as regression gate)
- **After every plan wave:** Run `npm test` + manual browser smoke test of all routes
- **Before `/gsd:verify-work`:** Full suite must be green + manual verification of all routes
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | MOD-05 | smoke | `npm test` (server regression) | Yes | pending |
| 06-02-01 | 02 | 2 | MOD-05 | manual-smoke | Manual: open browser, check console on all routes | N/A | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers server-side requirements. No frontend test infrastructure exists — validation is manual browser smoke testing per Phase 2 decisions. Adding React Testing Library is v2 scope (MOD-V2-02).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero `childContextTypes` or `legacy context` warnings | MOD-05 | Browser console inspection — no frontend test framework | Open each route in browser, open DevTools console, verify zero legacy context warnings |
| All routes navigate correctly | MOD-05 | Requires browser rendering of full React tree | Navigate to `/landing`, `/conflict`, `/route/EasternMediterranean`, `/about`, `/admin` — verify each renders |
| Route parameters resolve for all 12 routes | MOD-05 | Requires live route slug resolution | Navigate to each of 12 `/route/:arg` URLs — verify correct route data loads |
| No nested Router crash | MOD-05 | Browser runtime error detection | Navigate to `/route/:arg` pages — verify no "You cannot render a Router inside another Router" error |
| Browser back/forward navigation | MOD-05 | Requires browser history stack testing | Navigate between routes using links, then use browser back/forward buttons — verify no errors |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
