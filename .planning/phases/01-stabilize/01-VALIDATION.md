---
phase: 1
slug: stabilize
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 24.8.0 + Enzyme (configured via `enzyme.config.js`) |
| **Config file** | `jest.config.js` (exists at project root) |
| **Quick run command** | `npm test -- --testPathPattern=<file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds (no test files exist yet) |

---

## Sampling Rate

- **After every task commit:** `npm audit` for STAB-05; `npm test` for any unit tests created
- **After every plan wave:** `npm audit` + manual browser smoke test
- **Before `/gsd:verify-work`:** Full suite green + manual navigation test
- **Max feedback latency:** ~10 seconds (npm audit) / manual for UI behaviors

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| STAB-01 | memory leaks | 1 | STAB-01 | manual | Browser memory profiler — navigate away from globe, check heap | ❌ manual | ⬜ pending |
| STAB-02 | loading states | 1 | STAB-02 | manual | Start dev server, load app, observe spinner during data fetch | ❌ manual | ⬜ pending |
| STAB-03 | error states | 1 | STAB-03 | manual | Kill API server, reload app, verify error message appears | ❌ manual | ⬜ pending |
| STAB-04 | rotation toggle | 1 | STAB-04 | manual | Open globe view, click toggle button, verify rotation stops/resumes | ❌ manual | ⬜ pending |
| STAB-05 | security patches | 1 | STAB-05 | automated | `npm audit` | n/a (audit output) | ⬜ pending |
| STAB-06 | CORS + rate limit | 1 | STAB-06 | integration | `npm test -- --testPathPattern=rateLimit` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/server/rateLimit.test.js` — integration test for 429 behavior covering STAB-06

*Existing Jest infrastructure covers all other phase requirements. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Memory leaks fixed on globe navigate | STAB-01 | Requires browser memory profiler (Chrome DevTools heap snapshot) | Navigate to globe → navigate away → take heap snapshot → verify GlobeVisual listeners not retained |
| Spinner visible during data fetch | STAB-02 | Requires rendered app with network throttling | Open DevTools → Network tab → throttle to Slow 3G → reload → spinner must appear |
| Error message shown on fetch failure | STAB-03 | Requires mocked API failure | Stop backend server → reload frontend → verify error message (not blank/frozen) |
| Globe rotation toggles on button click | STAB-04 | Requires rendered THREE.js scene | Open globe view → click rotation toggle → globe stops → click again → globe resumes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (manual) / 10s (automated)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
