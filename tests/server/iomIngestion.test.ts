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

describe('IOM incremental ingestion flow', () => {
  it('filterNewRows reduces row count when cutoff is recent', () => {
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

    expect(newRows).toHaveLength(3);
    expect(newRows.map(r => r.id)).toEqual(['MMP004', 'MMP005', 'MMP006']);
  });

  it('second run with same data returns zero new rows', () => {
    const allRows = [
      makeRow('MMP001', '2026-03-28'),
      makeRow('MMP002', '2026-03-30'),
    ];
    const firstRun = filterNewRows(allRows, null);
    expect(firstRun).toHaveLength(2);

    const secondRun = filterNewRows(allRows, '2026-03-30');
    expect(secondRun).toHaveLength(1);
    expect(secondRun[0].id).toBe('MMP002');
  });
});
