// routes/backend/reports.js  (example file)
const express = require("express");
const router = express.Router();

const Order = require("../../models/Order");
const { isAdmin } = require("../../middleware/auth"); // if you want only admin

// 🧾 GET: show meals grouped by driver
  router.get("/driver-meals", async (req, res) => {
  try {
    // 1) Get only orders that have been assigned to a driver
    //    You can also filter by status: Delivered only, etc.
    const orders = await Order.find({
      deliveryPersonId: { $ne: null }, // only assigned
      // status: "Delivered"           // uncomment if you want delivered only
    })
      .populate("deliveryPersonId", "username role") // get driver info
      .lean();

    // 2) Group meals by driver
    const map = {}; // { driverId: { driverName, orders: [...] } }

    orders.forEach((order) => {
      const drv = order.deliveryPersonId;
      const driverId = drv ? String(drv._id) : "UNASSIGNED";
      const driverName = drv ? drv.username : "Unassigned";

      if (!map[driverId]) {
        map[driverId] = {
          driverId,
          driverName,
          orders: [],
        };
      }

      // For each meal item in the order, push a row
      (order.mealItems || []).forEach((item) => {
        map[driverId].orders.push({
          orderId: order._id,
          status: order.status,
          createdAt: order.createdAt,
          customerName: order.customerName,
          customerMobile: order.customerMobile,
          customerAddress:
            order.deliveryDetails &&
            [
              order.deliveryDetails.city,
              order.deliveryDetails.zone
                ? `Zone ${order.deliveryDetails.zone}`
                : "",
              order.deliveryDetails.street
                ? `Street ${order.deliveryDetails.street}`
                : "",
              order.deliveryDetails.building
                ? `Bldg ${order.deliveryDetails.building}`
                : "",
              order.deliveryDetails.aptNo
                ? `Apt ${order.deliveryDetails.aptNo}`
                : "",
            ]
              .filter(Boolean)
              .join(", "),
          mealName: item.name,
          quantity: item.quantity,
          price: item.price,
          lineTotal: (item.price || 0) * (item.quantity || 0),
          totalAmount: order.totalAmount,
        });
      });
    });

    // 3) Convert map → array for Handlebars
    const drivers = Object.values(map);

    res.render("backend/driver-meals-report", {
      layout: false,              // 👈 add this line
      title: "Meals per Driver",
      drivers,
    });
  } catch (err) {
    console.error("❌ Error in /backend/driver-meals:", err);
    res.status(500).send("Server error generating driver meals report");
  }
});

module.exports = router;
