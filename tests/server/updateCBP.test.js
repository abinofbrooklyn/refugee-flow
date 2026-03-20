/**
 * Unit tests for CBP auto-update URL construction and date logic
 */

// Extract and test the pure functions by reimplementing them here
// (updateCBP.js is a script, not a module — we test the logic, not the I/O)

const MONTH_ABBRS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getExpectedFileParams(now) {
  const dataDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const dataMonth = MONTH_ABBRS[dataDate.getMonth()];
  const currentFY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const startFY = currentFY - 3;
  return { dataMonth, startFY, endFY: currentFY, now };
}

function fy(y) { return String(y).slice(2); }
function pad(n) { return String(n).padStart(2, '0'); }

function buildCandidateUrls({ dataMonth, startFY, endFY, now }) {
  const urls = [];
  const filename = `nationwide-encounters-fy${fy(startFY)}-fy${fy(endFY)}-${dataMonth}-aor.csv`;

  for (let offset = 0; offset <= 2; offset++) {
    const dirDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const dirYear = dirDate.getFullYear();
    const dirMonthNum = pad(dirDate.getMonth() + 1);
    const dirMonthName = MONTH_NAMES[dirDate.getMonth()];

    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthNum}/${filename}`);
    urls.push(`https://www.cbp.gov/sites/default/files/${dirYear}-${dirMonthName}/${filename}`);
    urls.push(`https://www.cbp.gov/sites/default/files/assets/documents/${dirYear}-${dirMonthName}/${filename}`);
  }
  return urls;
}

describe('getExpectedFileParams', () => {
  test('March 2026 expects January data (2 month lag)', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15)); // March 15
    expect(params.dataMonth).toBe('jan');
  });

  test('January 2026 expects November data', () => {
    const params = getExpectedFileParams(new Date(2026, 0, 15)); // Jan 15
    expect(params.dataMonth).toBe('nov');
  });

  test('fiscal year range spans 4 years', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15)); // March 2026
    expect(params.startFY).toBe(2023);
    expect(params.endFY).toBe(2026);
  });

  test('after October, FY advances', () => {
    const params = getExpectedFileParams(new Date(2026, 9, 15)); // October 2026
    expect(params.endFY).toBe(2027); // Oct is in FY2027
    expect(params.startFY).toBe(2024);
  });

  test('September stays in current FY', () => {
    const params = getExpectedFileParams(new Date(2026, 8, 15)); // September 2026
    expect(params.endFY).toBe(2026);
    expect(params.startFY).toBe(2023);
  });

  test('data month wraps correctly from Feb to Dec (previous year)', () => {
    const params = getExpectedFileParams(new Date(2026, 1, 15)); // Feb 2026
    expect(params.dataMonth).toBe('dec'); // Dec of previous data cycle
  });
});

describe('buildCandidateUrls', () => {
  test('generates 9 candidate URLs (3 offsets x 3 patterns)', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    expect(urls).toHaveLength(9);
  });

  test('all URLs contain the expected filename', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    urls.forEach(url => {
      expect(url).toContain('nationwide-encounters-fy23-fy26-jan-aor.csv');
    });
  });

  test('includes numeric month format (YYYY-MM)', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    expect(urls.some(u => u.includes('/2026-03/'))).toBe(true);
    expect(urls.some(u => u.includes('/2026-02/'))).toBe(true);
    expect(urls.some(u => u.includes('/2026-01/'))).toBe(true);
  });

  test('includes named month format (YYYY-Mon)', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    expect(urls.some(u => u.includes('/2026-Mar/'))).toBe(true);
    expect(urls.some(u => u.includes('/2026-Feb/'))).toBe(true);
  });

  test('includes legacy assets/documents path', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    expect(urls.some(u => u.includes('/assets/documents/'))).toBe(true);
  });

  test('all URLs are valid HTTPS', () => {
    const params = getExpectedFileParams(new Date(2026, 2, 15));
    const urls = buildCandidateUrls(params);
    urls.forEach(url => {
      expect(url).toMatch(/^https:\/\/www\.cbp\.gov\//);
      expect(url).toMatch(/\.csv$/);
    });
  });

  test('handles year boundary correctly (January)', () => {
    const params = getExpectedFileParams(new Date(2026, 0, 15)); // Jan 2026
    const urls = buildCandidateUrls(params);
    // Should look back into December 2025 and November 2025
    expect(urls.some(u => u.includes('/2025-12/') || u.includes('/2025-Dec/'))).toBe(true);
    expect(urls.some(u => u.includes('/2025-11/') || u.includes('/2025-Nov/'))).toBe(true);
  });
});

describe('CBP ingestion script (no stale removal)', () => {
  test('script exits with usage message when no args', () => {
    const { execSync } = require('child_process');
    try {
      execSync('node scripts/ingestCBP.js 2>&1', { encoding: 'utf-8' });
      fail('Should have exited with code 1');
    } catch (e) {
      expect(e.stdout || e.stderr).toContain('Usage:');
      expect(e.status).toBe(1);
    }
  });
});
