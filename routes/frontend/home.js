//console.log("home.js");
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Food = require('../../models/Meal');
const Restaurant = require('../../models/Restaurant');

// Load JSON data
const groceries = require('../../data/groceries.json');
const childCareStores = require('../../data/childCareStores.json');
const pharmacies = require("../../data/pharmacies.json");
const flowerShops = require("../../data/flowerShops.json");
const nutrition = require("../../data/nutrition.json");
const electronics = require("../../data/electronics.json");

// Root route → loads introduction.hbs
router.get('/', (req, res) => {
  res.render('frontend/introduction', {
    layout: false,  // disable layout if you want only the intro page
    title: 'Welcome to Flamingo'
  });
});
// Root to load registration form

// ✅ Full-featured homepage

router.get("/home", async (req, res) => {
  //console.log("🟢 /home route triggered");

  try {
    const allMeals = await Food.find().limit(20).lean();
    const allRestaurants = await Restaurant.find().lean();
    const favorites = req.session.favorites || [];
   // console.log("inside home route triggered");
    const jsonPath = path.join(__dirname, "../../public/carousel/data.json");
    let carouselItems = [];
    if (fs.existsSync(jsonPath)) {
      const jsonData = await fs.promises.readFile(jsonPath, "utf-8");
      carouselItems = JSON.parse(jsonData);
    }
   // console.log(" rendering Meal");
    res.render('frontend/home', {
      allMeals,
      favorites, // ✅ Added here
      restaurants: allRestaurants,
      carouselItems,
      groceries,
      childCareStores,
      pharmacies,
      flowerShops,
      nutrition,
      electronics
    });
  } catch (err) {
    console.error("❌ Error in /home route:", err.message);
    res.status(500).send("Internal Server Error");
  }
});
//console.log("leaving rendering Meal");
module.exports = router;



