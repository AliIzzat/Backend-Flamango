// app.js

// -------------------- Env & Core -------------------- //
require("dotenv").config();

const path = require("path");
const express = require("express");
const compression = require("compression");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const cors = require("cors");
const morgan = require("morgan");

const expHbs = require("express-handlebars");
const Handlebars = require("handlebars");

// Models
const Food = require("./models/Meal");
const Restaurant = require("./models/Restaurant");

// Routers
const mobileRoutes = require("./routes/mobile");
const orderRoutes = require("./routes/frontend/order");

const deliveryRoutes = require("./routes/backend/delivery");
const driverApiRouter = require("./routes/api/driver");
const reportsRoutes = require("./routes/backend/reports");
const mobileAuthRoutes = require("./routes/api/mobileAuth");

// Frontend routers
const homeRoutes = require("./routes/frontend/home");
const childRoutes = require("./routes/frontend/child");
const sportRoutes = require("./routes/frontend/sport");
const sessionRoutes = require("./routes/frontend/session");
const cartRoutes = require("./routes/frontend/cart");
const restaurantRoutes = require("./routes/frontend/restaurant");

const adminRoutes = require("./routes/backend/admin");
const foodRoutes = require("./routes/backend/food");
const favoritesRoutes = require("./routes/backend/favorites");
const dashboardRoutes = require("./routes/backend/dashboard");
const authRoutes = require("./routes/backend/auth");

// Helpers
const distanceHelper = require("./utils/distance");

// -------------------- Config -------------------- //
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/flamingosDB";
const isProd = process.env.NODE_ENV === "production";

// ✅ ENVIRONMENT DIAGNOSTIC LOG
console.log("ENV CHECK:", {
  PORT,
  NODE_ENV: process.env.NODE_ENV || "not set",
  DB: MONGODB_URI.includes("127.0.0.1") ? "LOCAL DB" : "REMOTE DB",
});
function safeMongoTarget(uri) {
  try {
    if (!uri) return "MONGODB_URI is empty";
    // Remove query
    const noQuery = uri.split("?")[0];
    // For mongodb://user:pass@host:port/db
    // For mongodb+srv://user:pass@host/db
    const parts = noQuery.split("/");
    const db = parts.length >= 4 ? parts[3] : ""; // index 3 is db name
    return db || "(NO_DB_NAME -> defaults to 'test')";
  } catch {
    return "Could not parse";
  }
}

console.log("MONGO TARGET DB =", safeMongoTarget(MONGODB_URI));
console.log("MONGODB_URI contains /flamingosDB ?", String(MONGODB_URI).includes("/flamingosDB"));

// -------------------- App Init -------------------- //
const app = express();

if (isProd) app.set("trust proxy", 1);
app.use(morgan("dev"));
app.use(cors());

// -------------------- Middleware / Parsers / Static -------------------- //
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  express.static(path.join(__dirname, "public"), { maxAge: isProd ? "1d" : 0 })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

console.log("🔥 App.js loaded");

// -------------------- Sessions (before routes that use req.session) -------------------- //
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbackSecretKey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000, // 30 minutes
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

// Optional request trace (keep if you want)
app.use((req, _res, next) => {
  console.log("➡", req.method, req.url);
  next();
});

// -------------------- API ROUTES (put API routes before frontend routes) -------------------- //
// Driver API (must match your Driver app calls)
app.use("/api/driver", driverApiRouter);

// Mobile auth API
app.use("/api/mobile", mobileAuthRoutes);

// Delivery backend routes (drivers/admin web)
app.use("/delivery", deliveryRoutes);

// Reports backend
app.use("/reports", reportsRoutes);

