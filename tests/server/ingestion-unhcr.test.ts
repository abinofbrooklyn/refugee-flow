/**
 * Unit tests for UNHCR asylum application ingestion module (04-03)
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

// We mock fetch globally for node environment
global.fetch = jest.fn() as typeof fetch;

import { logIngestion, getLastSyncDate } from '../../server/ingestion/ingestionLogger';
import {
  fetchAllUnhcrApplications,
  transformUnhcrItems,
  runUnhcrIngestion,
} from '../../server/ingestion/unhcrIngestion';

const mockLogIngestion = logIngestion as jest.MockedFunction<typeof logIngestion>;
const mockGetLastSyncDate = getLastSyncDate as jest.MockedFunction<typeof getLastSyncDate>;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- fetchAllUnhcrApplications ---

describe('fetchAllUnhcrApplications()', () => {
  test('Test 1: paginates correctly — page=1 returns maxPages=2, fetches both pages', async () => {
    const page1 = { page: 1, maxPages: 2, items: [{ year: 2022, coo_name: 'Syria', coa_name: 'Germany', applied: '500' }] };
    const page2 = { page: 2, maxPages: 2, items: [{ year: 2022, coo_name: 'Iraq', coa_name: 'Sweden', applied: '200' }] };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => page1 })
      .mockResolvedValueOnce({ ok: true, json: async () => page2 });

    const result = await fetchAllUnhcrApplications(null);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0].coo_name).toBe('Syria');
    expect(result[1].coo_name).toBe('Iraq');
  });

  test('Test 2: passes yearFrom param when lastSync provided', async () => {
    const page1 = { page: 1, maxPages: 1, items: [] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => page1 });

    await fetchAllUnhcrApplications(2021);

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(calledUrl).toContain('yearFrom=2021');
  });
});

// --- transformUnhcrItems ---

describe('transformUnhcrItems()', () => {
  // Use non-EU destinations — EU countries are filtered out (Eurostat owns EU/EEA data)
  const sampleItems = [
    { year: 2022, coo_name: 'Syria', coa_name: 'Turkey', applied: '500' },
    { year: 2021, coo_name: 'Afghanistan', coa_name: 'Pakistan', applied: '300' },
  ];

  test('Test 3: maps coo_name to origin, coa_name to destination, applied to value', () => {
    const result = transformUnhcrItems(sampleItems);
    expect(result[0].origin).toBe('Syria');
    expect(result[0].destination).toBe('Turkey');
    expect(result[0].value).toBe(500);
    expect(result[1].origin).toBe('Afghanistan');
    expect(result[1].destination).toBe('Pakistan');
    expect(result[1].value).toBe(300);
  });

  test('Test 3b: filters out EU/EEA destinations (Eurostat owns those)', () => {
    const euItems = [
      { year: 2022, coo_name: 'Syria', coa_name: 'Germany', applied: '500' },
      { year: 2022, coo_name: 'Syria', coa_name: 'Turkey', applied: '200' },
    ];
    const result = transformUnhcrItems(euItems);
    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe('Turkey');
  });

  test("Test 4: sets quarter to 'q1' for all records (UNHCR has annual data only)", () => {
    const result = transformUnhcrItems(sampleItems);
    expect(result[0].quarter).toBe('q1');
    expect(result[1].quarter).toBe('q1');
  });

  test('Test 5: sets year as string', () => {
    const result = transformUnhcrItems(sampleItems);
    expect(typeof result[0].year).toBe('string');
    expect(result[0].year).toBe('2022');
    expect(typeof result[1].year).toBe('string');
    expect(result[1].year).toBe('2021');
  });
});

// --- runUnhcrIngestion ---

describe('runUnhcrIngestion()', () => {
  function setupDbMock(rowCount = 1) {
    const db = require('../../server/database/connection') as jest.MockedFunction<() => Record<string, jest.Mock>>;
    const mergeResult = { rowCount };
    const mergeMock = jest.fn().mockResolvedValue(mergeResult);
    const onConflictMock = jest.fn().mockReturnValue({ merge: mergeMock });
    const insertMock = jest.fn().mockReturnValue({ onConflict: onConflictMock });
    // Chain for db('asy_applications').select().sum().whereIn().groupBy()
    const groupByMock = jest.fn().mockResolvedValue([]);
    const whereInMock = jest.fn().mockReturnValue({ groupBy: groupByMock });
    const sumMock = jest.fn().mockReturnValue({ whereIn: whereInMock });
    const selectMock = jest.fn().mockReturnValue({ sum: sumMock });
    db.mockReturnValue({ insert: insertMock, select: selectMock } as unknown as ReturnType<typeof db>);
    return { db, insertMock, onConflictMock, mergeMock };
  }

  test('Test 6: logs success to ingestion_log', async () => {
    setupDbMock();
    mockGetLastSyncDate.mockResolvedValue(null);

    // Use non-EU destination so record is not filtered out
    const page1 = { page: 1, maxPages: 1, items: [{ year: 2022, coo_name: 'Syria', coa_name: 'Turkey', applied: '100' }] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => page1 });

    await runUnhcrIngestion();

    expect(mockLogIngestion).toHaveBeenCalledWith(expect.objectContaining({
      source: 'unhcr',
      status: 'success',
    }));
  });

  test('Test 7: logs error with message on failure', async () => {
    setupDbMock();
    mockGetLastSyncDate.mockResolvedValue(null);

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'));

    await runUnhcrIngestion();

    expect(mockLogIngestion).toHaveBeenCalledWith(expect.objectContaining({
      source: 'unhcr',
      status: 'error',
      errorMessage: 'Network failure',
    }));
  });
});
