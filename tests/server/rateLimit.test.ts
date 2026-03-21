import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import type { Express } from 'express';

function buildTestApp(): Express {
  const app = express();

  const testLimiter = rateLimit({
    windowMs: 60000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Try again in 15 minutes.' },
  });

  app.use('/data', testLimiter);
  app.get('/data/reduced_war_data', (_req, res) => res.json({ ok: true }));

  return app;
}

describe('Rate limiting on /data routes', () => {
  let app: Express;

  beforeEach(() => {
    app = buildTestApp();
  });

  test('GET /data/reduced_war_data returns 200 on first request', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    expect(res.status).toBe(200);
  });

  test('returns 429 after exceeding the rate limit', async () => {
    // Exhaust the limit (max: 3)
    await request(app).get('/data/reduced_war_data');
    await request(app).get('/data/reduced_war_data');
    await request(app).get('/data/reduced_war_data');

    // 4th request should be rate limited
    const res = await request(app).get('/data/reduced_war_data');
    expect(res.status).toBe(429);
  });

  test('429 response body contains an error key with a message string', async () => {
    await request(app).get('/data/reduced_war_data');
    await request(app).get('/data/reduced_war_data');
    await request(app).get('/data/reduced_war_data');

    const res = await request(app).get('/data/reduced_war_data');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });
});
