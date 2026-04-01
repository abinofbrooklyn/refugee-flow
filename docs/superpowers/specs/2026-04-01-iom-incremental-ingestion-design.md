# IOM Incremental Ingestion

**Date:** 2026-04-01
**Phase:** 4 (Data Ingestion Pipeline)
**Problem:** IOM ingestion sends 21K INSERT ON CONFLICT IGNORE statements to Supabase on every weekly run, consuming free-tier row operation limits unnecessarily.

## Root Cause

IOM's CSV API provides no date filtering — the full dataset (~21K rows) is always downloaded. The current code transforms all rows and upserts all of them to the DB. While `onConflict('id').ignore()` prevents duplicates, Supabase still counts each INSERT attempt against the free-tier limits.

## Solution

Filter transformed rows client-side before any DB writes. Query the latest date already in `route_deaths`, keep only rows newer than that date.

## Data Flow (Before → After)

**Before:**
```
Download 21K rows → Transform 21K → Validate 21K → INSERT 21K (DB ignores ~20,950)
```

**After:**
```
Download 21K rows → Transform 21K → Query MAX(date) → Filter to ~50 new → Validate ~50 → INSERT ~50
```

## Implementation

### 1. New function: `getLatestIomDate()`

```typescript
async function getLatestIomDate(): Promise<string | null> {
  const result = await db('route_deaths').max('date as max_date').first();
  return result?.max_date ?? null;
}
```

Returns the most recent date string in `route_deaths`, or null if the table is empty.

### 2. New function: `filterNewRows(rows, cutoffDate)`

```typescript
export function filterNewRows(
  rows: RouteDeathRow[],
  cutoffDate: string | null
): RouteDeathRow[] {
  if (!cutoffDate) return rows; // First run — insert all
  return rows.filter(r => r.date != null && r.date >= cutoffDate);
}
```

- Uses `>=` on the cutoff date (not `>`) so rows from the same day as the latest are included
- `onConflict('id').ignore()` handles the overlap (same-day duplicates are skipped by ID)
- Null cutoff (empty table) returns all rows — preserves first-run behavior
- Rows with null dates are excluded (they can't be compared)

### 3. Modify `runIomIngestion()`

After `transformIomRows()` and before validation:

```typescript
const cutoffDate = await getLatestIomDate();
const newRows = filterNewRows(rows, cutoffDate);
console.log(`[IOM] ${rows.length} total, ${newRows.length} new (cutoff: ${cutoffDate ?? 'none'})`);
```

Then validate and insert only `newRows` instead of `rows`.

If `newRows.length === 0`, skip the upsert loop entirely and log success with 0 rows affected.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First run (empty table) | `cutoffDate` is null → all rows inserted (existing behavior) |
| Normal weekly run | ~10-50 new rows inserted, rest filtered out |
| No new data from IOM | 0 rows inserted, logged as success |
| IOM updates old incident | Missed — but IOM data is append-only, incidents don't change |
| Multiple incidents same date as cutoff | Included by `>=`, duplicates handled by `onConflict.ignore()` |
| Rows with null date | Excluded from new rows (can't compare) |

## Testing

### Unit tests for `filterNewRows`:
1. Returns all rows when cutoffDate is null (first run)
2. Filters to only rows >= cutoffDate
3. Returns empty array when all rows are older than cutoff
4. Excludes rows with null dates
5. Includes rows on the exact cutoff date (overlap safety)
6. Handles empty input array

### Unit tests for `getLatestIomDate`:
1. Returns null when table is empty (mock DB)
2. Returns the max date string when rows exist (mock DB)

### Integration verification:
- Run ingestion twice — second run should insert 0 new rows
- Log output shows filtered count vs total count

## Impact

- **Supabase free tier:** ~21K row operations/week → ~50 row operations/week (99.8% reduction)
- **Ingestion speed:** Validation + upsert goes from 3s to <100ms
- **No behavior change:** Same data ends up in the DB, just fewer wasted writes
