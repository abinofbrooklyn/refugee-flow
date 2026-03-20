/**
 * Unit tests for UK Channel small boat crossing ingestion
 */

// Reimplement parseQuarter for unit testing (script isn't a module)
function parseQuarter(qStr) {
  const match = qStr.match(/^(\d{4})\s+Q(\d)$/);
  if (!match) return null;
  return { year: match[1], quarter: 'q' + match[2] };
}

const SKIP_NATIONALITIES = new Set([
  'Not stated', 'Other', 'Stateless', 'British overseas citizens',
]);

describe('parseQuarter', () => {
  test('parses standard format', () => {
    expect(parseQuarter('2023 Q3')).toEqual({ year: '2023', quarter: 'q3' });
    expect(parseQuarter('2018 Q1')).toEqual({ year: '2018', quarter: 'q1' });
    expect(parseQuarter('2025 Q4')).toEqual({ year: '2025', quarter: 'q4' });
  });

  test('returns null for invalid formats', () => {
    expect(parseQuarter('invalid')).toBeNull();
    expect(parseQuarter('2023Q3')).toBeNull(); // missing space
    expect(parseQuarter('Q3 2023')).toBeNull(); // reversed
    expect(parseQuarter('')).toBeNull();
  });

  test('returns null for partial matches', () => {
    expect(parseQuarter('2023 Q')).toBeNull();
    expect(parseQuarter('Q3')).toBeNull();
    expect(parseQuarter('2023')).toBeNull();
  });

  test('handles all four quarters', () => {
    expect(parseQuarter('2020 Q1').quarter).toBe('q1');
    expect(parseQuarter('2020 Q2').quarter).toBe('q2');
    expect(parseQuarter('2020 Q3').quarter).toBe('q3');
    expect(parseQuarter('2020 Q4').quarter).toBe('q4');
  });
});

describe('SKIP_NATIONALITIES', () => {
  test('contains expected entries', () => {
    expect(SKIP_NATIONALITIES.has('Not stated')).toBe(true);
    expect(SKIP_NATIONALITIES.has('Other')).toBe(true);
    expect(SKIP_NATIONALITIES.has('Stateless')).toBe(true);
    expect(SKIP_NATIONALITIES.has('British overseas citizens')).toBe(true);
  });

  test('does not skip real countries', () => {
    expect(SKIP_NATIONALITIES.has('Afghanistan')).toBe(false);
    expect(SKIP_NATIONALITIES.has('Albania')).toBe(false);
    expect(SKIP_NATIONALITIES.has('Iran')).toBe(false);
  });
});

describe('ingestion script', () => {
  test('exits with usage message when no args', () => {
    const { execSync } = require('child_process');
    try {
      execSync('node scripts/ingestUKChannel.js 2>&1', { encoding: 'utf-8' });
      fail('Should have exited with code 1');
    } catch (e) {
      expect(e.stdout || e.stderr).toContain('Usage:');
      expect(e.status).toBe(1);
    }
  });
});
