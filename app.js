// // app.js
// app.js (Postgres-only, production-safe)

require("dotenv").config();

const path = require("path");
const express = require("express");
const compression = require("compression");
const session = require("express-session");
const cors = require("cors");
const morgan = require("morgan");

const catalogPgRoutes = require("./routes/api/catalog-pg");
const pool = require("./utils/pg"); // MUST export a ready Pool instance

// -------------------- Config -------------------- //
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const isProd = process.env.NODE_ENV === "production";

// Accept either single URL or separate PG fields (recommended)
const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL;

console.log("ENV CHECK:", {
  PORT,
  NODE_ENV: process.env.NODE_ENV || "not set",
  DB: "POSTGRES",
  HAS_DATABASE_URL: !!DATABASE_URL,
  HAS_PG_FIELDS: !!(
    process.env.PGHOST &&
    process.env.PGPORT &&
    process.env.PGDATABASE &&
    process.env.PGUSER
  ),
});

// Fail fast only in production if no PG creds exist at all
if (isProd && !DATABASE_URL && !process.env.PGHOST) {
  console.error("❌ Postgres config missing. Set DATABASE_URL (or PG_URL) OR PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.");
  process.exit(1);
}

// -------------------- Postgres assertion -------------------- //
async function assertPostgres() {
  const r = await pool.query("SELECT 1 AS ok");
  if (!r?.rows?.[0]?.ok) throw new Error("Postgres ping failed");
  console.log("🟢 Connected to PostgreSQL");
}

// -------------------- App Init -------------------- //
const app = express();

if (isProd) app.set("trust proxy", 1);

app.use(morgan("dev"));
app.use(cors());
app.use(compression());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  express.static(path.join(__dirname, "public"), { maxAge: isProd ? "1d" : 0 })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

console.log("🔥 Postgres-only app.js loaded");

// -------------------- Sessions -------------------- //
// IMPORTANT: Do not crash if connect-pg-simple isn't installed.
let sessionStore = undefined;

try {
  const PgSession = require("connect-pg-simple")(session);
  sessionStore = new PgSession({
    pool,
    tableName: "session",
    createTableIfMissing: true,
  });
  console.log("🟢 Session store: Postgres (connect-pg-simple)");
} catch (e) {
  console.log("🟡 Session store: MemoryStore (connect-pg-simple not installed)");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbackSecretKey",
    resave: false,
    saveUninitialized: false,
    store: sessionStore, // undefined => default MemoryStore
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000,
    },
  })
);

// Template locals + cart bootstrap
app.use((req, res, next) => {
  req.session.cart ||= [];
  const cart = req.session.cart;

  res.locals.cartCount = cart.reduce((n, i) => n + (i.quantity || 0), 0);
  res.locals.cartTotal = cart.reduce(
    (s, i) => s + (i.price || 0) * (i.quantity || 0),
    0
  );

  res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
  next();
});

// -------------------- Health / Diagnostics -------------------- //
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/ping", (_req, res) => res.type("text/plain").send("pong"));

app.get("/api/health/db", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT 1 AS ok, current_database() AS db");
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ PG health check failed:", err.message);
    res.status(500).json({ error: "Postgres not reachable", detail: err.message });
  }
});

// Optional request trace
app.use((req, _res, next) => {
  console.log("➡", req.method, req.url);
  next();
});

// -------------------- API Routes -------------------- //
// If catalogPgRoutes defines /meals and /restaurants too, keep it.
// It is mounted under /api:
app.use("/api", catalogPgRoutes);

// -------------------- JSON APIs (Postgres) -------------------- //
// These endpoints are what your mobile app is calling.
const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || "";

