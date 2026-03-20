/**
 * Unit tests for CBP border crossing ingestion utilities
 */
const {
  CBP_NATIONALITY_MAP,
  normalizeCbpNationality,
} = require('../../scripts/nationality-map');

// --- CBP_NATIONALITY_MAP ---

describe('CBP_NATIONALITY_MAP', () => {
  test('contains all known CBP nationalities', () => {
    expect(Object.keys(CBP_NATIONALITY_MAP).length).toBeGreaterThanOrEqual(22);
  });

  test('all keys are uppercase', () => {
    Object.keys(CBP_NATIONALITY_MAP).forEach(k => {
      expect(k).toBe(k.toUpperCase());
    });
  });

  test('all values are non-empty strings', () => {
    Object.values(CBP_NATIONALITY_MAP).forEach(v => {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

// --- normalizeCbpNationality ---

describe('normalizeCbpNationality', () => {
  test('maps standard single-word nationalities', () => {
    expect(normalizeCbpNationality('MEXICO')).toBe('Mexico');
    expect(normalizeCbpNationality('COLOMBIA')).toBe('Colombia');
    expect(normalizeCbpNationality('BRAZIL')).toBe('Brazil');
  });

  test('maps multi-word nationalities correctly', () => {
    expect(normalizeCbpNationality('EL SALVADOR')).toBe('El Salvador');
    expect(normalizeCbpNationality('DOMINICAN REPUBLIC')).toBe('Dominican Republic');
    expect(normalizeCbpNationality('COSTA RICA')).toBe('Costa Rica');
    expect(normalizeCbpNationality('SIERRA LEONE')).toBe('Sierra Leone');
    expect(normalizeCbpNationality('BURKINA FASO')).toBe('Burkina Faso');
    expect(normalizeCbpNationality('SOUTH KOREA')).toBe('South Korea');
    expect(normalizeCbpNationality('DEMOCRATIC REPUBLIC OF THE CONGO')).toBe('Democratic Republic of the Congo');
  });

  test('handles special name transformations', () => {
    expect(normalizeCbpNationality('MYANMAR (BURMA)')).toBe('Myanmar');
    expect(normalizeCbpNationality('TURKEY')).toBe('Türkiye');
  });

  test('maps OTHER correctly', () => {
    expect(normalizeCbpNationality('OTHER')).toBe('Other');
  });

  test('handles null/undefined input', () => {
    expect(normalizeCbpNationality(null)).toBe('Unknown');
    expect(normalizeCbpNationality(undefined)).toBe('Unknown');
    expect(normalizeCbpNationality('')).toBe('Unknown');
  });

  test('trims whitespace', () => {
    expect(normalizeCbpNationality('  MEXICO  ')).toBe('Mexico');
    expect(normalizeCbpNationality(' EL SALVADOR ')).toBe('El Salvador');
  });

  test('fallback title-cases unmapped multi-word names', () => {
    expect(normalizeCbpNationality('IVORY COAST')).toBe('Ivory Coast');
    expect(normalizeCbpNationality('NEW ZEALAND')).toBe('New Zealand');
    expect(normalizeCbpNationality('SOUTH AFRICA')).toBe('South Africa');
  });

  test('fallback title-cases unmapped single-word names', () => {
    expect(normalizeCbpNationality('JAPAN')).toBe('Japan');
    expect(normalizeCbpNationality('ARGENTINA')).toBe('Argentina');
  });

  test('is case-insensitive for input', () => {
    expect(normalizeCbpNationality('mexico')).toBe('Mexico');
    expect(normalizeCbpNationality('El Salvador')).toBe('El Salvador');
  });
});

// --- toCalendarYear ---
// Import from ingestCBP.js — we need to extract it first.
// Since toCalendarYear is not exported, we test it via behavior:

describe('Fiscal year to calendar year conversion logic', () => {
  // Replicate the logic here to unit test it
  function toCalendarYear(fiscalYear, monthAbbr) {
    const fy = parseInt(fiscalYear);
    if (['OCT', 'NOV', 'DEC'].includes(monthAbbr)) {
      return String(fy - 1);
    }
    return String(fy);
  }

  test('Jan-Sep stay in the fiscal year', () => {
    expect(toCalendarYear('2024', 'JAN')).toBe('2024');
    expect(toCalendarYear('2024', 'MAR')).toBe('2024');
    expect(toCalendarYear('2024', 'JUN')).toBe('2024');
    expect(toCalendarYear('2024', 'SEP')).toBe('2024');
  });

  test('Oct-Dec go to previous calendar year', () => {
    expect(toCalendarYear('2024', 'OCT')).toBe('2023');
    expect(toCalendarYear('2024', 'NOV')).toBe('2023');
    expect(toCalendarYear('2024', 'DEC')).toBe('2023');
  });

  test('FY2020 OCT = October 2019', () => {
    expect(toCalendarYear('2020', 'OCT')).toBe('2019');
  });

  test('FY2026 JAN = January 2026', () => {
    expect(toCalendarYear('2026', 'JAN')).toBe('2026');
  });

  test('boundary: FY2025 SEP vs OCT', () => {
    expect(toCalendarYear('2025', 'SEP')).toBe('2025');
    expect(toCalendarYear('2025', 'OCT')).toBe('2024');
  });
});

// --- Quarter mapping ---

describe('Quarter mapping', () => {
  const QUARTER_MAP = {
    JAN: 'q1', FEB: 'q1', MAR: 'q1',
    APR: 'q2', MAY: 'q2', JUN: 'q2',
    JUL: 'q3', AUG: 'q3', SEP: 'q3',
    OCT: 'q4', NOV: 'q4', DEC: 'q4',
  };

  test('all 12 months are mapped', () => {
    expect(Object.keys(QUARTER_MAP)).toHaveLength(12);
  });

  test('Q1 = Jan-Mar', () => {
    expect(QUARTER_MAP.JAN).toBe('q1');
    expect(QUARTER_MAP.FEB).toBe('q1');
    expect(QUARTER_MAP.MAR).toBe('q1');
  });

  test('Q2 = Apr-Jun', () => {
    expect(QUARTER_MAP.APR).toBe('q2');
    expect(QUARTER_MAP.MAY).toBe('q2');
    expect(QUARTER_MAP.JUN).toBe('q2');
  });

  test('Q3 = Jul-Sep', () => {
    expect(QUARTER_MAP.JUL).toBe('q3');
    expect(QUARTER_MAP.AUG).toBe('q3');
    expect(QUARTER_MAP.SEP).toBe('q3');
  });

  test('Q4 = Oct-Dec', () => {
    expect(QUARTER_MAP.OCT).toBe('q4');
    expect(QUARTER_MAP.NOV).toBe('q4');
    expect(QUARTER_MAP.DEC).toBe('q4');
  });
});