// -------------------- View Engine -------------------- //
const hbs = expHbs.create({
  extname: ".hbs",
  defaultLayout: "main",
  layoutsDir: path.join(__dirname, "views", "layouts"),
  partialsDir: path.join(__dirname, "views", "partials"),
  handlebars: Handlebars,
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  },
  helpers: {
    distance: distanceHelper,
    includes: (arr, v) => Array.isArray(arr) && arr.includes(v?.toString?.()),
    totalPrice: (meals) =>
      Array.isArray(meals)
        ? meals
            .reduce((sum, i) => sum + i.price * (i.quantity || 1), 0)
            .toFixed(2)
        : "0.00",
    ifEquals: (a, b, opts) => (a == b ? opts.fn(this) : opts.inverse(this)),
    json: (ctx) => JSON.stringify(ctx, null, 2),
    stringify: (obj) => JSON.stringify(obj, null, 2),
    encodeURI: (s) => encodeURIComponent(s ?? ""),
    multiply: (a, b) => a * b,
    eq: (a, b) => a === b,
    array: (...args) => args.slice(0, -1),
    or: (a, b) => a || b,
    range: (from, to, opts) => {
      let out = "";
      for (let i = from; i < to; i++) out += opts.fn(i);
      return out;
    },
    ifCond: function (v1, operator, v2, opts) {
      switch (operator) {
        case "==":
          return v1 == v2 ? opts.fn(this) : opts.inverse(this);
        case "<=":
          return v1 <= v2 ? opts.fn(this) : opts.inverse(this);
        default:
          return opts.inverse(this);
      }
    },
    slugify: (text) =>
      typeof text === "string" ? text.toLowerCase().replace(/\s+/g, "-") : "",
  },
});

app.engine("hbs", hbs.engine);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

// -------------------- Lightweight JSON API (MEALS / RESTAURANTS) -------------------- //
// NOTE: We removed app.use('/api/meals', mealApiRoutes) to avoid route conflicts.
// Keep ALL /api/meals handlers here in one place.

app.get("/api/meals", async (_req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || "http://192.168.1.26:4000";

    const foods = await Food.find({}).lean();

    const meals = foods.map((f) => ({
      id: String(f._id),
      name: f.name,
      price: f.price,
      image: f.image
        ? f.image.startsWith("http")
          ? f.image
          : `${BASE_PUBLIC_URL}${f.image}`
        : null,
      restaurant: f.restaurant_en || f.restaurant_ar || "",
      details: f.details || f.details_ar || "",
      offer: !!f.offer,
    }));

    res.json(meals);
  } catch (err) {
    console.error("Error loading meals:", err);
    res.status(500).json({ message: "Failed to load meals" });
  }
});

app.get("/api/meals/offers", async (_req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || "http://192.168.1.26:4000";

    const foods = await Food.find({ offer: true }).lean();

    const meals = foods.map((f) => ({
      id: String(f._id),
      name: f.name,
      price: f.price,
      image: f.image
        ? f.image.startsWith("http")
          ? f.image
          : `${BASE_PUBLIC_URL}${f.image}`
        : null,
      restaurant: f.restaurant_en || f.restaurant_ar || "",
      details: f.details || f.details_ar || "",
      offer: !!f.offer,
    }));

    res.json(meals);
  } catch (err) {
    console.error("Error loading offer meals:", err);
    res.status(500).json({ message: "Failed to load offer meals" });
  }
});

app.get("/api/meals/:id", async (req, res) => {
  try {
    const food = await Food.findById(req.params.id)
      .populate("restaurant", "name name_ar")
      .lean();

    if (!food) return res.status(404).json({ message: "Not found" });

    res.json({
      id: String(food._id),
      name: food.name,
      name_ar: food.name_ar,
      price: food.price,
      image: food.image,
      restaurant:
        food.restaurant_en || food.restaurant?.name || food.restaurant_ar || "",
      cuisine: food.cuisine || "",
      details: food.details || "",
      details_ar: food.details_ar || "",
      offer: !!food.offer,
      period: food.period ?? 0,
      address: food.address || "",
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load meal", error: e.message });
  }
});

// Restaurants
app.get("/api/restaurants", async (_req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || "http://192.168.1.26:4000";

    const docs = await Restaurant.find({}).lean();

    const restaurants = docs.map((r) => ({
      id: String(r._id),
      restaurant_en: r.restaurant_en || r.name_en || "",
      restaurant_ar: r.restaurant_ar || r.name_ar || "",
      logo:
        r.logo && r.logo.startsWith("http")
          ? r.logo
          : r.logo
          ? `${BASE_PUBLIC_URL}${r.logo}`
          : null,
      address: r.address || "",
    }));

    res.json(restaurants);
  } catch (err) {
    console.error("Error loading restaurants:", err);
    res.status(500).json({ message: "Failed to load restaurants" });
  }
});

app.get("/api/restaurants/:id", async (req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || "http://192.168.1.26:4000";
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid restaurant id format",
        idReceived: id,
      });
    }

    const r = await Restaurant.findById(id).lean();
    if (!r) {
      return res.status(404).json({
        message: "Restaurant not found",
        idRequested: id,
      });
    }

    const restaurant = {
      id: String(r._id),
      restaurant_en: r.restaurant_en || r.name_en || "",
      restaurant_ar: r.restaurant_ar || r.name_ar || "",
      logo:
        r.logo && r.logo.startsWith("http")
          ? r.logo
          : r.logo
          ? `${BASE_PUBLIC_URL}${r.logo}`
          : null,
      address: r.address || "",
    };

    return res.json(restaurant);
  } catch (err) {
    console.error("Error loading restaurant details:", err);
    return res.status(500).json({
      message: "Failed to load restaurant",
      error: err.message,
    });
  }
});

