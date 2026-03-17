require('dotenv').config();
const knex = require('knex');

const { parse } = require('pg-connection-string');
const connStr = (process.env.DATABASE_URL || '');
const isSSL = connStr.includes('sslmode=');
const cleanUrl = connStr.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const parsed = parse(cleanUrl);

const db = knex({
  client: 'pg',
  connection: {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: isSSL ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
});

module.exports = db;
