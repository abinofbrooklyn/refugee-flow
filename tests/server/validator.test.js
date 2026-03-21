/**
 * Unit tests for validator.js
 * Tests all 3 rule types: geo-label mismatch, outlier coordinates, value anomalies
 * Plus: known-bad suppression, quarantineRows, graceful fallback, non-geo source skip
 */

// Mock the database connection
jest.mock('../../server/database/connection', () => {
  const mockDb = jest.fn();
  mockDb.destroy = jest.fn().mockResolvedValue();
  return mockDb;
});

// Mock iomNormalizer's applyGeoBoundsCorrections so we control geo validation output
jest.mock('../../server/ingestion/iomNormalizer', () => ({
  applyGeoBoundsCorrections: jest.fn(),
}));

const db = require('../../server/database/connection');
const { applyGeoBoundsCorrections } = require('../../server/ingestion/iomNormalizer');
const { validateRows, quarantineRows, SOURCE_CONFIG } = require('../../server/ingestion/validator');

beforeEach(() => {
  jest.clearAllMocks();
  // Default: applyGeoBoundsCorrections returns the route unchanged (no mismatch)
  applyGeoBoundsCorrections.mockImplementation((route) => route);
});

// Helper to set up a chainable db mock that returns empty accepted IDs
function setupEmptyAcceptedIds() {
  const selectMock = jest.fn().mockResolvedValue([]);
  const whereMock = jest.fn().mockReturnValue({ select: selectMock });
  db.mockReturnValue({ where: whereMock });
  return { whereMock, selectMock };
}

// ============================================================
// SOURCE_CONFIG export
// ============================================================

describe('SOURCE_CONFIG', () => {
  test('exports SOURCE_CONFIG with all 7 source keys', () => {
    expect(SOURCE_CONFIG).toHaveProperty('iom');
    expect(SOURCE_CONFIG).toHaveProperty('acled');
    expect(SOURCE_CONFIG).toHaveProperty('eurostat');
    expect(SOURCE_CONFIG).toHaveProperty('unhcr');
    expect(SOURCE_CONFIG).toHaveProperty('frontex');
    expect(SOURCE_CONFIG).toHaveProperty('cbp');
    expect(SOURCE_CONFIG).toHaveProperty('uk-channel');
  });

  test('iom and acled have hasGeo: true', () => {
    expect(SOURCE_CONFIG.iom.hasGeo).toBe(true);
    expect(SOURCE_CONFIG.acled.hasGeo).toBe(true);
  });

  test('non-geo sources have hasGeo: false', () => {
    expect(SOURCE_CONFIG.eurostat.hasGeo).toBe(false);
    expect(SOURCE_CONFIG.unhcr.hasGeo).toBe(false);
    expect(SOURCE_CONFIG.frontex.hasGeo).toBe(false);
    expect(SOURCE_CONFIG.cbp.hasGeo).toBe(false);
    expect(SOURCE_CONFIG['uk-channel'].hasGeo).toBe(false);
  });
});

// ============================================================
// Rule 1: Geo-label mismatch (IOM only)
// ============================================================

