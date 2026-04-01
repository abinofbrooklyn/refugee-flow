# Refugee Flow — Project Instructions

## Overview

Interactive conflict/refugee visualization app. React 18 + Express + PostgreSQL (Supabase). Part of the Places & Spaces traveling museum exhibit.

## Commands

```bash
# Dev server (frontend + backend)
npm run dev

# Production build (Vite)
npm run build

# TypeScript check
npx tsc --noEmit

# Run all tests
npx jest

# Run specific test file
npx jest tests/server/iomIngestion.test.ts --no-cache

# Run client tests only
npx jest --selectProjects client

# Run server tests only
npx jest --selectProjects server
```

## Stack

- **Frontend:** React 18, Vite, TypeScript, styled-components, MapLibre GL, THREE.js, D3
- **Backend:** Express, TypeScript, Knex (PostgreSQL)
- **Database:** Supabase (PostgreSQL) — free tier, minimize unnecessary writes
- **Deployment:** AWS (ECS Fargate + S3 + CloudFront + ALB), GitHub Actions CI/CD
- **Tests:** Jest (client: jsdom, server: node), ts-jest

## Project Structure

```
src/                    # React frontend
server/                 # Express backend
  ingestion/            # Automated data ingestion pipelines
  controllers/          # API route handlers
  routes/               # Express route definitions
  database/             # Knex connection
  types/                # TypeScript types
tests/
  client/               # Frontend tests (jsdom)
  server/               # Backend tests (node)
infrastructure/         # AWS CloudFormation + task definitions
.planning/              # GSD workflow (not pushed to git)
```

## Key Conventions

- **npm ci requires `--legacy-peer-deps`** due to eslint-config-airbnb peer conflict
- **Never hardcode PII** (emails, passwords, API keys) — always use .env
- **Geo precision reduction** only for war_events (THREE.js globe), NOT route deaths (MapLibre)
- **Data ingestion pattern:** fetch → transform → normalize → validate → diff/filter → upsert → log → alert → cache bust
- **Incremental ingestion:** Always filter to new rows before upserting. Never bulk-insert the full dataset — Supabase free tier counts every INSERT attempt
- **MapLibre event handlers:** Use refs for data access inside callbacks registered in useEffect([], []) — props create stale closures
- **Quadtree hit radius:** 30px mouse, 50px touch. Always pass radius to `find()` — never let it snap to distant points

## Data Sources (Automated)

| Source | Schedule | Script |
|--------|----------|--------|
| IOM Missing Migrants | Friday 02:00 UTC | server/ingestion/iomIngestion.ts |
| Eurostat | Wednesday 02:00 UTC | server/ingestion/eurostatIngestion.ts |
| UNHCR | Friday 04:00 UTC | server/ingestion/unhcrIngestion.ts |
| Frontex | 1st of month 03:00 UTC | server/ingestion/frontexIngestion.ts |
| CBP | 15th of month 05:00 UTC | server/ingestion/cbpIngestion.ts |
| UK Channel | 1st of month 05:00 UTC | server/ingestion/ukChannelIngestion.ts |
| ACLED | Monday 02:00 UTC | BLOCKED — waiting on API access |

## Environment Variables

See `.env.example` for all required variables. Key ones:
- `DATABASE_URL` — local PostgreSQL
- `DATABASE_URL_PRODUCTION` — Supabase (port 5432, not 6543)
- `RESEND_API_KEY` — email alerts for ingestion failures
- `ACLED_EMAIL` / `ACLED_PASSWORD` — ACLED API (when access granted)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — AWS CLI

## AWS Deployment

- **CloudFront URL:** https://d1apamzo7oo4z.cloudfront.net
- **Stack name:** refugee-flow (us-east-1)
- **CI/CD:** Push to `main` triggers GitHub Actions (frontend → S3, backend → ECR → ECS)
- **Secrets:** AWS Secrets Manager (refugee-flow/production), GitHub repo secrets for CI/CD
