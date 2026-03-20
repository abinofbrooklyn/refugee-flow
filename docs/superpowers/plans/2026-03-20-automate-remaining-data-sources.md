# Automate Remaining Data Source Pipelines

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate data ingestion for the 4 remaining manual data sources: IOM Missing Migrants, Frontex IBC, UNHCR Asylum Applications, and Eurostat Monthly Asylum. Each gets an ingestion script and an auto-update script with cron scheduling.

**Architecture:** Each source follows the same pattern established by CBP and UK Channel: download → normalize → diff-based upsert → update country/route mappings. All scripts are idempotent, use transactions, and fail loudly with specific exit codes.

**Tech Stack:** Node.js, knex (PostgreSQL), csv-parse, xlsx, node-fetch or https module

---

## Execution Order

Build one at a time, test, commit, then move to the next:

1. **IOM Missing Migrants** — simplest (stable CSV URL, no scraping)
2. **Frontex IBC** — already has ingestion script, just needs auto-update wrapper
3. **UNHCR Asylum** — REST API, needs new ingestion logic
4. **Eurostat** — REST API (SDMX), needs new ingestion logic

---

## Phase 1: IOM Missing Migrants

### Context

- **Source URL:** `https://missingmigrants.iom.int/sites/g/files/tmzbdl601/files/report-migrant-incident/Missing_Migrants_Global_Figures_allData.csv`
- **Stable URL** — no scraping needed
- **CSV columns:** Main ID, Incident ID, Incident Type, Region of Incident, Incident Date, Incident Year, Month, Number of Dead, Minimum Estimated Number of Missing, Total Number of Dead and Missing, Number of Survivors, Number of Females, Number of Males, Number of Children, Country of Origin, Region of Origin, Cause of Death, Country of Incident, Migration Route, Location of Incident, Coordinates, UNSD Geographical Grouping, Information Source, URL, Source Quality
- **Target table:** `route_deaths`
- **~21K rows**, 2014-present, updated near-weekly
- **Note:** CSV has UTF-8 BOM, coordinates in single "lat, lon" field

### Files

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/ingestIOM.js` | Create | IOM CSV ingestion with diff-based upsert into `route_deaths` |
| `scripts/updateIOM.js` | Create | Auto-download from stable URL + run ingestion |
| `scripts/DATA_SOURCES.md` | Modify | Move IOM to automated section |

### Task 1.1: Examine current route_deaths schema and seed logic

- [ ] **Step 1:** Read `db/migrations/001_create_tables.js` for `route_deaths` schema
- [ ] **Step 2:** Read `scripts/seed.js` to understand how IOM data is currently loaded
- [ ] **Step 3:** Read `server/ingestion/iomNormalizer.js` to understand route normalization
- [ ] **Step 4:** Download the CSV and examine its structure vs what's in the DB
- [ ] **Step 5:** Document the field mapping: CSV columns → `route_deaths` columns

### Task 1.2: Create IOM ingestion script

- [ ] **Step 1:** Create `scripts/ingestIOM.js` following the pattern of `ingestCBP.js`:
  - Read CSV with `csv-parse`
  - Apply route normalization via `iomNormalizer.js` (reuse existing logic)
  - Parse coordinates from "lat, lon" string
  - Parse incident date
  - Diff against existing `route_deaths` rows by Incident ID (unique key)
  - Insert new, update changed, skip unchanged
  - Wrap in transaction
- [ ] **Step 2:** Verify dry run (no args → usage message)
- [ ] **Step 3:** Run against downloaded CSV, verify counts
- [ ] **Step 4:** Run again, verify "no changes needed"
- [ ] **Step 5:** Commit

### Task 1.3: Create IOM auto-update script

- [ ] **Step 1:** Create `scripts/updateIOM.js`:
  - Download from stable URL (no scraping needed)
  - Verify downloaded file is valid CSV (check header)
  - Run `ingestIOM.js`
  - Clean up temp file
- [ ] **Step 2:** Test the script end-to-end
- [ ] **Step 3:** Commit

### Task 1.4: Tests

- [ ] **Step 1:** Write tests for coordinate parsing, date parsing, route mapping
- [ ] **Step 2:** Run tests
- [ ] **Step 3:** Commit

### Task 1.5: Update DATA_SOURCES.md and commit

- [ ] **Step 1:** Move IOM from manual to automated section
- [ ] **Step 2:** Add cron line
- [ ] **Step 3:** Commit and push

---

## Phase 2: Frontex IBC

### Context

- **Source:** Scrape `https://www.frontex.europa.eu/what-we-do/monitoring-and-risk-analysis/migratory-map/` for XLSX link
- **URL pattern:** `/assets/Migratory_routes/{YEAR}/Monthly_detections_of_IBC_{YYYY}_{MM}_{DD}.xlsx`
- **Filename changes monthly** — must scrape page
- **Ingestion script already exists:** `scripts/ingestFrontexIBC.js` (already diff-based)
- **Target table:** `ibc_crossings` (all European routes)
- **~13.8K rows**, 2009-present, updated monthly

