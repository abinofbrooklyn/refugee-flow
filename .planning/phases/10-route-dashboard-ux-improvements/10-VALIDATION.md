---
phase: 10
slug: route-dashboard-ux-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest (jsdom) |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --testPathPatterns=client` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit && npm run build`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | UX-FRAMING | build | `npx tsc --noEmit && npm run build` | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | UX-FRAMING | visual | Manual browser check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no new test framework or test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-route map framing matches user screenshots | UX-FRAMING | Visual framing quality cannot be unit tested | Navigate to each of 10 updated routes; verify initial view matches the agreed framing from screenshots |
| Sidebar collapse reframes correctly | UX-FRAMING | Requires visual MapLibre viewport check | Collapse sidebar on each route; map should reframe to use full width without losing data focus |
| Route switch animates to new framing | UX-FRAMING | Visual animation quality | Switch between routes; map should fly to new framing smoothly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
