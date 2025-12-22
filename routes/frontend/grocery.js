const express = require('express');
const router = express.Router();
const GroceryItem = require("../../models/GroceryItem");

router.get("/", async (req, res) => {
  try {
    const { supermarketId, category } = req.query;

    const filter = {};

    if (supermarketId) {
      filter.supermarketId = supermarketId;
    }

    if (category) {
      filter.category = category;
    }

    const items = await GroceryItem.find(filter).populate("supermarketId").lean();

    res.render("grocery-list", { items }); // or res.json(items) for API
  } catch (err) {
    console.error("❌ Error fetching groceries:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
