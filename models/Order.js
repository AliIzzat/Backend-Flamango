const mongoose = require('mongoose');
const OrderSchema = new mongoose.Schema({
  customerName: String,
  customerMobile: String,
  deliveryDetails: {
    city: String,
    street: String,
    building: String,
    aptNo: String,
    floor: String,
    zone: String,
    latitude: Number,
    longitude: Number,
  },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  mealItems: [
  {
    mealId: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number,
    quantity: Number
  }
],
totalAmount: {
  type: Number,
  required: true
},
coordinates: {
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number]
  }
},
  createdAt: {
    type: Date,
    default: Date.now
  },
status: {
  type: String,
  enum: ['Pending', 'Picked Up', 'Delivered'],
  default: 'Pending'
},
deliveryPersonId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},
deliveryPersonName: {
  type: String,
  default: ""
}
});
OrderSchema.index({ coordinates: '2dsphere' });

module.exports = mongoose.model('Order', OrderSchema);
