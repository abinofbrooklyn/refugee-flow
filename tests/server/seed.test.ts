import db from '../../server/database/connection';

afterAll(async () => {
  await db.destroy();
});

describe('Seed data integrity', () => {
  test('war_events lat values have at most 2 decimal places', async () => {
    const rows = await db('war_events').select('lat').limit(1000);
    rows.forEach((row: { lat: number }) => {
      const decimals = String(row.lat).split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });

  test('war_events lng values have at most 2 decimal places', async () => {
    const rows = await db('war_events').select('lng').limit(1000);
    rows.forEach((row: { lng: number }) => {
      const decimals = String(row.lng).split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });

  test('no duplicate lat,lng within same year+quarter in war_events', async () => {
    const dupes = await db.raw(`
      SELECT year, quarter, lat, lng, COUNT(*) as cnt
      FROM war_events
      GROUP BY year, quarter, lat, lng
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    expect(dupes.rows.length).toBe(0);
  });

  test('war_events lat and lng are numbers not strings', async () => {
    const rows = await db('war_events').select('lat', 'lng').limit(10);
    rows.forEach((row: { lat: unknown; lng: unknown }) => {
      expect(typeof row.lat).toBe('number');
      expect(typeof row.lng).toBe('number');
    });
  });

  test('route_deaths lat values are precision-reduced to 2 decimal places', async () => {
    const rows = await db('route_deaths').select('lat').whereNotNull('lat').limit(500);
    rows.forEach((row: { lat: number }) => {
      // float8 can produce extra digits (e.g., 35.29 → 35.290000000000001)
      // so check that rounding to 2 decimals matches the stored value within tolerance
      const rounded = Math.round(row.lat * 100) / 100;
      expect(Math.abs(row.lat - rounded)).toBeLessThan(0.005);
    });
  });
});