describe('geo-label mismatch', () => {
  test('row with route=Central Mediterranean, coords falling in Horn of Africa => quarantined with geo-label-mismatch', async () => {
    // lat=5, lng=40 — applyGeoBoundsCorrections would return 'Horn of Africa'
    applyGeoBoundsCorrections.mockReturnValue('Horn of Africa');
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW1', route: 'Central Mediterranean', lat: 5, lng: 40 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(clean).toHaveLength(0);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('geo-label-mismatch');
    expect(quarantined[0].violations[0].found).toBe('Central Mediterranean');
    expect(quarantined[0].violations[0].expected).toBe('Horn of Africa');
  });

  test('row with route=Central Mediterranean, coords in Central Med => clean', async () => {
    // lat=35, lng=15 — applyGeoBoundsCorrections returns 'Central Mediterranean' (no change)
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW2', route: 'Central Mediterranean', lat: 35, lng: 15 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });

  test('row with no lat/lng (null) skips geo rules => clean', async () => {
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW3', route: 'Central Mediterranean', lat: null, lng: null }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
    // applyGeoBoundsCorrections should NOT have been called
    expect(applyGeoBoundsCorrections).not.toHaveBeenCalled();
  });
});

// ============================================================
// Rule 2: Outlier coordinates (IOM only)
// ============================================================

describe('outlier-coordinates', () => {
  test('row with lat=0, lng=0 => quarantined with outlier-coordinates (null island)', async () => {
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW4', route: 'Central Mediterranean', lat: 0, lng: 0 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('outlier-coordinates');
    expect(quarantined[0].violations[0].found).toContain('null island');
  });

  test('row with lat=95, lng=10 => quarantined (lat out of valid range)', async () => {
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW5', route: 'Central Mediterranean', lat: 95, lng: 10 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('outlier-coordinates');
  });

  test('row with lat=-200, lng=10 => quarantined (lat out of valid range)', async () => {
    setupEmptyAcceptedIds();

    const rows = [{ id: 'ROW6', route: 'Central Mediterranean', lat: -200, lng: 10 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('outlier-coordinates');
  });
});

// ============================================================
// Rule 3: Value anomalies — per source
// ============================================================

describe('value-anomaly', () => {
  // --- CBP ---
  test('validateRows("cbp", [{count: -5}]) => quarantined with value-anomaly', async () => {
    const rows = [{ count: -5, border_location: 'Southwest', nationality: 'Mexico', year: 2022, quarter: 'q1' }];
    const { clean, quarantined } = await validateRows('cbp', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  test('validateRows("cbp", [{count: 3000000}]) => quarantined (exceeds 2000000 max)', async () => {
    const rows = [{ count: 3000000, border_location: 'Southwest', nationality: 'Mexico', year: 2022, quarter: 'q1' }];
    const { clean, quarantined } = await validateRows('cbp', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  test('validateRows("cbp", [{count: 100}]) => clean', async () => {
    const rows = [{ count: 100, border_location: 'Southwest', nationality: 'Mexico', year: 2022, quarter: 'q1' }];
    const { clean, quarantined } = await validateRows('cbp', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });

  // --- IOM dead_and_missing ---
  test('validateRows("iom", [{dead_and_missing: "-3"}]) => quarantined (negative after parseInt)', async () => {
    setupEmptyAcceptedIds();
    const rows = [{ id: 'ROW7', dead_and_missing: '-3', route: 'Central Mediterranean', lat: 35, lng: 15 }];
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  test('validateRows("iom", [{dead_and_missing: "15000"}]) => quarantined (exceeds 10000 max)', async () => {
    setupEmptyAcceptedIds();
    const rows = [{ id: 'ROW8', dead_and_missing: '15000', route: 'Central Mediterranean', lat: 35, lng: 15 }];
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  // --- ACLED fat ---
  test('validateRows("acled", [{fat: -1}]) => quarantined', async () => {
    const rows = [{ event_id: 'E1', fat: -1, route: 'Central Mediterranean', lat: 35, lng: 15 }];
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');
    const { clean, quarantined } = await validateRows('acled', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  test('validateRows("acled", [{fat: 60000}]) => quarantined (exceeds 50000)', async () => {
    const rows = [{ event_id: 'E2', fat: 60000, route: 'Central Mediterranean', lat: 35, lng: 15 }];
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');
    const { clean, quarantined } = await validateRows('acled', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  // --- UNHCR ---
  test('validateRows("unhcr", [{value: -10}]) => quarantined', async () => {
    const rows = [{ origin: 'SY', destination: 'DE', year: 2022, quarter: 'q1', value: -10 }];
    const { clean, quarantined } = await validateRows('unhcr', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  // --- Frontex ---
  test('validateRows("frontex", [{count: -1}]) => quarantined', async () => {
    const rows = [{ route: 'Central Mediterranean', nationality_long: 'Syrian', year: 2022, quarter: 'q1', count: -1 }];
    const { clean, quarantined } = await validateRows('frontex', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  // --- UK Channel ---
  test('validateRows("uk-channel", [{count: -1}]) => quarantined', async () => {
    const rows = [{ nationality_long: 'Albanian', year: 2022, quarter: 'q1', count: -1 }];
    const { clean, quarantined } = await validateRows('uk-channel', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('value-anomaly');
  });

  // --- Eurostat (within range) ---
  test('validateRows("eurostat", [{value: 500}]) => clean (within range)', async () => {
    const rows = [{ origin: 'SY', destination: 'DE', year: 2022, quarter: 'q1', value: 500 }];
    const { clean, quarantined } = await validateRows('eurostat', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });
});

// ============================================================
// Known-bad suppression
// ============================================================

describe('known-bad suppression', () => {
  test('IOM row with accepted ID is passed as clean (not quarantined)', async () => {
    // Simulate data_quarantine having this ID as status=accepted
    const selectMock = jest.fn().mockResolvedValue([
      { raw_data: JSON.stringify({ id: 'ACCEPTED-123' }) },
    ]);
    const whereMock = jest.fn().mockReturnValue({ select: selectMock });
    db.mockReturnValue({ where: whereMock });

    // Even with bad geo, the accepted row should come through as clean
    applyGeoBoundsCorrections.mockReturnValue('Horn of Africa'); // would normally fail
    const rows = [{ id: 'ACCEPTED-123', route: 'Central Mediterranean', lat: 5, lng: 40, dead_and_missing: '3' }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });

  test('IOM row with unknown ID and bad geo => quarantined normally', async () => {
    setupEmptyAcceptedIds();
    applyGeoBoundsCorrections.mockReturnValue('Horn of Africa');
    const rows = [{ id: 'UNKNOWN-999', route: 'Central Mediterranean', lat: 5, lng: 40 }];
    const { clean, quarantined } = await validateRows('iom', rows);

    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].violations[0].rule).toBe('geo-label-mismatch');
  });

  test('IOM accepted row: accepted status loaded via where({source:"iom",status:"accepted"})', async () => {
    const selectMock = jest.fn().mockResolvedValue([
      { raw_data: JSON.stringify({ id: 'ACCEPTED-123' }) },
    ]);
    const whereMock = jest.fn().mockReturnValue({ select: selectMock });
    db.mockReturnValue({ where: whereMock });

    await validateRows('iom', [{ id: 'ACCEPTED-123', route: 'Central Mediterranean', lat: 5, lng: 40 }]);

    expect(whereMock).toHaveBeenCalledWith({ source: 'iom', status: 'accepted' });
  });
});

// ============================================================
// quarantineRows
// ============================================================

describe('quarantineRows', () => {
  test('quarantineRows inserts into data_quarantine with source, status=pending, raw_data as JSON string', async () => {
    const insertMock = jest.fn().mockResolvedValue();
    db.mockReturnValue({ insert: insertMock });

    const quarantinedItems = [
      {
        row: { id: 'ROW1', route: 'Central Mediterranean', lat: 5, lng: 40 },
        violations: [{ rule: 'geo-label-mismatch', expected: 'Horn of Africa', found: 'Central Mediterranean' }],
      },
    ];

    await quarantineRows('iom', quarantinedItems);

    expect(db).toHaveBeenCalledWith('data_quarantine');
    expect(insertMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        source: 'iom',
        status: 'pending',
        rule_violated: 'geo-label-mismatch',
      }),
    ]));

    // raw_data should be a JSON string
    const insertedRow = insertMock.mock.calls[0][0][0];
    expect(typeof insertedRow.raw_data).toBe('string');
    const parsed = JSON.parse(insertedRow.raw_data);
    expect(parsed.id).toBe('ROW1');
  });

  test('quarantineRows includes violation_detail as JSON string', async () => {
    const insertMock = jest.fn().mockResolvedValue();
    db.mockReturnValue({ insert: insertMock });

    const quarantinedItems = [
      {
        row: { id: 'ROW2' },
        violations: [{ rule: 'value-anomaly', expected: '>= 0', found: '-5' }],
      },
    ];

    await quarantineRows('iom', quarantinedItems);

    const insertedRow = insertMock.mock.calls[0][0][0];
    expect(typeof insertedRow.violation_detail).toBe('string');
    const detail = JSON.parse(insertedRow.violation_detail);
    expect(detail[0].rule).toBe('value-anomaly');
  });

  test('quarantineRows with multiple violations: rule_violated is comma-separated', async () => {
    const insertMock = jest.fn().mockResolvedValue();
    db.mockReturnValue({ insert: insertMock });

    const quarantinedItems = [
      {
        row: { id: 'ROW3' },
        violations: [
          { rule: 'outlier-coordinates', expected: 'lat in [-90,90]', found: 'lat=95' },
          { rule: 'value-anomaly', expected: '>= 0', found: '-3' },
        ],
      },
    ];

    await quarantineRows('iom', quarantinedItems);

    const insertedRow = insertMock.mock.calls[0][0][0];
    expect(insertedRow.rule_violated).toBe('outlier-coordinates, value-anomaly');
  });
});

// ============================================================
// Graceful fallback
// ============================================================

describe('graceful fallback', () => {
  test('when db("data_quarantine") select throws, validateRows returns all rows as clean (no crash)', async () => {
    // Simulate DB failure during accepted IDs loading
    const selectMock = jest.fn().mockRejectedValue(new Error('DB connection failed'));
    const whereMock = jest.fn().mockReturnValue({ select: selectMock });
    db.mockReturnValue({ where: whereMock });

    const rows = [
      { id: 'ROW1', route: 'Central Mediterranean', lat: 35, lng: 15 },
      { id: 'ROW2', route: 'Central Mediterranean', lat: 36, lng: 14 },
    ];
    applyGeoBoundsCorrections.mockReturnValue('Central Mediterranean');

    const { clean, quarantined } = await validateRows('iom', rows);

    // All rows pass through as clean on DB failure
    expect(clean).toHaveLength(2);
    expect(quarantined).toHaveLength(0);
  });

  test('graceful fallback does not throw on DB failure', async () => {
    const selectMock = jest.fn().mockRejectedValue(new Error('Network timeout'));
    const whereMock = jest.fn().mockReturnValue({ select: selectMock });
    db.mockReturnValue({ where: whereMock });

    const rows = [{ id: 'ROW1', route: 'Eastern Mediterranean', lat: 37, lng: 25 }];

    await expect(validateRows('iom', rows)).resolves.toBeDefined();
  });
});

// ============================================================
// Non-geo sources skip geo rules
// ============================================================

describe('non-geo sources skip geo rules', () => {
  test('validateRows("eurostat", [{value: 100, lat: 0, lng: 0}]) => clean (geo rules not applied)', async () => {
    const rows = [{ origin: 'SY', destination: 'DE', year: 2022, quarter: 'q1', value: 100, lat: 0, lng: 0 }];
    const { clean, quarantined } = await validateRows('eurostat', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
    // applyGeoBoundsCorrections should NOT be called for non-geo sources
    expect(applyGeoBoundsCorrections).not.toHaveBeenCalled();
  });

  test('validateRows("unhcr", [{value: 100, lat: 0, lng: 0}]) => clean', async () => {
    const rows = [{ origin: 'AF', destination: 'US', year: 2022, quarter: 'q1', value: 100, lat: 0, lng: 0 }];
    const { clean, quarantined } = await validateRows('unhcr', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });

  test('validateRows("frontex", [{count: 500, lat: 0, lng: 0}]) => clean', async () => {
    const rows = [{ route: 'Central Mediterranean', nationality_long: 'Syrian', year: 2022, quarter: 'q1', count: 500, lat: 0, lng: 0 }];
    const { clean, quarantined } = await validateRows('frontex', rows);

    expect(clean).toHaveLength(1);
    expect(quarantined).toHaveLength(0);
  });
});
