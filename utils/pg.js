// utils/pg.js
const { Pool } = require("pg");

const isProd = process.env.NODE_ENV === "production";

const connectionString = process.env.DATABASE_URL || process.env.PG_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
    });

module.exports = pool;





// const { Pool } = require('pg');

// const pool = new Pool({
//   host: process.env.PGHOST,
//   port: Number(process.env.PGPORT),
//   database: process.env.PGDATABASE,
//   user: process.env.PGUSER,
//   password: process.env.PGPASSWORD,
//   ssl: process.env.PGSSL === 'true'
// });

// pool.on('connect', () => {
//   console.log('🟢 Connected to PostgreSQL');
// });

// pool.on('error', (err) => {
//   console.error('❌ PostgreSQL error', err);
//   process.exit(1);
// });

// module.exports = pool;