app.get("/api/restaurants/:id/meals", async (req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || "http://192.168.1.26:4000";
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid restaurant id format",
        idReceived: id,
      });
    }

    const r = await Restaurant.findById(id).lean();
    if (!r) {
      return res.status(404).json({
        message: "Restaurant not found",
        idRequested: id,
      });
    }

    const restaurantNameEn = r.restaurant_en || r.name_en || "";
    const restaurantNameAr = r.restaurant_ar || r.name_ar || "";

    const foundFoods = await Food.find({
      $or: [{ restaurant_en: restaurantNameEn }, { restaurant_ar: restaurantNameAr }],
    }).lean();

    const mealsForApp = foundFoods.map((f) => ({
      id: String(f._id),
      name: f.name || "",
      name_ar: f.name_ar || "",
      price: f.price ?? 0,
      details: f.details || f.details_ar || "",
      offer: !!f.offer,
      restaurant: f.restaurant_en || f.restaurant_ar || "",
      image: f.image
        ? f.image.startsWith("http")
          ? f.image
          : `${BASE_PUBLIC_URL}${f.image}`
        : null,
    }));

    return res.json(mealsForApp);
  } catch (err) {
    console.error("Error getting restaurant meals:", err);
    return res.status(500).json({
      message: "Failed to load meals for restaurant",
      error: err.message,
    });
  }
});

// -------------------- Frontend Routes (web) -------------------- //
app.use("/", homeRoutes);
app.use("/", childRoutes);
app.use("/", sportRoutes);
app.use("/", sessionRoutes);
app.use("/order", orderRoutes);
app.use("/cart", cartRoutes);
app.use("/", restaurantRoutes);
app.use("/mobile", mobileRoutes);

// Backend Web (admin/dashboard)
app.use("/admin", adminRoutes);
app.use("/food", foodRoutes);
app.use("/favorites", favoritesRoutes);
app.use("/dashboard", dashboardRoutes);
app.use(authRoutes);

// Simple pages
app.get("/", (_req, res) =>
  res.render("frontend/introduction", { hideLayoutParts: true })
);
app.get("/session", (req, res) => res.json(req.session));
app.get("/search", (_req, res) => res.render("search"));
app.get("/login", (_req, res) => res.render("frontend/login"));

app.get("/edit", async (_req, res, next) => {
  try {
    const allFood = await Food.find();
    res.render("edit-food", { food: allFood });
  } catch (e) {
    next(e);
  }
});

app.get("/reset-cart", (req, res) => {
  req.session.cart = [];
  res.redirect("/cart/view");
});

