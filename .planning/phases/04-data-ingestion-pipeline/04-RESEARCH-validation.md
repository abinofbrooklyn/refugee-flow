# Phase 4 (Validation Addendum): Data Quality Validation Layer - Research

**Researched:** 2026-03-20
**Domain:** Data validation, quarantine patterns, geographic boundary detection, anomaly thresholds
**Confidence:** HIGH — based entirely on project source code, no external dependencies needed

---

<user_constraints>
## User Constraints (from CONTEXT.md — validation addendum)

### Locked Decisions
- Quarantine + alert pattern: bad rows go to `data_quarantine` table, clean rows proceed
- Email alert sent to abin.abraham4@gmail.com with every flagged row and reason
- Uses existing Resend alerter (onboarding@resend.dev)
- Four validation rule types applied: geo-label mismatch, outlier coordinates, duplicate detection, value anomalies
- Quarantine stores: source, original row data (JSON), validation rule, timestamp, status (pending/reviewed/accepted/rejected)
- Alert email includes: raw values, which rule flagged it, expected vs found, pipeline/source

### Claude's Discretion
- Exact validation thresholds per source and rule
- Bounding box vs centroid approach per route
- Quarantine table schema details
- Whether to apply validation to existing geo fallback rerouting logic or keep both layers
- How to handle the 15 known unfixable IOM records already in the database

### Deferred Ideas (OUT OF SCOPE)
- Automated quarantine review UI (admin page v2)
- Machine learning anomaly detection
- Data lineage tracking
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INGEST-01 | War/conflict data ingested from ACLED API on weekly schedule | Blocked on API access; validation layer must handle war_events geo validation when unblocked |
| INGEST-02 | Asylum application data from UNHCR API on weekly schedule | UNHCR/Eurostat pipelines are non-geo (no lat/lng) — value anomaly + duplicate detection apply |
| INGEST-03 | Route death data from IOM Missing Migrants API on weekly schedule | Primary motivation for validation: fat-finger geo labeling. Full 4-rule validation applies |
| INGEST-04 | All lat/lng data passes through precision reduction and deduplication | Validation layer sits between transform and existing precision+dedup steps |
| INGEST-05 | Ingestion failures logged to `ingestion_log` table | logIngestion() can be extended with quarantine_count field |
| INGEST-06 | Admin can upload CSV data via password-protected `/admin` route | CSV upload transform → validate → upsert flow; same validator interface applies |
| INGEST-07 | CSV uploads show preview before committing | Preview step can include validation warnings before commit |
</phase_requirements>

---

## Summary

This validation layer sits between the transform step and the DB insert step in all 7 ingestion pipelines. The architecture is deliberately simple: a pure `validateRows(source, rows)` function returns `{ clean, quarantined }` partitions. Clean rows proceed to the existing upsert logic; quarantined rows go to a new `data_quarantine` table and trigger a single summary email per ingestion run.

The four validation rules map neatly to the three data types in the project: coordinate-bearing records (IOM route_deaths, ACLED war_events) get all four rules; count-bearing records (UNHCR/Eurostat asy_applications, Frontex/CBP/UK ibc_crossings) get only the two non-geo rules (duplicate detection and value anomalies).

The 15 known unfixable IOM records must be seeded into the quarantine table on migration as pre-accepted rows so they never re-trigger alerts on subsequent IOM ingestion runs.

**Primary recommendation:** Build a single `server/ingestion/validator.js` module with a `validateRows(source, rows)` function. Each pipeline calls it after transform and before insert. The module handles all four rule types and returns clean/quarantined partitions. A separate `sendQuarantineAlert(source, quarantined)` function in alerter.js sends the email.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Already-present: `db` (Knex) | existing | Quarantine table writes | Same Knex connection used by all other ingestion modules |
| Already-present: `resend` | existing | Email alerts | alerter.js already wires this up; we add one new function |
| Already-present: `node` stdlib | - | Pure validation logic | No new runtime dependencies needed |

**No new npm packages required.** The validator is pure JavaScript logic — array operations, numeric comparisons, and the existing geographic functions already in iomNormalizer.js.

### Supporting
| Component | Location | Purpose |
|-----------|----------|---------|
| `geoFallback()` | iomNormalizer.js | Already encodes geographic region logic — reuse for geo-label validation |
| `applyGeoBoundsCorrections()` | iomNormalizer.js | Route bounding box logic already written — validation confirms agreement |
| `logIngestion()` | ingestionLogger.js | Extend to include quarantine_count field |
| `sendIngestionAlert()` | alerter.js | Add `sendQuarantineAlert()` alongside it |

