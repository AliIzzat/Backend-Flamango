// e.g. in routes/mobile.js
const express = require('express');
//const fetch = require('node-fetch');  if not already installed: npm install node-fetch
const router = express.Router();

const Order = require('../models/Order'); // adjust to your actual Order model

const MYFATOORAH_API_KEY = process.env.MYFATOORAH_API_KEY;
const MYFATOORAH_BASE = process.env.MYFATOORAH_API_BASE || 'https://apitest.myfatoorah.com';
const SUCCESS_URL = process.env.MYFATOORAH_SUCCESS_URL;
const ERROR_URL = process.env.MYFATOORAH_ERROR_URL;

router.post('/checkout', async (req, res) => {
  try {
    const { restaurantId, items, customer, source } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty.' });
    }

    // 1️⃣ Calculate total
    const totalAmount = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0
    );

    // 2️⃣ Create order in MongoDB (simplified example)
    const order = await Order.create({
      restaurantId,
      items: items.map((i) => ({
        mealId: i.mealId,
        name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
      })),
      customerName: customer?.name,
      customerPhone: customer?.phone,
      customerAddress: customer?.address,
      totalAmount,
      status: 'PendingPayment',
      source: source || 'mobile',
    });

    // 3️⃣ Create payment with MyFatoorah
    const mfPayload = {
      InvoiceValue: totalAmount,
      CustomerName: customer?.name || 'Mobile Customer',
      CustomerMobile: customer?.phone || '',
      CustomerEmail: 'test@example.com', // optional
      CallBackUrl: SUCCESS_URL,
      ErrorUrl: ERROR_URL,
      UserDefinedField: String(order._id), // store order id to retrieve in callback
      DisplayCurrencyIso: 'QAR', // or your currency
      // You can add more fields like InvoiceItems if needed
    };

    const mfRes = await axios.post(
  `${MYFATOORAH_BASE}/v2/SendPayment`,
  payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MYFATOORAH_API_KEY}`,
      },
      body: JSON.stringify(mfPayload),
    });

    const mfData = await mfRes.json();
    console.log('MyFatoorah response:', mfData);

    if (!mfData || !mfData.IsSuccess) {
      console.error('MyFatoorah error:', mfData);
      return res.status(500).json({ message: 'Failed to create payment.' });
    }

    const paymentUrl = mfData.Data?.PaymentURL || mfData.Data?.InvoiceURL;
    if (!paymentUrl) {
      return res.status(500).json({ message: 'No payment URL from MyFatoorah.' });
    }

    // 4️⃣ Respond to mobile with orderId + payment URL
    res.json({
      orderId: order._id,
      paymentUrl,
    });
  } catch (err) {
    console.error('Mobile checkout error:', err);
    res.status(500).json({ message: 'Checkout error.' });
  }
});

module.exports = router;
