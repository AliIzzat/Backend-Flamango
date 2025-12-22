// routes/home.js or wherever your home route is defined
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ⬇️ GET route for home page
router.get('/', (req, res) => {
  const jsonPath = path.join(__dirname, '../public/carousel/data.json');

  // Read carousel items from JSON file
  let carouselItems = [];
  try {
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    carouselItems = JSON.parse(jsonData);
  } catch (err) {
    console.error('❌ Failed to load carousel data:', err);
  }

  // Render 'home' view with carousel data
  res.render('frontend/home', {
    carouselItems
  });
});

module.exports = router;
