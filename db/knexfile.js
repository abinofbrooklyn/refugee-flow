require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const connStr = (process.env.DATABASE_URL || '');
const isSSL = connStr.includes('sslmode=');
const cleanUrl = connStr.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const parsed = require('pg-connection-string').parse(cleanUrl);

function makeConnection() {
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: isSSL ? { rejectUnauthorized: false } : false,
  };
}

module.exports = {
  development: {
    client: 'pg',
    connection: makeConnection,
    migrations: { directory: './migrations' },
  },
  production: {
    client: 'pg',
    connection: makeConnection,
    migrations: { directory: './migrations' },
    pool: { min: 2, max: 10 },
  },
};
