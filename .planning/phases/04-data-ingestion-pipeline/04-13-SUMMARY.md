# Plan 04-13 Summary: Frontex IBC Auto-Ingestion

**Status:** COMPLETE
**Executed:** 2026-03-20

## What was done
- Created `server/ingestion/frontexIngestion.js` — scrapes Frontex page for XLSX link, downloads, parses, diff-based upsert
- Wired into server node-cron: 1st of month at 3 AM
- Added to admin controller's allowed sources (triggerable from `/admin`)
- Updated `DATA_SOURCES.md` with complete automation registry (server-side + standalone)
- Scopes queries to exclude Americas and English Channel routes (CBP/UK data)

## IOM status
IOM was already automated in Plans 04-03/04-04 — `server/ingestion/iomIngestion.js` runs weekly via node-cron (Friday 2 AM) and is triggerable from admin panel. No additional work needed.

## Key decisions
- Frontex goes in server node-cron (not standalone) — same pattern as IOM/UNHCR/Eurostat/ACLED
- Monthly schedule (not weekly) — Frontex updates monthly
- Excludes Americas + English Channel from stale row detection
