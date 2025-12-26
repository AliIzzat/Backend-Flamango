const express = require("express");
const router = express.Router();
const pool = require("../../utils/pg");

function isUuid(v) {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function publicUrl(req) {
  // Prefer env for production image absolute paths
  return (
    process.env.BASE_PUBLIC_URL ||
    process.env.API_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    `${req.protocol}://${req.get("host")}`
  );
}

function normalizeImage(base, imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;

  // If stored like "/uploads/x.jpg" or "/public/..", keep it relative-to-host
  if (imageUrl.startsWith("/")) return `${base}${imageUrl}`;
  return `${base}/${imageUrl}`;
}

/**
 * GET /api/meals
 * Reads from postgres "meals" + left join "restaurants"
 */
router.get("/meals", async (req, res) => {
  try {
    const base = publicUrl(req);

    const q = `
      SELECT
        m.id,
        m.name_en,
        m.name_ar,
        m.price,
        m.offer,
        m.period,
        m.image_url,
        m.details_en,
        m.details_ar,
        r.name_en AS restaurant_en,
        r.name_ar AS restaurant_ar
      FROM meals m
      LEFT JOIN restaurants r ON r.id = m.restaurant_id
      ORDER BY m.created_at DESC
    `;

    const { rows } = await pool.query(q);

    const meals = rows.map((r) => ({
      id: r.id,
      name: r.name_en || r.name_ar || "",
      name_ar: r.name_ar || "",
      price: Number(r.price ?? 0),
      image: normalizeImage(base, r.image_url),
      restaurant: r.restaurant_en || r.restaurant_ar || "",
      details: r.details_en || r.details_ar || "",
      offer: !!r.offer,
      period: Number(r.period ?? 0),
    }));

    return res.json(meals);
  } catch (err) {
    console.error("❌ PG /api/meals error:", err);
    return res.status(500).json({ message: "Failed to load meals" });
  }
});

/**
 * GET /api/meals/offers
 */
router.get("/meals/offers", async (req, res) => {
  try {
    const base = publicUrl(req);

    const q = `
      SELECT
        m.id,
        m.name_en,
        m.name_ar,
        m.price,
        m.offer,
        m.period,
        m.image_url,
        m.details_en,
        m.details_ar,
        r.name_en AS restaurant_en,
        r.name_ar AS restaurant_ar
      FROM meals m
      LEFT JOIN restaurants r ON r.id = m.restaurant_id
      WHERE m.offer = true
      ORDER BY m.created_at DESC
    `;

    const { rows } = await pool.query(q);

    const meals = rows.map((r) => ({
      id: r.id,
      name: r.name_en || r.name_ar || "",
      name_ar: r.name_ar || "",
      price: Number(r.price ?? 0),
      image: normalizeImage(base, r.image_url),
      restaurant: r.restaurant_en || r.restaurant_ar || "",
      details: r.details_en || r.details_ar || "",
      offer: true,
      period: Number(r.period ?? 0),
    }));

    return res.json(meals);
  } catch (err) {
    console.error("❌ PG /api/meals/offers error:", err);
    return res.status(500).json({ message: "Failed to load offer meals" });
  }
});

/**
 * GET /api/meals/:id
 */
router.get("/meals/:id", async (req, res) => {
  try {
    const base = publicUrl(req);
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid meal id format", idReceived: id });
    }

    const q = `
      SELECT
        m.id,
        m.name_en,
        m.name_ar,
        m.price,
        m.offer,
        m.period,
        m.image_url,
        m.details_en,
        m.details_ar,
        r.id AS restaurant_id,
        r.name_en AS restaurant_en,
        r.name_ar AS restaurant_ar
      FROM meals m
      LEFT JOIN restaurants r ON r.id = m.restaurant_id
      WHERE m.id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Not found" });

    const r = rows[0];

    return res.json({
      id: r.id,
      name: r.name_en || r.name_ar || "",
      name_ar: r.name_ar || "",
      price: Number(r.price ?? 0),
      image: normalizeImage(base, r.image_url),
      restaurant: r.restaurant_en || r.restaurant_ar || "",
      restaurantId: r.restaurant_id || null,
      details: r.details_en || "",
      details_ar: r.details_ar || "",
      offer: !!r.offer,
      period: Number(r.period ?? 0),
    });
  } catch (err) {
    console.error("❌ PG /api/meals/:id error:", err);
    return res.status(500).json({ message: "Failed to load meal" });
  }
});

/**
 * GET /api/restaurants
 */
router.get("/restaurants", async (req, res) => {
  try {
    const base = publicUrl(req);

    const q = `
      SELECT id, name_en, name_ar, address, logo_url
      FROM restaurants
      ORDER BY created_at DESC
    `;

    const { rows } = await pool.query(q);

    const restaurants = rows.map((r) => ({
      id: r.id,
      restaurant_en: r.name_en || "",
      restaurant_ar: r.name_ar || "",
      logo: normalizeImage(base, r.logo_url),
      address: r.address || "",
    }));

    return res.json(restaurants);
  } catch (err) {
    console.error("❌ PG /api/restaurants error:", err);
    return res.status(500).json({ message: "Failed to load restaurants" });
  }
});

/**
 * GET /api/restaurants/:id
 */
router.get("/restaurants/:id", async (req, res) => {
  try {
    const base = publicUrl(req);
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid restaurant id format", idReceived: id });
    }

    const q = `
      SELECT id, name_en, name_ar, address, logo_url
      FROM restaurants
      WHERE id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Restaurant not found" });

    const r = rows[0];
    return res.json({
      id: r.id,
      restaurant_en: r.name_en || "",
      restaurant_ar: r.name_ar || "",
      logo: normalizeImage(base, r.logo_url),
      address: r.address || "",
    });
  } catch (err) {
    console.error("❌ PG /api/restaurants/:id error:", err);
    return res.status(500).json({ message: "Failed to load restaurant" });
  }
});

/**
 * GET /api/restaurants/:id/meals
 */
router.get("/restaurants/:id/meals", async (req, res) => {
  try {
    const base = publicUrl(req);
    const { id } = req.params;

    if (!isUuid(id)) {
      return res.status(400).json({ message: "Invalid restaurant id format", idReceived: id });
    }

    const q = `
      SELECT
        m.id, m.name_en, m.name_ar, m.price, m.offer, m.period, m.image_url, m.details_en, m.details_ar,
        r.name_en AS restaurant_en, r.name_ar AS restaurant_ar
      FROM meals m
      JOIN restaurants r ON r.id = m.restaurant_id
      WHERE r.id = $1
      ORDER BY m.created_at DESC
    `;

    const { rows } = await pool.query(q, [id]);

    const meals = rows.map((r) => ({
      id: r.id,
      name: r.name_en || r.name_ar || "",
      name_ar: r.name_ar || "",
      price: Number(r.price ?? 0),
      details: r.details_en || r.details_ar || "",
      offer: !!r.offer,
      period: Number(r.period ?? 0),
      restaurant: r.restaurant_en || r.restaurant_ar || "",
      image: normalizeImage(base, r.image_url),
    }));

    return res.json(meals);
  } catch (err) {
    console.error("❌ PG /api/restaurants/:id/meals error:", err);
    return res.status(500).json({ message: "Failed to load meals for restaurant" });
  }
});

module.exports = router;
