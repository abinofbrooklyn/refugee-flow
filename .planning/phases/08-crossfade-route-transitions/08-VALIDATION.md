---
phase: 8
slug: crossfade-route-transitions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + react-test-renderer 18 (jsdom) |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --testPathPattern=tests/client` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=tests/client`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | UX-CROSSFADE | unit | `npm test -- --testPathPattern=TransitionOutlet` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | UX-CROSSFADE | unit | `npm test -- --testPathPattern=useTransitionSignal` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/client/TransitionOutlet.test.tsx` — covers outlet render + crossfade trigger logic
- [ ] `tests/client/useTransitionSignal.test.tsx` — covers context signalReady/onReady contract

*Existing infrastructure covers framework needs — Jest + jsdom already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Crossfade visual smoothness | UX-CROSSFADE | CSS transition visual quality cannot be unit tested | Navigate between routes in browser; old route should fade out while new fades in over ~400ms |
| Adaptive threshold (cached vs uncached) | UX-CROSSFADE | Requires real network timing | First visit: crossfade visible. Revisit same route: instant switch. |
| MapLibre canvas intact during fade | UX-CROSSFADE | WebGL rendering visual verification | Old route's map should remain fully rendered during fade-out, not go blank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
