/**
 * Unit tests for IOM Missing Migrants ingestion module (04-03)
 */
jest.mock('../../server/database/connection', () => {
  const mockDb = jest.fn() as jest.Mock & { destroy: jest.Mock };
  mockDb.destroy = jest.fn().mockResolvedValue(undefined);
  return mockDb;
});

jest.mock('../../server/ingestion/ingestionLogger', () => ({
  logIngestion: jest.fn().mockResolvedValue(undefined),
  getLastSyncDate: jest.fn().mockResolvedValue(null),
}));

global.fetch = jest.fn() as typeof fetch;

import { logIngestion } from '../../server/ingestion/ingestionLogger';
import {
  parseCoordinates,
  monthToQuarter,
  transformIomRows,
  runIomIngestion,
} from '../../server/ingestion/iomIngestion';

const mockLogIngestion = logIngestion as jest.MockedFunction<typeof logIngestion>;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- parseCoordinates ---

describe('parseCoordinates()', () => {
  test('Test 1: "35.12, 14.52" returns { lat: 35.12, lng: 14.52 }', () => {
    const result = parseCoordinates('35.12, 14.52');
    expect(result.lat).toBe(35.12);
    expect(result.lng).toBe(14.52);
  });

  test('preserves full precision coordinates (no rounding to 2 decimal places)', () => {
    const result = parseCoordinates('31.650259, -110.366455');
    expect(result.lat).toBe(31.650259);
    expect(result.lng).toBe(-110.366455);
  });

  test('preserves 6+ decimal places', () => {
    const result = parseCoordinates('35.123456, 14.654321');
    expect(result.lat).toBe(35.123456);
    expect(result.lng).toBe(14.654321);
  });

  test('Test 2: empty string returns { lat: null, lng: null }', () => {
    expect(parseCoordinates('')).toEqual({ lat: null, lng: null });
  });

  test('Test 3: null returns { lat: null, lng: null }', () => {
    expect(parseCoordinates(null)).toEqual({ lat: null, lng: null });
  });

  test('Test 4: "invalid" returns { lat: null, lng: null }', () => {
    expect(parseCoordinates('invalid')).toEqual({ lat: null, lng: null });
  });
});

// --- monthToQuarter ---

describe('monthToQuarter()', () => {
  test('Test 5: maps month numbers to correct quarters', () => {
    expect(monthToQuarter(1)).toBe('q1');
    expect(monthToQuarter(3)).toBe('q1');
    expect(monthToQuarter(4)).toBe('q2');
    expect(monthToQuarter(6)).toBe('q2');
    expect(monthToQuarter(7)).toBe('q3');
    expect(monthToQuarter(9)).toBe('q3');
    expect(monthToQuarter(10)).toBe('q4');
    expect(monthToQuarter(12)).toBe('q4');
  });
});

// --- transformIomRows ---

describe('transformIomRows()', () => {
  const sampleRows = [
    {
      'Main ID': '12345',
      'Incident Date': '2022-06-15',
      'Incident Year': '2022',
      'Number of Dead': '5',
      'Minimum Estimated Number of Missing': '2',
      'Total Number of Dead and Missing': '7',
      'Cause of Death': 'Drowning',
      'Country of Incident': 'Libya',
      'Information Source': 'IOM',
      'Coordinates': '32.88, 13.17',
      'Migration Route': 'Central Mediterranean',
      'URL': 'https://example.com/incident/12345',
    },
  ];

  test('Test 6: maps CSV column names to DB column names correctly', () => {
    const result = transformIomRows(sampleRows);
    const row = result[0];
    expect(row.id).toBe('12345');
    expect(row.date).toBe('2022-06-15');
    expect(row.year).toBe('2022');
    expect(row.dead).toBe('5');
    expect(row.missing).toBe('2');
    expect(row.dead_and_missing).toBe('7');
    expect(row.cause_of_death).toBe('Drowning');
    expect(row.location).toBe('Libya');
    expect(row.source).toBe('IOM');
    expect(row.route).toBe('Central Mediterranean');
    expect(row.source_url).toBe('https://example.com/incident/12345');
  });

  test('Test 7: splits Coordinates and preserves full precision', () => {
    const result = transformIomRows(sampleRows);
    const row = result[0];
    expect(row.lat).toBe(32.88);
    expect(row.lng).toBe(13.17);
  });

  test('does not deduplicate rows — DB handles dedup via unique ID', () => {
    // Two rows at same coords but different IDs should both be kept
    const dupeRows: typeof sampleRows = [
      { ...sampleRows[0], 'Main ID': '11111' },
      { ...sampleRows[0], 'Main ID': '22222' },
    ];
    const result = transformIomRows(dupeRows);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('11111');
    expect(result[1].id).toBe('22222');
  });
});

// --- runIomIngestion ---

describe('runIomIngestion()', () => {
  const csvContent = `Main ID,Incident Date,Incident Year,Number of Dead,Minimum Estimated Number of Missing,Total Number of Dead and Missing,Cause of Death,Country of Incident,Information Source,Coordinates,Migration Route,URL
99999,2022-06-15,2022,3,1,4,Drowning,Libya,IOM,"32.88, 13.17",Central Mediterranean,https://example.com
`;

  function setupDbMock() {
    const db = require('../../server/database/connection') as jest.MockedFunction<() => Record<string, jest.Mock>>;
    const ignoreMock = jest.fn().mockResolvedValue({ rowCount: 1 });
    const onConflictMock = jest.fn().mockReturnValue({ ignore: ignoreMock });
    const insertMock = jest.fn().mockReturnValue({ onConflict: onConflictMock });
    db.mockReturnValue({ insert: insertMock } as unknown as ReturnType<typeof db>);
    return { db, insertMock, onConflictMock, ignoreMock };
  }

  test('Test 8: fetches CSV, parses, upserts with onConflict("id").ignore()', async () => {
    const { ignoreMock } = setupDbMock();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => csvContent,
    });

    await runIomIngestion();

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('missingmigrants.iom.int'));
    expect(ignoreMock).toHaveBeenCalled();
  });

  test('Test 9: logs success with row count', async () => {
    setupDbMock();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      text: async () => csvContent,
    });

    await runIomIngestion();

    expect(mockLogIngestion).toHaveBeenCalledWith(expect.objectContaining({
      source: 'iom',
      status: 'success',
      rowsAffected: 1,
    }));
  });

  test('Test 10: logs error on failure', async () => {
    setupDbMock();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

    await runIomIngestion();

    expect(mockLogIngestion).toHaveBeenCalledWith(expect.objectContaining({
      source: 'iom',
      status: 'error',
      errorMessage: 'Connection refused',
    }));
  });
});
