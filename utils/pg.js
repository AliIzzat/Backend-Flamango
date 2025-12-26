const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'true'
});

pool.on('connect', () => {
  console.log('🟢 Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL error', err);
  process.exit(1);
});

module.exports = pool;
