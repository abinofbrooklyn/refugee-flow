const knex = require('knex');
require('dotenv').config();

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

afterAll(async () => {
  await db.destroy();
});

describe('Seed data integrity', () => {
  test('war_events lat values have at most 2 decimal places', async () => {
    const rows = await db('war_events').select('lat').limit(1000);
    rows.forEach(row => {
      const decimals = String(row.lat).split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });

  test('war_events lng values have at most 2 decimal places', async () => {
    const rows = await db('war_events').select('lng').limit(1000);
    rows.forEach(row => {
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
    rows.forEach(row => {
      expect(typeof row.lat).toBe('number');
      expect(typeof row.lng).toBe('number');
    });
  });

  test('route_deaths lat values have at most 2 decimal places', async () => {
    const rows = await db('route_deaths').select('lat').whereNotNull('lat').limit(500);
    rows.forEach(row => {
      const decimals = String(row.lat).split('.')[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });
});
