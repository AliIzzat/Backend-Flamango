const express = require("express");
const router = express.Router();
const Restaurant = require("../../models/Restaurant");

// GET /api/restaurants
router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.json({ success: true, restaurants });
  } catch (err) {
    console.error("Failed to load restaurants:", err);
    res.status(500).json({ success: false, message: "Failed to load restaurants" });
  }
});

// Optional: GET /api/restaurants/offers
router.get("/offers", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ offer: true });
    res.json({ success: true, restaurants });
  } catch (err) {
    console.error("Failed to load restaurant offers:", err);
    res.status(500).json({ success: false, message: "Failed to load restaurant offers" });
  }
});

module.exports = router;