// -------------------- MyFatoorah debug route (KEEP ONLY ONE) -------------------- //
app.get("/debug/payment-methods", async (_req, res) => {
  try {
    const MF_API_URL = process.env.MF_API_URL || "https://apitest.myfatoorah.com";
    const MF_TOKEN = process.env.MF_TOKEN;

    console.log("🔧 /debug/payment-methods called");
    console.log("🔑 MF_TOKEN present?", !!MF_TOKEN);
    console.log("🌍 MF_API_URL =", MF_API_URL);

    const body = {
      InvoiceAmount: 10,
      CurrencyIso: "QAR", // adjust to your account currency if needed
    };

    const resp = await fetch(`${MF_API_URL}/v2/InitiatePayment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MF_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const rawText = await resp.text();
    console.log("📡 InitiatePayment HTTP status =", resp.status);
    console.log("📡 InitiatePayment raw body   =", rawText);

    let data = null;
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error("⚠️ JSON parse failed:", e.message);
      }
    }

    if (!resp.ok) {
      return res.status(resp.status).json({
        status: resp.status,
        raw: rawText,
        parsed: data,
      });
    }

    return res.json(data);
  } catch (e) {
    console.error("❌ /debug/payment-methods error:", e);
    return res.status(500).json({ error: e.message });
  }
});

// -------------------- API 404 (clear JSON for unknown API routes) -------------------- //
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, error: "API route not found", path: req.originalUrl });
});

// -------------------- Start & Graceful Shutdown -------------------- //
let server;

(async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    console.log("Mongo connected");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });

    server.setMaxListeners(0);
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
})();

const shutdown = async () => {
  try {
    if (server) await new Promise((res) => server.close(res));
    await mongoose.connection.close();
    console.log("✅ Closed gracefully");
    process.exit(0);
  } catch (e) {
    console.error("❌ Error during shutdown", e);
    process.exit(1);
  }
};

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);









// // -------------------- Env & Core -------------------- //
// require('dotenv').config();// loads all variable from .env
// const path = require('path'); //work with file and directory paths
// const express = require('express');
// const compression = require('compression');
// const mongoose = require('mongoose');
// const session = require('express-session');
// const Food = require('./models/Meal');
// const MongoStore = require('connect-mongo');
// const cors = require('cors');
// const Restaurant = require('./models/Restaurant');
// const mobileRoutes = require('./routes/mobile');
// const orderRoutes = require('./routes/frontend/order');
// const expHbs = require('express-handlebars');
// const Handlebars = require('handlebars');
// const mealApiRoutes = require('./routes/api/meals');
// const deliveryRoutes = require('./routes/backend/delivery');
// const driverApiRouter = require("./routes/api/driver");
// const reportsRoutes = require("./routes/backend/reports");
// const mobileAuthRoutes = require("./routes/api/mobileAuth");

// // Helpers & Models actually used
// const distanceHelper = require('./utils/distance');

// // -------------------- Config -------------------- //
// const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/flamingosDB';
// const isProd = process.env.NODE_ENV === 'production';
// // ✅ ENVIRONMENT DIAGNOSTIC LOG (ADD HERE)
// console.log('ENV CHECK:', {
//   PORT,
//   NODE_ENV: process.env.NODE_ENV || 'not set',
//   DB: MONGODB_URI.includes('127.0.0.1') ? 'LOCAL DB' : 'REMOTE DB',
// });

// // -------------------- App Init -------------------- //
// const app = express();
// app.use(require('morgan')('dev'));

// if (isProd) app.set('trust proxy', 1); // secure cookies behind proxy
// app.use(cors());

// // -------------------- Security / Parsers / Static -------------------- //
// app.use(compression());
// app.use(express.json({ limit: '1mb' }));
// app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1d' : 0 }));
// app.use('/api/meals', mealApiRoutes);
// app.use("/api/driver", driverApiRouter);
// app.use("/api/mobile", mobileAuthRoutes);
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use('/delivery', deliveryRoutes);
// app.use("/reports", reportsRoutes);

// console.log('🔥 App.js loaded');

// // -------------------- Sessions (must precede handlers using req.session) -------------------- //
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || 'fallbackSecretKey',
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({ mongoUrl: MONGODB_URI, collectionName: 'sessions' }),
//     cookie: {
//       secure: isProd,
//       httpOnly: true,
//       sameSite: 'lax',
//       maxAge: 30 * 60 * 1000, // 30m
//     },
//   })
// );

// // Minimal cart/session bootstrap + template locals
// app.use((req, res, next) => {
//   req.session.cart ||= [];
//   const cart = req.session.cart;
//   res.locals.cartCount = cart.reduce((n, i) => n + (i.quantity || 0), 0);
//   res.locals.cartTotal = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
//   res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
//   next();
// });

// // -------------------- Health / Diagnostics (keep ABOVE catch-alls) -------------------- //
// app.get('/api/health', (_req, res) => res.json({ ok: true }));
// app.get('/api/ping', (_req, res) => res.type('text/plain').send('pong'));

// // -------------------- View Engine -------------------- //
// const hbs = expHbs.create({
//   extname: '.hbs',
//   defaultLayout: 'main',
//   layoutsDir: path.join(__dirname, 'views', 'layouts'),
//   partialsDir: path.join(__dirname, 'views', 'partials'),
//   handlebars: Handlebars,
//   runtimeOptions: {
//     allowProtoPropertiesByDefault: true,
//     allowProtoMethodsByDefault: true,
//   },
//   helpers: {
//     distance: distanceHelper,
//     includes: (arr, v) => Array.isArray(arr) && arr.includes(v?.toString?.()),
//     totalPrice: (meals) =>
//       Array.isArray(meals)
//         ? meals.reduce((sum, i) => sum + i.price * (i.quantity || 1), 0).toFixed(2)
//         : '0.00',
//     ifEquals: (a, b, opts) => (a == b ? opts.fn(this) : opts.inverse(this)),
//     json: (ctx) => JSON.stringify(ctx, null, 2),
//     stringify: (obj) => JSON.stringify(obj, null, 2),
//     encodeURI: (s) => encodeURIComponent(s ?? ''),
//     multiply: (a, b) => a * b,
//     eq: (a, b) => a === b,
//     array: (...args) => args.slice(0, -1),
//     or: (a, b) => a || b,
//     range: (from, to, opts) => {
//       let out = '';
//       for (let i = from; i < to; i++) out += opts.fn(i);
//       return out;
//     },
//     ifCond: function (v1, operator, v2, opts) {
//       switch (operator) {
//         case '==':
//           return v1 == v2 ? opts.fn(this) : opts.inverse(this);
//         case '<=':
//           return v1 <= v2 ? opts.fn(this) : opts.inverse(this);
//         default:
//           return opts.inverse(this);
//       }
//     },
//     slugify: (text) =>
//       typeof text === 'string' ? text.toLowerCase().replace(/\s+/g, '-') : '',
//   },
// });
// app.engine('hbs', hbs.engine);
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'hbs');

// // -------------------- Lightweight JSON API used by the app -------------------- //
// app.get('/api/meals', async (_req, res) => {
//   try {
//     const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || 'http://192.168.1.26:4000';

//     // Only offer meals OR all meals – choose what you prefer:
//     const foods = await Food.find({}).lean();                // all meals

//     const meals = foods.map((f) => ({
//       id: String(f._id),
//       name: f.name,
//       price: f.price,
//       image: f.image
//         ? (f.image.startsWith('http')
//             ? f.image
//             : `${BASE_PUBLIC_URL}${f.image}`)
//         : null,
//       restaurant: f.restaurant_en || f.restaurant_ar || '',
//       details: f.details || f.details_ar || '',
//       offer: !!f.offer,
//     }));

//     res.json(meals);
//   } catch (err) {
//     console.error('Error loading meals:', err);
//     res.status(500).json({ message: 'Failed to load meals' });
//   }
// });
// // ✅ Only meals with offer = true
// app.get('/api/meals/offers', async (_req, res) => {
//   try {
//     const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || 'http://192.168.1.26:4000';
//     const foods = await Food.find({ offer: true }).lean();

//     const meals = foods.map(f => ({
//       id: String(f._id),
//       name: f.name,
//       price: f.price,
//       image: f.image
//         ? (f.image.startsWith('http')
//             ? f.image
//             : `${BASE_PUBLIC_URL}${f.image}`)
//         : null,
//       restaurant: f.restaurant_en || f.restaurant_ar || '',
//       details: f.details || f.details_ar || '',
//       offer: !!f.offer,
//     }));

//     res.json(meals);
//   } catch (err) {
//     console.error('Error loading offer meals:', err);
//     res.status(500).json({ message: 'Failed to load offer meals' });
//   }
// });

// // -------------------- Restaurants API for mobile -------------------- //

// app.get('/api/restaurants', async (req, res) => {
//   try {
//     const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || 'http://192.168.1.26:4000';

//     const docs = await Restaurant.find({}).lean();

//     const restaurants = docs.map((r) => ({
//       id: String(r._id),
//       restaurant_en: r.restaurant_en || r.name_en || '',
//       restaurant_ar: r.restaurant_ar || r.name_ar || '',
//       logo: r.logo && r.logo.startsWith('http')
//         ? r.logo
//         : (r.logo ? `${BASE_PUBLIC_URL}${r.logo}` : null),
//       address: r.address || ''
//     }));

//     res.json(restaurants);
//   } catch (err) {
//     console.error('Error loading restaurants:', err);
//     res.status(500).json({ message: 'Failed to load restaurants' });
//   }
// });

// // GET /api/restaurants/:id → restaurant details
// app.get('/api/restaurants/:id', async (req, res) => {
//   try {
//     const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || 'http://192.168.1.26:4000';
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         message: 'Invalid restaurant id format',
//         idReceived: id,
//       });
//     }

//     const r = await Restaurant.findById(id).lean();
//     if (!r) {
//       return res.status(404).json({
//         message: 'Restaurant not found',
//         idRequested: id,
//       });
//     }

//     const restaurant = {
//       id: String(r._id),
//       restaurant_en: r.restaurant_en || r.name_en || '',
//       restaurant_ar: r.restaurant_ar || r.name_ar || '',
//       logo:
//         r.logo && r.logo.startsWith('http')
//           ? r.logo
//           : r.logo
//           ? `${BASE_PUBLIC_URL}${r.logo}`
//           : null,
//       address: r.address || '',
//     };

//     return res.json(restaurant);
//   } catch (err) {
//     console.error('Error loading restaurant details:', err);
//     return res.status(500).json({
//       message: 'Failed to load restaurant',
//       error: err.message,
//     });
//   }
// });

// app.get('/api/restaurants/:id/meals', async (req, res) => {
//   try {
//     const BASE_PUBLIC_URL = process.env.BASE_PUBLIC_URL || 'http://192.168.1.26:4000';
//     const { id } = req.params;

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         message: 'Invalid restaurant id format',
//         idReceived: id,
//       });
//     }

//     const r = await Restaurant.findById(id).lean();
//     if (!r) {
//       return res.status(404).json({
//         message: 'Restaurant not found',
//         idRequested: id,
//       });
//     }

//     const restaurantNameEn = r.restaurant_en || r.name_en || '';
//     const restaurantNameAr = r.restaurant_ar || r.name_ar || '';

//     const foundFoods = await Food.find({
//       $or: [
//         { restaurant_en: restaurantNameEn },
//         { restaurant_ar: restaurantNameAr },
//       ],
//     }).lean();

//     const mealsForApp = foundFoods.map((f) => ({
//       id: String(f._id),
//       name: f.name || "",
//       name_ar: f.name_ar || "",
//       price: f.price ?? 0,
//       details: f.details || f.details_ar || "",
//       offer: !!f.offer,
//       restaurant: f.restaurant_en || f.restaurant_ar || "",
//       image: f.image
//         ? (f.image.startsWith("http")
//             ? f.image
//             : `${BASE_PUBLIC_URL}${f.image}`)
//         : null,
//     }));

//     return res.json(mealsForApp);
//   } catch (err) {
//     console.error("Error getting restaurant meals:", err);
//     return res.status(500).json({
//       message: "Failed to load meals for restaurant",
//       error: err.message,
//     });
//   }
// });


// app.get('/api/meals/:id', async (req, res) => {
//   try {
//     const food = await Food.findById(req.params.id)
//       .populate('restaurant', 'name name_ar')
//       .lean();
//     if (!food) return res.status(404).json({ message: 'Not found' });
//     res.json({
//       id: String(food._id),
//       name: food.name,
//       name_ar: food.name_ar,
//       price: food.price,
//       image: food.image,
//       restaurant:
//         food.restaurant_en || food.restaurant?.name || food.restaurant_ar || '',
//       cuisine: food.cuisine || '',
//       details: food.details || '',
//       details_ar: food.details_ar || '',
//       offer: !!food.offer,
//       period: food.period ?? 0,
//       address: food.address || '',
//     });
//   } catch (e) {
//     res.status(500).json({ message: 'Failed to load meal', error: e.message });
//   }
// });

// app.post('/create-checkout-session', (req, res) => {
//   res.status(200).json({ ok: true, body: req.body });
// });

// // TEMP DEBUG to find which router is wrong
// const homeRoutes       = require('./routes/frontend/home');
// const childRoutes      = require('./routes/frontend/child');
// const sportRoutes      = require('./routes/frontend/sport');
// const sessionRoutes    = require('./routes/frontend/session');
// const cartRoutes       = require('./routes/frontend/cart');
// const restaurantRoutes = require('./routes/frontend/restaurant'); 
// const adminRoutes      = require('./routes/backend/admin');
// const foodRoutes       = require('./routes/backend/food');
// const favoritesRoutes  = require('./routes/backend/favorites');
// const dashboardRoutes  = require('./routes/backend/dashboard');
// const authRoutes       = require('./routes/backend/auth');

// app.use((req, res, next) => {
//   console.log('➡', req.method, req.url);
//   next();
// });

// app.use('/', homeRoutes);
// app.use('/', childRoutes);
// app.use('/', sportRoutes);
// app.use('/', sessionRoutes);
// app.use('/order', orderRoutes);
// app.use('/cart', cartRoutes);
// app.use('/', restaurantRoutes);   
// app.use('/mobile', mobileRoutes);

// // Backend
// app.use('/admin', adminRoutes);
// app.use('/food', foodRoutes);
// app.use('/favorites', favoritesRoutes);
// app.use('/dashboard', dashboardRoutes);
// app.use(authRoutes);

// // Simple pages
// app.get('/', (_req, res) => res.render('frontend/introduction', { hideLayoutParts: true }));
// app.get('/session', (req, res) => res.json(req.session));
// app.get('/search', (_req, res) => res.render('search'));
// app.get('/login', (_req, res) => res.render('frontend/login'));
// app.get('/edit', async (_req, res, next) => {
//   try {
//     const allFood = await Food.find();
//     res.render('edit-food', { food: allFood });
//   } catch (e) {
//     next(e);
//   }
// });
// app.get('/reset-cart', (req, res) => {
//   req.session.cart = [];
//   res.redirect('/cart/view');
// });

// // -------------------- MyFatoorah debug route -------------------- //
// app.get('/debug/payment-methods', async (req, res) => {
//   try {
//     const MF_API_URL = process.env.MF_API_URL || 'https://apitest.myfatoorah.com';
//     const MF_TOKEN   = process.env.MF_TOKEN;

//     console.log('🔧 /debug/payment-methods called');
//     console.log('🔑 MF_TOKEN present?', !!MF_TOKEN);
//     console.log('🌍 MF_API_URL =', MF_API_URL);

//     const body = {
//       InvoiceAmount: 10,
//       CurrencyIso: 'KWD',  // test account currency
//     };

//     const resp = await fetch(`${MF_API_URL}/v2/InitiatePayment`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${MF_TOKEN}`,
//       },
//       body: JSON.stringify(body),
//     });

//     const rawText = await resp.text();   // 👈 read as text first

//     console.log('📡 InitiatePayment HTTP status =', resp.status);
//     console.log('📡 InitiatePayment raw body   =', rawText);

//     let data = null;
//     if (rawText) {
//       try {
//         data = JSON.parse(rawText);
//       } catch (e) {
//         console.error('⚠️ JSON parse failed:', e.message);
//       }
//     }

//     // If MyFatoorah returned an error status, forward it to the browser
//     if (!resp.ok) {
//       return res.status(resp.status).json({
//         status: resp.status,
//         raw: rawText,
//         parsed: data,
//       });
//     }

//     // Success
//     return res.json(data);
//   } catch (e) {
//     console.error('❌ /debug/payment-methods error:', e);
//     return res.status(500).json({ error: e.message });
//   }
// });

// // -------------------- Start & Graceful Shutdown -------------------- //
// let server;
// (async () => {
//   try {
//     await mongoose.connect(MONGODB_URI, {
//       bufferCommands: false,
//       maxPoolSize: 10,
//       serverSelectionTimeoutMS: 10000,
//     });

//     console.log('Mongo connected');

//     server = app.listen(PORT, '0.0.0.0', () =>
//       console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
//     );
//     server.setMaxListeners(0);
//   } catch (err) {
//     console.error('❌ MongoDB connection failed:', err);
//     process.exit(1);
//   }
// })();

// const shutdown = async () => {
//   try {
//     if (server) await new Promise((res) => server.close(res));
//     await mongoose.connection.close();
//     console.log('✅ Closed gracefully');
//     process.exit(0);
//   } catch (e) {
//     console.error('❌ Error during shutdown', e);
//     process.exit(1);
//   }
// };
// // app.js or a debug route file
// app.get('/debug/payment-methods', async (req, res) => {
//   try {
//     const MF_API_URL = process.env.MF_API_URL || 'https://apitest.myfatoorah.com';
//     const MF_TOKEN   = process.env.MF_TOKEN;
//     const body = {
//       InvoiceAmount: 10,
//       CurrencyIso: 'QAR',   // or KWD / whatever your account uses
//     };

//     const resp = await fetch(`${MF_API_URL}/v2/InitiatePayment`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${MF_TOKEN}`,
//       },
//       body: JSON.stringify(body),
//     });

//     const data = await resp.json();
//     console.log('💳 PaymentMethods =', JSON.stringify(data, null, 2));
//     res.json(data);
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: e.message });
//   }
// });

// process.once('SIGTERM', shutdown);
// process.once('SIGINT', shutdown);
