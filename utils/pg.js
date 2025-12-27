// utils/pg.js
const { Pool } = require("pg");

// 1) Prefer a full URL if provided
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL;

// 2) Or build from separate fields
const hasParts =
  process.env.PGHOST &&
  process.env.PGPORT &&
  process.env.PGDATABASE &&
  process.env.PGUSER &&
  process.env.PGPASSWORD;

// If neither exists, fail fast with a clear message
if (!DATABASE_URL && !hasParts) {
  console.error(
    "❌ Postgres config missing. Set DATABASE_URL (or PG_URL) OR PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD."
  );
  process.exit(1);
}

// SSL handling:
// - For Railway public proxy (yamabiko.proxy.rlwy.net) you usually need SSL.
// - If PGSSL=true, we enable ssl with rejectUnauthorized false.
const useSSL = String(process.env.PGSSL).toLowerCase() === "true";

const pool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    });

// Optional: log where you are connecting (without secrets)
console.log("🟣 PG CONFIG:", {
  mode: DATABASE_URL ? "URL" : "FIELDS",
  host: process.env.PGHOST || "(from URL)",
  database: process.env.PGDATABASE || "(from URL)",
  ssl: useSSL,
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
