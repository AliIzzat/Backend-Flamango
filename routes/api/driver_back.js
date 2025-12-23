// routes/api/driver.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Order = require("../../models/Order");
const jwt = require("jsonwebtoken");
const Notification = require("../../models/Notification");
// temporary Rout
router.get("/debug/user/:username", async (req, res) => {
  try {
    const u = await User.findOne({ username: req.params.username }).lean();
    if (!u) return res.json({ found: false });

    res.json({
      found: true,
      id: String(u._id),
      username: u.username,
      role: u.role,
      hasPassword: !!u.password,
    });
  } catch (e) {
    res.status(500).json({ found: false, error: e.message });
  }
});
// End temporary Route

// ---------------- TEMP SEED: create a delivery driver ----------------
router.post("/seed-driver", async (req, res) => {
  try {
    const { username, password, name } = req.body;

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
        role: existing.role,
      });
    }

    const user = await User.create({
      username,
      password,
      name: name || username,
      role: "delivery",
    });

    return res.json({
      success: true,
      id: String(user._id),
      role: user.role,
      username: user.username,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || user.role !== "delivery") {
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

    // ✅ MUST respond with JSON, not res.send("<html>...")
    res.json({
      success: true,
      token,
      driverId: user._id,
      name: user.name || user.username,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    console.error("❌ Driver login error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});
// 🧾 helper to shape order object sent to the app
function serializeOrder(order) {
  return {
    id: order._id.toString(),
    restaurantName:
      order.restaurant?.restaurant_en ||
      order.restaurant?.restaurant_ar ||
      "Unknown",
    totalAmount: order.totalAmount ?? order.total ?? 0,
    status: order.status,
    // adjust these if your field names differ:
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    address: order.address || "",
  };
}

// 🔍 Extract restaurant + meal names from different shapes of an Order document
function getNamesFromOrder(o) {
  let restaurantName = "";
  let mealName = "";

  // 0) Try top-level fields first (some schemas store plain strings there)
  restaurantName =
    o.restaurantName ||
    o.restaurant_en ||
    o.restaurant_ar ||
    restaurantName;

  mealName =
    o.mealName ||
    o.meal ||
    mealName;

  // 1) Try populated restaurant doc
  if (o.restaurant) {
    restaurantName =
      restaurantName ||
      o.restaurant.restaurant_en ||
      o.restaurant.restaurant_ar ||
      o.restaurant.name ||
      o.restaurant.restaurantName ||
      "";
  }

  // 2) Try populated meals (e.g. mealIds populated)
  const mealsArray =
    (Array.isArray(o.mealIds) ? o.mealIds : null) ||
    (Array.isArray(o.meals) ? o.meals : null);

  const firstMeal = mealsArray && mealsArray.length > 0 ? mealsArray[0] : null;

  if (firstMeal) {
    mealName =
      mealName ||
      firstMeal.mealName ||
      firstMeal.meal_en ||
      firstMeal.name ||
      firstMeal.title ||
      "";

    if (!restaurantName) {
      restaurantName =
        firstMeal.restaurantName ||
        firstMeal.restaurant_en ||
        firstMeal.restaurant_ar ||
        "";
    }
  }

  // 3) Try embedded cart / items arrays (mobile/web carts)
  const possibleLists = [
    o.items,
    o.cartItems,
    o.cart,
    o.orderItems,
  ].filter((arr) => Array.isArray(arr) && arr.length > 0);

  const firstList = possibleLists.length > 0 ? possibleLists[0] : null;
  const firstItem = firstList ? firstList[0] : null;

  if (firstItem) {
    mealName =
      mealName ||
      firstItem.name ||
      firstItem.mealName ||
      firstItem.title ||
      firstItem.meal ||
      "";

    if (!restaurantName) {
      restaurantName =
        firstItem.restaurantName ||
        firstItem.restaurant_en ||
        firstItem.restaurant_ar ||
        firstItem.restaurant ||
        "";
    }
  }

  if (!restaurantName) restaurantName = "Unknown";
  if (!mealName) mealName = "";

  // Debug log if still unknown
  if (restaurantName === "Unknown") {
    console.log(
      "⚠️ Unknown restaurant for order",
      o._id,
      "keys:",
      Object.keys(o)
    );
  }

  return { restaurantName, mealName };
}


//  2) AVAILABLE ORDERS  ------------------------------
// GET: all pending orders for drivers
router.get("/available", async (req, res) => {
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
        mealName: "", // we’ll fill this later in a safe way
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

// GET /api/driver/my-orders?driverId=.....

router.get("/my-orders", async (req, res) => {
  try {
    console.log("📥 /api/driver/my-orders body =", req.body);
    console.log("📥 /api/driver/my-orders query =", req.query);
    console.log(
      "📥 /api/driver/my-orders session.userId =",
      req.session?.userId
    );

    const driverId =
      req.query.driverId || req.body.driverId || req.session?.userId;

    if (!driverId) {
      console.error("❌ MISSING_DRIVER_ID in /my-orders");
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
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR" });
  }
});



router.post("/claim/:id", async (req, res) => {
  try {
    const { driverId, driverName } = req.body;   
    const orderId = req.params.id;
    if (!driverId) {
      return res
        .status(400)
        .json({ success: false, error: "MISSING_DRIVER_ID" });
    }
    // Optional: small log to confirm what is coming
    console.log(" Claim request:", { orderId, driverId, driverName });
    const order = await Order.findOne({
      _id: orderId,
      status: "Pending",
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: "ORDER_NOT_FOUND_OR_ALREADY_CLAIMED",
      });
    }
    // Update order with driver info
    order.status = "Picked Up";
    order.deliveryPersonId = driverId;
    if (driverName) {
      order.deliveryPersonName = driverName;     
    }
    await order.save();
    // Sync notification
    await Notification.findOneAndUpdate(
      { orderId: order._id },
      { status: "picked" }
    );
    return res.json({
      success: true,
      orderId: order._id,
      newStatus: order.status,
      driverId,
      driverName: order.deliveryPersonName || null,
    });
  } catch (err) {
    console.error("❌ /api/driver/claim error:", err);
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR_CLAIM" });
  }
});
// TEMP: verify which DB + collection the API is using
router.get("/debug/db-info", async (req, res) => {
  try {
    const mongoose = require("mongoose");

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

module.exports = router;