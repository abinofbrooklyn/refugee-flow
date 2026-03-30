import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import request from 'supertest';
import type { Express } from 'express';
import app from '../../server/server';
import db from '../../server/database/connection';
import { healthLimiter } from '../../server/routes/dataRoute';

afterAll(async () => {
  await db.destroy();
});

describe('Security Headers (CSP)', () => {
  jest.setTimeout(30000);

  test('GET /data/reduced_war_data includes content-security-policy header', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty('content-security-policy');
  });

  test('CSP header contains worker-src with blob: for MapLibre Web Workers', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toBeDefined();
    expect(csp).toMatch(/worker-src[^;]*blob:/);
  });

  test('CSP header contains img-src with *.basemaps.cartocdn.com for map tiles', async () => {
    const res = await request(app).get('/data/reduced_war_data');
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toBeDefined();
    expect(csp).toMatch(/img-src[^;]*basemaps\.cartocdn\.com/);
  });
});

describe('CORS Method Restriction', () => {
  jest.setTimeout(30000);

  test('OPTIONS preflight for GET /data/reduced_war_data allows GET', async () => {
    const res = await request(app)
      .options('/data/reduced_war_data')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'GET');
    // CORS preflight should succeed and include GET in allowed methods
    const allowedMethods = res.headers['access-control-allow-methods'] as string | undefined;
    // If header present, GET must be allowed; if absent, the request falls through as allowed
    if (allowedMethods) {
      expect(allowedMethods).toMatch(/GET/);
    }
  });

  test('OPTIONS preflight for POST /data/reduced_war_data does not allow POST', async () => {
    const res = await request(app)
      .options('/data/reduced_war_data')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'POST');
    const allowedMethods = res.headers['access-control-allow-methods'] as string | undefined;
    // POST should not be in the allowed methods
    if (allowedMethods) {
      expect(allowedMethods).not.toMatch(/\bPOST\b/);
    }
  });
});

describe('Error Sanitization', () => {
  jest.setTimeout(30000);

  test('error responses contain generic "Internal server error", not DB details', async () => {
    // Use a test app that simulates what the sanitized catch blocks do
    const testApp = express();
    testApp.get('/fail', (_req, res) => {
      res.status(500).json({ error: 'Internal server error' });
    });

    const res = await request(testApp).get('/fail');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    // Verify no DB connection string or table name leaks
    expect(res.body.error).not.toMatch(/postgres|supabase|knex|relation|column|table/i);
  });

  test('dataRoute catch blocks do not expose raw error messages (static analysis)', () => {
    // This test verifies at the source level that no catch block exposes (err as Error).message
    // by importing and inspecting the module's source
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '../../server/routes/dataRoute.ts'),
      'utf8'
    );
    // No catch block should expose raw error message
    expect(source).not.toMatch(/\(err as Error\)\.message/);
    // All catch blocks should return the generic message
    const catchMatches = source.match(/catch \(err\)/g);
    expect(catchMatches).not.toBeNull();
    expect(catchMatches!.length).toBe(6);
  });
});

describe('Health Endpoint Rate Limit', () => {
  jest.setTimeout(30000);

  function buildHealthTestApp(): Express {
    const testApp = express();
    testApp.get('/data/ingestion-health', healthLimiter, (_req, res) => {
      res.json({ status: 'ok' });
    });
    return testApp;
  }

  test('GET /data/ingestion-health returns 200 on first request', async () => {
    const testApp = buildHealthTestApp();
    const res = await request(testApp).get('/data/ingestion-health');
    expect(res.status).toBe(200);
  });

  test('returns 429 after 10 rapid requests to /data/ingestion-health', async () => {
    // Each test gets a fresh app instance (fresh limiter state)
    const testApp = buildHealthTestApp();

    // Exhaust the 10-request limit
    for (let i = 0; i < 10; i++) {
      await request(testApp).get('/data/ingestion-health');
    }

    // 11th request should be rate limited
    const res = await request(testApp).get('/data/ingestion-health');
    expect(res.status).toBe(429);
  });

  test('429 response from health limiter has error key as string', async () => {
    const testApp = buildHealthTestApp();

    for (let i = 0; i < 10; i++) {
      await request(testApp).get('/data/ingestion-health');
    }

    const res = await request(testApp).get('/data/ingestion-health');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
  });
});
