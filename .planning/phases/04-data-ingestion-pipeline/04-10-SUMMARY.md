# Plan 04-10 Summary: CBP Border Crossing Ingestion

**Status:** COMPLETE
**Executed:** 2026-03-20

## What was done
- Created `scripts/nationality-map.js` — CBP uppercase → title case nationality normalization
- Created `scripts/ingestCBP.js` — diff-based upsert into `ibc_crossings` (route="Americas")
- Created `scripts/updateCBP.js` — automated monthly download (tries multiple URL patterns)
- Filters to USBP Title 8 apprehensions only (equivalent to Frontex IBC)
- Converts US fiscal year months to calendar year quarters
- Aggregates across border regions, stores Southwest/Northern breakdown in extra columns
- DB migration `003_cbp_border_breakdown.js` for `count_southwest` and `count_northern` columns
- Added CBP to About page data sources
- 22 tests for nationality map + FY conversion, 14 tests for auto-update URL logic

## Key decisions
- Title 8 USBP apprehensions only (not OFO inadmissibles) — closest to Frontex IBC
- No stale row deletion — CBP CSVs cover partial date ranges
- Merged Southwest + Northern into single entry per nationality (total in `count`, breakdown in extra cols)
- Monthly cron on 15th to account for CBP's ~2 month publishing lag

## Data stats
- 550 rows, 22 nationalities, 2019-2026
- 5,314,232 total border crossings