---

## Architecture Patterns

### Recommended File Structure
```
server/ingestion/
├── validator.js              # NEW — pure validateRows(source, rows) → {clean, quarantined}
├── alerter.js                # MODIFY — add sendQuarantineAlert(source, quarantined)
├── ingestionLogger.js        # MODIFY — extend logIngestion to accept quarantineCount
├── iomIngestion.js           # MODIFY — call validator between transform and upsert
├── acledIngestion.js         # MODIFY — call validator between transform and upsert
├── eurostatIngestion.js      # MODIFY — call validator between transform and upsert
├── unhcrIngestion.js         # MODIFY — call validator between transform and upsert
├── frontexIngestion.js       # MODIFY — call validator between transform and upsert
├── cbpIngestion.js           # MODIFY — call validator between transform and upsert
├── ukChannelIngestion.js     # MODIFY — call validator between transform and upsert
db/migrations/
└── 004_data_quarantine.js    # NEW — quarantine table + unique index on ibc_crossings
```

### Pattern 1: Validation Slot in Pipeline

The existing pipeline pattern in every module is:

```javascript
// fetch → transform → upsert
const rows = transformXxx(csvRows);
await db('table').insert(rows).onConflict(...).ignore();
```

Validation inserts between transform and upsert:

```javascript
// fetch → transform → VALIDATE → upsert clean / quarantine bad
const rows = transformXxx(csvRows);
const { clean, quarantined } = validateRows('iom', rows);

if (quarantined.length > 0) {
  await quarantineRows(quarantined);
  await sendQuarantineAlert('iom', quarantined);
}

// Only clean rows proceed to existing upsert logic
await db('route_deaths').insert(clean).onConflict('id').ignore();
```

This pattern adds exactly 4 lines to each pipeline main function. The validator is called once per run, not per row.

### Pattern 2: `validateRows(source, rows)` Function Signature

```javascript
// server/ingestion/validator.js
function validateRows(source, rows) {
  const clean = [];
  const quarantined = [];

  for (const row of rows) {
    const violations = runRules(source, row);
    if (violations.length > 0) {
      quarantined.push({ row, violations });
    } else {
      clean.push(row);
    }
  }

  return { clean, quarantined };
}
```

Each violation is: `{ rule: 'geo-label-mismatch', expected: 'Central Mediterranean', found: 'Horn of Africa', detail: '...' }`

### Pattern 3: Quarantine Table Write

```javascript
// server/ingestion/validator.js
async function quarantineRows(source, quarantinedItems) {
  const rows = quarantinedItems.map(item => ({
    source,
    raw_data: JSON.stringify(item.row),
    rule_violated: item.violations.map(v => v.rule).join(', '),
    violation_detail: JSON.stringify(item.violations),
    quarantined_at: new Date().toISOString(),
    status: 'pending',
  }));

  await db('data_quarantine').insert(rows);
}
```

### Pattern 4: IOM Known-Bad Rows — Suppress on Insert, Not Skip

The 15 known unfixable IOM records (Iran coords at Hungary, Libya at India, etc.) must be pre-populated in the quarantine table with `status = 'accepted'`. The validator checks quarantine for existing `accepted` rows matching on `source + id` before flagging.

```javascript
// In validator.js — check known-accepted set before flagging
const acceptedIds = await db('data_quarantine')
  .where({ source, status: 'accepted' })
  .pluck('raw_data'); // parse to extract IDs

// Then in per-row check:
if (acceptedIds.has(row.id)) {
  clean.push(row); // known bad but accepted — let through
  continue;
}
```

