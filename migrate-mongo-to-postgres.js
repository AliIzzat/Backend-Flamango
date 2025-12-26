/**
 * migrate-mongo-to-postgres.js
 *
 * Migrates: users, restaurants, meals, orders, notifications (and order_items if present)
 * from MongoDB (flamingosDB) -> PostgreSQL (flamango schema you created).
 *
 * Requirements:
 *   npm i mongodb pg dotenv
 *
 * Run:
 *   node migrate-mongo-to-postgres.js
 *
 * ENV (.env):
 *   MONGO_URI=mongodb+srv://.../flamingosDB?retryWrites=true&w=majority
 *   PG_URL=postgresql://user:pass@host:5432/dbname
 *   # optional:
 *   MIGRATE_DROP_FIRST=false
 *   MIGRATE_LIMIT=0   # 0 = no limit
 */

require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const { Pool } = require("pg");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PG_URL = process.env.PG_URL || process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error("❌ Missing MONGO_URI (or MONGODB_URI) in .env");
  process.exit(1);
}
if (!PG_URL) {
  console.error("❌ Missing PG_URL (or DATABASE_URL) in .env");
  process.exit(1);
}

const LIMIT = Number(process.env.MIGRATE_LIMIT || 0); // 0 = unlimited
const DROP_FIRST = String(process.env.MIGRATE_DROP_FIRST || "false").toLowerCase() === "true";

const pool = new Pool({
  connectionString: PG_URL,
  // Railway internal does not require SSL. If using public URL, uncomment:
  // ssl: { rejectUnauthorized: false },
});

// -------------------- Helpers -------------------- //

function mongoIdToText(id) {
  if (!id) return null;
  try {
    return typeof id === "string" ? id : String(id);
  } catch {
    return null;
  }
}

function pickRole(rawRole) {
  // Your schema allows: admin, support, data_entry, driver, customer, delivery
  // Your existing system used "delivery" sometimes, and you want "driver".
  const r = String(rawRole || "").toLowerCase().trim();
  if (!r) return "customer";

  if (r === "delivery" || r === "driver") return "driver";
  if (r === "dataentry" || r === "data_entry") return "data_entry";
  if (["admin", "support", "customer"].includes(r)) return r;

  // fallback
  return "customer";
}

function normalizeOrderStatus(s) {
  const v = String(s || "").trim();
  const allowed = new Set(["Pending", "Assigned", "Picked Up", "Delivered", "Cancelled", "Failed"]);
  if (allowed.has(v)) return v;
  // common variants:
  if (/picked/i.test(v)) return "Picked Up";
  if (/deliver/i.test(v)) return "Delivered";
  if (/cancel/i.test(v)) return "Cancelled";
  if (/fail/i.test(v)) return "Failed";
  return "Pending";
}

function safeNumber(n, fallback = null) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function safeText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

async function queryOne(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}

// -------------------- Optional: drop tables (DANGEROUS) -------------------- //
async function dropAll() {
  // Only if you explicitly set MIGRATE_DROP_FIRST=true
  await pool.query(`
    DO $$
    BEGIN
      -- Drop child tables first
      IF to_regclass('public.order_items') IS NOT NULL THEN EXECUTE 'DROP TABLE order_items CASCADE'; END IF;
      IF to_regclass('public.payments') IS NOT NULL THEN EXECUTE 'DROP TABLE payments CASCADE'; END IF;
      IF to_regclass('public.notifications') IS NOT NULL THEN EXECUTE 'DROP TABLE notifications CASCADE'; END IF;
      IF to_regclass('public.orders') IS NOT NULL THEN EXECUTE 'DROP TABLE orders CASCADE'; END IF;
      IF to_regclass('public.meals') IS NOT NULL THEN EXECUTE 'DROP TABLE meals CASCADE'; END IF;
      IF to_regclass('public.restaurants') IS NOT NULL THEN EXECUTE 'DROP TABLE restaurants CASCADE'; END IF;
      IF to_regclass('public.users') IS NOT NULL THEN EXECUTE 'DROP TABLE users CASCADE'; END IF;
    END $$;
  `);
  console.log("🧨 Dropped existing tables (because MIGRATE_DROP_FIRST=true).");
}

