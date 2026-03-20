# Data Source Automation Registry

This document tracks all data ingestion pipelines — what's automated, what's manual, and how to fix them if they break.

## Automated Pipelines

| Source | Ingestion Script | Auto-Update Script | Cron Schedule | Data Type | Route/Feature |
|--------|-----------------|-------------------|---------------|-----------|---------------|
| **CBP** (US border) | `ingestCBP.js` | `updateCBP.js` | `0 0 15 * *` (monthly, 15th) | Border crossings | Americas IBC tab |
| **UK Home Office** | `ingestUKChannel.js` | `updateUKChannel.js` | `0 0 1 * *` (monthly, 1st) | Small boat crossings | English Channel IBC tab |

## Manual Pipelines (to be automated)

| Source | Current Script | Access Method | Priority |
|--------|---------------|---------------|----------|
| **IOM Missing Migrants** | `seed.js` | Direct CSV URL (stable) | 1 - easiest |
| **Frontex IBC** | `ingestFrontexIBC.js` | Scrape page for XLSX | 2 |
| **UNHCR Asylum** | `seed.js` | REST API | 3 |
| **Eurostat** | `seed.js` | REST API (SDMX) | 4 |

## Cron Setup

```bash
# Add to crontab (crontab -e) on the server:
0 0 15 * *  cd /path/to/refugee-flow && node scripts/updateCBP.js >> logs/cbp-update.log 2>&1
0 0 1  * *  cd /path/to/refugee-flow && node scripts/updateUKChannel.js >> logs/uk-update.log 2>&1
# Add these as they are built:
# 0 0 5  * *  cd /path/to/refugee-flow && node scripts/updateIOM.js >> logs/iom-update.log 2>&1
# 0 0 10 * *  cd /path/to/refugee-flow && node scripts/updateFrontex.js >> logs/frontex-update.log 2>&1
# 0 0 20 * *  cd /path/to/refugee-flow && node scripts/updateUNHCR.js >> logs/unhcr-update.log 2>&1
# 0 0 22 * *  cd /path/to/refugee-flow && node scripts/updateEurostat.js >> logs/eurostat-update.log 2>&1
```

## Troubleshooting

All auto-update scripts exit with specific codes:
- **Exit 0** — success (or no new data)
- **Exit 1** — download failed (URL pattern changed, site down, or access blocked)
- **Exit 2** — ingestion failed (data format changed, DB error)

### If a pipeline breaks:

1. Check the log file in `logs/` for the error message
2. **Exit 1 (download failed):**
   - Visit the source website manually to check if it's up
   - Check if the URL structure or page layout changed
   - For scraped sources (Frontex, UK): inspect the page HTML for the new download link pattern
   - For direct URLs (IOM, CBP): verify the URL still works in a browser
   - Update the URL pattern in the update script
3. **Exit 2 (ingestion failed):**
   - Download the file manually and inspect its structure
   - Check if column names, sheet names, or data format changed
   - Update the ingestion script to match the new format
4. Re-run the update script manually: `node scripts/update<Source>.js`
5. All scripts are idempotent — safe to re-run at any time

### Manual fallback for any source:

```bash
# Download the file manually from the source website, then:
node scripts/ingest<Source>.js <path-to-downloaded-file>
```

## Data Flow Architecture

```
Source Website/API
        ↓
  updateXxx.js (download)
        ↓
  ingestXxx.js (normalize + diff-based upsert)
        ↓
  ibc_crossings / route_deaths / asy_applications (PostgreSQL)
        ↓
  Server API (dataController.js queries DB live)
        ↓
  Frontend components (auto-populate from API response)
```

All ingestion scripts use **diff-based upsert**: only insert new rows, update changed counts, skip unchanged data. No bulk deletes. Safe to run repeatedly.
