import 'dotenv/config';
import request from 'supertest';
import app from '../../server/server';
import db from '../../server/database/connection';

afterAll(async () => {
  await db.destroy();
});

describe('Endpoint response shapes (DB-02)', () => {
  jest.setTimeout(30000);
  test('GET /data/note/1 returns array', async () => {
    const res = await request(app).get('/data/note/1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /data/reduced_war_data returns year objects with q1-q4', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const first = res.body[0];
    expect(first).toHaveProperty('Year');
    expect(typeof first.Year).toBe('string');
    expect(first).toHaveProperty('value');
    expect(first.value).toHaveProperty('q1');
    expect(first.value).toHaveProperty('q2');
    expect(first.value).toHaveProperty('q3');
    expect(first.value).toHaveProperty('q4');
    expect(Array.isArray(first.value.q1)).toBe(true);
  });

  test('GET /data/reduced_war_data events have correct types', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    const event = res.body[0].value.q1[0];
    expect(typeof event.lat).toBe('number');
    expect(typeof event.lng).toBe('number');
    expect(typeof event.fat).toBe('number');
    expect(typeof event.id).toBe('string');
    expect(Array.isArray(event.cot)).toBe(true);
    expect(event.cot.length).toBe(2);
  });

  test('GET /data/asy_application_all returns 1-element array wrapping object', async () => {
    const res = await request(app).get('/data/asy_application_all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);

    const yearObj = res.body[0];
    expect(typeof yearObj).toBe('object');
    // Should have year keys like '2010'
    const keys = Object.keys(yearObj);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys[0]).toMatch(/^\d{4}$/);

    // Each year should have q1-q4
    const firstYear = yearObj[keys[0]];
    expect(firstYear).toHaveProperty('q1');
    expect(Array.isArray(firstYear.q1)).toBe(true);
  });

  test('GET /data/asy_application_all records have correct fields', async () => {
    const res = await request(app).get('/data/asy_application_all');
    const yearObj = res.body[0];
    const firstYear = yearObj[Object.keys(yearObj)[0]];
    const record = firstYear.q1[0];
    expect(record).toHaveProperty('Origin');
    expect(record).toHaveProperty('Value');
    expect(record).toHaveProperty('id');
    expect(record).toHaveProperty('destination');
  });

  test('GET /data/route_death returns flat array with camelCase fields', async () => {
    const res = await request(app).get('/data/route_death');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const first = res.body[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('cause_of_death_displayText');
    expect(first).toHaveProperty('route_displayText');
    expect(first).toHaveProperty('dead');
    expect(first).toHaveProperty('source_url');
    // dead should be string type (preserved from source)
    expect(typeof first.dead).toBe('string');
  });

  test('GET /data/route_IBC_country_list returns array of {country, route}', async () => {
    const res = await request(app).get('/data/route_IBC_country_list');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const first = res.body[0];
    expect(first).toHaveProperty('country');
    expect(first).toHaveProperty('route');
    expect(Array.isArray(first.route)).toBe(true);
  });

  test('GET /data/route_IBC returns route-keyed object', async () => {
    const res = await request(app).get('/data/route_IBC');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(typeof res.body).toBe('object');

    const keys = Object.keys(res.body);
    expect(keys.length).toBeGreaterThan(0);
    // Each value should be an array
    expect(Array.isArray(res.body[keys[0]])).toBe(true);

    // First record should have Route, BorderLocation, NationalityLong
    const firstRecord = res.body[keys[0]][0];
    expect(firstRecord).toHaveProperty('Route');
    expect(firstRecord).toHaveProperty('BorderLocation');
    expect(firstRecord).toHaveProperty('NationalityLong');
    // Should have at least one year key with quarter values
    const yearKey = Object.keys(firstRecord).find((k: string) => /^\d{4}$/.test(k));
    expect(yearKey).toBeDefined();
    expect(firstRecord[yearKey!]).toHaveProperty('q1');
  });
});
