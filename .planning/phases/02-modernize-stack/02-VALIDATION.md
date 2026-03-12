---
phase: 02
slug: modernize-stack
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x (existing) |
| **Config file** | package.json (jest config inline) |
| **Quick run command** | `npm test -- --passWithNoTests` |
| **Full suite command** | `npm test -- --passWithNoTests` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --passWithNoTests`
- **After every plan wave:** Run `npm test -- --passWithNoTests`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | MOD-02 | grep | `grep -r "UNSAFE_componentWillReceiveProps" src/ \| wc -l` returns 0 after rename | N/A | ⬜ pending |
| 02-02-01 | 02 | 2 | MOD-03 | build+grep | `node -e "require('three').REVISION"` shows 165+ | N/A | ⬜ pending |
| 02-03-01 | 03 | 3 | MOD-01 | build | `npx vite build` exits 0 | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 4 | MOD-04 | grep | `ls node_modules/{jquery,underscore} 2>/dev/null` returns empty | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing jest infrastructure covers all phase requirements
- Vite build verification is a post-migration command (not a pre-existing test)

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe renders correctly after THREE.js upgrade | MOD-03 | WebGL visual output cannot be verified by CLI | Start app, navigate to globe, verify 3D rendering, country hover, route display |
| No deprecated lifecycle warnings in console | MOD-02 | Console warnings require browser observation | Open DevTools console, navigate all views, verify zero React deprecation warnings |
| App builds and runs with Vite | MOD-01 | Dev server behavior requires browser verification | `npm run dev`, open browser, verify hot reload works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
