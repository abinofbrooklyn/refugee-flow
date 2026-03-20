# Data Source Automation Registry

This document tracks all data ingestion pipelines — what's automated, how they run, and how to fix them if they break.

## Automated Pipelines

### Server-side (node-cron, runs when server is up)

These run inside the Express server process via node-cron. Also triggerable from `/admin` panel.

| Source | Module | Cron Schedule | Data Type | Target Table |
|--------|--------|---------------|-----------|-------------|
| **ACLED** | `server/ingestion/acledIngestion.js` | Monday 2 AM (weekly) | War/conflict events | `war_events`, `war_notes` |
| **Eurostat** | `server/ingestion/eurostatIngestion.js` | Wednesday 2 AM (weekly) | Monthly asylum stats | `asy_applications` |
| **IOM Missing Migrants** | `server/ingestion/iomIngestion.js` | Friday 2 AM (weekly) | Route deaths/missing | `route_deaths` |
| **UNHCR** | `server/ingestion/unhcrIngestion.js` | Friday 4 AM (weekly) | Asylum applications | `asy_applications` |
| **Frontex IBC** | `server/ingestion/frontexIngestion.js` | 1st of month 3 AM | European border crossings | `ibc_crossings` |

### Standalone scripts (system cron, runs independently)

These run as standalone Node scripts via system crontab. Independent of server process.

| Source | Ingestion Script | Auto-Update Script | Cron Schedule | Data Type | Target Table |
|--------|-----------------|-------------------|---------------|-----------|-------------|
| **CBP** (US border) | `scripts/ingestCBP.js` | `scripts/updateCBP.js` | `0 0 15 * *` (monthly, 15th) | Border crossings | `ibc_crossings` |
| **UK Home Office** | `scripts/ingestUKChannel.js` | `scripts/updateUKChannel.js` | `0 0 1 * *` (monthly, 1st) | Small boat crossings | `ibc_crossings` |

## Cron Setup

```bash
# System crontab (crontab -e) — standalone scripts:
0 0 15 * *  cd /path/to/refugee-flow && node scripts/updateCBP.js >> logs/cbp-update.log 2>&1
0 0 1  * *  cd /path/to/refugee-flow && node scripts/updateUKChannel.js >> logs/uk-update.log 2>&1

# Server-side cron (automatic when server runs) — configured in server/server.js:
# ACLED:    Monday 2 AM weekly
# Eurostat: Wednesday 2 AM weekly (runs before UNHCR — provides seasonal ratios)
# IOM:     Friday 2 AM weekly
# UNHCR:   Friday 4 AM weekly (after Eurostat)
# Frontex: 1st of month 3 AM
```

## Troubleshooting

### Exit codes (standalone scripts)
- **Exit 0** — success (or no new data)
- **Exit 1** — download failed (URL pattern changed, site down, or access blocked)
- **Exit 2** — ingestion failed (data format changed, DB error)

### Server-side ingestion failures
- Check `ingestion_log` table for error details: `SELECT * FROM ingestion_log WHERE status='error' ORDER BY completed_at DESC;`
- Trigger manual re-run from `/admin` panel (select source → trigger ingestion)

### If a pipeline breaks:

1. Check the log (`ingestion_log` table for server-side, `logs/` directory for standalone)
2. **Download failed:**
   - Visit the source website manually to check if it's up
   - For scraped sources (Frontex, UK): inspect the page HTML for the new download link pattern
   - For direct URLs (IOM, CBP): verify the URL still works in a browser
   - For API sources (UNHCR, Eurostat): test the API endpoint manually
3. **Ingestion failed:**
   - Download the file manually and inspect its structure
   - Check if column names, sheet names, or data format changed
   - Update the ingestion module/script to match the new format
4. **Manual fallback:** Download file from source, then `node scripts/ingest<Source>.js <path>`
5. All scripts are idempotent — safe to re-run at any time

## Data Flow Architecture

```
Source Website/API
        ↓
  Auto-download (scrape page / stable URL / REST API)
        ↓
  Normalize (route mapping, country codes, FY conversion, coordinate parsing)
        ↓
  Diff-based upsert (insert new, update changed, skip unchanged)
        ↓
  PostgreSQL (ibc_crossings / route_deaths / asy_applications / war_events)
        ↓
  Server API (dataController.js queries DB live — no restart needed)
        ↓
  Frontend components (auto-populate from API response)
```

All ingestion uses **diff-based upsert**: only write what's new or changed. No bulk deletes (except Frontex which removes stale rows when source data is corrected). Safe to run repeatedly.
