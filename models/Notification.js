const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
  message: String,
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  status: { type: String, enum: ['unpicked', 'picked', 'delivered'], default: 'unpicked' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Notification', notificationSchema);

