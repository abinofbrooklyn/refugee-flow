# Phase 4: Data Ingestion Pipeline - Validation Context

**Gathered:** 2026-03-20
**Status:** Ready for planning
**Scope:** Data quality validation layer for all automated ingestion pipelines

<domain>
## Phase Boundary

Add a data validation layer that runs on every automated ingestion before rows reach the database. All 7 pipelines (ACLED, Eurostat, IOM, UNHCR, Frontex, CBP, UK Channel) pass through validation. Bad rows are quarantined, clean rows are ingested, and the owner is alerted with details of flagged data.

This does NOT change what data is ingested or from where — it adds quality gates to the existing pipelines.

</domain>

<decisions>
## Implementation Decisions

### Validation Rules (all 4 selected)
- **Geo-label mismatch:** Coordinates must fall within the expected geographic region for the labeled route. Claude decides whether to use bounding boxes or distance-from-centroid per route — pick whichever best fits each route's geography.
- **Outlier coordinates:** Catch clearly wrong lat/lng — null island (0,0), ocean coordinates for land events, values outside valid ranges (-90 to 90 lat, -180 to 180 lng).
- **Duplicate detection:** Covered by existing onConflict dedup (ID-based sources) + value anomaly rule (count-swing detection for Frontex/CBP/UK Channel). No separate duplicate rule needed — folded into value anomalies per research recommendation.
- **Value anomalies:** Claude decides thresholds per source based on historical data patterns. At minimum: negative counts, zero values where non-zero expected, impossible values.

### Bad Data Handling
- **LOCKED:** Quarantine + alert pattern
- Bad rows go to a `data_quarantine` table (not deleted, not ingested into main tables)
- Clean rows proceed to normal ingestion
- Email alert sent to abin.abraham4@gmail.com with every flagged row and the reason it was flagged
- Uses existing Resend alerter (onboarding@resend.dev) and retry runner

### Quarantine Table Design
- Claude's discretion on exact schema
- Must store: source, original row data (JSON), validation rule that flagged it, timestamp, status (pending/reviewed/accepted/rejected)
- Accepted rows can be moved to main tables; rejected rows stay in quarantine

### Alert Email Content
- **LOCKED:** Include every flagged row with:
  - The raw values from the source
  - Which validation rule flagged it
  - What was expected vs what was found
  - Which pipeline/source it came from

### Historical Context
- Previous cleanup deleted 6 ibc_crossings rows (US-Mexico positive longitude)
- ~20 route_deaths records were rerouted via geo fallback in dataController.js (not deleted)
- 15 IOM records remain unfixable in the database (source data errors: Iran coords at Hungary, Libya coords at India, etc.)
- asy_applications duplicates were cleaned via migration 002
- The geo fallback rerouting in dataController.js is a display-time band-aid — validation should catch these at ingestion time going forward
- Record 2022.MMP0765 (lat 24.86, lng 51.51) labeled "Central Mediterranean" but is in Qatar/UAE — still in DB, needs cleanup

### One-Time Retroactive Cleanup
- **LOCKED:** Migration 004 must include a one-time re-validation pass over ALL existing route_deaths rows
- Run every existing row through the validator's geo-label mismatch rules
- Rows that fail: quarantine them (move to data_quarantine table with reason)
- This catches the UAE record and any other unnoticed outliers already in the database
- Also tighten Central Med bounds — current check allows lng up to 55, but Central Med corridor is Libya/Tunisia → Italy (lng should be capped around 37)

### Bounds Fix Needed
- **LOCKED:** Central Mediterranean upper lng bound must be tightened from 55 to ~37 in applyGeoBoundsCorrections
- Current: `route === 'Central Mediterranean' && (lng > 55 || lng < -15)` — lets Qatar (lng 51) through
- Fix: `route === 'Central Mediterranean' && (lng > 37 || lng < -15)` — matches actual Libya/Tunisia → Italy corridor

### Claude's Discretion
- Exact validation thresholds per source and rule
- Bounding box vs centroid approach per route
- Quarantine table schema details
- Whether to apply validation to the existing geo fallback rerouting logic or keep both layers
- How to handle the 15 known unfixable IOM records already in the database

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ingestion pipeline architecture
- `server/ingestion/retryRunner.js` — Retry wrapper with alerting, all pipelines use this
- `server/ingestion/alerter.js` — Resend email alerter with source-specific diagnostics
- `server/ingestion/ingestionLogger.js` — ingestion_log table logging (logIngestion, getLastSyncDate)
- `server/server.js` lines 40-60 — Cron schedule registration for all 7 pipelines

### Existing data quality handling
- `server/controllers/api/data/dataController.js` — Geographic outlier rerouting at query time (band-aid)
- `server/ingestion/iomNormalizer.js` — IOM route normalization with geo fallback
- `db/migrations/002_ingestion_log_and_schema_updates.js` — asy_applications dedup migration

### Ingestion modules (validation must integrate with each)
- `server/ingestion/acledIngestion.js` — War/conflict events
- `server/ingestion/unhcrIngestion.js` — Non-EU asylum applications
- `server/ingestion/iomIngestion.js` — Missing migrants / route deaths
- `server/ingestion/eurostatIngestion.js` — EU asylum applications
- `server/ingestion/frontexIngestion.js` — EU border crossings
- `server/ingestion/cbpIngestion.js` — Americas border crossings
- `server/ingestion/ukChannelIngestion.js` — English Channel crossings

### Route geography reference
- `src/components/RefugeeRoute.jsx` line 19 — Route order list (12 routes)
- `server/ingestion/iomNormalizer.js` — ROUTE_MAP with geographic assignments

### Health monitoring
- `server/controllers/api/data/ingestionHealthController.js` — GET /data/ingestion-health endpoint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `retryRunner.js` + `alerter.js` — Already handles retry and email alerts; validation alerts can use the same Resend infrastructure
- `ingestionLogger.js` — logIngestion() already tracks success/error per source; could extend for quarantine counts
- `reduceGeoPercision()` — Existing geo precision function in seed utilities
- `iomNormalizer.js` ROUTE_MAP — Geographic route assignments that define expected regions per route

### Established Patterns
- All ingestion modules follow the same pattern: fetch → transform → diff-based upsert
- Validation should slot in between transform and upsert (after data is parsed, before it hits the database)
- Each module uses the shared `db` connection from `server/database/connection.js`

### Integration Points
- Validation runs inside each ingestion module's main function (after transform, before insert)
- Quarantine table needs a migration
- Health endpoint could report quarantine counts alongside ingestion status
- Alert emails use the existing Resend setup (RESEND_API_KEY in .env)

</code_context>

<specifics>
## Specific Ideas

- The IOM data specifically had fat-fingered results where labels didn't match coordinates — this was the primary motivation
- Validation should prevent the need for manual database cleanup going forward
- The 15 unfixable IOM records are known and accepted — don't re-flag them on every ingestion run
- The quarantine table is a review queue, not a trash can — accepted rows should be promotable to main tables

</specifics>

<deferred>
## Deferred Ideas

- Automated quarantine review UI (admin page v2) — for now, review via email + direct DB queries
- Machine learning anomaly detection — overkill for current data volume
- Data lineage tracking (which source contributed which row) — useful but separate concern

</deferred>

---

*Phase: 04-data-ingestion-pipeline*
*Context gathered: 2026-03-20 (validation addendum)*