// GET /api/meals
app.get("/api/meals", async (_req, res) => {
  try {
    const q = `
      SELECT
        id,
        name_en  AS name,
        name_ar,
        price,
        image_url AS image,
        offer,
        COALESCE(details_en, details_ar, '') AS details_any,
        restaurant_id
      FROM meals
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;
    const r = await pool.query(q);

    const meals = r.rows.map((row) => ({
      id: String(row.id),
      name: row.name || "",
      name_ar: row.name_ar || "",
      price: Number(row.price ?? 0),
      image: row.image
        ? String(row.image).startsWith("http")
          ? row.image
          : `${BASE_PUBLIC_URL}${row.image}`
        : null,
      restaurantId: row.restaurant_id ? String(row.restaurant_id) : null,
      details: row.details_any || "",
      offer: !!row.offer,
    }));

    res.json(meals);
  } catch (err) {
    console.error("Error loading meals:", err);
    res.status(500).json({ message: "Failed to load meals", error: err.message });
  }
});

// GET /api/meals/offers
app.get("/api/meals/offers", async (_req, res) => {
  try {
    const q = `
      SELECT
        id,
        name_en AS name,
        name_ar,
        price,
        image_url AS image,
        offer,
        COALESCE(details_en, details_ar, '') AS details_any,
        restaurant_id
      FROM meals
      WHERE offer = TRUE
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;
    const r = await pool.query(q);

    const meals = r.rows.map((row) => ({
      id: String(row.id),
      name: row.name || "",
      name_ar: row.name_ar || "",
      price: Number(row.price ?? 0),
      image: row.image
        ? String(row.image).startsWith("http")
          ? row.image
          : `${BASE_PUBLIC_URL}${row.image}`
        : null,
      restaurantId: row.restaurant_id ? String(row.restaurant_id) : null,
      details: row.details_any || "",
      offer: true,
    }));

    res.json(meals);
  } catch (err) {
    console.error("Error loading offer meals:", err);
    res.status(500).json({ message: "Failed to load offer meals", error: err.message });
  }
});

// GET /api/restaurants
app.get("/api/restaurants", async (_req, res) => {
  try {
    const q = `
      SELECT
        id,
        name_en AS restaurant_en,
        name_ar AS restaurant_ar,
        logo_url AS logo,
        address
      FROM restaurants
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;
    const r = await pool.query(q);

    const restaurants = r.rows.map((row) => ({
      id: String(row.id),
      restaurant_en: row.restaurant_en || "",
      restaurant_ar: row.restaurant_ar || "",
      logo: row.logo
        ? String(row.logo).startsWith("http")
          ? row.logo
          : `${BASE_PUBLIC_URL}${row.logo}`
        : null,
      address: row.address || "",
    }));

    res.json(restaurants);
  } catch (err) {
    console.error("Error loading restaurants:", err);
    res.status(500).json({ message: "Failed to load restaurants", error: err.message });
  }
});

// GET /api/restaurants/:id
app.get("/api/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const q = `
      SELECT
        id,
        name_en AS restaurant_en,
        name_ar AS restaurant_ar,
        logo_url AS logo,
        address
      FROM restaurants
      WHERE id = $1
      LIMIT 1
    `;
    const r = await pool.query(q, [id]);

    if (r.rowCount === 0) {
      return res.status(404).json({ message: "Restaurant not found", idRequested: id });
    }

    const row = r.rows[0];
    res.json({
      id: String(row.id),
      restaurant_en: row.restaurant_en || "",
      restaurant_ar: row.restaurant_ar || "",
      logo: row.logo
        ? String(row.logo).startsWith("http")
          ? row.logo
          : `${BASE_PUBLIC_URL}${row.logo}`
        : null,
      address: row.address || "",
    });
  } catch (err) {
    console.error("Error loading restaurant details:", err);
    res.status(500).json({ message: "Failed to load restaurant", error: err.message });
  }
});

// GET /api/restaurants/:id/meals
app.get("/api/restaurants/:id/meals", async (req, res) => {
  try {
    const { id } = req.params;

    const q = `
      SELECT
        id,
        name_en AS name,
        name_ar,
        price,
        image_url AS image,
        offer,
        COALESCE(details_en, details_ar, '') AS details_any,
        period,
        address
      FROM meals
      WHERE restaurant_id = $1
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;
    const r = await pool.query(q, [id]);

    const mealsForApp = r.rows.map((row) => ({
      id: String(row.id),
      name: row.name || "",
      name_ar: row.name_ar || "",
      price: Number(row.price ?? 0),
      details: row.details_any || "",
      offer: !!row.offer,
      image: row.image
        ? String(row.image).startsWith("http")
          ? row.image
          : `${BASE_PUBLIC_URL}${row.image}`
        : null,
      period: Number(row.period ?? 0),
      address: row.address || "",
    }));

    res.json(mealsForApp);
  } catch (err) {
    console.error("Error getting restaurant meals:", err);
    res.status(500).json({ message: "Failed to load meals for restaurant", error: err.message });
  }
});

