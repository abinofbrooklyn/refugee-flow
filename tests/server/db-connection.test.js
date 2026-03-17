require('dotenv').config();

describe('Database connection (DB-01)', () => {
  test('knex connects to Postgres without MONGODB_URI', async () => {
    // Ensure no MongoDB env var is set
    delete process.env.MONGODB_URI;
    delete process.env.MONGO_URI;

    const db = require('../../server/database/connection');
    const result = await db.raw('SELECT 1 AS ok');
    expect(result.rows[0].ok).toBe(1);
    await db.destroy();
  });

  test('mongoose is not in package.json dependencies', () => {
    const pkg = require('../../package.json');
    expect(pkg.dependencies.mongoose).toBeUndefined();
  });

  test('no mongoose require in server directory', () => {
    const { execSync } = require('child_process');
    const result = execSync('grep -r "require.*mongoose" server/ --include="*.js" -l 2>/dev/null || echo ""').toString().trim();
    expect(result).toBe('');
  });
});