**Important:** These 15 records are already IN the database with bad geo. They should continue to exist there (they won't be re-inserted due to `onConflict('id').ignore()`). The quarantine suppression prevents them from being flagged in future IOM runs as "new" violations.

### Anti-Patterns to Avoid
- **Don't run the validator per-batch:** Call it on all transformed rows before batching, so the email has the full picture for one run.
- **Don't throw on validation failure:** Quarantine is not a pipeline error. Exceptions should only come from DB/network failures.
- **Don't add the quarantine check inside `iomNormalizer.js`:** That module is pure (no DB dependency). Keep validation separate.
- **Don't validate during CSV preview:** Preview shows the raw data; only validate on commit.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geographic bounds per route | Custom bounding box tables | `applyGeoBoundsCorrections()` + `geoFallback()` already in iomNormalizer.js | Already handles all 12 routes |
| Email templating | Custom HTML builder | Extend existing `sendIngestionAlert()` pattern in alerter.js | Consistent email formatting already established |
| Deduplication logic | Custom diff algorithm | Existing `deduplicateRows()` in iomNormalizer.js, existing Map-based dedup in CBP/Frontex | Already handles the within-batch case |
| Quarantine promotion to main tables | Custom merge scripts | Knex insert with existing upsert patterns | No new technique needed |

---

## Validation Rules — Per Source Detail

### Rule 1: Geo-Label Mismatch (IOM and ACLED only)

**Applies to:** `route_deaths` (IOM), `war_events` (ACLED)

The existing `applyGeoBoundsCorrections()` function in `iomNormalizer.js` already contains the authoritative geographic bounds for each route. The validation rule reuses this: after normalization assigns a route, check whether the coordinates agree.

**Implementation approach:** Run `geoFallback(lat, lng)` on each row's coordinates. If the result disagrees with the assigned route AND the row was not already caught by `applyGeoBoundsCorrections()`, flag it.

In practice, since `normalizeRow()` already applies `applyGeoBoundsCorrections()` before returning, geo-label mismatch in IOM will mainly catch records where the source route label is clearly wrong AND the coordinate is in a genuinely ambiguous zone. The primary catch is: **check whether `geoFallback(lat, lng) !== row.route` after normalization.** If they disagree, quarantine.

**Route bounding box summary** (from `applyGeoBoundsCorrections()` + `geoFallback()` — these are the authoritative ranges already in code):

| Route | Approximate Bounds | Notes |
|-------|--------------------|-------|
| Americas | lng < -15 (western hemisphere) | Hard west limit |
| Western African | lng -15 to +15, lat -17 to +36; also Atlantic -35 to -15 | West Africa + Canary Islands corridor |
| Central Mediterranean | lng -15 to +55, lat +15 to +40 | Sahara + Libya/Tunisia coast + Italy |
| Eastern Mediterranean | lng +15 to +45, lat +30 to +42 | Greece, Turkey, Levant |
| Western Mediterranean | lng -25 to +15, lat +30 to +50 | Morocco → Spain → France |
| Western Balkans | lng +10 to +50, lat +35 to +55 | Greece → Central Europe |
| Eastern Land Borders | lng +10 to +40, lat > +40 | Poland/Belarus/Baltics/Ukraine |
| English Channel | lng -10 to +10, lat > +48 | NW Europe |
| Horn of Africa | lng +15 to +55, lat -5 to +30 | East Africa + Yemen + Red Sea |
| East & Southern Africa | lat < -5, lng +15 to +55 | Sub-Saharan south |
| Iran-Afghanistan Corridor | lng +42 to +70, lat +15 to +40 | Iran, Afghanistan, Arabian Sea |
| South & East Asia | lng > +70 | Bay of Bengal, Andaman Sea |

**Confidence:** HIGH — derived directly from iomNormalizer.js source code.

### Rule 2: Outlier Coordinates (IOM and ACLED only)

**Applies to:** `route_deaths` (IOM), `war_events` (ACLED)

Flag rows where:
- lat is null and lng is null simultaneously AND there's a non-null route (coords missing but route assigned)
- lat outside [-90, 90] or lng outside [-180, 180] (impossible values)
- Both lat AND lng are exactly 0.0 (null island — Gulf of Guinea, not a real incident location for any route in this dataset)
- lat rounds to 0.00 AND lng rounds to 0.00 after `reduceGeoPercision(, 2)` — same problem

**Note on null coords:** IOM has legitimate null-coord rows (2 known records per migration 001 comments: "2 records have empty strings not null"). These should NOT be flagged if they have no route assigned either. Only flag null coords paired with a route assignment.

### Rule 3: Duplicate Detection (all sources)

**Applies to:** All 7 pipelines

The existing within-batch deduplication (`onConflict().ignore()` for IOM, Map-based diff for CBP/Frontex/UK) handles same-key exact duplicates. The near-duplicate problem is different: the same real-world event appears across ingestion runs with slightly changed values.

**Near-duplicate definition per source:**

| Source | Near-Duplicate Signature | Threshold |
|--------|--------------------------|-----------|
| IOM (route_deaths) | Same `id` from IOM's Main ID field | Exact match — IOM uses stable IDs; `onConflict('id').ignore()` already handles this. No near-dup problem in practice. |
| ACLED (war_events) | Same `event_id` | Exact match — stable ACLED IDs. `onConflict('event_id').ignore()` handles it. |
| Eurostat (asy_applications) | Same `(year, quarter, origin, destination)` | Handled by unique index + onConflict merge. Log if merge changes value by > 50%. |
| UNHCR (asy_applications) | Same `(year, quarter, origin, destination)` | Same as Eurostat. |
| Frontex (ibc_crossings) | Same `(route, nationality_long, year, quarter)` | Diff-based upsert already detects this. Flag if count changes by > 200% in single run (data error likely). |
| CBP (ibc_crossings) | Same `(border_location, nationality, year, quarter)` | Same as Frontex. |
| UK Channel (ibc_crossings) | Same `(nationality_long, year, quarter)` | Same as Frontex. |

**Practical scope:** For IOM and ACLED, near-duplicate detection via ID is already complete. The main value of the duplicate rule is flagging cross-run value swings for count-based sources. This is effectively a subset of Rule 4 (value anomalies).

### Rule 4: Value Anomalies (all sources)

**Applies to:** All 7 pipelines, different fields per source

| Source | Table | Fields to Check | Flag Condition |
|--------|-------|-----------------|----------------|
| IOM | route_deaths | `dead_and_missing` (text field) | Parsed integer < 0; or > 10,000 for a single incident (the highest IOM record is ~800 — 10,000 would be a clear data error) |
| ACLED | war_events | `fat` (fatalities) | < 0; or > 50,000 (Hiroshima was ~80,000; a single ACLED event > 50K is implausible) |
| Eurostat | asy_applications | `value` | < 0; or == 0 with a non-null origin/destination pair that had non-zero in prior quarters (optional — high noise risk, skip unless obvious) |
| UNHCR | asy_applications | `value` | < 0; or single-country annual total > 5,000,000 (Syria peak was ~1.2M; 5M would be a clear data error) |
| Frontex | ibc_crossings | `count` | < 0; or > 500,000 for a single route-nationality-quarter combo |
| CBP | ibc_crossings | `count` | < 0; or > 2,000,000 for a single nationality-quarter combo (CBP total quarterly encounters are typically 400K-700K) |
| UK Channel | ibc_crossings | `count` | < 0; or > 100,000 for a single nationality-quarter (UK annual total is ~45,000 small boat arrivals) |

**Simpler negative-value rule that applies everywhere:** Any numeric count/value field < 0 is always quarantined. This catches the most common data error (sign flip) without needing historical baselines.

---

## Quarantine Table Schema

```sql
-- Migration 004_data_quarantine.js
CREATE TABLE data_quarantine (
  id          SERIAL PRIMARY KEY,
  source      TEXT NOT NULL,            -- 'iom', 'acled', 'eurostat', 'unhcr', 'frontex', 'cbp', 'uk-channel'
  raw_data    JSONB NOT NULL,           -- original row object before any modification
  rule_violated TEXT NOT NULL,          -- comma-separated rule names: 'geo-label-mismatch', 'outlier-coordinates', 'duplicate', 'value-anomaly'
  violation_detail JSONB NOT NULL,      -- [{rule, expected, found, detail}, ...]
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'reviewed', 'accepted', 'rejected'
  reviewed_at TIMESTAMPTZ,
  review_note TEXT
);

-- Index for efficient lookup during suppression check
CREATE INDEX data_quarantine_source_status_idx ON data_quarantine(source, status);
```

**Why JSONB not JSON:** Supabase/PostgreSQL performs better with JSONB for indexed lookups. The suppression check (finding accepted IOM records by ID) benefits from GIN indexing on `raw_data` if needed.

**Status lifecycle:**
- `pending` — newly quarantined, not yet reviewed
- `reviewed` — owner has looked at it but not decided
- `accepted` — owner accepts this as valid data; validator will not re-flag on future runs
- `rejected` — confirmed bad data; stays quarantined forever

**Promotion path:** Accepted rows can be promoted by directly inserting from `raw_data` into the target table via a one-time script or admin SQL. No automated promotion mechanism needed for v1.

---

## Known-Bad IOM Records — Seed Strategy

The 15 unfixable IOM records (Iran coords at Hungary, Libya coords at India, etc.) are already in the `route_deaths` table from the initial seed. They will never be re-inserted due to `onConflict('id').ignore()`. But future IOM ingestion runs will re-process them through the CSV (IOM sends full history each time) and the validator will flag them every week without suppression.

**Resolution:** Populate these 15 records in `data_quarantine` with `status = 'accepted'` in migration 004. The validator checks a pre-loaded set of accepted source IDs at the start of each IOM run.

**Implementation:**
```javascript
// At start of IOM validation run, load accepted IDs:
const acceptedIomIds = new Set(
  (await db('data_quarantine')
    .where({ source: 'iom', status: 'accepted' })
    .select('raw_data'))
  .map(r => JSON.parse(r.raw_data).id)
);

// Per-row check:
if (source === 'iom' && acceptedIomIds.has(row.id)) {
  clean.push(row); // skip validation for accepted records
  continue;
}
```

The 15 IDs are known from the context: Iran-at-Hungary, Libya-at-India cases. These need to be identified from the database (a one-time query) and hardcoded into the migration 004 seed data.

**Action for implementation:** Run `SELECT id, lat, lng, route, location FROM route_deaths WHERE (route = 'Eastern Mediterranean' AND lng > 60) OR (route = 'Eastern Land Borders' AND lat < 10)` to identify the affected IDs before writing migration 004.

---

## Integration — How Each Pipeline Changes

All 7 pipelines follow the same 4-line addition pattern. The differences are in which rules apply:

| Pipeline | Table | Geo Rules? | Value Anomaly Fields |
|----------|-------|------------|---------------------|
| IOM | route_deaths | YES (lat/lng present) | dead_and_missing parsed as int |
| ACLED | war_events | YES (lat/lng present) | fat (fatalities) |
| Eurostat | asy_applications | NO | value |
| UNHCR | asy_applications | NO | value |
| Frontex | ibc_crossings | NO | count |
| CBP | ibc_crossings | NO | count, count_southwest, count_northern |
| UK Channel | ibc_crossings | NO | count |

The validator needs a `sourceConfig` map that says which rules to run per source. Non-geo sources skip rules 1 and 2 automatically.

---

## Alert Email — New Function

Add `sendQuarantineAlert(source, quarantinedItems)` to `alerter.js`. The locked decision requires every flagged row to be in the email with full detail.

```javascript
// alerter.js — new function
async function sendQuarantineAlert(source, quarantinedItems) {
  if (!quarantinedItems.length) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('[Alert] RESEND_API_KEY not set'); return; }

  const rowsHtml = quarantinedItems.map(item => `
    <tr>
      <td>${item.violations.map(v => v.rule).join(', ')}</td>
      <td><pre>${JSON.stringify(item.row, null, 2)}</pre></td>
      <td>${item.violations.map(v => `Expected: ${v.expected} / Found: ${v.found}`).join('<br>')}</td>
    </tr>
  `).join('');

  const html = `
    <h2>Data Quality Alert: ${source} — ${quarantinedItems.length} rows quarantined</h2>
    <table border="1" cellpadding="6" style="border-collapse:collapse; font-family: monospace; font-size: 12px;">
      <thead><tr><th>Rule</th><th>Raw Row</th><th>Detail</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p>Quarantined rows are in <code>data_quarantine</code> table with status='pending'.<br>
       Review via: <code>SELECT * FROM data_quarantine WHERE source='${source}' AND status='pending';</code></p>
    <hr><p style="color:#888; font-size:12px;">Refugee Flow Data Quality Alert</p>
  `;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: FROM_EMAIL,
    to: ALERT_EMAIL,
    subject: `[Refugee Flow] Data Quality: ${quarantinedItems.length} rows quarantined from ${source}`,
    html,
  });
}
```

---

## Common Pitfalls

### Pitfall 1: Validating IOM Records That Are Already in the Database
**What goes wrong:** IOM sends full history CSV every run. The 15 known-bad records will be re-processed. Without suppression, they generate weekly alert emails that noise out real issues.
**How to avoid:** Seed accepted IDs in migration 004. Load them at the start of each IOM validation run. See "Known-Bad IOM Records" section above.
**Warning signs:** Same IOM IDs appearing in quarantine alert emails week after week.

### Pitfall 2: Validator Throws, Pipeline Fails Entirely
**What goes wrong:** If `validateRows()` or `quarantineRows()` throw (e.g., DB write failure), the entire ingestion run fails and no data is ingested.
**How to avoid:** Wrap the validation + quarantine write in try/catch. On quarantine write failure, log the error and let ALL rows through to the main upsert. The goal is data quality gates, not data blocking.
```javascript
try {
  const { clean, quarantined } = validateRows(source, rows);
  if (quarantined.length > 0) {
    await quarantineRows(source, quarantined);
    await sendQuarantineAlert(source, quarantined);
  }
  return clean;
} catch (err) {
  console.error('[Validator] Failed, proceeding with all rows:', err.message);
  return rows; // graceful fallback
}
```

### Pitfall 3: Geo Validation False Positives for Legitimate Border Events
**What goes wrong:** An IOM record for "Ukraine to Europe" route legitimately has coordinates in Poland (destination country). `geoFallback(52, 21)` returns 'Western Balkans', not 'Eastern Land Borders'. This would be a false positive.
**How to avoid:** The validation rule should use `applyGeoBoundsCorrections()` rather than `geoFallback()`. `applyGeoBoundsCorrections()` has a ±tolerance built in for destination regions. Specifically: if `applyGeoBoundsCorrections(row.route, lat, lng) === row.route`, the row passes geo-label validation. Only quarantine if the bounds correction would change the route.
**Warning signs:** High quarantine rates from Eastern Land Borders or Western Balkans routes.

### Pitfall 4: Eurostat/UNHCR Value Anomaly Thresholds Too Tight
**What goes wrong:** Eurostat sends cumulative counts. If a previous run missed a month, the next run will catch up with double-month data, which looks like a sudden spike.
**How to avoid:** For asy_applications, only flag negative values as hard anomalies. The "value > N" threshold should be very conservative (> 5,000,000 total, not per-quarter-fluctuation). Alternatively, skip value-spike detection for Eurostat/UNHCR entirely and only flag negatives.

### Pitfall 5: sendQuarantineAlert Called With Empty Array
**What goes wrong:** No alert needed but code still makes Resend API call.
**How to avoid:** Guard at the top: `if (!quarantinedItems.length) return;` (shown in example above).

### Pitfall 6: JSONB raw_data Loses Type Fidelity
**What goes wrong:** `JSON.stringify(row)` then `JSON.parse(r.raw_data)` loses the original types. For route_deaths, `dead_and_missing` is a string (by design — Phase 3 decision). After round-trip through JSON, it may be coerced.
**How to avoid:** Knex with JSONB handles this — use the raw_data as an opaque blob for email display. If promotion to main table is needed, use the raw_data as a template but re-apply the same type coercions the ingestion module would apply.

---

## Code Examples

### Minimal validator.js Structure
```javascript
// server/ingestion/validator.js
const { applyGeoBoundsCorrections, geoFallback } = require('./iomNormalizer');
const db = require('../database/connection');

// Config: which rules apply per source
const SOURCE_CONFIG = {
  iom:          { hasGeo: true,  countField: null,    maxCount: null,    maxFat: null },
  acled:        { hasGeo: true,  countField: null,    maxCount: null,    maxFat: 50000 },
  eurostat:     { hasGeo: false, countField: 'value', maxCount: null,    maxFat: null },
  unhcr:        { hasGeo: false, countField: 'value', maxCount: 5000000, maxFat: null },
  frontex:      { hasGeo: false, countField: 'count', maxCount: 500000,  maxFat: null },
  cbp:          { hasGeo: false, countField: 'count', maxCount: 2000000, maxFat: null },
  'uk-channel': { hasGeo: false, countField: 'count', maxCount: 100000,  maxFat: null },
};

function runRules(source, row, config, acceptedIds) {
  const violations = [];

  // Suppress known-accepted rows
  if (source === 'iom' && row.id && acceptedIds.has(String(row.id))) return [];

  // Rule 1 + 2: Geo rules (IOM and ACLED only)
  if (config.hasGeo && row.lat != null && row.lng != null) {
    // Outlier coordinates
    if (row.lat < -90 || row.lat > 90 || row.lng < -180 || row.lng > 180) {
      violations.push({ rule: 'outlier-coordinates', expected: 'lat in [-90,90], lng in [-180,180]', found: `lat=${row.lat}, lng=${row.lng}` });
    } else if (row.lat === 0 && row.lng === 0) {
      violations.push({ rule: 'outlier-coordinates', expected: 'non-null-island coordinates', found: 'lat=0, lng=0 (null island)' });
    } else if (row.route) {
      // Geo-label mismatch: if bounds correction would change the route, flag it
      const corrected = applyGeoBoundsCorrections(row.route, row.lat, row.lng);
      if (corrected !== row.route) {
        violations.push({ rule: 'geo-label-mismatch', expected: corrected, found: row.route, detail: `coordinates (${row.lat}, ${row.lng}) fall in ${corrected} region` });
      }
    }
  }

  // Rule 4: Value anomalies
  if (config.countField) {
    const val = parseInt(row[config.countField], 10);
    if (!isNaN(val) && val < 0) {
      violations.push({ rule: 'value-anomaly', expected: '>= 0', found: String(val), detail: `${config.countField} is negative` });
    }
    if (config.maxCount && !isNaN(val) && val > config.maxCount) {
      violations.push({ rule: 'value-anomaly', expected: `<= ${config.maxCount}`, found: String(val), detail: `${config.countField} exceeds plausible maximum` });
    }
  }
  if (source === 'acled' && row.fat != null) {
    const fat = parseInt(row.fat, 10);
    if (!isNaN(fat) && fat < 0) {
      violations.push({ rule: 'value-anomaly', expected: '>= 0', found: String(fat), detail: 'fatalities is negative' });
    }
    if (!isNaN(fat) && fat > 50000) {
      violations.push({ rule: 'value-anomaly', expected: '<= 50000', found: String(fat), detail: 'fatalities exceeds plausible maximum' });
    }
  }
  if (source === 'iom' && row.dead_and_missing != null) {
    const dm = parseInt(row.dead_and_missing, 10);
    if (!isNaN(dm) && dm < 0) {
      violations.push({ rule: 'value-anomaly', expected: '>= 0', found: String(dm), detail: 'dead_and_missing is negative' });
    }
    if (!isNaN(dm) && dm > 10000) {
      violations.push({ rule: 'value-anomaly', expected: '<= 10000', found: String(dm), detail: 'dead_and_missing exceeds plausible maximum for single incident' });
    }
  }

  return violations;
}

async function validateRows(source, rows) {
  const config = SOURCE_CONFIG[source] || { hasGeo: false, countField: null };
  const acceptedIds = new Set();

  // Load accepted IOM IDs to suppress known-bad records
  if (source === 'iom') {
    const accepted = await db('data_quarantine')
      .where({ source: 'iom', status: 'accepted' })
      .select('raw_data');
    for (const r of accepted) {
      try {
        const data = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
        if (data.id) acceptedIds.add(String(data.id));
      } catch (e) { /* skip malformed */ }
    }
  }

  const clean = [];
  const quarantined = [];

  for (const row of rows) {
    const violations = runRules(source, row, config, acceptedIds);
    if (violations.length > 0) {
      quarantined.push({ row, violations });
    } else {
      clean.push(row);
    }
  }

  return { clean, quarantined };
}

async function quarantineRows(source, quarantinedItems) {
  const rows = quarantinedItems.map(item => ({
    source,
    raw_data: JSON.stringify(item.row),
    rule_violated: item.violations.map(v => v.rule).join(', '),
    violation_detail: JSON.stringify(item.violations),
    quarantined_at: new Date().toISOString(),
    status: 'pending',
  }));
  await db('data_quarantine').insert(rows);
}

module.exports = { validateRows, quarantineRows };
```

### Migration 004 Structure
```javascript
// db/migrations/004_data_quarantine.js
exports.up = async (knex) => {
  await knex.schema.createTable('data_quarantine', (t) => {
    t.increments('id').primary();
    t.text('source').notNullable();
    t.jsonb('raw_data').notNullable();
    t.text('rule_violated').notNullable();
    t.jsonb('violation_detail').notNullable();
    t.timestamp('quarantined_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.text('status').notNullable().defaultTo('pending');
    t.timestamp('reviewed_at', { useTz: true }).nullable();
    t.text('review_note').nullable();
  });

  await knex.raw('CREATE INDEX data_quarantine_source_status_idx ON data_quarantine(source, status)');

  // Seed the 15 known-unfixable IOM records as 'accepted'
  // IDs to be identified by: SELECT id, lat, lng, route FROM route_deaths WHERE ...
  // This INSERT is added after identifying IDs — placeholder here
};
```

### logIngestion Extension
```javascript
// Extend logIngestion signature to include quarantine_count
async function logIngestion({ source, status, rowsAffected = 0, errorMessage = null, startedAt, quarantineCount = 0 }) {
  await db('ingestion_log').insert({
    source, status,
    rows_affected: rowsAffected,
    error_message: errorMessage,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    quarantine_count: quarantineCount,
  });
}
```

This requires adding `quarantine_count INTEGER DEFAULT 0` to `ingestion_log` — handled in migration 004 via `ALTER TABLE`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing) |
| Config file | package.json (no explicit jest config — uses defaults) |
| Quick run command | `npx jest tests/server/validator.test.js --no-coverage` |
| Full suite command | `npx jest tests/server/ --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 | ACLED war_events geo validation | unit | `npx jest tests/server/validator.test.js -t "acled" --no-coverage` | Wave 0 |
| INGEST-02 | UNHCR value anomaly validation | unit | `npx jest tests/server/validator.test.js -t "unhcr" --no-coverage` | Wave 0 |
| INGEST-03 | IOM geo-label mismatch + known-bad suppression | unit | `npx jest tests/server/validator.test.js -t "iom" --no-coverage` | Wave 0 |
| INGEST-04 | Validator returns only clean rows to upsert path | unit | `npx jest tests/server/validator.test.js -t "clean rows" --no-coverage` | Wave 0 |
| INGEST-05 | logIngestion receives quarantine_count | unit | `npx jest tests/server/ingestion-iom.test.js --no-coverage` | Exists (extend) |
| INGEST-06 | CSV upload path calls validator | unit | `npx jest tests/server/validator.test.js -t "csv" --no-coverage` | Wave 0 |
| INGEST-07 | CSV preview does NOT call validator | unit | `npx jest tests/server/validator.test.js -t "preview" --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest tests/server/validator.test.js --no-coverage`
- **Per wave merge:** `npx jest tests/server/ --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/server/validator.test.js` — covers all 4 rule types, known-bad suppression, graceful fallback on DB failure
- [ ] `db/migrations/004_data_quarantine.js` — quarantine table schema
- [ ] `quarantine_count` column addition to `ingestion_log` table (part of migration 004)

---

## Open Questions

1. **Exact IDs of 15 unfixable IOM records**
   - What we know: Context states 15 records with source data errors (Iran coords at Hungary, Libya at India)
   - What's unclear: The exact numeric IOM Main IDs for these records need to be queried from the live database
   - Recommendation: Implementation task should begin with `SELECT id, lat, lng, route, location FROM route_deaths WHERE (route = 'Eastern Mediterranean' AND (lng > 60 OR lng < 10)) OR (route = 'Eastern Land Borders' AND lat < 20)` to surface them

2. **Frontex "Black Sea Route" and "Circular Route from Albania to Greece" in ROUTE_NAME_MAP**
   - What we know: frontexIngestion.js maps these to non-standard route names ('Black Sea', 'Circular Route from Albania to Greece') not in the 12-route list
   - What's unclear: Should geo-label validation apply to these, or skip because they're not in iomNormalizer's ROUTE_MAP?
   - Recommendation: Skip geo-label validation for routes not in iomNormalizer's known 12 routes — they have no bounds defined. Flag only value anomalies for Frontex.

3. **ingestion_log quarantine_count column addition**
   - What we know: logIngestion() needs a quarantine_count parameter
   - What's unclear: Whether to ALTER the existing ingestion_log in migration 004 or create a separate migration 005
   - Recommendation: Include in migration 004 with `ALTER TABLE ingestion_log ADD COLUMN quarantine_count INTEGER DEFAULT 0` — single migration for the validation feature

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dataController.js` geo fallback at query time | Validation at ingestion time | This phase | Cleans source data once; frontend reads clean data |
| Manual database cleanup for bad IOM records | Quarantine table with accept/reject workflow | This phase | No more ad-hoc DELETE queries |
| No alert on bad data quality (only on pipeline failures) | Quarantine alert email per run | This phase | Owner knows about quality issues immediately |

