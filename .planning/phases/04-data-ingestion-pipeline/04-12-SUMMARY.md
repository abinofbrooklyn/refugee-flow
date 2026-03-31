# Plan 04-12 Summary: Border Breakdown, Data Sources Links, Route Ordering

**Status:** COMPLETE
**Executed:** 2026-03-20

## What was done
- DB migration `003_cbp_border_breakdown.js` — added `count_southwest`, `count_northern` columns
- Updated `dataController.js` to include `borderBreakdown` in API response for Americas
- Updated IBC card component with labeled Southwest/Northern border rows
- Route-aware Data Sources buttons: CBP for Americas, UK Home Office for English Channel, Frontex for others
- Basic Info Data Sources: same routing, plus skip The Migrants Files for non-European routes
- Route ordering: English Channel after Western Mediterranean, Americas before Western African (geographic grouping)
- Updated all three route list locations (JSON, RefugeeRoute, GlobeRouteButton)
- Created `scripts/DATA_SOURCES.md` — in-repo automation registry with troubleshooting guide

## Files changed
- `db/migrations/003_cbp_border_breakdown.js`
- `server/controllers/api/data/dataController.js`
- `src/components/RefugeeRoute_textArea_content_ibcCountryItem.jsx`
- `src/components/RefugeeRoute_textArea_content_ibcCountry.jsx`
- `src/components/RefugeeRoute_textArea_content_basicInfo.jsx`
- `src/data/IBC_crossingCountByCountry.json`
- `src/components/RefugeeRoute.jsx`
- `src/components/globe/GlobeRouteButton.jsx`
- `scripts/DATA_SOURCES.md`
