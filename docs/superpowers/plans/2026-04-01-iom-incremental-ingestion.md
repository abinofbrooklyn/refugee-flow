# IOM Incremental Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce IOM ingestion from 21K DB writes per week to ~50 by filtering to only new rows before upserting.

**Architecture:** Add a `getLatestIomDate()` DB query and a pure `filterNewRows()` function to `iomIngestion.ts`. Call them after `transformIomRows()` and before validation/upsert. TDD: tests first for the pure function, then integration.

**Tech Stack:** TypeScript, Knex (PostgreSQL), Jest

---

### Task 1: Write failing tests for `filterNewRows`

**Files:**
- Create: `tests/server/iomIngestion.test.ts`

- [ ] **Step 1: Create test file with 6 tests**

```typescript
import { filterNewRows } from '../../server/ingestion/iomIngestion';
import type { RouteDeathRow } from '../../server/types/knex';

const makeRow = (id: string, date: string | null): RouteDeathRow => ({
  id,
  date,
  quarter: 'q1',
  year: '2026',
  dead: '1',
  missing: '0',
  dead_and_missing: '1',
  cause_of_death: 'Drowning',
  cause_of_death_display_text: 'Drowning',
  location: 'Mediterranean',
  description: null,
  source: 'IOM',
  lat: 35.0,
  lng: 14.0,
  route: 'Central Mediterranean',
  route_display_text: 'Central Mediterranean',
  source_url: null,
});

describe('filterNewRows', () => {
  const rows = [
    makeRow('MMP001', '2026-01-15'),
    makeRow('MMP002', '2026-02-20'),
    makeRow('MMP003', '2026-03-10'),
    makeRow('MMP004', '2026-03-25'),
    makeRow('MMP005', '2026-03-30'),
  ];

  it('returns all rows when cutoffDate is null (first run)', () => {
    const result = filterNewRows(rows, null);
    expect(result).toHaveLength(5);
  });

  it('filters to only rows >= cutoffDate', () => {
    const result = filterNewRows(rows, '2026-03-10');
    expect(result.map(r => r.id)).toEqual(['MMP003', 'MMP004', 'MMP005']);
  });

  it('returns empty array when all rows are older than cutoff', () => {
    const result = filterNewRows(rows, '2026-12-01');
    expect(result).toHaveLength(0);
  });

  it('excludes rows with null dates', () => {
    const withNull = [...rows, makeRow('MMP006', null)];
    const result = filterNewRows(withNull, '2026-03-10');
    expect(result.map(r => r.id)).toEqual(['MMP003', 'MMP004', 'MMP005']);
  });

  it('includes rows on the exact cutoff date (overlap safety)', () => {
    const result = filterNewRows(rows, '2026-03-25');
    expect(result.map(r => r.id)).toEqual(['MMP004', 'MMP005']);
  });

  it('handles empty input array', () => {
    const result = filterNewRows([], '2026-03-10');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/server/iomIngestion.test.ts --no-cache`
Expected: FAIL — `filterNewRows` is not exported from `iomIngestion.ts`

---

### Task 2: Implement `filterNewRows` (green)

**Files:**
- Modify: `server/ingestion/iomIngestion.ts`

- [ ] **Step 1: Add `filterNewRows` function**

Add after the `transformIomRows` function (after line 93), before `fetchAndParseIomCsv`:

```typescript
/**
 * Filter transformed rows to only those on or after the cutoff date.
 * Returns all rows if cutoffDate is null (first run / empty table).
 */
export function filterNewRows(
  rows: RouteDeathRow[],
  cutoffDate: string | null,
): RouteDeathRow[] {
  if (!cutoffDate) return rows;
  return rows.filter(r => r.date != null && r.date >= cutoffDate);
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest tests/server/iomIngestion.test.ts --no-cache`
Expected: PASS — 6/6 tests

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add server/ingestion/iomIngestion.ts tests/server/iomIngestion.test.ts
git commit -m "feat(04): add filterNewRows for IOM incremental ingestion with 6 tests"
```

---

### Task 3: Add `getLatestIomDate` and wire into `runIomIngestion`

**Files:**
- Modify: `server/ingestion/iomIngestion.ts`

- [ ] **Step 1: Add `getLatestIomDate` function**

Add after `filterNewRows`, before `fetchAndParseIomCsv`:

```typescript
/**
 * Query the most recent incident date in route_deaths.
 * Returns null if the table is empty (triggers full import).
 */
export async function getLatestIomDate(): Promise<string | null> {
  const result = await db('route_deaths').max('date as max_date').first();
  return result?.max_date ?? null;
}
```

- [ ] **Step 2: Modify `runIomIngestion` to use incremental filtering**

In `runIomIngestion()`, after line 121 (`console.log`) and before the validation block (line 123), add:

```typescript
    // Incremental: only process rows newer than what's already in DB
    const cutoffDate = await getLatestIomDate();
    const newRows = filterNewRows(rows, cutoffDate);
    console.log(`[IOM] ${rows.length} total, ${newRows.length} new (cutoff: ${cutoffDate ?? 'first run'})`);

    if (newRows.length === 0) {
      console.log('[IOM] No new rows — skipping upsert');
      await logIngestion({ source: 'iom', status: 'success', rowsAffected: 0, startedAt, quarantineCount: 0 });
      return { source: 'iom', rowsAffected: 0, quarantineCount: 0, duration: Date.now() - start };
    }
