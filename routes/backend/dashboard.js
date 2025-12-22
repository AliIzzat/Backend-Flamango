const express = require('express');
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Food = require("../../models/Meal");
const Restaurant = require("../../models/Restaurant");
const Notification = require("../../models/Notification"); 
const connectDB = require('../../utils/db'); // ✅ ADD THIS
const { requireLogin, requireRole } = require('../../middleware/auth');

/* -----------------------------------------
   Multer Setup for File Uploads
----------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

router.get('/restaurant/add', (req, res) => {
  requireLogin,
  requireRole('admin', 'data_entry'),
  (req, res) => {
    res.render('restaurant-form');
  }});
router.post('/restaurant/add', 
  requireLogin,
  requireRole('admin', 'data_entry'),
  upload.single('logo'), 
  (req, res) => {
  console.log("✅ POST /restaurant/add route hit");
  console.log("🟢 req.body:", req.body);
  console.log("🖼️ req.file:", req.file);
  res.send("Form received with file upload");
});
/* -----------------------------------------
   POST: Add Food Item
----------------------------------------- */
router.post("/add-food", 
  requireLogin,
  requireRole('admin', 'data_entry'),
  upload.fields([
  { name: "image", maxCount: 1 },
  { name: "restaurantLogo", maxCount: 1 }
]), async (req, res) => {
  console.log("🔥 /add-food route triggered");
  try {
   await connectDB(); // ✅ WAIT FOR CONNECTION
    const {
      name, name_ar, price,
      restaurant_en, restaurant_ar,
      details, details_ar,
      address, cuisine, offer, period
    } = req.body;
    const image = req.files["image"]?.[0];
    const logo = req.files["restaurantLogo"]?.[0];
    const mealImagePath = image ? "/uploads/" + image.filename : "";
    const logoPath = logo ? "/uploads/" + logo.filename : "";
    // 🔍 Normalize input
    const normalized_en = restaurant_en?.trim().toLowerCase();
    const normalized_ar = restaurant_ar?.trim().toLowerCase();
    console.log("🔍 Checking if restaurant exists:", normalized_en);
    console.log("📨 Incoming form data:", req.body);
// 🔍 Case-insensitive check to avoid duplicates
    const existing = await Restaurant.findOne({
      restaurant_en: { $regex: new RegExp(`^${normalized_en}$`, 'i') }
    });
    console.log("📦 Found existing restaurant?", existing);
    if (!existing) {
      console.log("✅ Inserting new restaurant:", normalized_en);
      const newRestaurant = new Restaurant({
        restaurant_en:normalized_en,
        restaurant_ar: normalized_ar,
        address: address.trim(),
        logo: logoPath || ""
      });
      await newRestaurant.save();
      console.log("✅ New restaurant saved:", normalized_en);
    } else {
      console.log("🔎 Restaurant already exists:", normalized_en);
    }
// 🧠 Save the food, but keep original casing for display
    const newFood = new Food({
      name: name.trim(),
      name_ar: name_ar.trim(),
      price: parseFloat(price),
      restaurant_en: restaurant_en.trim(),
      restaurant_ar: restaurant_ar.trim(),
      details: details?.trim(),
      details_ar: details_ar?.trim(),
      address: address.trim(),
      cuisine: cuisine.trim(),
      offer: offer === "true",
      period: isNaN(parseInt(period)) ? 0 : parseInt(period),
      image: mealImagePath
    });
    await newFood.save();
    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ Error saving food or restaurant:", err);
    res.status(500).send("Failed to save");
  }
});
/* -----------------------------------------
   GET: Dashboard Page
----------------------------------------- */
router.get("/", requireLogin,
  requireRole('admin', 'support'),
  async (req, res) => {
  console.log("🔥 GET /dashboard route triggered"); 
  const notifications = await Notification.find({}).sort({ createdAt: -1 }).lean();
  try {
    const allFood = await Food.find().lean();
    const checkboxState = req.session.checkboxState || false;
     console.log("All food items:", allFood);
    req.session.checkboxState = null;
    res.render('backend/dashboard', {
      title: "Dashboard",
      foodItems: allFood,
      food: allFood,
      foods: allFood,
      meals: allFood,
      checkboxState,
      notifications
    });
  } catch (err) {
    console.error("❌ Error loading dashboard:", err);
    res.status(500).send("Server Error");
  }
});
/* -----------------------------------------
   POST: Edit Food Form
----------------------------------------- */
router.post("/edit/:id",requireLogin,
  requireRole('admin', 'data_entry'),
  upload.single("image"), 
  async (req, res) => {
  try {
    const foodId = req.params.id;
    const {
      name, name_ar, price,
      restaurant_en, restaurant_ar,
      details, details_ar,
      address, cuisine, offer, period
    } = req.body;

    const image = req.file;
    const mealImagePath = image ? "/uploads/" + image.filename : undefined;

    const updatedFields = {
      name: name.trim(),
      name_ar: name_ar.trim(),
      price: parseFloat(price),
      restaurant_en: restaurant_en.trim(),
      restaurant_ar: restaurant_ar.trim(),
      details: details?.trim(),
      details_ar: details_ar?.trim(),
      address: address.trim(),
      cuisine: cuisine.trim(),
      offer: offer === "true",
      period: isNaN(parseInt(period)) ? 0 : parseInt(period),
    };

    if (mealImagePath) {
      updatedFields.image = mealImagePath;
    }

    await Food.findByIdAndUpdate(foodId, updatedFields);
    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ Error updating food:", err);
    res.status(500).send("Error updating food");
  }
});

/* -----------------------------------------
   GET: Edit Food Form
----------------------------------------- */
router.get("/edit/:id",requireLogin,
  requireRole('admin', 'data_entry'),
   async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).lean();
    if (!food) return res.status(404).send("Food not found");
    res.render('frontend/edit-food', {
      title: "Edit Food",
      food,
    });
  } catch (err) {
    console.error("❌ Error loading edit form:", err);
    res.status(500).send("Error loading edit form");
  }
});
/* -----------------------------------------
   POST: Delete Food Item
----------------------------------------- */
router.post("/delete/:id", requireLogin,
  requireRole('admin'), 
  async (req, res) => {
  try {
    const food = await Food.findByIdAndDelete(req.params.id);
    if (!food) return res.status(404).send("Food item not found");

    if (food.image) {
      const imagePath = path.join(__dirname, "..", "public", food.image);
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Failed to delete image:", err);
        else console.log("🗑️ Image deleted:", imagePath);
      });
    }
    res.redirect("/dashboard");
  } catch (err) {
    console.error("❌ Failed to delete food:", err);
    res.status(500).send("Error deleting food");
  }
});
/* -----------------------------------------
   GET: Grouped Restaurant Menus
----------------------------------------- */
router.get("/restaurant-menu", requireLogin,
  requireRole('admin', 'support'),
  async (req, res) => {
  try {
    const meals = await Food.find().lean();

    const menuByRestaurant = {};
    meals.forEach((meal) => {
      const restaurantName = meal.restaurant_en?.trim() || "Unknown";
      if (!menuByRestaurant[restaurantName]) {
        menuByRestaurant[restaurantName] = [];
      }
      menuByRestaurant[restaurantName].push(meal);
    });
    res.render("restaurant-menu", { menuByRestaurant });
  } catch (err) {
    console.error("❌ Error loading menu:", err);
    res.status(500).send("Server error loading menu");
  }
});
/* -----------------------------------------
   No-op Middleware
----------------------------------------- */
module.exports = router;
