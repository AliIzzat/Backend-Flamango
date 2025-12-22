// routes/backend/delivery.js
const express = require('express');
const router = express.Router();

const Order = require('../../models/Order');
const Notification = require('../../models/Notification');

// 🔒 Use the shared auth helpers
const { requireLogin, requireRole } = require('../../middleware/auth');

/**
 * All routes below:
 *  - user must be logged in (requireLogin)
 *  - userRole must be "delivery" (requireRole('delivery'))
 */

// ✅ View unclaimed orders
router.get('/available',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    try {
      const orders = await Order.find({ status: 'Pending' })
        .populate('restaurant') // keep this
        .lean();

      res.render('backend/delivery-available', {
        orders,
        userRole: req.session.userRole, // if you want to show role in template
      });
    } catch (err) {
      console.error('❌ Error loading available orders:', err);
      res.status(500).send('Server Error');
    }
  }
);

// ✅ View assigned orders
router.get(
  '/my-orders',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    try {
      const userId = req.session.userId;

      const orders = await Order.find({ deliveryPersonId: userId })
        .populate('restaurant')
        .lean();

      // Add clean coordinate aliases for Handlebars / views
      orders.forEach((order) => {
        if (order.restaurant?.coordinates?.coordinates) {
          order.restaurantLat = order.restaurant.coordinates.coordinates[1]; // lat
          order.restaurantLng = order.restaurant.coordinates.coordinates[0]; // lng
        }
        if (order.coordinates?.coordinates) {
          order.customerLat = order.coordinates.coordinates[1]; // lat
          order.customerLng = order.coordinates.coordinates[0]; // lng
        }
      });

      res.render('delivery-my-orders', {
        orders,
        userRole: req.session.userRole,
      });
    } catch (err) {
      console.error('❌ Error loading driver orders:', err);
      res.status(500).send('Server Error');
    }
  }
);

// ✅ Claim order
router.post(
  '/claim/:id',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    const orderId = req.params.id;
    const deliveryPersonId = req.session.userId;

    try {
      const order = await Order.findOne({ _id: orderId, status: 'Pending' });
      if (!order) return res.status(404).send('Order already claimed');

      order.status = 'Picked Up';
      order.deliveryPersonId = deliveryPersonId;
      await order.save();

      await Notification.findOneAndUpdate(
        { orderId: order._id },
        { status: 'picked' }
      );

      res.redirect('/delivery/my-orders');
    } catch (err) {
      console.error('❌ Error claiming order:', err);
      res.status(500).send('Server Error');
    }
  }
);

// ✅ Update status
router.post(
  '/update-status/:id',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    const orderId = req.params.id;
    const { newStatus } = req.body;
    const userId = req.session.userId;

    try {
      const order = await Order.findOne({
        _id: orderId,
        deliveryPersonId: userId,
      });
      if (!order) return res.status(403).send('Unauthorized');

      // Strict valid transitions
      const validTransitions = {
        Pending: ['Picked Up'],
        'Picked Up': ['Delivered'],
      };

      if (!validTransitions[order.status]?.includes(newStatus)) {
        return res.status(400).send('Invalid status transition');
      }

      order.status = newStatus;
      await order.save();

      // Update notification status accordingly
      const statusMap = {
        'Picked Up': 'picked',
        Delivered: 'delivered',
      };

      const newNotificationStatus = statusMap[newStatus];
      if (newNotificationStatus) {
        await Notification.findOneAndUpdate(
          { orderId: order._id },
          { status: newNotificationStatus }
        );
      }

      res.redirect('/delivery/my-orders');
    } catch (err) {
      console.error('❌ Error updating status:', err);
      res.status(500).send('Internal server error');
    }
  }
);

/* ===================================================================
   🚚 JSON API for driver app / driver screen (MOBILE OR WEB)
   =================================================================== */

// 🔹 Get all available orders (JSON)
router.get(
  '/api/available',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    try {
      const orders = await Order.find({ status: 'Pending' })
        .populate('restaurant')
        .lean();

      res.json({
        success: true,
        orders,
      });
    } catch (err) {
      console.error('❌ Error loading available orders (API):', err);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }
);

// 🔹 Get orders assigned to this driver (JSON)
router.get(
  '/api/my-orders',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    try {
      const userId = req.session.userId;

      const orders = await Order.find({ deliveryPersonId: userId })
        .populate('restaurant')
        .lean();

      // Add coordinate aliases for API too (optional, but useful)
      orders.forEach((order) => {
        if (order.restaurant?.coordinates?.coordinates) {
          order.restaurantLat = order.restaurant.coordinates.coordinates[1];
          order.restaurantLng = order.restaurant.coordinates.coordinates[0];
        }
        if (order.coordinates?.coordinates) {
          order.customerLat = order.coordinates.coordinates[1];
          order.customerLng = order.coordinates.coordinates[0];
        }
      });

      res.json({
        success: true,
        orders,
      });
    } catch (err) {
      console.error('❌ Error loading driver orders (API):', err);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }
);

// 🔹 Claim order (JSON)
router.post(
  '/api/claim/:id',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    const orderId = req.params.id;
    const deliveryPersonId = req.session.userId;

    try {
      const order = await Order.findOne({ _id: orderId, status: 'Pending' });
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: 'Order already claimed or not found' });
      }

      order.status = 'Picked Up';
      order.deliveryPersonId = deliveryPersonId;
      await order.save();

      await Notification.findOneAndUpdate(
        { orderId: order._id },
        { status: 'picked' }
      );

      res.json({
        success: true,
        order,
      });
    } catch (err) {
      console.error('❌ Error claiming order (API):', err);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }
);

// 🔹 Update status (JSON)
router.post(
  '/api/update-status/:id',
  requireLogin,
  requireRole('delivery'),
  async (req, res) => {
    const orderId = req.params.id;
    const { newStatus } = req.body;
    const userId = req.session.userId;

    try {
      const order = await Order.findOne({
        _id: orderId,
        deliveryPersonId: userId,
      });

      if (!order) {
        return res
          .status(403)
          .json({ success: false, message: 'Unauthorized or order not found' });
      }

      const validTransitions = {
        Pending: ['Picked Up'],
        'Picked Up': ['Delivered'],
      };

      if (!validTransitions[order.status]?.includes(newStatus)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid status transition' });
      }

      order.status = newStatus;
      await order.save();

      const statusMap = {
        'Picked Up': 'picked',
        Delivered: 'delivered',
      };

      const newNotificationStatus = statusMap[newStatus];
      if (newNotificationStatus) {
        await Notification.findOneAndUpdate(
          { orderId: order._id },
          { status: newNotificationStatus }
        );
      }

      res.json({
        success: true,
        order,
      });
    } catch (err) {
      console.error('❌ Error updating status (API):', err);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }
);
module.exports = router;
