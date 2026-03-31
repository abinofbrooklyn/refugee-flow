---
phase: 14-aws-cloudformation-deployment
plan: 02
subsystem: infra
tags: [cloudformation, ecs, fargate, cloudfront, s3, route53, acm, lambda, eventbridge, cloudwatch, iam, oidc, github-actions, secrets-manager]

# Dependency graph
requires:
  - phase: 14-aws-cloudformation-deployment (plan 01)
    provides: Dockerfile + ECR image, trust proxy + CF invalidation wired in, CF_DIST_ID env var pattern
  - phase: 12-security-hardening
    provides: Helmet CSP, CORS, rate limiting — CloudFront must not conflict with these headers
  - phase: 04-data-ingestion-pipeline
    provides: retryRunner.ts wrapping ingestion crons that need CF_DIST_ID for cache invalidation
provides:
  - infrastructure/cloudformation.yaml — complete AWS infrastructure definition (VPC, ECS, ECR, S3, CloudFront, Secrets Manager, Route 53/ACM, Lambda, EventBridge, CloudWatch, IAM, OIDC)
  - infrastructure/lambda/ip-updater.py — Route 53 A record updater Lambda (Fargate IP tracking)
  - infrastructure/task-definition.json — ECS task definition with PLACEHOLDER values for GitHub Actions render step
affects:
  - 14-03 (GitHub Actions deploy.yml uses task-definition.json and CloudFormation outputs)
  - 14-04 (operational runbook references cloudformation.yaml deploy command)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HasDomain condition pattern — single CloudFormation template deploys with or without custom domain
    - PLACEHOLDER substitution pattern in task-definition.json — deploy.yml sed-substitutes ARNs from CloudFormation outputs at CI/CD time
    - api-origin subdomain pattern — EventBridge+Lambda updates Route 53 A record with ephemeral Fargate IP; CloudFront uses stable DNS name as custom origin

key-files:
  created:
    - infrastructure/cloudformation.yaml (1045 lines — complete infrastructure definition)
    - infrastructure/lambda/ip-updater.py (standalone version with full error handling)
    - infrastructure/task-definition.json (GitHub Actions render step input)
  modified:
    - server/server.ts (app.set('trust proxy', 1) — committed in 14-01 / 5db310f1)

key-decisions:
  - "CloudFormation template is parameterized on DomainName (optional) — deploys immediately with CloudFront default URL before domain is chosen"
  - "HasDomain condition gates Route 53, ACM, Lambda, and EventBridge — no orphaned resources when running without a domain"
  - "CloudFront /data/* path pattern matches Express app.use('/data', dataRoutes) — NOT /api/*"
  - "Custom ApiCachePolicy (MinTTL=0, DefaultTTL=3600, MaxTTL=86400) — caches API responses 1h by default, invalidated by ingestion crons"
  - "task-definition.json uses PLACEHOLDER_ prefix for all ARNs — deploy.yml sed-replaces from CloudFormation stack outputs"
  - "ECSTaskExecutionRoleArn and ECSTaskRoleArn in CloudFormation Outputs — required by deploy.yml for task-definition.json substitution"
  - "ECS DeploymentConfiguration MinimumHealthyPercent=0 — allows single task replacement without needing a second healthy task"

patterns-established:
  - "CloudFormation Condition HasDomain: use !If [HasDomain, value, !Ref AWS::NoValue] to omit optional properties"
  - "task-definition.json PLACEHOLDER pattern: define in infra/, substitute in CI/CD pipeline"
  - "LambdaInvocationAlarm threshold >5 in 600s: crash loop detection via ip-updater invocation rate spike"

requirements-completed: [DEPLOY-04, DEPLOY-06, DEPLOY-07, DEPLOY-08, DEPLOY-09]

# Metrics
duration: 9min
completed: 2026-03-31
---

# Phase 14 Plan 02: CloudFormation Template Summary

**Complete AWS infrastructure as code: 1045-line CloudFormation template covering VPC, ECS Fargate, ECR, S3+CloudFront, Secrets Manager, Route 53/ACM (conditional), Lambda IP updater, CloudWatch crash-loop alarms, and GitHub OIDC — plus ECS task definition JSON for CI/CD placeholder substitution**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T22:19:36Z
- **Completed:** 2026-03-31T22:29:04Z
- **Tasks:** 2
- **Files created:** 3 (cloudformation.yaml, ip-updater.py, task-definition.json)

