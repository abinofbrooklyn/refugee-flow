---
phase: 14
slug: aws-cloudformation-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.3.0 + Supertest 7.2.2 (existing) |
| **Config file** | `jest.config.js` (existing) |
| **Quick run command** | `npm test -- --testPathPattern=server --passWithNoTests` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (Vite build check) + `aws cloudformation validate-template`
- **After every plan wave:** Run `npm test` + `docker build -t refugee-flow-test .`
- **Before `/gsd:verify-work`:** Full suite must be green + end-to-end CloudFront smoke tests

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | DEPLOY-01 | Build check | `npm run build` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | DEPLOY-02 | Build check | `docker build -t refugee-flow-test .` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 1 | DEPLOY-04 | Lint | `aws cloudformation validate-template --template-body file://infrastructure/cloudformation.yaml` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 2 | DEPLOY-05 | CI check | Push to main, observe Actions tab | ❌ W0 | ⬜ pending |
| 14-04-01 | 04 | 3 | DEPLOY-03 | Smoke test | `docker run -e DATABASE_URL=... -p 2700:2700 refugee-flow-test` + `curl localhost:2700/data/war` | ❌ W0 | ⬜ pending |
| 14-04-02 | 04 | 3 | DEPLOY-06 | Manual | `curl https://BUCKET.s3.amazonaws.com/index.html` should 403 | N/A | ⬜ pending |
| 14-04-03 | 04 | 3 | DEPLOY-07 | Manual | `curl https://d1234.cloudfront.net/` returns HTML | N/A | ⬜ pending |
| 14-04-04 | 04 | 3 | DEPLOY-08 | Manual | `curl https://d1234.cloudfront.net/data/war` returns JSON | N/A | ⬜ pending |
| 14-04-05 | 04 | 3 | DEPLOY-09 | Manual | `aws ecs describe-task-definition` — secrets shows ARN not value | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `Dockerfile` — does not exist; must be created in Wave 1
- [ ] `infrastructure/cloudformation.yaml` — does not exist; must be created in Wave 1-2
- [ ] `.github/workflows/deploy.yml` — does not exist; must be created in Wave 3
- [ ] `infrastructure/task-definition.json` — does not exist; placeholder for GitHub Actions render step

*Existing test infrastructure (Jest + Supertest) covers application-level regression.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| S3 bucket inaccessible directly | DEPLOY-06 | Requires live AWS resources | curl bucket URL, expect 403 |
| CloudFront serves frontend | DEPLOY-07 | Requires deployed stack | curl CloudFront domain, expect HTML |
| CloudFront proxies API | DEPLOY-08 | Requires deployed stack | curl /api/war, expect JSON |
| Secrets not exposed in task def | DEPLOY-09 | Requires deployed ECS | Inspect task definition JSON |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
