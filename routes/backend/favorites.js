const express = require('express');
const router = express.Router();
const Food = require("../../models/Meal");
// ------------------------------
// TOGGLE FAVORITE
// ------------------------------
router.post("/toggle", express.urlencoded({ extended: true }), (req, res) => {
  const foodId = req.body.mealId;
//  console.log("foodId",foodId);
  req.session.favorites = req.session.favorites || [];
  const index = req.session.favorites.indexOf(foodId);
  if (index === -1) {
    req.session.favorites.push(foodId);
  } else {
    req.session.favorites.splice(index, 1);
  }
  // ✅ Ensure no duplicates
  req.session.favorites = [...new Set(req.session.favorites)];
  res.status(200).json({ success: true });
});
// ------------------------------
// LIST FAVORITES
// ------------------------------
router.get("/list", async (req, res) => {
  const favoriteIds = req.session.favorites || [];
  let favoriteFoods = [];
  if (favoriteIds.length > 0) {
    try {
      favoriteFoods = await Food.find({ _id: { $in: favoriteIds } }).lean();
    } catch (err) {
      console.error("❌ Error fetching favorite foods:", err);
      return res.status(500).send("Error loading favorites");
    }
  }
  res.render("favorite-list", { foods: favoriteFoods });
});
module.exports = router;
