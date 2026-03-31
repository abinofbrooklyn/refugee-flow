# Phase 14: AWS CloudFormation Deployment - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the Refugee Flow app (Vite static frontend + Express API + PostgreSQL via Supabase) to AWS using a CloudFormation template. The stack must be cheap, secure, highly available, and hands-off — alerting the owner only when something breaks.

</domain>

<decisions>
## Implementation Decisions

### Compute Strategy
- ECS Fargate for the Express API server (always-on for node-cron ingestion jobs)
- Single task baseline: 0.25 vCPU, 0.5 GB RAM (~$10-15/mo)
- No ALB — CloudFront connects directly to Fargate task as origin
- CloudFront caches API responses at the edge with 1-hour default TTL (data only changes on weekly cron runs), absorbing 95%+ of read traffic
- Ingestion crons automatically invalidate CloudFront /data/* cache after successful data updates via retryRunner.ts — ensures fresh data propagates within seconds
- No auto-scaling needed — CloudFront handles traffic spikes, Fargate sees minimal actual requests
- `app.set('trust proxy', 1)` required in server.ts — CloudFront sits in front, express-rate-limit needs real visitor IPs
- Dockerfile needed (does not exist yet) — Express server + node-cron jobs in one container

### Database Strategy
- Keep Supabase as managed PostgreSQL — no RDS
- Connect from Fargate via DATABASE_URL environment variable over TLS
- No read replica needed — data is mostly static between cron runs, CloudFront caches API responses
- Store DATABASE_URL and other secrets in AWS Secrets Manager, referenced in ECS task definition

### Frontend Hosting
- S3 bucket for Vite static build output (dist/) — bucket is fully private (no public access)
- OAC (Origin Access Control) on CloudFront → S3 origin — only CloudFront can read from the bucket
- CloudFront distribution serves both static frontend (S3 origin) and API (Fargate origin)
- CloudFront path-based routing: / → S3, /data/* → Fargate (Express mounts routes at `app.use('/data', dataRoutes)` in server.ts)
- ACM certificate for HTTPS (free, auto-renewing)

### Domain & SSL
- Route 53 for DNS management
- Domain TBD — refugeeflow.world was lost to a domain squatter after partner stopped paying hosting bills. New domain will be registered (possibly through Route 53)
- ACM certificate attached to CloudFront distribution
- CloudFormation template parameterizes the domain name so it can be set when decided
- CloudFront default domain (d1234abcdef.cloudfront.net) available immediately for pre-launch sharing

### CI/CD Pipeline
- GitHub Actions for automated deployment (free for public repos)
- On push to master: build frontend → sync to S3 → invalidate CloudFront cache
- On push to master: build Docker image → push to ECR → update ECS Fargate service
- No manual deployment steps — merge PR and walk away

### Monitoring & Alerting
- CloudWatch Alarms → SNS → email when:
  - Fargate task crashes or becomes unhealthy
  - API error rate spikes (5xx responses)
  - CPU usage pegs high
  - Ingestion cron hasn't run within expected window (e.g., 8 days for weekly jobs)
  - Lambda invocation rate spikes (>5 invocations in 10 minutes — indicates Fargate crash loop)
  - ECS task replacement rate spikes (>3 task stops in 1 hour — crash/restart loop detection)
- Design principle: hands-off operation. Set it and forget it, get alerted if something breaks.

### IAM Roles & Policies

**ECS Task Execution Role** (ECS agent uses this to pull/start the container):
- `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer` — pull images from ECR
- `secretsmanager:GetSecretValue` — read DATABASE_URL, ADMIN_SECRET, RESEND_API_KEY, ACLED creds
- `logs:CreateLogStream`, `logs:PutLogEvents` — push container logs to CloudWatch Logs

**ECS Task Role** (Express app uses this at runtime):
- `cloudfront:CreateInvalidation` — invalidate API cache after cron ingestion runs
- `logs:CreateLogStream`, `logs:PutLogEvents` — application logging

**Lambda Execution Role** (Route 53 updater — fires via EventBridge when Fargate task starts):
- `ecs:DescribeTasks` — get the new task's public IP
- `route53:ChangeResourceRecordSets` — update the A record pointing CloudFront to Fargate
- `logs:CreateLogStream`, `logs:PutLogEvents` — Lambda execution logs

**GitHub Actions OIDC Role** (CI/CD — no long-lived access keys):
- `ecr:PushImage`, `ecr:InitiateLayerUpload`, `ecr:CompleteLayerUpload`, `ecr:BatchCheckLayerAvailability` — push Docker images
- `ecs:UpdateService` — force new Fargate deployment
- `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket` — sync frontend build to S3
- `cloudfront:CreateInvalidation` — bust cache after deploy
- Federated via OIDC trust policy — GitHub proves identity to AWS, no secrets stored in GitHub

**S3 Bucket Policy** (resource policy, not IAM role):
- Block Public Access enabled (all four settings)
- Allow CloudFront OAC `s3:GetObject` — only CloudFront can serve files
- GitHub Actions OIDC role gets write access via its IAM policy (not the bucket policy)

All roles defined in CloudFormation with least-privilege policies. Every policy scoped to specific resource ARNs, not wildcards.

### Environment Variables (Secrets Manager)
- DATABASE_URL (Supabase connection string)
- ADMIN_SECRET
- ACLED_EMAIL / ACLED_PASSWORD (when access granted)
- RESEND_API_KEY
- PORT, NODE_ENV

### Claude's Discretion
- VPC configuration (public subnet for Fargate, security groups)
- CloudFront cache TTL values for API responses
- CloudWatch alarm thresholds
- ECR lifecycle policy for old images
- S3 bucket policy details beyond OAC
- GitHub Actions workflow file structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Application Architecture
- `server/server.ts` — Express server entry point, middleware stack, port configuration
- `package.json` — Build scripts (vite build), server scripts (pm2, nodemon), dependencies
- `docker-compose.yml` — Local PostgreSQL setup (reference for DB connection pattern)
- `.env.example` — All environment variables the app needs

### Existing Infrastructure
- `pm2.ecosystem.json` — Existing PM2 production config (referenced by "kickoff" script)

### Security (Phase 12)
- `.planning/phases/12-security-hardening/` — Helmet v8 CSP, CORS config, rate limiting — CloudFront must not conflict with these headers

### Data Ingestion (Phase 4)
- `server/ingestion/` — All cron job modules that must keep running in Fargate container

No external specs — requirements are fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker-compose.yml`: PostgreSQL service definition — pattern for containerized services
- `pm2.ecosystem.json`: Existing production process config — informs Dockerfile CMD
- `.env.example`: Complete list of required environment variables

### Established Patterns
- Express server on port 2700 (configurable via PORT env var)
- node-cron for scheduled ingestion jobs (weekly/monthly)
- Vite build outputs to dist/ (static SPA)
- Supabase connection via DATABASE_URL connection string

### Integration Points
- GitHub Actions will need repository secrets for AWS credentials (ECR push, S3 sync, ECS deploy)
- CloudFront must allow CSP headers set by Helmet v8 (script-src, img-src for CartoCDN, etc.)
- Fargate container needs outbound internet access for Supabase, ACLED API, UNHCR API, IOM API, etc.

</code_context>

<specifics>
## Specific Ideas

- User is studying for AWS Solutions Architect Associate — this deployment doubles as exam practice
- Traffic pattern: spike at v2 launch (media campaign), then steady decline to casual visitors
- Must work for both museum exhibit kiosk AND public internet visitors
- "I don't want to manage it" — everything should run automatically, alert only on failures
- Cost target: as cheap as possible (~$12-20/mo estimated)
- CloudFront default URL can be shared with collaborators before domain is finalized

</specifics>

<deferred>
## Deferred Ideas

- Domain name selection (refugeeflow.world lost to squatter — new domain TBD, does not block CF template)
- ALB addition if traffic ever exceeds single Fargate task capacity
- RDS migration if Supabase free tier becomes insufficient
- EventBridge for cron jobs (only needed if decoupling crons from Express server)

</deferred>

---

*Phase: 14-aws-cloudformation-deployment*
*Context gathered: 2026-03-30*
