const express = require('express');
const router = express.Router();
const Food = require('../../models/Meal');
const Restaurant = require('../../models/Restaurant');
// const connectDB = require('../../utils/db'); // ✅ DB connection function

// ✅ ROUTE 1: Show all restaurants (cards list)
router.get('/restaurant', async (req, res) => {
  try {
    const restaurants = await Restaurant.find().lean();

    res.render('frontend/restaurant', {
      restaurants,
      cart: req.session.cart || [],
    });
  } catch (err) {
    console.error('❌ Error fetching restaurants:', err);
    res.status(500).render('frontend/500', { message: 'Server Error' });
  }
});

// ✅ ROUTE 2: View menu of a restaurant by name
router.get('/restaurant/:restaurantName', async (req, res) => {
  const restaurantName = decodeURIComponent(req.params.restaurantName).trim();

  try {
    const meals = await Food.find({
      restaurant_en: { $regex: new RegExp(`^${restaurantName}$`, 'i') },
    }).lean();

    if (!meals.length) {
      return res
        .status(404)
        .render('frontend/404', { url: req.originalUrl, cart: req.session.cart || [] });
    }

    const { address, restaurant_ar, logo } = meals[0];

    // make sure restaurant exists in Restaurant collection
    const existing = await Restaurant.findOne({
      restaurant_en: { $regex: new RegExp(`^${restaurantName}$`, 'i') },
    });

    if (!existing) {
      const newRestaurant = new Restaurant({
        restaurant_en: restaurantName,
        restaurant_ar: restaurant_ar || '',
        address: address || '',
        logo: logo || '',
      });
      await newRestaurant.save();
    }

    res.render('frontend/restaurant-menu', {
      restaurantName,
      restaurantAddress: address || 'Not available',
      meals,
      hideFooter: true,
      cart: req.session.cart || [],
    });
  } catch (err) {
    console.error('❌ Error in /restaurant/:restaurantName:', err);
    res.status(500).render('frontend/500', { message: 'Server error' });
  }
});

// ✅ ROUTE 3: Save restaurant manually
router.post('/save', async (req, res) => {
  let { restaurant_en, restaurant_ar, address, logo } = req.body;
  restaurant_en = restaurant_en?.trim().toLowerCase();
  restaurant_ar = restaurant_ar?.trim().toLowerCase();

  try {
    const exists = await Restaurant.findOne({
      restaurant_en: { $regex: new RegExp('^' + restaurant_en + '$', 'i') },
      restaurant_ar: { $regex: new RegExp('^' + restaurant_ar + '$', 'i') },
    });

    if (exists) {
      return res.status(200).json({ message: 'Restaurant already exists' });
    }

    const newRestaurant = new Restaurant({ restaurant_en, restaurant_ar, address, logo });
    await newRestaurant.save();

    res.status(201).json({ message: 'Restaurant saved successfully' });
  } catch (err) {
    console.error('❌ Failed to save restaurant:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;