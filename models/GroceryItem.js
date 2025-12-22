const mongoose = require("mongoose");
const groceryItemSchema = new mongoose.Schema({
  name_en: {
    type: String,
    required: true,
    trim: true
  },
  name_ar: {
    type: String,
    required: true,
    trim: true
  },
  description_en: {
    type: String,
    default: "",
    trim: true
  },
  description_ar: {
    type: String,
    default: "",
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  offer: {
    type: Boolean,
    default: false
  },
  offerPrice: {
    type: Number,
    min: 0
  },
  image: {
    type: String,
    default: "/uploads/default.png"
  },
  category: {
    type: String,
    enum: [
      "Fruits", "Vegetables", "Dairy", "Meat", "Bakery",
      "Snacks", "Beverages", "Pantry", "Frozen", "Household"
    ],
    required: true
  },
  supermarketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supermarket",
    required: true
  },
  unit: {
    type: String,
    enum: ["kg", "gram", "liter", "piece", "pack", "box"],
    default: "piece"
  },
  stockQuantity: {
    type: Number,
    default: 100,
    min: 0
  },
  available: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
module.exports = mongoose.model("GroceryItem", groceryItemSchema);