// -------------------- Ensure schema exists -------------------- //
// If you already ran your schema SQL, you can skip this,
// but keeping it makes script “just work”.
async function ensureSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

  // Minimal tables (same as your schema). If you already created them, these are no-ops.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username        TEXT UNIQUE NOT NULL,
      name            TEXT,
      role            TEXT NOT NULL CHECK (role IN ('admin','support','data_entry','driver','customer','delivery')),
      password_hash   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      mongo_id      TEXT UNIQUE,
      name_en       TEXT,
      name_ar       TEXT,
      address       TEXT,
      logo_url      TEXT,
      lat           DOUBLE PRECISION,
      lng           DOUBLE PRECISION,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON restaurants (lat, lng);

    CREATE TABLE IF NOT EXISTS meals (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      mongo_id      TEXT UNIQUE,
      restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
      name_en       TEXT,
      name_ar       TEXT,
      price         NUMERIC(12,2) NOT NULL DEFAULT 0,
      offer         BOOLEAN NOT NULL DEFAULT false,
      period        INTEGER NOT NULL DEFAULT 0,
      image_url     TEXT,
      details_en    TEXT,
      details_ar    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_meals_restaurant_id ON meals (restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_meals_offer ON meals (offer);

    CREATE TABLE IF NOT EXISTS orders (
      id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      mongo_id             TEXT UNIQUE,
      restaurant_id        UUID REFERENCES restaurants(id) ON DELETE SET NULL,
      customer_id          UUID REFERENCES users(id) ON DELETE SET NULL,

      status               TEXT NOT NULL DEFAULT 'Pending'
                             CHECK (status IN ('Pending','Assigned','Picked Up','Delivered','Cancelled','Failed')),

      total_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,

      delivery_person_id   UUID REFERENCES users(id) ON DELETE SET NULL,
      delivery_person_name TEXT,

      customer_name        TEXT,
      customer_mobile      TEXT,
      customer_address     TEXT,
      customer_lat         DOUBLE PRECISION,
      customer_lng         DOUBLE PRECISION,

      delivery_details     JSONB,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
    CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders (delivery_person_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

    CREATE TABLE IF NOT EXISTS order_items (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      meal_id        UUID REFERENCES meals(id) ON DELETE SET NULL,
      name_snapshot  TEXT NOT NULL,
      price_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
      quantity       INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status      TEXT NOT NULL CHECK (status IN ('unpicked','picked','delivered')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_order ON notifications(order_id);

    CREATE TABLE IF NOT EXISTS payments (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider     TEXT NOT NULL DEFAULT 'myfatoorah',
      invoice_id   TEXT,
      payment_id   TEXT,
      status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
      raw_response JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
  `);

  console.log("✅ Ensured PostgreSQL schema exists.");
}

// -------------------- Main Migration -------------------- //
(async () => {
  const mongo = new MongoClient(MONGO_URI, { ignoreUndefined: true });

  try {
    console.log("🔌 Connecting to Mongo...");
    await mongo.connect();
    const mongoDbNameFromUri = (() => {
      const afterSlash = MONGO_URI.split("?")[0].split("/");
      return afterSlash[afterSlash.length - 1] || "flamingosDB";
    })();
    // If URI ends with /flamingosDB, this will use it. If not, you can set DB explicitly:
    const mdb = mongo.db(mongoDbNameFromUri);

    console.log("🔌 Connecting to Postgres...");
    await pool.query("SELECT 1 as ok");
    console.log("✅ Postgres reachable.");

    if (DROP_FIRST) await dropAll();
    await ensureSchema();

    // Choose collections (based on what you showed)
    const colUsers = mdb.collection("users");
    const colRestaurants = mdb.collection("restaurants");
    const colMeals = mdb.collection("meals");
    const colOrders = mdb.collection("orders");
    const colNotifications = mdb.collection("notifications");

    // For mapping Mongo _id -> Postgres UUID
    const mapUser = new Map();       // mongoId(text) -> pg uuid
    const mapRestaurant = new Map(); // mongoId(text) -> pg uuid
    const mapMeal = new Map();       // mongoId(text) -> pg uuid
    const mapOrder = new Map();      // mongoId(text) -> pg uuid

    // -------------------- USERS -------------------- //
    console.log("👤 Migrating users...");
    const usersCursor = colUsers.find({});
    if (LIMIT > 0) usersCursor.limit(LIMIT);

    let userCount = 0;
    while (await usersCursor.hasNext()) {
      const u = await usersCursor.next();
      const mongo_id = mongoIdToText(u._id);
      const username = safeText(u.username) || safeText(u.email) || `user_${mongo_id}`;
      const name = safeText(u.name) || safeText(u.fullName) || null;
      const role = pickRole(u.role);

      // Important: do NOT store plain passwords in password_hash.
      // If your Mongo has plain `password`, you should properly hash later.
      // For migration, we keep NULL or store a placeholder.
      const password_hash = null;

      const row = await queryOne(
        `
        INSERT INTO users (username, name, role, password_hash)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (username) DO UPDATE
          SET name = COALESCE(EXCLUDED.name, users.name),
              role = EXCLUDED.role
        RETURNING id;
        `,
        [username, name, role, password_hash]
      );

      mapUser.set(mongo_id, row.id);
      userCount++;
    }
    console.log(`✅ Users migrated: ${userCount}`);

    // -------------------- RESTAURANTS -------------------- //
    console.log("🏪 Migrating restaurants...");
    const restCursor = colRestaurants.find({});
    if (LIMIT > 0) restCursor.limit(LIMIT);

    let restCount = 0;
    while (await restCursor.hasNext()) {
      const r = await restCursor.next();
      const mongo_id = mongoIdToText(r._id);

      const name_en = safeText(r.restaurant_en) || safeText(r.name_en) || safeText(r.name) || null;
      const name_ar = safeText(r.restaurant_ar) || safeText(r.name_ar) || null;
      const address = safeText(r.address) || safeText(r.location) || null;
      const logo_url = safeText(r.logo) || safeText(r.logo_url) || null;

      // common coordinate shapes:
      const lat =
        safeNumber(r.lat) ??
        safeNumber(r.latitude) ??
        safeNumber(r.coordinates?.lat) ??
        safeNumber(r.coordinates?.latitude) ??
        safeNumber(r.location?.lat) ??
        safeNumber(r.location?.latitude) ??
        null;

      const lng =
        safeNumber(r.lng) ??
        safeNumber(r.longitude) ??
        safeNumber(r.coordinates?.lng) ??
        safeNumber(r.coordinates?.longitude) ??
        safeNumber(r.location?.lng) ??
        safeNumber(r.location?.longitude) ??
        null;

      const row = await queryOne(
        `
        INSERT INTO restaurants (mongo_id, name_en, name_ar, address, logo_url, lat, lng)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (mongo_id) DO UPDATE
          SET name_en = COALESCE(EXCLUDED.name_en, restaurants.name_en),
              name_ar = COALESCE(EXCLUDED.name_ar, restaurants.name_ar),
              address = COALESCE(EXCLUDED.address, restaurants.address),
              logo_url = COALESCE(EXCLUDED.logo_url, restaurants.logo_url),
              lat = COALESCE(EXCLUDED.lat, restaurants.lat),
              lng = COALESCE(EXCLUDED.lng, restaurants.lng)
        RETURNING id;
        `,
        [mongo_id, name_en, name_ar, address, logo_url, lat, lng]
      );

      mapRestaurant.set(mongo_id, row.id);
      restCount++;
    }
    console.log(`✅ Restaurants migrated: ${restCount}`);

    // -------------------- MEALS -------------------- //
    console.log("🍽️ Migrating meals...");
    const mealCursor = colMeals.find({});
    if (LIMIT > 0) mealCursor.limit(LIMIT);

    let mealCount = 0;
    while (await mealCursor.hasNext()) {
      const m = await mealCursor.next();
      const mongo_id = mongoIdToText(m._id);

      // Attempt to locate restaurant reference:
      // - some schemas store restaurantId
      // - some store restaurant ObjectId
      // - your current Mongo Meal seems to store restaurant_en/restaurant_ar strings (not ideal)
      // We'll try multiple ways:
      let restaurant_id = null;

      const possibleRestaurantMongoId =
        mongoIdToText(m.restaurantId) ||
        mongoIdToText(m.restaurant_id) ||
        mongoIdToText(m.restaurant) ||
        null;

      if (possibleRestaurantMongoId && mapRestaurant.has(possibleRestaurantMongoId)) {
        restaurant_id = mapRestaurant.get(possibleRestaurantMongoId);
      } else {
        // fallback: match by name against restaurants we inserted
        const restName = safeText(m.restaurant_en) || safeText(m.restaurant_ar) || null;
        if (restName) {
          const found = await queryOne(
            `
            SELECT id FROM restaurants
            WHERE name_en = $1 OR name_ar = $1
            LIMIT 1;
            `,
            [restName]
          );
          restaurant_id = found?.id || null;
        }
      }

      const name_en = safeText(m.name) || safeText(m.name_en) || null;
      const name_ar = safeText(m.name_ar) || null;

      const price = safeNumber(m.price, 0) ?? 0;
      const offer = !!m.offer;
      const period = Number.isFinite(Number(m.period)) ? Number(m.period) : 0;

      const image_url = safeText(m.image) || safeText(m.image_url) || null;
      const details_en = safeText(m.details) || safeText(m.details_en) || null;
      const details_ar = safeText(m.details_ar) || null;

      const row = await queryOne(
        `
        INSERT INTO meals (mongo_id, restaurant_id, name_en, name_ar, price, offer, period, image_url, details_en, details_ar)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (mongo_id) DO UPDATE
          SET restaurant_id = COALESCE(EXCLUDED.restaurant_id, meals.restaurant_id),
              name_en = COALESCE(EXCLUDED.name_en, meals.name_en),
              name_ar = COALESCE(EXCLUDED.name_ar, meals.name_ar),
              price = EXCLUDED.price,
              offer = EXCLUDED.offer,
              period = EXCLUDED.period,
              image_url = COALESCE(EXCLUDED.image_url, meals.image_url),
              details_en = COALESCE(EXCLUDED.details_en, meals.details_en),
              details_ar = COALESCE(EXCLUDED.details_ar, meals.details_ar)
        RETURNING id;
        `,
        [mongo_id, restaurant_id, name_en, name_ar, price, offer, period, image_url, details_en, details_ar]
      );

      mapMeal.set(mongo_id, row.id);
      mealCount++;
    }
    console.log(`✅ Meals migrated: ${mealCount}`);

    // -------------------- ORDERS (+ order_items) -------------------- //
    console.log("🧾 Migrating orders...");
    const orderCursor = colOrders.find({});
    if (LIMIT > 0) orderCursor.limit(LIMIT);

    let orderCount = 0;
    let orderItemCount = 0;

    while (await orderCursor.hasNext()) {
      const o = await orderCursor.next();
      const mongo_id = mongoIdToText(o._id);

      // restaurant mapping
      let restaurant_id = null;
      const orderRestaurantMongoId =
        mongoIdToText(o.restaurantId) ||
        mongoIdToText(o.restaurant_id) ||
        mongoIdToText(o.restaurant) ||
        null;

      if (orderRestaurantMongoId && mapRestaurant.has(orderRestaurantMongoId)) {
        restaurant_id = mapRestaurant.get(orderRestaurantMongoId);
      }

      // customer mapping
      let customer_id = null;
      const customerMongoId = mongoIdToText(o.customerId) || mongoIdToText(o.customer_id) || mongoIdToText(o.userId) || null;
      if (customerMongoId && mapUser.has(customerMongoId)) {
        customer_id = mapUser.get(customerMongoId);
      }

      // driver mapping
      let delivery_person_id = null;
      const driverMongoId =
        mongoIdToText(o.deliveryPersonId) ||
        mongoIdToText(o.delivery_person_id) ||
        mongoIdToText(o.driverId) ||
        null;

      if (driverMongoId && mapUser.has(driverMongoId)) {
        delivery_person_id = mapUser.get(driverMongoId);
      }

      const status = normalizeOrderStatus(o.status);
      const total_amount = safeNumber(o.totalAmount ?? o.total, 0) ?? 0;

      const delivery_person_name = safeText(o.deliveryPersonName) || safeText(o.delivery_person_name) || null;

      const customer_name = safeText(o.customerName) || safeText(o.customer_name) || null;
      const customer_mobile = safeText(o.customerMobile) || safeText(o.customer_mobile) || null;

      // If you stored address in deliveryDetails, keep a readable snapshot too
      let customer_address = safeText(o.customerAddress) || safeText(o.address) || null;
      const d = o.deliveryDetails || {};
      if (!customer_address) {
        const addrParts = [
          d.city,
          d.zone ? `Zone ${d.zone}` : null,
          d.street ? `Street ${d.street}` : null,
          d.building ? `Bldg ${d.building}` : null,
          d.floor ? `Floor ${d.floor}` : null,
          d.aptNo ? `Apt ${d.aptNo}` : null,
          d.addressNote,
        ].filter(Boolean);
        customer_address = addrParts.length ? addrParts.join(", ") : null;
      }

      const customer_lat = safeNumber(o.customerLat) ?? safeNumber(d.lat) ?? safeNumber(d.customerLat) ?? null;
      const customer_lng = safeNumber(o.customerLng) ?? safeNumber(d.lng) ?? safeNumber(d.customerLng) ?? null;

      const delivery_details = o.deliveryDetails ? JSON.stringify(o.deliveryDetails) : null;

      const row = await queryOne(
        `
        INSERT INTO orders (
          mongo_id, restaurant_id, customer_id,
          status, total_amount,
          delivery_person_id, delivery_person_name,
          customer_name, customer_mobile, customer_address,
          customer_lat, customer_lng,
          delivery_details
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (mongo_id) DO UPDATE
          SET restaurant_id = COALESCE(EXCLUDED.restaurant_id, orders.restaurant_id),
              customer_id = COALESCE(EXCLUDED.customer_id, orders.customer_id),
              status = EXCLUDED.status,
              total_amount = EXCLUDED.total_amount,
              delivery_person_id = COALESCE(EXCLUDED.delivery_person_id, orders.delivery_person_id),
              delivery_person_name = COALESCE(EXCLUDED.delivery_person_name, orders.delivery_person_name),
              customer_name = COALESCE(EXCLUDED.customer_name, orders.customer_name),
              customer_mobile = COALESCE(EXCLUDED.customer_mobile, orders.customer_mobile),
              customer_address = COALESCE(EXCLUDED.customer_address, orders.customer_address),
              customer_lat = COALESCE(EXCLUDED.customer_lat, orders.customer_lat),
              customer_lng = COALESCE(EXCLUDED.customer_lng, orders.customer_lng),
              delivery_details = COALESCE(EXCLUDED.delivery_details, orders.delivery_details)
        RETURNING id;
        `,
        [
          mongo_id,
          restaurant_id,
          customer_id,
          status,
          total_amount,
          delivery_person_id,
          delivery_person_name,
          customer_name,
          customer_mobile,
          customer_address,
          customer_lat,
          customer_lng,
          delivery_details ? JSON.parse(delivery_details) : null,
        ]
      );

      const orderPgId = row.id;
      mapOrder.set(mongo_id, orderPgId);
      orderCount++;

      // Order Items (best-effort):
      // Your Mongo order might have: items, cartItems, cart, orderItems, mealIds, meals, etc.
      const candidates = [
        o.items,
        o.cartItems,
        o.cart,
        o.orderItems,
      ].filter((arr) => Array.isArray(arr) && arr.length);

      if (candidates.length) {
        const list = candidates[0];
        for (const it of list) {
          const name_snapshot = safeText(it.name) || safeText(it.mealName) || safeText(it.title) || "Item";
          const price_snapshot = safeNumber(it.price, 0) ?? 0;
          const quantity = Number.isFinite(Number(it.quantity)) ? Number(it.quantity) : 1;

          // Try to map meal_id if item stores Mongo meal id
          let meal_id = null;
          const mealMongoId = mongoIdToText(it.mealId) || mongoIdToText(it.meal_id) || mongoIdToText(it._id) || null;
          if (mealMongoId && mapMeal.has(mealMongoId)) {
            meal_id = mapMeal.get(mealMongoId);
          }

          await pool.query(
            `
            INSERT INTO order_items (order_id, meal_id, name_snapshot, price_snapshot, quantity)
            VALUES ($1,$2,$3,$4,$5);
            `,
            [orderPgId, meal_id, name_snapshot, price_snapshot, quantity]
          );
          orderItemCount++;
        }
      }
    }

    console.log(`✅ Orders migrated: ${orderCount}`);
    console.log(`✅ Order items inserted: ${orderItemCount}`);

    // -------------------- NOTIFICATIONS -------------------- //
    console.log("🔔 Migrating notifications...");
    const notCursor = colNotifications.find({});
    if (LIMIT > 0) notCursor.limit(LIMIT);

    let notCount = 0;
    while (await notCursor.hasNext()) {
      const n = await notCursor.next();

      // Your Notification likely references orderId (Mongo ObjectId)
      const orderMongoId = mongoIdToText(n.orderId) || mongoIdToText(n.order_id) || null;
      if (!orderMongoId) continue;
      if (!mapOrder.has(orderMongoId)) continue;

      const order_id = mapOrder.get(orderMongoId);
      const statusRaw = String(n.status || "").toLowerCase().trim();
      const status = ["unpicked", "picked", "delivered"].includes(statusRaw) ? statusRaw : "unpicked";

      await pool.query(
        `
        INSERT INTO notifications (order_id, status)
        VALUES ($1,$2)
        ON CONFLICT (order_id) DO UPDATE
          SET status = EXCLUDED.status;
        `,
        [order_id, status]
      );

      notCount++;
    }
    console.log(`✅ Notifications migrated: ${notCount}`);

    console.log("\n🎉 Migration finished successfully.");
    console.log("Next quick checks (Postgres):");
    console.log("  SELECT COUNT(*) FROM users;");
    console.log("  SELECT COUNT(*) FROM restaurants;");
    console.log("  SELECT COUNT(*) FROM meals;");
    console.log("  SELECT COUNT(*) FROM orders;");
    console.log("  SELECT COUNT(*) FROM notifications;");
  } catch (e) {
    console.error("❌ Migration failed:", e);
    process.exitCode = 1;
  } finally {
    try {
      await pool.end();
    } catch {}
    try {
      await mongo.close();
    } catch {}
  }
})();
