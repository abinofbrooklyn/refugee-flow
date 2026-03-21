import dotenv from 'dotenv';
dotenv.config();

import knex, { Knex } from 'knex';
import { parse } from 'pg-connection-string';

const connStr = process.env.DATABASE_URL || '';
const isSSL = connStr.includes('sslmode=');
const cleanUrl = connStr.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const parsed = parse(cleanUrl);

const db: Knex = knex({
  client: 'pg',
  connection: {
    host: parsed.host ?? undefined,
    port: parsed.port ? parseInt(parsed.port, 10) : undefined,
    user: parsed.user ?? undefined,
    password: parsed.password ?? undefined,
    database: parsed.database ?? undefined,
    ssl: isSSL ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
});

export = db;
