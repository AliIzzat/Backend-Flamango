// routes/api/driver.js
const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("../../models/User");
const Order = require("../../models/Order");
const Notification = require("../../models/Notification");

// ---------------- Helpers ----------------
function signToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

// ---------------- Debug: list routes ----------------
router.get("/debug/routes", (_req, res) => {
  const routes = router.stack
    .filter((l) => l.route)
    .map((l) => ({
      method: Object.keys(l.route.methods)[0].toUpperCase(),
      path: l.route.path,
    }));

  res.json({ routes });
});

// ---------------- Debug: which DB are we using ----------------
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

// ---------------- Debug: find user by username ----------------
router.get("/debug/user/:username", async (req, res) => {
  try {
    const username = String(req.params.username || "").trim();
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

// ---------------- TEMP SEED: create a driver ----------------
router.post("/seed-driver", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const name = String(req.body.name || username).trim();
    const role = String(req.body.role || "driver").trim(); // you can send "driver" from Postman

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, error: "username and password are required" });
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

    const user = await User.create({ username, password, name, role });

    return res.json({
      success: true,
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
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, error: "username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    // Accept both "driver" and "delivery" because you changed it previously
    if (user.role !== "driver" && user.role !== "delivery") {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials or not a driver" });
    }

    const match = password === user.password; // (later you should hash)
    if (!match) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid username or password" });
    }

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      driverId: String(user._id),
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
          o.restaurant?.restaurant_en || o.restaurant?.restaurant_ar || "Unknown",
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
// GET /api/driver/my-orders?driverId=xxxxx
router.get("/my-orders", async (req, res) => {
  try {
    const driverId = String(req.query.driverId || "").trim();

    if (!driverId) {
      return res
        .status(400)
        .json({ success: false, error: "MISSING_DRIVER_ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DRIVER_ID",
        driverId,
      });
    }

    // Adjust this field name if your Order schema uses a different one
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
          o.restaurant?.restaurant_en || o.restaurant?.restaurant_ar || "Unknown",
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- CLAIM ----------------
router.post("/claim/:id", async (req, res) => {
  try {
    const orderId = String(req.params.id || "").trim();
    const driverId = String(req.body.driverId || "").trim();
    const driverName = String(req.body.driverName || "").trim();

    if (!driverId) {
      return res
        .status(400)
        .json({ success: false, error: "MISSING_DRIVER_ID" });
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
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;




// // routes/api/driver.js
// const express = require("express");
// const router = express.Router();
// const driverAuth = require("../../middleware/driverAuth");

// const mongoose = require("mongoose");
// const jwt = require("jsonwebtoken");

// const User = require("../../models/User");
// const Order = require("../../models/Order");
// const Notification = require("../../models/Notification");

// /**
//  * Helpers
//  */
// function normalizeUsername(u) {
//   return (u ?? "").toString().trim();
// }

// function isDriverRole(role) {
//   // Backward-compatible: accept both values
//   return ["driver", "delivery"].includes((role ?? "").toString().trim().toLowerCase());
// }

// // ---------------- TEMP DEBUG: check user exists ----------------
// router.get("/debug/user/:username", async (req, res) => {
//   try {
//     const username = normalizeUsername(req.params.username);

//     if (!username) return res.status(400).json({ found: false, error: "MISSING_USERNAME" });

//     const u = await User.findOne({ username }).lean();

//     if (!u) return res.json({ found: false, username });

//     return res.json({
//       found: true,
//       id: String(u._id),
//       username: u.username,
//       role: u.role,
//       hasPassword: !!u.password,
//     });
//   } catch (e) {
//     return res.status(500).json({ found: false, error: e.message });
//   }
// });

// // ---------------- TEMP DEBUG: verify DB identity ----------------
// router.get("/debug/db-info", async (_req, res) => {
//   try {
//     const info = {
//       connected: mongoose.connection.readyState === 1,
//       dbName: mongoose.connection.name,
//       host: mongoose.connection.host,
//       port: mongoose.connection.port,
//       userCollection: User.collection.name,
//       userCount: await User.countDocuments({}),
//     };

//     return res.json({ success: true, info });
//   } catch (e) {
//     return res.status(500).json({ success: false, error: e.message });
//   }
// });

// // ---------------- TEMP SEED: create a driver user ----------------
// router.post("/seed-driver", async (req, res) => {
//   try {
//     const username = normalizeUsername(req.body?.username);
//     const password = (req.body?.password ?? "").toString();
//     const name = (req.body?.name ?? "").toString().trim();

//     if (!username || !password) {
//       return res.status(400).json({
//         success: false,
//         error: "username and password are required",
//       });
//     }

//     const existing = await User.findOne({ username });
//     if (existing) {
//       return res.json({
//         success: true,
//         message: "User already exists",
//         id: String(existing._id),
//         username: existing.username,
//         role: existing.role,
//       });
//     }

//     // IMPORTANT: choose ONE role standard. We accept both at login.
//     const user = await User.create({
//       username,
//       password, // NOTE: plain text; you should hash later
//       name: name || username,
//       role: "driver",
//     });

//     return res.json({
//       success: true,
//       message: "Driver created",
//       id: String(user._id),
//       username: user.username,
//       role: user.role,
//     });
//   } catch (e) {
//     return res.status(500).json({ success: false, error: e.message });
//   }
// });

// // ---------------- LOGIN ----------------
// router.post("/login", async (req, res) => {
//   try {
//     const username = normalizeUsername(req.body?.username);
//     const password = (req.body?.password ?? "").toString();

//     if (!username || !password) {
//       return res.status(400).json({ success: false, error: "MISSING_USERNAME_OR_PASSWORD" });
//     }

//     const user = await User.findOne({ username });

//     if (!user || !isDriverRole(user.role)) {
//       return res
//         .status(401)
//         .json({ success: false, error: "Invalid credentials or not a driver" });
//     }

//     const match = password === user.password;
//     if (!match) {
//       return res
//         .status(401)
//         .json({ success: false, error: "Invalid username or password" });
//     }

//     const token = jwt.sign(
//       { id: user._id, role: user.role },
//       process.env.JWT_SECRET || "dev-secret",
//       { expiresIn: "7d" }
//     );

//     return res.json({
//       success: true,
//       token,
//       driverId: user._id,
//       name: user.name || user.username,
//       username: user.username,
//       role: user.role,
//     });
//   } catch (err) {
//     console.error("❌ Driver login error:", err);
//     return res.status(500).json({ success: false, error: "Server error" });
//   }
// });

// // ---------------- AVAILABLE ORDERS ----------------
// // GET: all pending orders for drivers
// router.get("/available", async (_req, res) => {
//   try {
//     const orders = await Order.find({ status: "Pending" })
//       .populate("restaurant")
//       .lean();

//     const formatted = orders.map((o) => {
//       const d = o.deliveryDetails || {};

//       const customerAddress = [
//         d.city,
//         d.zone ? `Zone ${d.zone}` : "",
//         d.street ? `Street ${d.street}` : "",
//         d.building ? `Bldg ${d.building}` : "",
//         d.floor ? `Floor ${d.floor}` : "",
//         d.aptNo ? `Apt ${d.aptNo}` : "",
//         d.addressNote,
//       ]
//         .filter(Boolean)
//         .join(", ");

//       return {
//         _id: String(o._id),
//         orderId: String(o._id),
//         restaurantName:
//           o.restaurant?.restaurant_en ||
//           o.restaurant?.restaurant_ar ||
//           "Unknown",
//         mealName: "",
//         totalAmount: o.totalAmount || o.total || 0,
//         status: o.status,
//         customerName: o.customerName || "Mobile Customer",
//         customerPhone: o.customerMobile || "",
//         customerAddress,
//       };
//     });

//     return res.json({ success: true, orders: formatted });
//   } catch (err) {
//     console.error("❌ driver /available error:", err);
//     return res
//       .status(500)
//       .json({ success: false, error: "FAILED_TO_LOAD_AVAILABLE_ORDERS" });
//   }
// });

// // ---------------- MY ORDERS ----------------
// // GET /api/driver/my-orders?driverId=.....
// router.get("/my-orders", driverAuth, async (req, res) => {
//   try {
//     const driverId = req.user?.id;
//     if (!driverId) {
//       return res.status(400).json({ success: false, error: "MISSING_DRIVER_ID" });
//     }

//     // IMPORTANT: adjust these fields to match your Order schema
//     const orders = await Order.find({ driver: driverId }).sort({ createdAt: -1 }).lean();

//     return res.json({ success: true, orders });
//   } catch (e) {
//     return res.status(500).json({ success: false, error: e.message });
//   }

//   return res.json({ success: true, orders: formatted });
//   } catch (err) {
//     console.error("❌ /api/driver/my-orders ERROR:", err);
//     return res.status(500).json({ success: false, error: "SERVER_ERROR" });
//   }
// );

// // ---------------- CLAIM ORDER ----------------
// // Support both /claim/:id and /claim/:orderId (mobile apps vary)
// router.post("/claim/:id", async (req, res) => {
//   try {
//     const orderId = req.params.id;
//     const { driverId, driverName } = req.body || {};

//     if (!driverId) {
//       return res.status(400).json({ success: false, error: "MISSING_DRIVER_ID" });
//     }

//     const order = await Order.findOne({ _id: orderId, status: "Pending" });
//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         error: "ORDER_NOT_FOUND_OR_ALREADY_CLAIMED",
//       });
//     }

//     order.status = "Picked Up";
//     order.deliveryPersonId = driverId;
//     if (driverName) order.deliveryPersonName = driverName;

//     await order.save();

//     await Notification.findOneAndUpdate(
//       { orderId: order._id },
//       { status: "picked" },
//       { new: true }
//     );

//     return res.json({
//       success: true,
//       orderId: String(order._id),
//       newStatus: order.status,
//       driverId,
//       driverName: order.deliveryPersonName || null,
//     });
//   } catch (err) {
//     console.error("❌ /api/driver/claim error:", err);
//     return res.status(500).json({ success: false, error: "SERVER_ERROR_CLAIM" });
//   }
// });
// router.get("/debug/routes", (req, res) => {
//   const routes = router.stack
//     .filter((l) => l.route)
//     .map((l) => ({
//       method: Object.keys(l.route.methods)[0].toUpperCase(),
//       path: l.route.path,
//     }));

//   res.json({ routes });
// });

// module.exports = router;
