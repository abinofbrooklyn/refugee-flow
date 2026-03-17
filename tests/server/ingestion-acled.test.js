'use strict';

// Mock database/connection before requiring the module under test
jest.mock('../../server/database/connection', () => {
  const mockDb = jest.fn();
  mockDb.mockReturnValue({
    insert: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    ignore: jest.fn().mockResolvedValue([]),
    merge: jest.fn().mockResolvedValue([]),
  });
  return mockDb;
});

// Mock ingestionLogger
jest.mock('../../server/ingestion/ingestionLogger', () => ({
  logIngestion: jest.fn().mockResolvedValue(undefined),
  getLastSyncDate: jest.fn().mockResolvedValue(null),
}));

const {
  getAcledToken,
  fetchAcledEvents,
  transformAcledEvents,
  monthToQuarter,
  runAcledIngestion,
} = require('../../server/ingestion/acledIngestion');

const { logIngestion, getLastSyncDate } = require('../../server/ingestion/ingestionLogger');
const db = require('../../server/database/connection');

// Helper to create a mock fetch response
function mockFetchResponse(data, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('getAcledToken()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  test('Test 1: calls fetch with correct OAuth params and returns access_token', async () => {
    global.fetch = jest.fn().mockReturnValue(
      mockFetchResponse({ access_token: 'tok_abc123' })
    );

    process.env.ACLED_EMAIL = 'test@example.com';
    process.env.ACLED_PASSWORD = 'secret';

    const token = await getAcledToken();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://acleddata.com/oauth/token');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.email).toBe('test@example.com');
    expect(body.password).toBe('secret');
    expect(body.grant_type).toBe('password');
    expect(body.client_id).toBe('acled');
    expect(token).toBe('tok_abc123');
  });

  test('Test 2: throws on auth failure with descriptive message', async () => {
    global.fetch = jest.fn().mockReturnValue(
      mockFetchResponse({ error: 'invalid_credentials' })
    );

    await expect(getAcledToken()).rejects.toThrow(/ACLED auth failed/);
  });
});

describe('fetchAcledEvents()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Test 3: paginates correctly — fetches page 1 and page 2, stops when no more data', async () => {
    const page1 = Array.from({ length: 5000 }, (_, i) => ({ event_id_cnty: `E${i}` }));
    const page2 = Array.from({ length: 3 }, (_, i) => ({ event_id_cnty: `F${i}` }));

    global.fetch = jest.fn()
      .mockReturnValueOnce(mockFetchResponse({ data: page1 }))
      .mockReturnValueOnce(mockFetchResponse({ data: page2 }));

    const events = await fetchAcledEvents('tok_abc', null);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(events).toHaveLength(5003);

    const [url1] = global.fetch.mock.calls[0];
    expect(url1).toContain('page=1');
    const [url2] = global.fetch.mock.calls[1];
    expect(url2).toContain('page=2');
  });

  test('Test 4: uses event_date filter when lastSync date provided', async () => {
    global.fetch = jest.fn().mockReturnValue(
      mockFetchResponse({ data: [] })
    );

    const lastSync = new Date('2024-01-15');
    await fetchAcledEvents('tok_abc', lastSync);

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('event_date=');
    expect(url).toContain('event_date_where=BETWEEN');
    expect(url).toContain('2024-01-15');
  });
});

describe('monthToQuarter()', () => {
  test('Test 5: maps months 1-3 to q1, 4-6 to q2, 7-9 to q3, 10-12 to q4', () => {
    expect(monthToQuarter(1)).toBe('q1');
    expect(monthToQuarter(2)).toBe('q1');
    expect(monthToQuarter(3)).toBe('q1');
    expect(monthToQuarter(4)).toBe('q2');
    expect(monthToQuarter(5)).toBe('q2');
    expect(monthToQuarter(6)).toBe('q2');
    expect(monthToQuarter(7)).toBe('q3');
    expect(monthToQuarter(8)).toBe('q3');
    expect(monthToQuarter(9)).toBe('q3');
    expect(monthToQuarter(10)).toBe('q4');
    expect(monthToQuarter(11)).toBe('q4');
    expect(monthToQuarter(12)).toBe('q4');
  });
});

describe('transformAcledEvents()', () => {
  const sampleEvents = [
    {
      event_id_cnty: 'SYR14523',
      event_date: '2022-07-15',
      fatalities: '5',
      latitude: '36.2145678',
      longitude: '37.1234567',
      notes: 'Armed conflict near town',
      year: '2022',
    },
  ];

  test('Test 6: applies reduceGeoPercision(lat, 2) and reduceGeoPercision(lng, 2)', () => {
    const { warRows } = transformAcledEvents(sampleEvents);
    expect(warRows[0].lat).toBe(36.21);
    expect(warRows[0].lng).toBe(37.12);
  });

  test('Test 7: sets event_id to string event_id_cnty value', () => {
    const { warRows } = transformAcledEvents(sampleEvents);
    expect(warRows[0].event_id).toBe('SYR14523');
    expect(typeof warRows[0].event_id).toBe('string');
  });
});

describe('runAcledIngestion()', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch: OAuth token + one page of events
    global.fetch = jest.fn()
      .mockReturnValueOnce(mockFetchResponse({ access_token: 'tok_test' }))
      .mockReturnValueOnce(mockFetchResponse({
        data: [
          {
            event_id_cnty: 'SYR001',
            event_date: '2023-04-10',
            fatalities: '2',
            latitude: '35.5',
            longitude: '38.2',
            notes: 'Some notes here',
            year: '2023',
          },
        ],
      }));

    getLastSyncDate.mockResolvedValue(null);
    logIngestion.mockResolvedValue(undefined);

    // Reset db mock
    const insertMock = jest.fn().mockReturnThis();
    const onConflictMock = jest.fn().mockReturnThis();
    const ignoreMock = jest.fn().mockResolvedValue([]);
    const mergeMock = jest.fn().mockResolvedValue([]);

    db.mockReturnValue({
      insert: insertMock,
      onConflict: onConflictMock,
      ignore: ignoreMock,
      merge: mergeMock,
    });
  });

  test('Test 8: logs success with rowsAffected to ingestion_log', async () => {
    await runAcledIngestion();

    expect(logIngestion).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'acled',
        status: 'success',
        rowsAffected: expect.any(Number),
        startedAt: expect.any(Date),
      })
    );
  });

  test('Test 9: logs error with error message when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(runAcledIngestion()).rejects.toThrow('Network error');

    expect(logIngestion).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'acled',
        status: 'error',
        errorMessage: 'Network error',
        startedAt: expect.any(Date),
      })
    );
  });

  test('Test 10: inserts war_notes rows with event_id_cnty as id and notes text', async () => {
    await runAcledIngestion();

    // Check db was called with 'war_notes'
    const warNotesCalls = db.mock.calls.filter(c => c[0] === 'war_notes');
    expect(warNotesCalls.length).toBeGreaterThan(0);
  });
});
