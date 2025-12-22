//Customer name and address...
const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  city: String,
  street: String,
  building: String,
  floor: String,
  zone: String,
  aptNo: String,
  addressNote: String,
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  createdAt: { type: Date, default: Date.now }
});
// Geospatial index for proximity queries
customerSchema.index({ coordinates: "2dsphere" });

module.exports = mongoose.model('Customer', customerSchema);
