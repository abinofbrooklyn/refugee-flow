/**
 * Unit tests for IOM route normalization pipeline (04-06)
 */
const {
  ROUTE_MAP,
  geoFallback,
  fixSwappedLatLng,
  resolveRoute,
  applyGeoBoundsCorrections,
  normalizeRow,
  deduplicateRows,
} = require('../../server/ingestion/iomNormalizer');

// --- ROUTE_MAP ---

describe('ROUTE_MAP', () => {
  test('contains at least 30 entries', () => {
    expect(Object.keys(ROUTE_MAP).length).toBeGreaterThanOrEqual(30);
  });

  test('all values are non-empty strings', () => {
    Object.values(ROUTE_MAP).forEach(v => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });

  test('maps composite IOM labels to display categories', () => {
    expect(ROUTE_MAP['Central Mediterranean,Sahara Desert crossing']).toBe('Central Mediterranean');
    expect(ROUTE_MAP['Bay of Bengal/Andaman Sea']).toBe('South & East Asia');
    expect(ROUTE_MAP['US-Mexico border crossing']).toBe('Americas');
  });

  test('does not contain Others entry', () => {
    expect(ROUTE_MAP).not.toHaveProperty('Others');
  });
});

// --- fixSwappedLatLng ---

describe('fixSwappedLatLng()', () => {
  test('swaps when lat > 90', () => {
    expect(fixSwappedLatLng(150, 35)).toEqual({ lat: 35, lng: 150 });
  });

  test('swaps when lat < -90', () => {
    expect(fixSwappedLatLng(-150, 35)).toEqual({ lat: 35, lng: -150 });
  });

  test('no swap when lat is within range', () => {
    expect(fixSwappedLatLng(35, 15)).toEqual({ lat: 35, lng: 15 });
  });

  test('returns nulls unchanged', () => {
    expect(fixSwappedLatLng(null, null)).toEqual({ lat: null, lng: null });
  });
});

// --- geoFallback ---

describe('geoFallback()', () => {
  test('Americas for lng < -15', () => {
    expect(geoFallback(6, -70)).toBe('Americas');
  });

  test('Western Mediterranean for North Africa lat 30-40, lng -10 to 15', () => {
    expect(geoFallback(33, 12)).toBe('Western Mediterranean');
  });

  test('Horn of Africa for tropical lng 30-55', () => {
    expect(geoFallback(10, 45)).toBe('Horn of Africa');
  });

  test('South & East Asia for lng > 70', () => {
    expect(geoFallback(20, 80)).toBe('South & East Asia');
  });

  test('Central Mediterranean for Sahara transit', () => {
    expect(geoFallback(22, 10)).toBe('Central Mediterranean');
  });

  test('English Channel for NW Europe', () => {
    expect(geoFallback(56, 0)).toBe('English Channel');
  });

  test('Western African as catch-all', () => {
    expect(geoFallback(-10, 10)).toBe('Western African');
  });
});

// --- resolveRoute ---

describe('resolveRoute()', () => {
  test('known route returns mapped value with wasFallback=false', () => {
    const result = resolveRoute('Central Mediterranean,Sahara Desert crossing', 33, 12);
    expect(result).toEqual({
      route: 'Central Mediterranean',
      wasFallback: false,
      rawRoute: 'Central Mediterranean,Sahara Desert crossing',
    });
  });

  test('unknown route returns geoFallback with wasFallback=true', () => {
    const result = resolveRoute('SomeNewUnknownRoute', 33, 12);
    expect(result.wasFallback).toBe(true);
    expect(result.route).toBe(geoFallback(33, 12));
  });

  test('null route returns geoFallback with wasFallback=true', () => {
    const result = resolveRoute(null, 33, 12);
    expect(result.wasFallback).toBe(true);
    expect(result.route).toBe(geoFallback(33, 12));
  });

  test('Others route returns geoFallback (not in ROUTE_MAP)', () => {
    const result = resolveRoute('Others', 33, 12);
    expect(result.wasFallback).toBe(true);
    expect(result.route).toBe(geoFallback(33, 12));
  });

  test('empty string route returns geoFallback', () => {
    const result = resolveRoute('', 6, -70);
    expect(result.wasFallback).toBe(true);
    expect(result.route).toBe('Americas');
  });
});

// --- applyGeoBoundsCorrections ---

describe('applyGeoBoundsCorrections()', () => {
  test('valid bounds unchanged - Americas', () => {
    expect(applyGeoBoundsCorrections('Americas', 20, -80)).toBe('Americas');
  });

  test('valid bounds unchanged - Central Mediterranean', () => {
    expect(applyGeoBoundsCorrections('Central Mediterranean', 33, 12)).toBe('Central Mediterranean');
  });

  test('Horn of Africa out of bounds (lng > 55) corrected via geoFallback', () => {
    const result = applyGeoBoundsCorrections('Horn of Africa', 35, 60);
    expect(result).toBe(geoFallback(35, 60));
    expect(result).not.toBe('Horn of Africa');
  });

  test('hard limit: lng > 70 becomes South & East Asia', () => {
    expect(applyGeoBoundsCorrections('Central Mediterranean', 20, 80)).toBe('South & East Asia');
  });

  test('hard limit: lng < -35 becomes Americas', () => {
    expect(applyGeoBoundsCorrections('Western African', 20, -40)).toBe('Americas');
  });

  test('Americas with lng > -15 corrected via geoFallback', () => {
    const result = applyGeoBoundsCorrections('Americas', 33, 12);
    expect(result).toBe(geoFallback(33, 12));
  });

  test('Americas in Atlantic zone corrected to Western African', () => {
    expect(applyGeoBoundsCorrections('Americas', 20, -25)).toBe('Western African');
  });
});

// --- normalizeRow ---

describe('normalizeRow()', () => {
  test('full pipeline: swapped coords + raw IOM label', () => {
    const row = {
      id: '1',
      lat: 150,
      lng: 35,
      route: 'Central Mediterranean,Sahara Desert crossing',
      route_display_text: 'Central Mediterranean,Sahara Desert crossing',
      date: '2022-01-01',
      dead_and_missing: '5',
    };
    const result = normalizeRow(row);
    // Coords should be swapped
    expect(result.lat).toBe(35);
    expect(result.lng).toBe(150);
    // Route should be resolved via geo bounds (lng 150 > 70 -> South & East Asia)
    expect(result.route).toBe('South & East Asia');
    expect(result.route_display_text).toBe('South & East Asia');
  });

  test('null coords returns row with no geographic inference', () => {
    const row = {
      id: '2',
      lat: null,
      lng: null,
      route: 'Central Mediterranean',
      route_display_text: 'Central Mediterranean',
      date: '2022-01-01',
      dead_and_missing: '3',
    };
    const result = normalizeRow(row);
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result._wasFallback).toBe(false);
  });

  test('normalizeRow includes _wasFallback and _rawRoute tracking fields', () => {
    const row = {
      id: '3',
      lat: 33,
      lng: 12,
      route: 'SomeUnknownRoute',
      route_display_text: 'SomeUnknownRoute',
      date: '2022-01-01',
      dead_and_missing: '1',
    };
    const result = normalizeRow(row);
    expect(result._wasFallback).toBe(true);
    expect(result._rawRoute).toBe('SomeUnknownRoute');
  });
});

// --- deduplicateRows ---

describe('deduplicateRows()', () => {
  test('removes rows with identical lat|lng|date|dead_and_missing', () => {
    const rows = [
      { id: '1', lat: 33, lng: 12, date: '2022-01-01', dead_and_missing: '5' },
      { id: '2', lat: 33, lng: 12, date: '2022-01-01', dead_and_missing: '5' },
      { id: '3', lat: 34, lng: 13, date: '2022-01-02', dead_and_missing: '3' },
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });

  test('keeps first occurrence when duplicates exist', () => {
    const rows = [
      { id: 'first', lat: 33, lng: 12, date: '2022-01-01', dead_and_missing: '5' },
      { id: 'second', lat: 33, lng: 12, date: '2022-01-01', dead_and_missing: '5' },
    ];
    const result = deduplicateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('first');
  });

  test('handles empty array', () => {
    expect(deduplicateRows([])).toEqual([]);
  });
});
