// routes/api/driver.js
const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("../../models/User");
const Order = require("../../models/Order");
const Notification = require("../../models/Notification");

/**
 * Helpers
 */
function normalizeUsername(u) {
  return (u ?? "").toString().trim();
}

function isDriverRole(role) {
  // Backward-compatible: accept both values
  return ["driver", "delivery"].includes((role ?? "").toString().trim().toLowerCase());
}

// ---------------- TEMP DEBUG: check user exists ----------------
router.get("/debug/user/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

    if (!username) return res.status(400).json({ found: false, error: "MISSING_USERNAME" });

    const u = await User.findOne({ username }).lean();

    if (!u) return res.json({ found: false, username });

    return res.json({
      found: true,
      id: String(u._id),
      username: u.username,
      role: u.role,
      hasPassword: !!u.password,
    });
  } catch (e) {
    return res.status(500).json({ found: false, error: e.message });
  }
});

// ---------------- TEMP DEBUG: verify DB identity ----------------
router.get("/debug/db-info", async (_req, res) => {
  try {
    const info = {
      connected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      userCollection: User.collection.name,
      userCount: await User.countDocuments({}),
    };

    return res.json({ success: true, info });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ---------------- TEMP SEED: create a driver user ----------------
router.post("/seed-driver", async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = (req.body?.password ?? "").toString();
    const name = (req.body?.name ?? "").toString().trim();

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "username and password are required",
      });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.json({
        success: true,
        message: "User already exists",
        id: String(existing._id),
        username: existing.username,
        role: existing.role,
      });
    }

    // IMPORTANT: choose ONE role standard. We accept both at login.
    const user = await User.create({
      username,
      password, // NOTE: plain text; you should hash later
      name: name || username,
      role: "driver",
    });

    return res.json({
      success: true,
      message: "Driver created",
      id: String(user._id),
      username: user.username,
      role: user.role,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ---------------- LOGIN ----------------
router.post("/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = (req.body?.password ?? "").toString();

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "MISSING_USERNAME_OR_PASSWORD" });
    }

    const user = await User.findOne({ username });

    if (!user || !isDriverRole(user.role)) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials or not a driver" });
    }

    const match = password === user.password;
    if (!match) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      driverId: user._id,
      name: user.name || user.username,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error("❌ Driver login error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ---------------- AVAILABLE ORDERS ----------------
// GET: all pending orders for drivers
router.get("/available", async (_req, res) => {
  try {
    const orders = await Order.find({ status: "Pending" })
      .populate("restaurant")
      .lean();

    const formatted = orders.map((o) => {
      const d = o.deliveryDetails || {};

      const customerAddress = [
        d.city,
        d.zone ? `Zone ${d.zone}` : "",
        d.street ? `Street ${d.street}` : "",
        d.building ? `Bldg ${d.building}` : "",
        d.floor ? `Floor ${d.floor}` : "",
        d.aptNo ? `Apt ${d.aptNo}` : "",
        d.addressNote,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        _id: String(o._id),
        orderId: String(o._id),
        restaurantName:
          o.restaurant?.restaurant_en ||
          o.restaurant?.restaurant_ar ||
          "Unknown",
        mealName: "",
        totalAmount: o.totalAmount || o.total || 0,
        status: o.status,
        customerName: o.customerName || "Mobile Customer",
        customerPhone: o.customerMobile || "",
        customerAddress,
      };
    });

    return res.json({ success: true, orders: formatted });
  } catch (err) {
    console.error("❌ driver /available error:", err);
    return res
      .status(500)
      .json({ success: false, error: "FAILED_TO_LOAD_AVAILABLE_ORDERS" });
  }
});

// ---------------- MY ORDERS ----------------
// GET /api/driver/my-orders?driverId=.....
router.get("/my-orders", async (req, res) => {
  try {
    const driverId =
      req.query.driverId || req.body?.driverId || req.session?.userId;

    if (!driverId) {
      return res
        .status(400)
        .json({ success: false, error: "MISSING_DRIVER_ID" });
    }

    const orders = await Order.find({ deliveryPersonId: driverId })
      .populate("restaurant")
      .lean();

    const formatted = orders.map((o) => {
      const d = o.deliveryDetails || {};

      const customerAddress = [
        d.city,
        d.zone ? `Zone ${d.zone}` : "",
        d.street ? `Street ${d.street}` : "",
        d.building ? `Bldg ${d.building}` : "",
        d.floor ? `Floor ${d.floor}` : "",
        d.aptNo ? `Apt ${d.aptNo}` : "",
        d.addressNote,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        _id: String(o._id),
        orderId: String(o._id),
        restaurantName:
          o.restaurant?.restaurant_en ||
          o.restaurant?.restaurant_ar ||
          "Unknown",
        mealName: "",
        customerName: o.customerName || "Mobile Customer",
        customerPhone: o.customerMobile || "-",
        customerAddress,
        totalAmount: o.totalAmount || o.total || 0,
        status: o.status,
      };
    });

    return res.json({ success: true, orders: formatted });
  } catch (err) {
    console.error("❌ /api/driver/my-orders ERROR:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR" });
  }
});

// ---------------- CLAIM ORDER ----------------
// Support both /claim/:id and /claim/:orderId (mobile apps vary)
router.post("/claim/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const { driverId, driverName } = req.body || {};

    if (!driverId) {
      return res.status(400).json({ success: false, error: "MISSING_DRIVER_ID" });
    }

    const order = await Order.findOne({ _id: orderId, status: "Pending" });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "ORDER_NOT_FOUND_OR_ALREADY_CLAIMED",
      });
    }

    order.status = "Picked Up";
    order.deliveryPersonId = driverId;
    if (driverName) order.deliveryPersonName = driverName;

    await order.save();

    await Notification.findOneAndUpdate(
      { orderId: order._id },
      { status: "picked" },
      { new: true }
    );

    return res.json({
      success: true,
      orderId: String(order._id),
      newStatus: order.status,
      driverId,
      driverName: order.deliveryPersonName || null,
    });
  } catch (err) {
    console.error("❌ /api/driver/claim error:", err);
    return res.status(500).json({ success: false, error: "SERVER_ERROR_CLAIM" });
  }
});

module.exports = router;
