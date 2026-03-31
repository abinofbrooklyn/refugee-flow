---
phase: 14-aws-cloudformation-deployment
plan: "03"
subsystem: infra
tags: [github-actions, oidc, aws, ecr, ecs, s3, cloudfront, ci-cd]

# Dependency graph
requires:
  - phase: 14-01
    provides: Dockerfile for docker build command in deploy-backend job
  - phase: 14-02
    provides: infrastructure/task-definition.json with PLACEHOLDER_ ARNs and CloudFormation outputs consumed by workflow

provides:
  - GitHub Actions CI/CD pipeline triggering on push to master
  - Automated frontend deploy (npm build -> S3 sync -> CloudFront invalidation)
  - Automated backend deploy (ECR push -> resolve ARNs from CF outputs -> ECS task def render -> ECS deploy)
  - OIDC federation so no long-lived IAM keys are stored in GitHub

affects:
  - 14-04 (deployment execution — this workflow is what gets triggered)

# Tech tracking
tech-stack:
  added:
    - aws-actions/configure-aws-credentials@v4 (OIDC token exchange)
    - aws-actions/amazon-ecr-login@v2
    - aws-actions/amazon-ecs-render-task-definition@v1
    - aws-actions/amazon-ecs-deploy-task-definition@v2
  patterns:
    - OIDC federation pattern (permissions id-token write, no stored access keys)
    - Parallel jobs pattern (deploy-frontend and deploy-backend run concurrently)
    - CloudFormation-output-as-runtime-config pattern (sed substitution of PLACEHOLDERs at deploy time)

key-files:
  created:
    - .github/workflows/deploy.yml
  modified:
    - .gitignore (added dist-server/)
    - .env.example (added AWS deployment docs section)

key-decisions:
  - "deploy-backend resolves task-definition.json ARNs from CloudFormation outputs at deploy time — not stored as GitHub secrets, always in sync with the stack"
  - "branches: [master] not [main] — this repo uses master as the default branch"
  - "Both jobs run in parallel with no depends_on — frontend and backend deploys are independent"

patterns-established:
  - "ARN resolution pattern: aws cloudformation describe-stacks + --query + sed substitution before ECS render step"
  - "OIDC auth pattern: permissions.id-token: write + role-to-assume: secrets.AWS_ROLE_ARN"

requirements-completed:
  - DEPLOY-01
  - DEPLOY-05

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 14 Plan 03: GitHub Actions CI/CD Workflow Summary

**GitHub Actions deploy workflow with OIDC federation, parallel frontend/backend jobs, and CloudFormation-output-driven task definition ARN resolution at deploy time**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T22:32:07Z
- **Completed:** 2026-03-31T22:34:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `.github/workflows/deploy.yml` created with two parallel jobs: deploy-frontend and deploy-backend
- OIDC authentication configured — `permissions.id-token: write` enables token exchange with no stored IAM access keys
- deploy-backend resolves `ECSTaskExecutionRoleArn`, `ECSTaskRoleArn`, `SecretsManagerArn`, and `CloudFrontDistributionId` from the `refugee-flow` CloudFormation stack at deploy time, then `sed`-substitutes placeholders in `infrastructure/task-definition.json` before the ECS render step
- `dist-server/` added to `.gitignore` to prevent tsc compiled output from being committed
- `.env.example` updated with documentation-only AWS deployment comment block

## Task Commits

1. **Task 1: Create GitHub Actions deploy workflow** - `f95d7378` (feat)
2. **Task 2: Add .gitignore entry and update .env.example** - `43aec1e3` (chore)

**Plan metadata:** (pending)

## Files Created/Modified

- `.github/workflows/deploy.yml` - CI/CD pipeline; two parallel jobs triggered on push to master; OIDC auth; full frontend and backend deploy paths
- `.gitignore` - Added `dist-server/` to exclude TypeScript compile output from version control
- `.env.example` - Added AWS deployment comments documenting GitHub secrets required (AWS_ROLE_ARN, S3_BUCKET, CF_DIST_ID)

## Decisions Made

- **branches: [master] not [main]** — this repository uses `master` as its default branch; aligning trigger to match actual branch name avoids the workflow never firing
- **CloudFormation outputs at runtime** — rather than storing execution role ARN, task role ARN, and secret ARN as GitHub secrets (which would drift when stack updates), the workflow queries the stack directly; this keeps task-definition.json accurate across stack redeployments without manual secret updates
- **Parallel jobs** — deploy-frontend and deploy-backend have no dependency on each other; running them in parallel minimizes total deployment time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing snapshot test failure in `tests/client/snapshots-04-pre.test.tsx` (1 failing test out of 280) — unrelated to this plan, no application code was changed. Pre-existing issue not introduced by this plan.

## User Setup Required

Before the workflow can run, set these GitHub repository secrets (Settings > Secrets > Actions):

- `AWS_ROLE_ARN` — `GitHubActionsRole` ARN from CloudFormation stack output
- `S3_BUCKET` — `FrontendBucketName` from CloudFormation stack output
- `CF_DIST_ID` — `CloudFrontDistributionId` from CloudFormation stack output

These are resolved for the frontend job only (S3 sync and CF invalidation). The backend job resolves its ARNs directly from CloudFormation outputs at runtime and does not require additional secrets.

## Next Phase Readiness

- Plan 03 complete — all CI/CD pipeline artifacts ready
- Wave 2 (plans 03) complete
- Plan 04 (CloudFormation stack deployment + DNS + smoke test) is the final wave 3 plan

---
*Phase: 14-aws-cloudformation-deployment*
*Completed: 2026-03-31*
