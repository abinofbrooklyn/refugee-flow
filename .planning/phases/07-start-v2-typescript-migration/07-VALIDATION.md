---
phase: 07
slug: start-v2-typescript-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 30.x + ts-jest |
| **Config file** | jest.config.js (updated for TS in Wave 0) |
| **Quick run command** | `npx jest --bail` |
| **Full suite command** | `npx jest && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --bail`
- **After every plan wave:** Run `npx jest && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | MOD-V2-01 | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | MOD-V2-01 | unit+build | `npx jest --bail && npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tsconfig.json` + `tsconfig.server.json` — dual TypeScript configs (frontend + server)
- [ ] `ts-jest` or equivalent — Jest TypeScript transform
- [ ] `@types/react`, `@types/react-dom`, `@types/express`, `@types/three` — type definitions
- [ ] Jest config updated for `.ts`/`.tsx` file handling

*Wave 0 installs TypeScript toolchain and configures build pipeline before any file conversion.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe renders correctly after GlobeVisual conversion | MOD-V2-01 | WebGL rendering, animation loop, camera behavior | 1. Load /conflict page 2. Verify globe spins 3. Click country, verify tooltip 4. Toggle rotation |
| Route map displays all 12 routes | MOD-V2-01 | MapLibre GL canvas rendering | 1. Navigate to each route slug 2. Verify map renders 3. Verify popup data displays |
| Landing page responsive behavior | MOD-V2-01 | Device-specific layout | 1. Check desktop layout 2. Resize to mobile breakpoint 3. Verify mobile variant |
| Chart renders asylum data | MOD-V2-01 | D3 canvas rendering | 1. Navigate to asylum page 2. Verify chart displays 3. Change year, verify update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
