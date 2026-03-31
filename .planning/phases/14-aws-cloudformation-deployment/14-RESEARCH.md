# Phase 14: AWS CloudFormation Deployment - Research

**Researched:** 2026-03-30
**Domain:** AWS CloudFormation, ECS Fargate, CloudFront, S3, Route 53, ACM, GitHub Actions CI/CD
**Confidence:** HIGH (primary findings verified against official AWS docs and GitHub Actions docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ECS Fargate for Express API (always-on for node-cron ingestion jobs)
- Single task: 0.25 vCPU, 0.5 GB RAM
- No ALB — CloudFront connects directly to Fargate task as origin
- CloudFront caches API responses at the edge
- No auto-scaling
- Dockerfile needed (does not exist yet) — Express server + node-cron jobs in one container
- Keep Supabase as managed PostgreSQL — no RDS
- S3 bucket for Vite static build (dist/) — fully private, no public access
- OAC (Origin Access Control) on CloudFront → S3 origin
- CloudFront path-based routing: / → S3, /api/* → Fargate
- ACM certificate for HTTPS (free, auto-renewing)
- Route 53 for DNS management
- Domain TBD — CloudFormation parameterizes domain name
- GitHub Actions for CI/CD (OIDC — no long-lived access keys)
- On push to main: frontend build → S3 sync → CloudFront invalidation
- On push to main: Docker build → ECR push → ECS update
- CloudWatch Alarms → SNS → email for task crashes, API errors, CPU spikes, ingestion gaps
- EventBridge + Lambda to update Route 53 A record when Fargate task IP changes
- Cost target: ~$12-20/mo
- All IAM roles defined in CloudFormation with least-privilege policies scoped to specific ARNs

### Claude's Discretion
- VPC configuration (public subnet for Fargate, security groups)
- CloudFront cache TTL values for API responses
- CloudWatch alarm thresholds
- ECR lifecycle policy for old images
- S3 bucket policy details beyond OAC
- GitHub Actions workflow file structure

### Deferred Ideas (OUT OF SCOPE)
- Domain name selection (does not block CF template)
- ALB addition if traffic ever exceeds single Fargate task capacity
- RDS migration if Supabase free tier becomes insufficient
- EventBridge for cron jobs (only needed if decoupling crons from Express server)
</user_constraints>

---

## Summary

This phase deploys a Vite static frontend + Express TypeScript API + Supabase PostgreSQL to AWS using a single CloudFormation template. The architecture uses CloudFront as the unified front door routing `/` to S3 (static) and `/api/*` to ECS Fargate (API), with no Application Load Balancer to minimize cost.

The single most important architectural insight from research: **CloudFront does not accept raw IP addresses as origin domain names**. Since ECS Fargate assigns ephemeral public IPs to each task, the decided pattern (EventBridge + Lambda → Route 53 A record update) is the correct solution. When a Fargate task starts, EventBridge fires an ECS Task State Change event → Lambda reads the task's ENI public IP → Lambda UPSERTs a Route 53 A record (e.g., `api-origin.yourdomain.com`) → CloudFront uses that subdomain as the custom origin domain name. This loop completes in seconds.

A second critical finding: **CloudFront VPC Origins is now GA (November 2024) and has CloudFormation support via `AWS::CloudFront::VpcOrigin`** — however, VPC Origins requires an ALB, NLB, or EC2 instance ARN, not direct Fargate task ENIs. So the decided EventBridge/Lambda/Route 53 pattern remains the correct no-ALB approach.

The server TypeScript code uses `noEmit: true` in tsconfig.server.json, meaning there is no compiled output directory. The Dockerfile must compile TypeScript as a build step (multi-stage) rather than relying on a pre-existing dist/server directory.

**Primary recommendation:** Implement in four CloudFormation stacks (or nested stacks): networking, compute (ECR + ECS), delivery (S3 + CloudFront), and monitoring — with a single parent template or sequential deploys. GitHub Actions handles the dynamic parts (image push, S3 sync) that CloudFormation cannot.

---

## Standard Stack

### Core AWS Resources (CloudFormation)
| Resource | CFN Type | Purpose | Why Standard |
|----------|----------|---------|--------------|
| VPC | `AWS::EC2::VPC` | Network isolation | Required for Fargate task networking |
| Public Subnet | `AWS::EC2::Subnet` | Fargate task placement with public IP | Needed for direct ECR pull without NAT |
| Internet Gateway | `AWS::EC2::InternetGateway` | Outbound internet for task (ECR, Supabase, APIs) | Required in public subnet setup |
| ECS Cluster | `AWS::ECS::Cluster` | Groups Fargate tasks | Logical container grouping |
| ECS Task Definition | `AWS::ECS::TaskDefinition` | Container spec: image, CPU, memory, env, secrets | Core ECS unit |
| ECS Service | `AWS::ECS::Service` | Ensures 1 task always running | Restarts crashed tasks |
| ECR Repository | `AWS::ECR::Repository` | Docker image registry | Required before ECS pull |
| S3 Bucket | `AWS::S3::Bucket` | Static frontend (dist/) hosting | Standard SPA hosting |
| S3 Bucket Policy | `AWS::S3::BucketPolicy` | OAC read-only access grant | Locks bucket to CloudFront only |
| CloudFront OAC | `AWS::CloudFront::OriginAccessControl` | Signs S3 requests (replaces legacy OAI) | AWS-recommended over OAI |
| CloudFront Distribution | `AWS::CloudFront::Distribution` | CDN: routes / → S3, /api/* → Fargate | Single front door |
| ACM Certificate | `AWS::CertificateManager::Certificate` | HTTPS (must deploy in us-east-1) | Free, auto-renewing |
| Route 53 Hosted Zone | Pre-existing or `AWS::Route53::HostedZone` | DNS management | Domain resolution |
| Route 53 Record | `AWS::Route53::RecordSet` | CloudFront alias A record | User-facing domain |
| Secrets Manager Secret | `AWS::SecretsManager::Secret` | DATABASE_URL, ADMIN_SECRET, etc. | Never plaintext env vars |
| CloudWatch Log Group | `AWS::Logs::LogGroup` | Container and Lambda logs | Required for ECS awslogs driver |
| SNS Topic | `AWS::SNS::Topic` | Alert channel for CloudWatch alarms | Email notifications |
| EventBridge Rule | `AWS::Events::Rule` | Fires on ECS Task State Change (RUNNING) | Triggers Lambda IP updater |
| Lambda Function | `AWS::Lambda::Function` | Reads Fargate task ENI IP, UPSERTs Route 53 A record | Bridges ephemeral IP to stable DNS |
| IAM OIDC Provider | `AWS::IAM::OIDCProvider` | GitHub Actions identity federation | No long-lived secrets in GitHub |
| IAM Roles (4) | `AWS::IAM::Role` | Task Execution, Task, Lambda, GitHub Actions | Least-privilege per actor |

### Supporting Resources
| Resource | CFN Type | Purpose | When to Use |
|----------|----------|---------|-------------|
| Security Group (Fargate) | `AWS::EC2::SecurityGroup` | Inbound 2700 from CloudFront IPs, all outbound | Required for task networking |
| ECR Lifecycle Policy | `AWS::ECR::Repository` (LifecyclePolicy prop) | Keep last 5 images, delete older | Cost control, image hygiene |
| CloudWatch Alarms | `AWS::CloudWatch::Alarm` | ECS CPU > 80%, ECS task count = 0, etc. | Monitoring without ALB health checks |
| Route Table + Association | `AWS::EC2::RouteTable`, `AWS::EC2::SubnetRouteTableAssociation` | Route internet traffic via IGW | Required for public subnet |
| Lambda Permission | `AWS::Lambda::Permission` | Allow EventBridge to invoke Lambda | Required for event-driven trigger |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| EventBridge→Lambda→Route53 | NLB with Elastic IP | NLB adds ~$16/mo (eliminates cost advantage) |
| EventBridge→Lambda→Route53 | CloudFront VPC Origins | VPC Origins requires ALB/NLB/EC2 ARN — not Fargate task directly |
| Multi-stage Docker build | tsx runtime in container | tsx is dev tooling; never run tsx in production |
| ECR | Docker Hub | ECR co-located with ECS, no pull rate limits |
| Secrets Manager | SSM Parameter Store | Secrets Manager has built-in rotation; SecureString in SSM is viable but less ergonomic for JSON bundles |
| Public subnet + public IP | Private subnet + NAT Gateway | NAT Gateway adds ~$32/mo minimum (eliminates cost advantage) |

**Installation (GitHub Actions uses these CLI tools — no npm install needed for infra):**
```bash
# CloudFormation deploy (in GitHub Actions or locally)
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yaml \
  --stack-name refugee-flow \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides DomainName=refugeeflow.world AlertEmail=you@example.com

# Lambda runtime dependencies (Python 3.12, uses boto3 — pre-installed in Lambda runtime)
# No pip install needed for the Route53 updater Lambda
```

---

## Architecture Patterns

### Recommended Project Structure
```
infrastructure/
├── cloudformation.yaml        # Main template (or parent stack)
├── cloudformation-monitoring.yaml  # Optional: separate monitoring stack
└── task-definition.json       # ECS task definition (rendered by GitHub Actions)

Dockerfile                     # NEW — multi-stage TypeScript build
.github/
└── workflows/
    ├── deploy-frontend.yml    # S3 sync + CloudFront invalidation
    └── deploy-backend.yml     # ECR push + ECS task definition update
    # OR: combined deploy.yml
```

### Pattern 1: Multi-Stage Dockerfile for TypeScript Express Server
**What:** Two-stage build — builder compiles TS to JS, production stage runs compiled JS only.
**When to use:** Always for production; tsx is a dev-only runtime transpiler.

```dockerfile
# Source: TypeScript Docker multi-stage build standard pattern
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.server.json ./
COPY server/ ./server/
# Compile TypeScript to JavaScript
# NOTE: tsconfig.server.json has noEmit:true — must override for Docker build
RUN npx tsc -p tsconfig.server.json --noEmit false --outDir dist-server

# Stage 2: Production
FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-server ./dist-server
# Copy data files needed at runtime (war/route dictionaries)
COPY server/data/ ./server/data/
EXPOSE 2700
CMD ["node", "dist-server/server.js"]
```

**CRITICAL tsconfig.server.json note:** `noEmit: true` is set in the existing file for dev workflow (tsx handles execution). For Docker build, override with `--noEmit false --outDir dist-server`. Do NOT modify tsconfig.server.json itself.

### Pattern 2: CloudFront Distribution with Dual Origins
**What:** Single distribution, two origins, path-based cache behaviors.
**When to use:** This architecture (no ALB, CloudFront as front door).

```yaml
# Source: AWS::CloudFront::Distribution CloudFormation reference
MyDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Origins:
        # S3 origin (OAC-signed)
        - Id: S3Origin
          DomainName: !GetAtt MyBucket.RegionalDomainName
          S3OriginConfig:
            OriginAccessIdentity: ''  # Empty string when using OAC
          OriginAccessControlId: !GetAtt MyOAC.Id
        # Fargate origin (custom origin via Route 53 subdomain)
        - Id: FargateOrigin
          DomainName: api-origin.yourdomain.com  # Updated by Lambda
          CustomOriginConfig:
            HTTPSPort: 443          # Fargate security group + Express must listen on 443
            # OR use 2700 with http-only to CloudFront (TLS terminates at CloudFront edge):
            HTTPPort: 2700
            OriginProtocolPolicy: http-only  # CloudFront → Fargate over HTTP internally
            OriginReadTimeout: 30
      DefaultCacheBehavior:
        TargetOriginId: S3Origin
        CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
        ViewerProtocolPolicy: redirect-to-https
      CacheBehaviors:
        - PathPattern: /api/*
          TargetOriginId: FargateOrigin
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
          OriginRequestPolicyId: b689b0a8-53d0-40ab-baf2-68738e2966ac  # AllViewerExceptHostHeader
          ViewerProtocolPolicy: redirect-to-https
```

**Important caching note:** The `/api/*` behavior MUST use `CachingDisabled` policy (ID: `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`) or set MinTTL=0. If MinTTL > 0, CloudFront ignores `Cache-Control: no-store` from Express and caches API responses.

### Pattern 3: EventBridge → Lambda → Route 53 IP Updater
**What:** When ECS task starts, Lambda reads ENI public IP and UPSERTs Route 53 A record.
**When to use:** No-ALB architecture with CloudFront custom origin.

```python
# Lambda function (Python 3.12, boto3 pre-installed)
# Triggered by EventBridge: ECS Task State Change → lastStatus: RUNNING
import boto3, os

ecs = boto3.client('ecs')
ec2 = boto3.client('ec2')
r53 = boto3.client('route53')

CLUSTER = os.environ['ECS_CLUSTER_ARN']
ZONE_ID = os.environ['HOSTED_ZONE_ID']
RECORD_NAME = os.environ['ORIGIN_RECORD_NAME']  # e.g. api-origin.yourdomain.com

def handler(event, context):
    task_arn = event['detail']['taskArn']
    # Get task ENI attachment
    task = ecs.describe_tasks(cluster=CLUSTER, tasks=[task_arn])['tasks'][0]
    eni_id = next(
        a['value'] for att in task['attachments']
        for a in att['details'] if a['name'] == 'networkInterfaceId'
    )
    # Get public IP from ENI
    eni = ec2.describe_network_interfaces(NetworkInterfaceIds=[eni_id])
    public_ip = eni['NetworkInterfaces'][0]['Association']['PublicIp']
    # Update Route 53 A record
    r53.change_resource_record_sets(
        HostedZoneId=ZONE_ID,
        ChangeBatch={
            'Changes': [{
                'Action': 'UPSERT',
                'ResourceRecordSet': {
                    'Name': RECORD_NAME,
                    'Type': 'A',
                    'TTL': 60,  # Short TTL — task IP changes on each deploy
                    'ResourceRecords': [{'Value': public_ip}]
                }
            }]
        }
    )
```

**EventBridge rule pattern:**
```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"],
  "detail": {
    "clusterArn": ["<ClusterArn>"],
    "lastStatus": ["RUNNING"],
    "desiredStatus": ["RUNNING"]
  }
}
```

### Pattern 4: Secrets Manager in ECS Task Definition
**What:** Reference Secrets Manager ARN in task definition `secrets` field (not `environment`).
**When to use:** All sensitive values (DATABASE_URL, ADMIN_SECRET, API keys).

```yaml
# CloudFormation task definition snippet
ContainerDefinitions:
  - Name: refugee-flow-api
    Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/refugee-flow:latest"
    PortMappings:
      - ContainerPort: 2700
    Secrets:
      - Name: DATABASE_URL
        ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:refugee-flow/production:DATABASE_URL::"
      - Name: ADMIN_SECRET
        ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:refugee-flow/production:ADMIN_SECRET::"
      - Name: RESEND_API_KEY
        ValueFrom: !Sub "arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:refugee-flow/production:RESEND_API_KEY::"
    Environment:
      - Name: NODE_ENV
        Value: production
      - Name: PORT
        Value: "2700"
    LogConfiguration:
      LogDriver: awslogs
      Options:
        awslogs-group: !Ref LogGroup
        awslogs-region: !Ref AWS::Region
        awslogs-stream-prefix: refugee-flow
```

**Requires:** ECS Task Execution Role with `secretsmanager:GetSecretValue` on the specific secret ARN.
**Platform version:** Fargate platform 1.4.0+ supports full Secrets Manager JSON key extraction. Use `LATEST` (currently 1.4.0).

### Pattern 5: GitHub Actions OIDC Trust Policy
**What:** Federated identity — GitHub exchanges OIDC token for short-lived AWS credentials.
**When to use:** Always instead of long-lived IAM access keys.

```yaml
# CloudFormation IAM resources for GitHub OIDC
GitHubOIDCProvider:
  Type: AWS::IAM::OIDCProvider
  Properties:
    Url: https://token.actions.githubusercontent.com
    ClientIdList:
      - sts.amazonaws.com
    # Thumbprint list — GitHub rotates these; use the current value
    ThumbprintList:
      - 6938fd4d98bab03faadb97b34396831e3780aea1

GitHubActionsRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal:
            Federated: !GetAtt GitHubOIDCProvider.Arn
          Action: sts:AssumeRoleWithWebIdentity
          Condition:
            StringEquals:
              "token.actions.githubusercontent.com:aud": sts.amazonaws.com
            StringLike:
              # Scope to specific repo AND main branch only
              "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/refugee-flow:ref:refs/heads/main"
```

### Pattern 6: GitHub Actions Deployment Workflow
**What:** Two-job workflow — frontend deploy (S3+CF) + backend deploy (ECR+ECS).

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write   # Required for OIDC token
  contents: read

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci
      - run: npm run build  # vite build → dist/
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CF_DIST_ID }} --paths "/*"

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-east-1
      - id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      - name: Build and push
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/refugee-flow:$IMAGE_TAG .
          docker push $ECR_REGISTRY/refugee-flow:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/refugee-flow:$IMAGE_TAG" >> $GITHUB_OUTPUT
      - id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: infrastructure/task-definition.json
          container-name: refugee-flow-api
          image: ${{ steps.build-push.outputs.image }}
      - uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: refugee-flow-service
          cluster: refugee-flow-cluster
          wait-for-service-stability: true
```

### Pattern 7: ECS Task Stopped Alert via EventBridge + SNS
**What:** EventBridge rule fires when ECS task stops (essential container exit), routes to SNS email.

```yaml
# CloudFormation resources
TaskStoppedRule:
  Type: AWS::Events::Rule
  Properties:
    EventPattern:
      source: [aws.ecs]
      detail-type: ["ECS Task State Change"]
      detail:
        clusterArn: [!GetAtt ECSCluster.Arn]
        lastStatus: [STOPPED]
        stoppedReason: ["Essential container in task exited"]
    Targets:
      - Arn: !Ref AlertTopic
        Id: SendToSNS

AlertTopicPolicy:
  Type: AWS::SNS::TopicPolicy
  Properties:
    Topics: [!Ref AlertTopic]
    PolicyDocument:
      Statement:
        - Effect: Allow
          Principal: { Service: events.amazonaws.com }
          Action: sns:Publish
          Resource: !Ref AlertTopic
```

### Anti-Patterns to Avoid
- **Hardcoding Fargate task IP as CloudFront origin:** CloudFront does not accept raw IP addresses as origin domain names. Must use a DNS name (Route 53 subdomain).
- **Using `tsx` or `ts-node` as the Docker CMD:** Both are dev-only runtimes. Compile TypeScript in the build stage, run compiled JS in production.
- **Setting MinTTL > 0 on the `/api/*` cache behavior:** CloudFront will cache API responses even when Express sends `Cache-Control: no-store`. Must use `CachingDisabled` managed policy or MinTTL=0.
- **Deploying ACM certificate in the wrong region:** CloudFront requires the ACM cert to be in `us-east-1`. The CloudFormation stack (or the cert-specific nested stack) must deploy there.
- **Forwarding the Host header to Fargate:** Use `AllViewerExceptHostHeader` origin request policy. Forwarding the Host header sends the CloudFront domain name, which confuses Express routing.
- **Using `pm2` inside Docker:** Docker is its own process supervisor. ECS restarts the container on exit. pm2 adds complexity with no benefit. The existing `pm2.ecosystem.json` is for bare-metal, not containers.
- **Storing GitHub secrets as IAM access keys:** Use OIDC federation via `AWS::IAM::OIDCProvider`. GitHub Actions proves identity; AWS issues short-lived tokens.
- **Forgetting `AssignPublicIp: ENABLED` in ECS service:** Without this, Fargate tasks in a public subnet cannot pull images from ECR or reach Supabase. The task simply fails to start.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Docker image build + push | Custom shell scripts | `aws-actions/amazon-ecr-login@v2` + standard `docker build/push` | Handles ECR auth token refresh |
| ECS task definition update | Custom AWS API calls | `aws-actions/amazon-ecs-render-task-definition@v1` + `amazon-ecs-deploy-task-definition@v1` | Handles task def registration + service update atomically |
| GitHub → AWS auth | Long-lived IAM access keys | `aws-actions/configure-aws-credentials@v4` with OIDC role | Cryptographic proof of identity, no secrets in GitHub |
| CloudFront cache invalidation | Custom invalidation logic | `aws cloudfront create-invalidation --paths "/*"` | AWS CLI built-in; path `/*` invalidates all |
| Secrets injection | ENV vars in task definition | Secrets Manager `valueFrom` in task definition `secrets` field | Secrets never appear in task definition JSON or CloudWatch logs |
| S3 static hosting | Custom file server | `aws s3 sync dist/ s3://bucket --delete` | Atomic sync with deletion of stale files |
| ECR image cleanup | Custom cleanup Lambda | ECR lifecycle policy with `imageCountMoreThan: 5` | Native ECR feature, zero maintenance |
| SIGTERM handling in Node | Custom signal handlers | `init: true` in task definition (Tini) + Express `server.close()` | Docker shell CMD doesn't forward signals; Tini does |

**Key insight:** Every operation in this phase has a first-class AWS or GitHub Actions tool. Hand-rolled solutions create maintenance debt and miss edge cases (ECR auth expiry, task def registration idempotency, CloudFront propagation timing).

---

## Common Pitfalls

### Pitfall 1: ACM Certificate Must Be in us-east-1
**What goes wrong:** CloudFormation deploys succeed but CloudFront rejects the certificate ARN because it's in the wrong region (e.g., us-east-2).
**Why it happens:** ACM is regional; CloudFront only accepts certs from `us-east-1` regardless of where the distribution is "deployed."
**How to avoid:** Either deploy the entire stack in `us-east-1`, or use a separate nested stack / StackSet in `us-east-1` for the ACM certificate. Pass the cert ARN as an output parameter to the main stack.
**Warning signs:** `CloudFormation CREATE_FAILED` on the CloudFront distribution with "The specified SSL certificate doesn't exist, isn't in us-east-1 region..."

### Pitfall 2: CloudFront Does Not Accept Raw IP Addresses as Origins
**What goes wrong:** You try to use the Fargate task's public IP directly in the CloudFront origin `DomainName` property. CloudFormation deploys, but CloudFront rejects the configuration.
**Why it happens:** CloudFront custom origins require a DNS hostname, not a dotted-decimal IP.
**How to avoid:** The EventBridge → Lambda → Route 53 A record pattern is mandatory. CloudFront's origin domain name is a Route 53 subdomain (e.g., `api-origin.yourdomain.com`) that Lambda keeps current.
**Warning signs:** CloudFront distribution deploy fails with "The domain name you provided is not valid."

### Pitfall 3: ECS Task Fails to Start Without AssignPublicIp
**What goes wrong:** ECS service launches but task immediately transitions to STOPPED. Reason: "CannotPullContainerError: pull image manifest has been retried 5 time(s)."
**Why it happens:** Fargate task in a public subnet without a public IP has no internet route to ECR for image pull. Without NAT Gateway, the task is network-isolated.
**How to avoid:** Set `AssignPublicIp: ENABLED` in the `NetworkConfiguration.AwsvpcConfiguration` of the ECS Service CloudFormation resource.
**Warning signs:** ECS service shows desired count = 1 but running count = 0; task stopped reason mentions ECR pull failure.

### Pitfall 4: Security Group Blocking CloudFront → Fargate Traffic
**What goes wrong:** CloudFront can't reach the Fargate origin; requests return 502/503 from CloudFront.
**Why it happens:** CloudFront IP ranges are large and change. Hardcoded inbound rules on port 2700 break when CloudFront adds new IPs.
**How to avoid:** Allow inbound on port 2700 from `0.0.0.0/0` for the Fargate security group (or use the managed CloudFront prefix list if in the same account). CloudFront protects the origin from the public. If you need to lock it down further, add a custom header that Express checks (Origin Verification Header pattern).
**Warning signs:** CloudFront returns 502 for `/api/*` paths; Fargate container logs show no incoming requests.

### Pitfall 5: Helmet CSP Conflicts with CloudFront Headers
**What goes wrong:** Browser console shows CSP violations for resources that worked locally; map tiles or fonts fail to load.
**Why it happens:** CloudFront may strip or modify headers. The existing Helmet CSP config allows `https://*.basemaps.cartocdn.com` — if CloudFront's response headers policy overrides CSP, these directives are lost.
**How to avoid:** Do NOT set a CloudFront Response Headers Policy that includes Content-Security-Policy. Let Express/Helmet set CSP headers and configure CloudFront to pass origin response headers through. Set `AllViewerExceptHostHeader` as the origin request policy (not "All") to avoid the Host header conflict.
**Warning signs:** CSP header differs between local dev and production; map tiles missing in prod.

### Pitfall 6: ts-node/tsx in Docker Production Image
**What goes wrong:** Image works in dev, but in production tsx may not be installed (`--omit=dev` removes it), or startup is slow due to JIT compilation. `noEmit: true` in tsconfig.server.json means `tsc` produces no output without override.
**Why it happens:** `tsx` is a devDependency; multi-stage builds with `npm ci --omit=dev` don't include it. Also `tsconfig.server.json` has `noEmit: true` which blocks `tsc` from emitting to `dist-server/`.
**How to avoid:** Multi-stage Dockerfile — in builder stage, run `tsc --noEmit false --outDir dist-server -p tsconfig.server.json`; in production stage, run `node dist-server/server.js`.
**Warning signs:** Container fails to start with "Cannot find module" or "tsx not found."

### Pitfall 7: Supabase Connection Pooler Port Changes
**What goes wrong:** DATABASE_URL uses port 6543 (old session mode); since February 28, 2025 Supabase deprecated session mode on port 6543. Port 6543 is now transaction-mode only.
**Why it happens:** The Express server uses knex + pg, which may use persistent connections (session-mode). Transaction mode on port 6543 restricts some PostgreSQL session features.
**How to avoid:** Use port 5432 (direct connection or Supavisor session mode) for the persistent Fargate server. Reserve port 6543 (transaction mode) for serverless/short-lived consumers. Verify the Supabase connection string in Secrets Manager uses port 5432 unless transaction mode is confirmed sufficient.
**Warning signs:** Intermittent query failures; "prepared statement does not exist" errors in logs.

### Pitfall 8: Lambda Route 53 Race Condition on Task Startup
**What goes wrong:** CloudFront routes a request to the old Fargate IP while the new task is starting; Lambda fires but there's a window where the old task is stopped and the new task's IP hasn't propagated.
**Why it happens:** ECS deployments do not overlap tasks by default (desired count = 1). The old task stops before the new one is RUNNING. During this window, the Route 53 A record still points to the old IP.
**How to avoid:** For ECS rolling deploys with count=1, accept a brief (seconds) gap. The existing `CachingDisabled` policy for `/api/*` means CloudFront retries quickly. Alternatively, set ECS deployment configuration `MinimumHealthyPercent: 0` and `MaximumPercent: 200` temporarily — this keeps old task running while new task starts (but requires paying for 2 tasks briefly).
**Warning signs:** Short 502 windows during backend deploys; usually resolves within 30-60 seconds.

---

## Code Examples

### ECR Lifecycle Policy (CloudFormation)
```yaml
# Source: AWS ECR Lifecycle Policies documentation
MyECRRepository:
  Type: AWS::ECR::Repository
  Properties:
    RepositoryName: refugee-flow
    LifecyclePolicy:
      LifecyclePolicyText: |
        {
          "rules": [
            {
              "rulePriority": 1,
              "description": "Keep last 5 images",
              "selection": {
                "tagStatus": "any",
                "countType": "imageCountMoreThan",
                "countNumber": 5
              },
              "action": { "type": "expire" }
            }
          ]
        }
```

### S3 OAC + Bucket Policy (CloudFormation)
```yaml
# Source: CloudFront OAC CloudFormation reference + AWS docs
MyOAC:
  Type: AWS::CloudFront::OriginAccessControl
  Properties:
    OriginAccessControlConfig:
      Name: refugee-flow-oac
      OriginAccessControlOriginType: s3
      SigningBehavior: always
      SigningProtocol: sigv4

MyBucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref MyBucket
    PolicyDocument:
      Statement:
        - Effect: Allow
          Principal:
            Service: cloudfront.amazonaws.com
          Action: s3:GetObject
          Resource: !Sub "${MyBucket.Arn}/*"
          Condition:
            StringEquals:
              "AWS:SourceArn": !Sub "arn:aws:cloudfront::${AWS::AccountId}:distribution/${MyDistribution}"
```

### CloudWatch Alarms for ECS (CloudFormation)
```yaml
# Source: CloudWatch alarm CloudFormation reference
ECSTaskCountAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: refugee-flow-task-count-zero
    AlarmDescription: ECS task count dropped to zero — container may have crashed
    Namespace: AWS/ECS
    MetricName: RunningTaskCount
    Dimensions:
      - Name: ClusterName
        Value: !Ref ECSCluster
      - Name: ServiceName
        Value: !GetAtt ECSService.Name
    Statistic: Minimum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: LessThanThreshold
    TreatMissingData: breaching
    AlarmActions: [!Ref AlertTopic]

ECSCPUAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: refugee-flow-cpu-high
    Namespace: AWS/ECS
    MetricName: CPUUtilization
    Dimensions:
      - Name: ClusterName
        Value: !Ref ECSCluster
      - Name: ServiceName
        Value: !GetAtt ECSService.Name
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions: [!Ref AlertTopic]
```

### ECS Service (public subnet, public IP, Fargate)
```yaml
# Source: AWS::ECS::Service CloudFormation reference
ECSService:
  Type: AWS::ECS::Service
  Properties:
    Cluster: !Ref ECSCluster
    LaunchType: FARGATE
    DesiredCount: 1
    TaskDefinition: !Ref ECSTaskDefinition
    NetworkConfiguration:
      AwsvpcConfiguration:
        AssignPublicIp: ENABLED  # CRITICAL — enables ECR pull without NAT
        Subnets:
          - !Ref PublicSubnet
        SecurityGroups:
          - !Ref FargateSecurityGroup
    DeploymentConfiguration:
      MinimumHealthyPercent: 0   # Allow task to stop before new one starts (count=1)
      MaximumPercent: 200
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAI (Origin Access Identity) for S3+CloudFront | OAC (Origin Access Control) | Nov 2022 (OAC GA) | OAI deprecated; OAC is more secure, uses SigV4 |
| Long-lived IAM access keys in GitHub Secrets | OIDC federated identity | 2022 (GitHub OIDC GA) | No secrets stored in GitHub, tokens expire in ~1 hour |
| ts-node for production | Compiled JS (tsc + node) | Always preferred | ts-node/tsx are dev tools; multi-stage Docker is standard |
| pm2 in Docker containers | Container as process (Docker = supervisor) | Docker-native era | pm2 adds complexity, ECS handles restarts |
| CloudFront OAI for S3 | CloudFront OAC | Nov 2022 | OAI support still works but new distributions must use OAC |
| NAT Gateway for Fargate egress | Public subnet + AssignPublicIp | Always an option | NAT adds ~$32/mo for a low-traffic app; public subnet is cost-optimal |
| Supabase session mode on port 6543 | Port 5432 (direct/session) or 6543 (transaction only) | Feb 28, 2025 | Port 6543 session mode deprecated; use 5432 for persistent connections |

**Deprecated/outdated:**
- `pm2.ecosystem.json`: Designed for bare-metal Node.js process management. Irrelevant inside Docker/ECS — ignore for container build.
- OAI (CloudFront Origin Access Identity): Still functional for existing distributions but deprecated. All new distributions must use OAC.
- Supabase port 6543 for session mode: Deprecated as of Feb 28, 2025. Use port 5432 for knex/pg persistent connections.

---

## Open Questions

1. **CloudFront origin protocol: HTTP or HTTPS to Fargate?**
   - What we know: Express runs on port 2700. CloudFront can use `http-only` to origin (TLS terminates at CloudFront edge). Using HTTPS from CloudFront to Fargate would require a valid TLS cert on the container itself (self-signed or from a CA).
   - What's unclear: Whether the internal HTTP path (CloudFront → Fargate) is acceptable given the app's security posture (museum exhibit, public data).
   - Recommendation: Use `OriginProtocolPolicy: http-only` with `HTTPPort: 2700`. Traffic between CloudFront PoPs and the Fargate origin is over AWS backbone (not public internet). TLS at the viewer edge is the important layer.

2. **CloudFront origin domain name before domain is finalized**
   - What we know: Domain TBD. CloudFront default domain (d1234.cloudfront.net) works immediately.
   - What's unclear: The EventBridge Lambda needs a Route 53 hosted zone and record name to function. If no domain exists, there's no hosted zone.
   - Recommendation: Create a placeholder hosted zone in Route 53 for a domain (e.g., register a cheap `.dev` or `.world` domain), or use the CloudFront default domain + skip the custom origin subdomain trick until a domain is registered. During pre-launch testing, CloudFront default domain is sufficient.

3. **GitHub repository visibility (public vs private) affects OIDC condition**
   - What we know: OIDC trust policy condition `token.actions.githubusercontent.com:sub` should match the exact repo path.
   - What's unclear: Whether the repo is public or private affects nothing about OIDC, but the `sub` claim format matters.
   - Recommendation: Use `StringLike` with `repo:ORG_OR_USER/refugee-flow:ref:refs/heads/main` as the condition.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.3.0 + Supertest 7.2.2 (existing) |
| Config file | `jest.config.js` (existing) |
| Quick run command | `npm test -- --testPathPattern=server --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
This phase is infrastructure-only (CloudFormation, Dockerfile, GitHub Actions workflows). There are no application code changes that require unit tests. Validation is via smoke tests and manual verification:

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DEPLOY-01 | Vite build succeeds | Build check | `npm run build` | Verifies dist/ is populated |
| DEPLOY-02 | Docker image builds | Build check | `docker build -t refugee-flow-test .` | Verifies Dockerfile |
| DEPLOY-03 | Container starts on port 2700 | Smoke test | `docker run -e DATABASE_URL=... -p 2700:2700 refugee-flow-test` then `curl localhost:2700/data/war` | Verifies runtime |
| DEPLOY-04 | CloudFormation template validates | Lint | `aws cloudformation validate-template --template-body file://infrastructure/cloudformation.yaml` | Catches syntax errors |
| DEPLOY-05 | GitHub Actions workflow runs without error | CI check | Push to main branch, observe Actions tab | Manual verification |
| DEPLOY-06 | S3 bucket inaccessible directly (OAC) | Manual | `curl https://BUCKET.s3.amazonaws.com/index.html` should return 403 | Privacy verification |
| DEPLOY-07 | CloudFront serves frontend at default URL | Manual | `curl https://d1234.cloudfront.net/` returns HTML | End-to-end |
| DEPLOY-08 | CloudFront proxies /api/* to Fargate | Manual | `curl https://d1234.cloudfront.net/api/war` returns JSON | End-to-end |
| DEPLOY-09 | Secrets not exposed in ECS task definition JSON | Manual | `aws ecs describe-task-definition --task-definition refugee-flow` — secrets field shows ARN not value | Security check |

### Sampling Rate
- **Per task commit:** `npm run build` (Vite build check) + `aws cloudformation validate-template`
- **Per wave merge:** Full `npm test` + `docker build` smoke test
- **Phase gate:** End-to-end CloudFront smoke tests (DEPLOY-07, DEPLOY-08) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Dockerfile` — does not exist; must be created in Wave 1
- [ ] `infrastructure/cloudformation.yaml` — does not exist; must be created in Wave 1-2
- [ ] `.github/workflows/deploy.yml` — does not exist; must be created in Wave 3
- [ ] `infrastructure/task-definition.json` — does not exist; placeholder for GitHub Actions render step

---

## Sources

### Primary (HIGH confidence)
- [AWS::CloudFront::Distribution CustomOriginConfig](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-cloudfront-distribution-customoriginconfig.html) — port configuration, OriginProtocolPolicy options
- [AWS::ECS::TaskDefinition Secret](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-ecs-taskdefinition-secret.html) — valueFrom syntax for Secrets Manager
- [Amazon ECS Fargate task networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html) — AssignPublicIp, ENI, public subnet
- [Specifying sensitive data using Secrets Manager in ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html) — platform version requirements
- [Sending SNS alerts for ECS task stopped events](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_cwet2.html) — EventBridge rule pattern, SNS topic policy
- [CloudFront OAC documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html) — OAC vs OAI, bucket policy
- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) — trust policy, condition keys
- [Deploying to Amazon ECS (GitHub Docs)](https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-amazon-elastic-container-service) — complete workflow YAML
- [CloudFront cache expiration behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) — MinTTL=0 required for no-cache API responses
- [ECR Lifecycle Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/LifecyclePolicies.html) — imageCountMoreThan policy syntax

### Secondary (MEDIUM confidence)
- [Update IP Address in Route53 on ECS Fargate Redeployments (Medium/AWS Factory)](https://medium.com/aws-factory/update-ip-address-in-route53-on-ecs-fargate-redeployments-a19e54e39ec5) — Lambda pattern for ENI IP → Route 53 update; verified Lambda logic flow with official ECS/EC2/Route53 API docs
- [CloudFront VPC Origins announcement (Nov 2024)](https://aws.amazon.com/blogs/aws/introducing-amazon-cloudfront-vpc-origins-enhanced-security-and-streamlined-operations-for-your-applications/) — VPC Origins requires ALB/NLB/EC2 ARN, not direct Fargate ENI; cross-account support added Nov 2025
- [Graceful Shutdowns with ECS (AWS blog)](https://aws.amazon.com/blogs/containers/graceful-shutdowns-with-ecs/) — SIGTERM/Tini pattern for Node.js containers
- [Supabase Connection String Guide 2026](https://www.weweb.io/blog/supabase-connection-string-guide-ports-pooling) — port 6543 session mode deprecation (Feb 28, 2025)

### Tertiary (LOW confidence — flag for validation)
- CloudFront VPC Origins CloudFormation support: Research found `AWS::CloudFront::VpcOrigin` resource exists, but practical Fargate ENI support (without ALB) is unconfirmed. The decided EventBridge/Lambda pattern avoids this uncertainty entirely.
- Fargate task startup timing for EventBridge trigger: The RUNNING state fires when the task is healthy but before it has served requests. DNS propagation adds ~60s with TTL=60. This brief gap behavior during deploys needs live testing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all CFN resource types verified against official AWS documentation
- Architecture patterns: HIGH for standard patterns (OAC, Secrets Manager, GitHub OIDC); MEDIUM for EventBridge→Lambda→Route53 (pattern is well-documented in community; core Lambda logic verified against ECS/EC2/Route53 API references)
- Common pitfalls: HIGH — all pitfalls verified against official AWS docs or documented behavior (ACM region, AssignPublicIp, MinTTL, port 6543 deprecation)
- GitHub Actions workflow: HIGH — verified against official GitHub Actions ECS deployment docs with exact action versions

**Research date:** 2026-03-30
**Valid until:** 2026-06-30 (stable AWS services; GitHub Actions action versions should be re-verified at implementation time)