### Files

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/updateFrontex.js` | Create | Auto-download XLSX by scraping page + run existing ingestion |
| `scripts/DATA_SOURCES.md` | Modify | Move Frontex to automated section |

### Task 2.1: Create Frontex auto-update script

- [ ] **Step 1:** Create `scripts/updateFrontex.js`:
  - Fetch migratory map page HTML
  - Extract XLSX href matching `/assets/Migratory_routes/.*\.xlsx`
  - Download XLSX
  - Run `ingestFrontexIBC.js` with downloaded file
  - Clean up
- [ ] **Step 2:** Test end-to-end
- [ ] **Step 3:** Commit

### Task 2.2: Tests

- [ ] **Step 1:** Write tests for URL extraction regex
- [ ] **Step 2:** Commit

### Task 2.3: Update DATA_SOURCES.md and commit

---

## Phase 3: UNHCR Asylum Applications

### Context

- **API:** `https://api.unhcr.org/population/v1/asylum-applications/`
- **No auth required**, CORS enabled
- **Key params:** `yearFrom=2000&yearTo=2025&coo_all=true&coa_all=true&download=true`
- **Returns:** ZIP containing `asylum-applications.csv` + `footnotes.csv`
- **CSV columns:** Year, Country of origin, Country of origin (ISO), Country of asylum, Country of asylum (ISO), Authority, Application type, Stage of procedure, Cases/Persons, applied
- **Target table:** `asy_applications`
- **~119K rows**, 2000-2025, updated annually (major) with continuous minor updates
- **Note:** UNHCR country codes differ from ISO — use `coo_iso`/`coa_iso` fields
- **Note:** Need to filter to `app_type=N` (new applications), `app_pc=P` (persons), appropriate `dec_level`

### Files

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/ingestUNHCR.js` | Create | UNHCR API CSV ingestion with diff-based upsert into `asy_applications` |
| `scripts/updateUNHCR.js` | Create | Auto-download from API + run ingestion |
| `scripts/DATA_SOURCES.md` | Modify | Move UNHCR to automated section |

### Task 3.1: Examine current asy_applications schema and seed logic

- [ ] **Step 1:** Read `db/migrations/001_create_tables.js` for `asy_applications` schema
- [ ] **Step 2:** Read seed logic to understand current data format
- [ ] **Step 3:** Download API CSV and compare structure to DB schema
- [ ] **Step 4:** Document field mapping

### Task 3.2: Create UNHCR ingestion script

- [ ] **Step 1:** Create `scripts/ingestUNHCR.js`:
  - Read CSV from ZIP or direct download
  - Filter to relevant application type/level
  - Map UNHCR country codes to display names
  - Aggregate by country pair + year (or quarter if available)
  - Diff-based upsert into `asy_applications`
- [ ] **Step 2:** Test with downloaded data
- [ ] **Step 3:** Commit

### Task 3.3: Create UNHCR auto-update script

- [ ] **Step 1:** Create `scripts/updateUNHCR.js`:
  - Call API with download=true
  - Unzip response
  - Run ingestion
- [ ] **Step 2:** Test end-to-end
- [ ] **Step 3:** Commit

### Task 3.4: Tests and update DATA_SOURCES.md

---

## Phase 4: Eurostat Monthly Asylum

### Context

- **API:** `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/migr_asyappctzm/{filters}`
- **Dataset:** `migr_asyappctzm` (asylum applicants by type, citizenship, age, sex — monthly)
- **No auth required**
- **Filter path:** `freq.unit.citizen.sex.applicant.age.geo` (use `.` as wildcard)
- **Supports:** JSON and TSV format
- **Target table:** `asy_applications` (quarterly estimates derived from monthly data)
- **34 destination countries, 206 citizenships**, 2008-present, updated monthly (~18th)
- **Note:** Currently used to estimate quarterly breakdowns for non-EU destinations using seasonal patterns applied to UNHCR annual totals. The automation should maintain this estimation logic.

### Files

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/ingestEurostat.js` | Create | Eurostat API ingestion with quarterly aggregation |
| `scripts/updateEurostat.js` | Create | Auto-fetch from API + run ingestion |
| `scripts/DATA_SOURCES.md` | Modify | Move Eurostat to automated section |

### Task 4.1: Examine current Eurostat usage

- [ ] **Step 1:** Read existing asylum chart code to understand how Eurostat data is used
- [ ] **Step 2:** Read the quarterly estimation logic (if it exists as a script)
- [ ] **Step 3:** Understand the relationship: Eurostat monthly → quarterly aggregation → applied to UNHCR annual totals
- [ ] **Step 4:** Document the data flow

### Task 4.2: Create Eurostat ingestion script

- [ ] **Step 1:** Create `scripts/ingestEurostat.js`:
  - Fetch TSV from API with appropriate filters (`M.PER..T.TOTAL.TOTAL.`)
  - Parse TSV response
  - Aggregate monthly → quarterly
  - Diff-based upsert
- [ ] **Step 2:** Test with API response
- [ ] **Step 3:** Commit

### Task 4.3: Create Eurostat auto-update script

- [ ] **Step 1:** Create `scripts/updateEurostat.js`
- [ ] **Step 2:** Test end-to-end
- [ ] **Step 3:** Commit

### Task 4.4: Tests and update DATA_SOURCES.md

---

## Final: Verify all pipelines

- [ ] **Step 1:** Run all 6 update scripts sequentially, verify no errors
- [ ] **Step 2:** Verify all routes display correct data in browser
- [ ] **Step 3:** Verify About page data sources are complete
- [ ] **Step 4:** Update DATA_SOURCES.md with all pipelines in automated section
- [ ] **Step 5:** Final commit and push