## Accomplishments
- CloudFormation template defines all 40+ AWS resources in a single file — one `aws cloudformation deploy` command stands up the entire stack
- `HasDomain` condition makes Route 53, ACM, Lambda, and EventBridge optional — template is immediately deployable with just CloudFront's default URL before a domain is finalized
- `/data/*` CloudFront cache behavior correctly targets Fargate origin matching Express's `app.use('/data', dataRoutes)` route prefix
- ECSTaskExecutionRoleArn and ECSTaskRoleArn exposed as CloudFormation Outputs — consumed by deploy.yml (plan 14-03) to substitute PLACEHOLDER values in task-definition.json
- `cfn-lint` passes with zero errors or warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: CloudFormation template + ip-updater Lambda** — committed in 14-01 as `5db310f1` (feat) — template was staged alongside trust proxy change
2. **Task 2: ECS task definition JSON** — `cc5a7f05` (feat)

**Plan metadata:** (in final docs commit below)

## Files Created/Modified
- `infrastructure/cloudformation.yaml` — 1045-line complete AWS infrastructure definition; cfn-lint clean; parameterized for DomainName, AlertEmail, GitHubOrg, GitHubRepo; HasDomain condition gates 10+ optional resources
- `infrastructure/lambda/ip-updater.py` — Standalone Route 53 IP updater with desiredStatus guard, full error handling, and CloudWatch print logging (also inlined in cloudformation.yaml ZipFile)
- `infrastructure/task-definition.json` — ECS task definition for GitHub Actions `amazon-ecs-render-task-definition@v1`; PLACEHOLDER values replaced at CI/CD time via sed from CloudFormation outputs

## Decisions Made
- **HasDomain condition approach:** All domain-dependent resources (Route 53, ACM, Lambda, EventBridge) gated behind `!If [HasDomain, ...]` — enables zero-config first deploy before domain selection without leaving orphaned stubs
- **Custom ApiCachePolicy vs CachingDisabled:** Used custom policy (MinTTL=0, DefaultTTL=3600) instead of the managed CachingDisabled policy — API responses are cached 1h by default since data only changes on weekly cron runs; ingestion crons invalidate `/data/*` after each update
- **CloudFront /data/* not /api/*:** Plan explicitly confirmed Express route prefix — `/data/*` matches `app.use('/data', dataRoutes)` in server/server.ts
- **ECS MinimumHealthyPercent=0:** Single-task setup (no ALB, no auto-scaling) — allows in-place replacement without blocking on a second healthy task
- **PLACEHOLDER_ prefix in task-definition.json:** Convention for all dynamic ARNs that deploy.yml must substitute before rendering; consistent prefix makes sed substitution patterns predictable

## Deviations from Plan

### Auto-fixed Issues

None in this plan. Task 1 artifacts (cloudformation.yaml, ip-updater.py) were already committed in plan 14-01 as part of the trust proxy commit (5db310f1) — agent executing 14-01 staged them alongside the server.ts change. The committed content fully satisfies all Task 1 acceptance criteria (cfn-lint clean, /data/* path pattern, all required outputs, HasDomain condition, least-privilege IAM).

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan executed as specified. Task 1 artifacts were already in the repository from plan 14-01; Task 2 (task-definition.json) was the only new file to create.

## Issues Encountered
- Write tool wrote to a sandboxed filesystem not visible to bash commands. Resolved by using absolute paths in all bash commands and discovering that Task 1 files were already committed (5db310f1) from plan 14-01.

## User Setup Required
After `aws cloudformation deploy`:
1. Update `refugee-flow/production` Secrets Manager secret with real values (DATABASE_URL, ADMIN_SECRET, RESEND_API_KEY, ACLED_EMAIL, ACLED_PASSWORD) — placeholder values are set by the template as a bootstrap step
2. Confirm SNS email subscription (AWS sends a confirmation email to AlertEmail)
3. If using a custom domain: update domain registrar nameservers to the Route 53 hosted zone nameservers after stack creation

## Next Phase Readiness
- Plan 14-03 can now create GitHub Actions deploy.yml using CloudFormation outputs for placeholder substitution
- `infrastructure/task-definition.json` PLACEHOLDER values documented and ready for sed-substitution pattern
- CloudFormation Outputs (ECSTaskExecutionRoleArn, ECSTaskRoleArn, SecretsManagerArn, CloudFrontDistributionId, ECRRepositoryUri, FrontendBucketName, ECSClusterName, ECSServiceName) cover all substitutions plan 14-03 will need

## Self-Check

- [ ] infrastructure/cloudformation.yaml: FOUND (1045 lines, committed 5db310f1)
- [ ] infrastructure/lambda/ip-updater.py: FOUND (committed 5db310f1)
- [ ] infrastructure/task-definition.json: FOUND (committed cc5a7f05)
- [ ] cfn-lint passes: PASSED
- [ ] /data/* path pattern: CONFIRMED
- [ ] cc5a7f05 commit: FOUND

## Self-Check: PASSED

---
*Phase: 14-aws-cloudformation-deployment*
*Completed: 2026-03-31*