// -------------------- API 404 -------------------- //
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, error: "API route not found", path: req.originalUrl });
});

// -------------------- Start & Graceful Shutdown -------------------- //
let server;

(async () => {
  try {
    await assertPostgres();

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });

    server.setMaxListeners(0);
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
})();

const shutdown = async () => {
  try {
    if (server) await new Promise((res) => server.close(res));
    await pool.end();
    console.log("✅ Closed gracefully");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error during shutdown", e);
    process.exit(1);
  }
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);






// require("dotenv").config();

// const path = require("path");
// const express = require("express");
// const compression = require("compression");
// const session = require("express-session");
// const cors = require("cors");
// const morgan = require("morgan");
// const catalogPgRoutes = require("./routes/api/catalog-pg");
// const pool = require('./utils/pg');

// // const { Pool } = require("pg");
// const PgSession = require("connect-pg-simple")(session);

// // -------------------- Config -------------------- //
// const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
// const isProd = process.env.NODE_ENV === "production";

// const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_URL;

// if (!DATABASE_URL) {
//   console.error("❌ DATABASE_URL (or PG_URL) is missing");
//   process.exit(1);
// }

// console.log("ENV CHECK:", {
//   PORT,
//   NODE_ENV: process.env.NODE_ENV || "not set",
//   DB: "POSTGRES",
// });

// // -------------------- Postgres Pool -------------------- //
// // Railway INTERNAL postgres URL typically does NOT need SSL.
// // If later you use a public URL that requires SSL, enable it below.
// pool = new Pool({
//   connectionString: DATABASE_URL,
//   // ssl: isProd ? { rejectUnauthorized: false } : false,
// });

// // Fail fast if Postgres is unreachable
// async function assertPostgres() {
//   const r = await pool.query("SELECT 1 as ok");
//   if (!r?.rows?.[0]?.ok) throw new Error("Postgres ping failed");
//   console.log("🟢 Connected to PostgreSQL");
// }

// // -------------------- App Init -------------------- //
// const app = express();

// if (isProd) app.set("trust proxy", 1);
// app.use(morgan("dev"));
// app.use(cors());
// app.use(compression());

// app.use(express.json({ limit: "1mb" }));
// app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// app.use(
//   express.static(path.join(__dirname, "public"), { maxAge: isProd ? "1d" : 0 })
// );
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// console.log("🔥 Postgres-only app.js loaded");

// // -------------------- Sessions (Postgres) -------------------- //
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "fallbackSecretKey",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: isProd,
//       httpOnly: true,
//       sameSite: "lax",
//       maxAge: 30 * 60 * 1000, // 30 minutes
//     },
//     store: new PgSession({
//       pool,
//       tableName: "session", // default is "session"
//       createTableIfMissing: true, // creates table automatically
//     }),
//   })
// );

// // Template locals + cart bootstrap (still OK without Mongo)
// app.use((req, res, next) => {
//   req.session.cart ||= [];
//   const cart = req.session.cart;

//   res.locals.cartCount = cart.reduce((n, i) => n + (i.quantity || 0), 0);
//   res.locals.cartTotal = cart.reduce(
//     (s, i) => s + (i.price || 0) * (i.quantity || 0),
//     0
//   );

