const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  restaurant_en: String,
  restaurant_ar: String,
  address: String,
  logo: String,
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number, Number], //[Number], 
      required: true
    }
  }
});
restaurantSchema.index({ coordinates: '2dsphere' }); // Optional: for geospatial queries
module.exports = mongoose.model('Restaurant', restaurantSchema);
