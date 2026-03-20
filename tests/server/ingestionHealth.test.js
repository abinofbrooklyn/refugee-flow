require('dotenv').config();
const request = require('supertest');
const app = require('../../server/server');
const db = require('../../server/database/connection');

afterAll(async () => {
  await db.destroy();
});

describe('GET /data/ingestion-health', () => {
  jest.setTimeout(15000);

  test('returns 200 with status and sources object', async () => {
    const res = await request(app).get('/data/ingestion-health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checked');
    expect(res.body).toHaveProperty('sources');
    expect(typeof res.body.sources).toBe('object');
  });

  test('includes all 7 data sources', async () => {
    const res = await request(app).get('/data/ingestion-health');
    const sources = Object.keys(res.body.sources);
    expect(sources).toContain('acled');
    expect(sources).toContain('eurostat');
    expect(sources).toContain('iom');
    expect(sources).toContain('unhcr');
    expect(sources).toContain('frontex');
    expect(sources).toContain('cbp');
    expect(sources).toContain('uk-channel');
    expect(sources).toHaveLength(7);
  });

  test('each source has expected shape', async () => {
    const res = await request(app).get('/data/ingestion-health');
    for (const source of Object.values(res.body.sources)) {
      expect(source).toHaveProperty('lastSuccess');
      expect(source).toHaveProperty('lastSuccessAgo');
      expect(source).toHaveProperty('rowsAffected');
      expect(source).toHaveProperty('stale');
      expect(typeof source.stale).toBe('boolean');
    }
  });

  test('status is healthy or degraded', async () => {
    const res = await request(app).get('/data/ingestion-health');
    expect(['healthy', 'degraded']).toContain(res.body.status);
  });
});
