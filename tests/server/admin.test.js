const request = require('supertest');

// Mock ingestion modules to prevent real API calls
jest.mock('../../server/ingestion/acledIngestion', () => ({
  runAcledIngestion: jest.fn().mockResolvedValue({ rowsInserted: 0 }),
}));
jest.mock('../../server/ingestion/unhcrIngestion', () => ({
  runUnhcrIngestion: jest.fn().mockResolvedValue({ rowsInserted: 0 }),
}));
jest.mock('../../server/ingestion/iomIngestion', () => ({
  runIomIngestion: jest.fn().mockResolvedValue({ rowsInserted: 0 }),
}));

// Mock DB so csvCommit tests don't need a live DB
jest.mock('../../server/database/connection', () => {
  const mockInsert = jest.fn().mockReturnThis();
  const mockOnConflict = jest.fn().mockReturnThis();
  const mockIgnore = jest.fn().mockResolvedValue([]);
  const mockDb = jest.fn(() => ({
    insert: mockInsert,
    onConflict: mockOnConflict,
    ignore: mockIgnore,
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  }));
  mockDb.mockReturnValue({
    insert: mockInsert,
    onConflict: mockOnConflict,
    ignore: mockIgnore,
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  });
  return mockDb;
});

const app = require('../../server/server');

describe('Admin routes', () => {
  beforeAll(() => {
    process.env.ADMIN_SECRET = 'test-secret-123';
  });

  describe('POST /admin/csv/preview', () => {
    it('returns 401 without auth header', async () => {
      const res = await request(app)
        .post('/admin/csv/preview')
        .attach('file', Buffer.from('name,value\ntest,123\n'), 'test.csv');
      expect(res.status).toBe(401);
    });

    it('returns 401 with wrong secret', async () => {
      const res = await request(app)
        .post('/admin/csv/preview')
        .set('Authorization', 'Bearer wrong-secret')
        .attach('file', Buffer.from('name,value\ntest,123\n'), 'test.csv');
      expect(res.status).toBe(401);
    });

    it('returns 200 with rows and count for valid CSV', async () => {
      const csvBuffer = Buffer.from('name,value\ntest,123\nfoo,456\n');
      const res = await request(app)
        .post('/admin/csv/preview')
        .set('Authorization', 'Bearer test-secret-123')
        .attach('file', csvBuffer, 'test.csv');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('rows');
      expect(res.body).toHaveProperty('count', 2);
      expect(res.body.rows).toHaveLength(2);
      expect(res.body.rows[0]).toEqual({ name: 'test', value: '123' });
    });

    it('returns 400 for invalid CSV content', async () => {
      // csv-parse is fairly lenient; send no file to trigger the error
      const res = await request(app)
        .post('/admin/csv/preview')
        .set('Authorization', 'Bearer test-secret-123');
      // No file attached — multer will leave req.file as undefined, causing a read error
      expect(res.status).toBe(400);
    });
  });

  describe('POST /admin/trigger/:source', () => {
    it('returns 400 for unknown source', async () => {
      const res = await request(app)
        .post('/admin/trigger/unknown')
        .set('Authorization', 'Bearer test-secret-123');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 401 without auth for known source', async () => {
      const res = await request(app)
        .post('/admin/trigger/acled');
      expect(res.status).toBe(401);
    });

    it('returns 200 for valid source trigger', async () => {
      const res = await request(app)
        .post('/admin/trigger/acled')
        .set('Authorization', 'Bearer test-secret-123');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'complete', source: 'acled' });
    });
  });
});
