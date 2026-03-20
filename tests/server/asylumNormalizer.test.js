/**
 * Unit tests for asylum data normalization modules (04-08)
 *
 * Tests countryNormalizer.js and quarterlyEstimator.js — pure functions,
 * no database dependency.
 */
const {
  normalizeCountryName,
  CANONICAL_NAMES,
  EU_DESTINATIONS,
} = require('../../server/ingestion/countryNormalizer');

const {
  computeSeasonalRatios,
  distributeByQuarter,
} = require('../../server/ingestion/quarterlyEstimator');

// --- countryNormalizer ---

describe('countryNormalizer', () => {
  describe('normalizeCountryName', () => {
    test.each([
      ['USA (EOIR)', 'United States'],
      ['USA (INS/DHS)', 'United States'],
      ['United States of America', 'United States'],
      ['United Kingdom of Great Britain and Northern Ireland', 'United Kingdom'],
      ['Serbia and Kosovo: S/RES/1244 (1999)', 'Serbia'],
      ['The former Yugoslav Rep. of Macedonia', 'North Macedonia'],
      ['Rep. of Korea', 'South Korea'],
      ['Iran (Islamic Rep. of)', 'Iran'],
      ["Cote d'Ivoire", "Cote d'Ivoire"],
      ['Dem. Rep. of the Congo', 'DR Congo'],
      ['Rep. of the Congo', 'Republic of the Congo'],
      ['Central African Rep.', 'Central African Republic'],
      ['Swaziland', 'Eswatini'],
      ['Syrian Arab Rep.', 'Syria'],
      ['Czech Rep.', 'Czechia'],
    ])('maps "%s" to "%s"', (input, expected) => {
      expect(normalizeCountryName(input)).toBe(expected);
    });

    test('passes through unknown/already-canonical names', () => {
      expect(normalizeCountryName('Germany')).toBe('Germany');
      expect(normalizeCountryName('Afghanistan')).toBe('Afghanistan');
    });
  });

  describe('CANONICAL_NAMES', () => {
    test('contains at least 15 mappings', () => {
      expect(Object.keys(CANONICAL_NAMES).length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('EU_DESTINATIONS', () => {
    test('contains 31 countries', () => {
      expect(EU_DESTINATIONS.size).toBe(31);
    });

    test('uses canonical names (Czechia not Czech Rep.)', () => {
      expect(EU_DESTINATIONS.has('Czechia')).toBe(true);
      expect(EU_DESTINATIONS.has('Czech Rep.')).toBe(false);
    });

    test('includes key EU/EEA members', () => {
      expect(EU_DESTINATIONS.has('Germany')).toBe(true);
      expect(EU_DESTINATIONS.has('France')).toBe(true);
      expect(EU_DESTINATIONS.has('Norway')).toBe(true);
      expect(EU_DESTINATIONS.has('Switzerland')).toBe(true);
    });
  });
});

// --- quarterlyEstimator ---

describe('quarterlyEstimator', () => {
  describe('computeSeasonalRatios', () => {
    test('computes ratios summing to 1.0 per origin', () => {
      const rows = [
        { origin: 'Afghanistan', quarter: 'q1', value: 300 },
        { origin: 'Afghanistan', quarter: 'q2', value: 250 },
        { origin: 'Afghanistan', quarter: 'q3', value: 200 },
        { origin: 'Afghanistan', quarter: 'q4', value: 250 },
        { origin: 'Syria', quarter: 'q1', value: 100 },
        { origin: 'Syria', quarter: 'q2', value: 100 },
        { origin: 'Syria', quarter: 'q3', value: 100 },
        { origin: 'Syria', quarter: 'q4', value: 100 },
      ];
      const ratios = computeSeasonalRatios(rows);

      // Afghanistan: 300/1000=0.3, 250/1000=0.25, 200/1000=0.2, 250/1000=0.25
      expect(ratios['Afghanistan'].q1).toBeCloseTo(0.3);
      expect(ratios['Afghanistan'].q2).toBeCloseTo(0.25);
      expect(ratios['Afghanistan'].q3).toBeCloseTo(0.2);
      expect(ratios['Afghanistan'].q4).toBeCloseTo(0.25);

      // Syria: equal distribution
      expect(ratios['Syria'].q1).toBeCloseTo(0.25);

      // Sum to 1.0
      const afSum = ratios['Afghanistan'].q1 + ratios['Afghanistan'].q2 + ratios['Afghanistan'].q3 + ratios['Afghanistan'].q4;
      expect(afSum).toBeCloseTo(1.0);
    });

    test('returns empty object for empty input', () => {
      expect(computeSeasonalRatios([])).toEqual({});
    });

    test('handles single origin across multiple destinations', () => {
      const rows = [
        { origin: 'Iraq', quarter: 'q1', value: 50 },
        { origin: 'Iraq', quarter: 'q1', value: 30 },
        { origin: 'Iraq', quarter: 'q2', value: 20 },
      ];
      const ratios = computeSeasonalRatios(rows);
      // q1 total = 80, q2 = 20, total = 100
      expect(ratios['Iraq'].q1).toBeCloseTo(0.8);
      expect(ratios['Iraq'].q2).toBeCloseTo(0.2);
      expect(ratios['Iraq'].q3).toBeCloseTo(0);
      expect(ratios['Iraq'].q4).toBeCloseTo(0);
    });
  });

  describe('distributeByQuarter', () => {
    test('splits using provided ratios', () => {
      const result = distributeByQuarter(25000, { q1: 0.30, q2: 0.25, q3: 0.22, q4: 0.23 });
      expect(result.q1).toBe(7500);
      expect(result.q2).toBe(6250);
      expect(result.q3).toBe(5500);
      // q4 = remainder
      expect(result.q4).toBe(5750);
    });

    test('q1+q2+q3+q4 equals annual total exactly', () => {
      const result = distributeByQuarter(25000, { q1: 0.30, q2: 0.25, q3: 0.22, q4: 0.23 });
      expect(result.q1 + result.q2 + result.q3 + result.q4).toBe(25000);
    });

    test('uses equal split when ratios is null', () => {
      const result = distributeByQuarter(100, null);
      expect(result).toEqual({ q1: 25, q2: 25, q3: 25, q4: 25 });
    });

    test('uses equal split when ratios is undefined', () => {
      const result = distributeByQuarter(100, undefined);
      expect(result).toEqual({ q1: 25, q2: 25, q3: 25, q4: 25 });
    });

    test('returns all zeros for zero total', () => {
      const result = distributeByQuarter(0, { q1: 0.3, q2: 0.2, q3: 0.2, q4: 0.3 });
      expect(result).toEqual({ q1: 0, q2: 0, q3: 0, q4: 0 });
    });

    test('remainder goes to q4 for odd numbers', () => {
      // 101 with equal split: round(25.25)=25, round(25.25)=25, round(25.25)=25, remainder=26
      const result = distributeByQuarter(101, { q1: 0.25, q2: 0.25, q3: 0.25, q4: 0.25 });
      expect(result.q1 + result.q2 + result.q3 + result.q4).toBe(101);
      expect(result.q4).toBe(101 - result.q1 - result.q2 - result.q3);
    });
  });
});
