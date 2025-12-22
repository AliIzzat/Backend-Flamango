// routes/backend/admin.js
const express = require('express');
const router = express.Router();
const path = require("path");
const multer = require("multer");

const Food = require('../../models/Meal');
const Notification = require('../../models/Notification');

// NEW: generic auth helpers
const { requireLogin, requireRole } = require('../../middleware/auth');
// ---------------------------------------------
// Multer Configuration for Image Uploads
// ---------------------------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
// ---------------------------------------------
// ROUTES: Dashboard
// ---------------------------------------------
// Only logged-in users with role "admin" (or "support") can see dashboard
router.get(
  '/dashboard',
  requireLogin,
  requireRole('admin', 'support'),
  async (req, res) => {
    try {
      const notifications = await Notification.find()
        .sort({ createdAt: -1 })
        .lean();

      const foodItems = await Food.find({}).lean();

      res.render('dashboard', {
        layout: 'main',
        title: 'Dashboard',
        notifications,
        foodItems,
        userRole: req.session.userRole, // so you can show/hide buttons in view
      });
    } catch (err) {
      console.error('❌ Failed to load dashboard:', err.message);
      res.status(500).send('Error loading dashboard');
    }
  }
);
// ---------------------------------------------
// POST: Add new item to dashboard
// admin or data_entry can add items
// ---------------------------------------------
router.post(
  "/dashboard",
  requireLogin,
  requireRole('admin', 'data_entry'),
  upload.single("image"),
  async (req, res) => {
    const { name, price, restaurant, cuisine, offer, details, period } = req.body;
    if (!req.file) {
      return res.status(400).send("Image upload is required.");
    }
    const image = "/uploads/" + req.file.filename;
    try {
      await Food.create({
        name,
        price,
        restaurant,
        cuisine,
        image,
        offer: offer === true || offer === "on",
        details,
        period: parseInt(period) || 0,
      });
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Error saving item:", err);
      res.status(500).send("Error saving item");
    }
  }
);
// ---------------------------------------------
// ROUTES: Edit Item
// ---------------------------------------------
// GET: Edit form  (admin / data_entry)
router.get(
  "/dashboard/edit/:id",
  requireLogin,
  requireRole('admin', 'data_entry'),
  async (req, res) => {
    try {
      const item = await Food.findById(req.params.id).lean();
      if (!item) return res.status(404).send("Item not found");

      res.render("edit", { title: "Edit Item", item });
    } catch (err) {
      console.error("Error loading edit form:", err);
      res.status(500).send("Invalid ID or server error");
    }
  }
);
// POST: Submit edited item (admin / data_entry)
router.post(
  "/dashboard/edit/:id",
  requireLogin,
  requireRole('admin', 'data_entry'),
  async (req, res) => {
    const { name, price, restaurant, cuisine, offer, details, period, image } = req.body;

    const updateData = {
      name,
      price,
      restaurant,
      image,
      offer: offer === true || offer === "on",
      details,
      period: parseInt(period) || 0,
    };
    if (cuisine && cuisine.trim() !== "") {
      updateData.cuisine = cuisine;
    }
    try {
      await Food.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Update error:", err);
      res.status(500).send("Failed to update item.");
    }
  }
);
// ---------------------------------------------
// ROUTES: Delete Item
// ---------------------------------------------
// Only admin (or you can add 'data_entry' if you want)
router.post(
  "/dashboard/delete/:id",
  requireLogin,
  requireRole('admin'),
  async (req, res) => {
    try {
      await Food.findByIdAndDelete(req.params.id);
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).send("Error deleting item");
    }
  }
);
// ---------------------------------------------
// Export Router
// ---------------------------------------------
module.exports = router;

