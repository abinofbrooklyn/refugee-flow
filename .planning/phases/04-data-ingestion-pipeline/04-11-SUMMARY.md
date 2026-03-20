# Plan 04-11 Summary: UK Home Office Channel Crossing Ingestion

**Status:** COMPLETE
**Executed:** 2026-03-20

## What was done
- Created `scripts/ingestUKChannel.js` — diff-based upsert into `ibc_crossings` (route="English Channel")
- Created `scripts/updateUKChannel.js` — quarterly auto-download (scrapes GOV.UK for latest XLSX link)
- Filters to "Small boat arrivals" method only
- Aggregates across sex/age by nationality + quarter (data already in calendar quarters)
- Added UK Home Office to About page data sources
- 7 tests for quarter parsing and skip logic

## Key decisions
- Filter to small boat arrivals only — other methods (air, port, inland) are not border crossings
- Skip non-country nationalities (Stateless, British overseas citizens, Not stated)
- No stale row deletion — consistent with CBP approach
- Quarterly cron (monthly check, catches quarterly releases)
- Scrape GOV.UK index page for XLSX link since URL hash changes each release

## Data stats
- 1,146 rows, 111 nationalities, 2018-2025
- 190,118 total small boat crossings
