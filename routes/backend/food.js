// C:\Flamangos\routes\backend\food.js
const express = require('express');
const router = express.Router();

const Food = require('../../models/Meal');
const Order = require('../../models/Order');   // ✅ Make sure this file exists
const multer = require('multer');

const upload = multer();

/**
 * @desc    Render the edit form for a specific food item (backend)
 */
router.get('/edit/:id', async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).lean();
    if (!food) return res.status(404).send('Food item not found');

    // If you really have it under views/frontend/edit-food.hbs, keep this:
    res.render('frontend/edit-food', { food });
  } catch (err) {
    console.error('Error loading food edit form:', err);
    res.status(500).send('Server error');
  }
});

/**
 * @desc    Return all meals as JSON (for mobile or frontend apps)
 */
router.get('/api/meals', async (req, res) => {
  try {
    const BASE_PUBLIC_URL =
      process.env.BASE_PUBLIC_URL || 'http://192.168.1.11:4000';

    const docs = await Food.find({}).lean();

    const meals = docs.map(f => ({
      id: String(f._id),
      name: f.name,
      price: f.price,
      image: f.image
        ? (f.image.startsWith('http')
            ? f.image
            : `${BASE_PUBLIC_URL}${f.image}`)
        : null,
      restaurant: f.restaurant_en || f.restaurant_ar || '',
      details: f.details || f.details_ar || '',
      offer: !!f.offer,
    }));

    res.json(meals);
  } catch (err) {
    console.error('❌ Failed to fetch meals:', err);
    res.status(500).json({ error: 'Failed to load meals' });
  }
});

/**
 * @desc    Save a simple order (example endpoint)
 */
// C:\Flamangos\routes\backend\food.js

router.post('/api/orders', async (req, res) => {
  try {
    const {
      // 🛒 cart
      items,          // array of { mealId, name, price, quantity }
      total,          // total amount
      // 👤 customer
      customerName,
      customerMobile,
      // 📍 address details coming from mobile app
      city,
      street,
      building,
      floor,
      zone,
      aptNo,
      addressNote,
      latitude,
      longitude,
    } = req.body;

    // (optional) validate here…
    const newOrder = new Order({
      customerName: customerName || 'Mobile Customer',
      customerMobile: customerMobile || '',

      // 🏠 store full deliveryDetails object exactly like schema
      deliveryDetails: {
        city: city || '',
        street: street || '',
        building: building || '',
        aptNo: aptNo || '',
        floor: floor || '',
        zone: zone || '',
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      },

      // 🧾 items + total
      mealItems: items || [],
      totalAmount: Number(total) || 0,

      // 🌍 coordinates field (GeoJSON)
      coordinates: {
        type: 'Point',
        coordinates: [
          longitude ? Number(longitude) : 0, // lng
          latitude ? Number(latitude) : 0,   // lat
        ],
      },

      status: 'Pending',
      createdAt: new Date(),
    });

    await newOrder.save();

    return res.status(201).json({
      success: true,
      message: 'Order saved',
      orderId: newOrder._id,
    });
  } catch (err) {
    console.error('❌ Order save error:', err);
    res.status(500).json({ success: false, error: 'FAILED_TO_SAVE_ORDER' });
  }
});

module.exports = router;