**The band-aid:** `dataController.js` `findRouteDeath()` is already a plain SELECT with no rerouting logic (the comment says normalization now happens at ingestion time). The old geo fallback was already moved to iomNormalizer.js. There is nothing to remove from dataController.js — it is already clean.

---

## Sources

### Primary (HIGH confidence)
- `server/ingestion/iomNormalizer.js` — authoritative geographic bounds (ROUTE_MAP, geoFallback, applyGeoBoundsCorrections)
- `server/ingestion/alerter.js` — exact Resend email pattern to extend
- `server/ingestion/ingestionLogger.js` — logIngestion() signature to extend
- `db/migrations/001_create_tables.js`, `002_ingestion_log_and_schema_updates.js`, `003_cbp_border_breakdown.js` — full schema
- All 7 ingestion modules — exact transform→upsert patterns that validator slots into
- `.planning/phases/04-data-ingestion-pipeline/04-CONTEXT-validation.md` — locked decisions

### Secondary (MEDIUM confidence)
- `tests/server/ingestion-iom.test.js` — establishes Jest mock patterns for DB and fetch, reusable for validator tests

---

## Metadata

**Confidence breakdown:**
- Quarantine table schema: HIGH — Knex patterns are established; JSONB is standard PostgreSQL practice
- Validation rule thresholds: MEDIUM — IOM/ACLED thresholds based on domain knowledge (10K deaths/incident, 50K fatalities/event) but not verified against historical data distribution
- Geographic bounds: HIGH — derived directly from iomNormalizer.js source code
- Integration pattern: HIGH — all 7 pipelines are read; the 4-line insert is straightforward
- Known-bad suppression: HIGH — pattern is clear; only gap is the exact 15 IDs which need a DB query

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (geographic bounds and schema decisions are stable; thresholds may be refined after first validation run)