```

Then change the validation and upsert blocks to use `newRows` instead of `rows`:

Replace line 124:
```typescript
    // OLD: let cleanRows = rows as unknown as Record<string, unknown>[];
    let cleanRows = newRows as unknown as Record<string, unknown>[];
```

Replace line 127:
```typescript
    // OLD: const { clean, quarantined } = await validateRows('iom', rows as unknown as Record<string, unknown>[]);
    const { clean, quarantined } = await validateRows('iom', newRows as unknown as Record<string, unknown>[]);
```

- [ ] **Step 3: Update the JSDoc comment on `runIomIngestion`**

Replace lines 108-112:
```typescript
/**
 * Main entry: download IOM CSV, transform, filter to new rows, upsert into route_deaths.
 * Always downloads full CSV (IOM has no date-filter API), but only inserts rows
 * newer than the latest date already in the DB. First run imports all rows.
 */
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Run all tests**

Run: `npx jest tests/server/iomIngestion.test.ts --no-cache`
Expected: PASS — 6/6

- [ ] **Step 6: Commit**

```bash
git add server/ingestion/iomIngestion.ts
git commit -m "feat(04): wire incremental filtering into IOM ingestion pipeline"
```

---

### Task 4: Integration test — verify incremental behavior

**Files:**
- Modify: `tests/server/iomIngestion.test.ts`

- [ ] **Step 1: Add integration-style test documenting the incremental flow**

Append to the test file:

```typescript
describe('IOM incremental ingestion flow', () => {
  it('filterNewRows reduces row count when cutoff is recent', () => {
    // Simulate: DB has data up to March 25, CSV has data up to March 30
    const allRows = [
      makeRow('MMP001', '2026-01-15'),
      makeRow('MMP002', '2026-02-20'),
      makeRow('MMP003', '2026-03-10'),
      makeRow('MMP004', '2026-03-25'),
      makeRow('MMP005', '2026-03-28'),
      makeRow('MMP006', '2026-03-30'),
    ];
    const dbMaxDate = '2026-03-25';
    const newRows = filterNewRows(allRows, dbMaxDate);

    // Only rows >= March 25 should remain (3 rows, not all 6)
    expect(newRows).toHaveLength(3);
    expect(newRows.map(r => r.id)).toEqual(['MMP004', 'MMP005', 'MMP006']);

    // MMP004 is on the cutoff date — included for safety, onConflict handles the dupe
  });

  it('second run with same data returns zero new rows', () => {
    const allRows = [
      makeRow('MMP001', '2026-03-28'),
      makeRow('MMP002', '2026-03-30'),
    ];
    // First run: cutoff null (empty DB) → all rows
    const firstRun = filterNewRows(allRows, null);
    expect(firstRun).toHaveLength(2);

    // Second run: cutoff is max date from first run → overlap only
    const secondRun = filterNewRows(allRows, '2026-03-30');
    expect(secondRun).toHaveLength(1); // Only MMP002 (same date)
    expect(secondRun[0].id).toBe('MMP002');
    // onConflict('id').ignore() would skip MMP002 since it already exists
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx jest tests/server/iomIngestion.test.ts --no-cache`
Expected: PASS — 8/8

- [ ] **Step 3: Run full test suite**

Run: `npx jest --no-cache`
Expected: 280+ tests pass, 0 failures

- [ ] **Step 4: Commit**

```bash
git add tests/server/iomIngestion.test.ts
git commit -m "test(04): add integration tests for IOM incremental ingestion flow"
```

---

### Task 5: Build, verify, and update plan

**Files:**
- Modify: `.planning/phases/04-data-ingestion-pipeline/` (plan file if needed)

- [ ] **Step 1: TypeScript + build check**

Run: `npx tsc --noEmit && npm run build`
Expected: Both exit 0

- [ ] **Step 2: Verify all tests pass**

Run: `npx jest --no-cache`
Expected: All pass

- [ ] **Step 3: Verify the fix with a dry run**

Run:
```bash
npx tsx -e "
const { getLatestIomDate, filterNewRows, transformIomRows, fetchAndParseIomCsv } = require('./server/ingestion/iomIngestion');
(async () => {
  const cutoff = await getLatestIomDate();
  console.log('DB cutoff date:', cutoff);
  const csv = await fetchAndParseIomCsv();
  const rows = transformIomRows(csv);
  const newRows = filterNewRows(rows, cutoff);
  console.log('Total CSV rows:', csv.length);
  console.log('After transform:', rows.length);
  console.log('New rows to insert:', newRows.length);
  process.exit(0);
})();
"
```
Expected: `New rows to insert:` should be a small number (0-50), NOT 21K

- [ ] **Step 4: Commit and push**

```bash
git push origin main
```