//   res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
//   next();
// });
// app.use("/api", catalogPgRoutes);

// // -------------------- Health / Diagnostics -------------------- //
// app.get("/api/health", (_req, res) => res.json({ ok: true }));
// app.get("/api/ping", (_req, res) => res.type("text/plain").send("pong"));

// app.get('/api/health/db', async (_req, res) => {
//   try {
//     const { rows } = await pool.query('SELECT 1 AS ok');
//     res.json(rows[0]);
//   } catch (err) {
//     console.error('❌ PG health check failed:', err.message);
//     res.status(500).json({ error: 'Postgres not reachable' });
//   }
// });

// // Optional request trace
// app.use((req, _res, next) => {
//   console.log("➡", req.method, req.url);
//   next();
// });

// // -------------------- JSON APIs (Postgres) -------------------- //
// // Expected tables (you can rename, but then update SQL below):
// //
// // restaurants: id (uuid or serial PK), restaurant_en, restaurant_ar, logo, address
// // meals: id (uuid or serial PK), name, name_ar, price, image, offer, details, details_ar,
// //       period, address, restaurant_id (FK -> restaurants.id)
// //
// // If your real column names differ, tell me your table DDL and I will adjust SQL.

// const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || "";

// // GET /api/meals
// // app.get("/api/meals", async (_req, res) => {
// //   try {
// //     const q = `
// //       SELECT
// //         id,
// //         name,
// //         name_ar,
// //         price,
// //         image,
// //         offer,
// //         COALESCE(details, details_ar, '') AS details_any,
// //         restaurant_id
// //       FROM meals
// //       ORDER BY id DESC
// //     `;
// //     const r = await pool.query(q);

// //     const meals = r.rows.map((row) => ({
// //       id: String(row.id),
// //       name: row.name,
// //       name_ar: row.name_ar,
// //       price: Number(row.price ?? 0),
// //       image: row.image
// //         ? String(row.image).startsWith("http")
// //           ? row.image
// //           : `${BASE_PUBLIC_URL}${row.image}`
// //         : null,
// //       restaurant: String(row.restaurant_id ?? ""),
// //       details: row.details_any || "",
// //       offer: !!row.offer,
// //     }));

// //     res.json(meals);
// //   } catch (err) {
// //     console.error("Error loading meals:", err);
// //     res.status(500).json({ message: "Failed to load meals" });
// //   }
// // });

// // GET /api/meals/offers
// app.get("/api/meals/offers", async (_req, res) => {
//   try {
//     const q = `
//       SELECT
//         id,
//         name,
//         name_ar,
//         price,
//         image,
//         offer,
//         COALESCE(details, details_ar, '') AS details_any,
//         restaurant_id
//       FROM meals
//       WHERE offer = TRUE
//       ORDER BY id DESC
//     `;
//     const r = await pool.query(q);

//     const meals = r.rows.map((row) => ({
//       id: String(row.id),
//       name: row.name,
//       name_ar: row.name_ar,
//       price: Number(row.price ?? 0),
//       image: row.image
//         ? String(row.image).startsWith("http")
//           ? row.image
//           : `${BASE_PUBLIC_URL}${row.image}`
//         : null,
//       restaurant: String(row.restaurant_id ?? ""),
//       details: row.details_any || "",
//       offer: true,
//     }));

//     res.json(meals);
//   } catch (err) {
//     console.error("Error loading offer meals:", err);
//     res.status(500).json({ message: "Failed to load offer meals" });
//   }
// });

// // GET /api/restaurants
// // app.get("/api/restaurants", async (_req, res) => {
// //   try {
// //     const q = `
// //       SELECT
// //         id,
// //         restaurant_en,
// //         restaurant_ar,
// //         logo,
// //         address
// //       FROM restaurants
// //       ORDER BY id DESC
// //     `;
// //     const r = await pool.query(q);

