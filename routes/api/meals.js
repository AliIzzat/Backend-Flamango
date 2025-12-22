// routes/api/meals.js
const express = require('express');
const router = express.Router();
const Meal = require('../../models/Meal');   // adjust path if your models folder is elsewhere
const Restaurant = require('../../models/Restaurant'); // optional, only if you populate

// GET /api/meals/offers  -> meals with offer = true
router.get('/offers', async (req, res) => {
  try {
    const meals = await Meal.find({ offer: true }).populate('restaurant'); // or whatever field you use
    res.json(meals);
  } catch (err) {
    console.error('❌ Error loading offer meals:', err);
    res.status(500).json({ message: 'Failed to load offer meals' });
  }
});

module.exports = router;
