// utils/pg.js
const { Pool } = require("pg");

function buildConfigFromParts() {
  const required = ["PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) return null;

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  };
}

const url = process.env.DATABASE_URL || process.env.PG_URL;

let pool;

if (url) {
  pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  });
} else {
  const cfg = buildConfigFromParts();
  if (!cfg) {
    console.error(
      "❌ Postgres config missing. Set DATABASE_URL (or PG_URL) OR PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD."
    );
    process.exit(1);
  }
  pool = new Pool(cfg);
}

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