// //     const restaurants = r.rows.map((row) => ({
// //       id: String(row.id),
// //       restaurant_en: row.restaurant_en || "",
// //       restaurant_ar: row.restaurant_ar || "",
// //       logo: row.logo
// //         ? String(row.logo).startsWith("http")
// //           ? row.logo
// //           : `${BASE_PUBLIC_URL}${row.logo}`
// //         : null,
// //       address: row.address || "",
// //     }));

// //     res.json(restaurants);
// //   } catch (err) {
// //     console.error("Error loading restaurants:", err);
// //     res.status(500).json({ message: "Failed to load restaurants" });
// //   }
// // });

// // GET /api/restaurants/:id
// app.get("/api/restaurants/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const q = `
//       SELECT
//         id,
//         restaurant_en,
//         restaurant_ar,
//         logo,
//         address
//       FROM restaurants
//       WHERE id = $1
//       LIMIT 1
//     `;
//     const r = await pool.query(q, [id]);

//     if (r.rowCount === 0) {
//       return res.status(404).json({ message: "Restaurant not found", idRequested: id });
//     }

//     const row = r.rows[0];
//     res.json({
//       id: String(row.id),
//       restaurant_en: row.restaurant_en || "",
//       restaurant_ar: row.restaurant_ar || "",
//       logo: row.logo
//         ? String(row.logo).startsWith("http")
//           ? row.logo
//           : `${BASE_PUBLIC_URL}${row.logo}`
//         : null,
//       address: row.address || "",
//     });
//   } catch (err) {
//     console.error("Error loading restaurant details:", err);
//     res.status(500).json({ message: "Failed to load restaurant", error: err.message });
//   }
// });

// // GET /api/restaurants/:id/meals
// app.get("/api/restaurants/:id/meals", async (req, res) => {
//   try {
//     const { id } = req.params;

//     const q = `
//       SELECT
//         id,
//         name,
//         name_ar,
//         price,
//         image,
//         offer,
//         COALESCE(details, details_ar, '') AS details_any,
//         period,
//         address
//       FROM meals
//       WHERE restaurant_id = $1
//       ORDER BY id DESC
//     `;
//     const r = await pool.query(q, [id]);

//     const mealsForApp = r.rows.map((row) => ({
//       id: String(row.id),
//       name: row.name || "",
//       name_ar: row.name_ar || "",
//       price: Number(row.price ?? 0),
//       details: row.details_any || "",
//       offer: !!row.offer,
//       image: row.image
//         ? String(row.image).startsWith("http")
//           ? row.image
//           : `${BASE_PUBLIC_URL}${row.image}`
//         : null,
//       period: Number(row.period ?? 0),
//       address: row.address || "",
//     }));

//     res.json(mealsForApp);
//   } catch (err) {
//     console.error("Error getting restaurant meals:", err);
//     res.status(500).json({ message: "Failed to load meals for restaurant", error: err.message });
//   }
// });

// // -------------------- API 404 -------------------- //
// app.use("/api", (req, res) => {
//   res.status(404).json({
//     success: false,
//     error: "API route not found",
//     path: req.originalUrl,
//   });
// });

// // -------------------- Start & Graceful Shutdown -------------------- //
// let server;

// (async () => {
//   try {
//     await assertPostgres();

//     server = app.listen(PORT, "0.0.0.0", () => {
//       console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
//     });

//     server.setMaxListeners(0);
//   } catch (err) {
//     console.error("❌ Startup failed:", err);
//     process.exit(1);
//   }
// })();

// const shutdown = async () => {
//   try {
//     if (server) await new Promise((res) => server.close(res));
//     await pool.end();
//     console.log("✅ Closed gracefully");
//     process.exit(0);
//   } catch (e) {
//     console.error("❌ Error during shutdown", e);
//     process.exit(1);
//   }
// };

// process.once("SIGTERM", shutdown);
// process.once("SIGINT", shutdown);
