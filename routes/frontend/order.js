// routes/frontend/order.js
const express = require('express');
const router = express.Router();
const Order = require('../../models/Order'); 
const MF_API_URL = process.env.MF_API_URL || 'https://apitest.myfatoorah.com';
const MF_TOKEN = process.env.MF_TOKEN;
const MF_PAYMENT_METHOD_ID = Number(process.env.MF_PAYMENT_METHOD_ID || 2); 
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://192.168.1.26:4000';
// Helper to avoid NaN
function getSafeNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
// ---------- HTML helper for success / error pages ----------
function renderPaymentPage({ status, orderId, paymentId, appBaseUrl, debugJson }) {
  const isSuccess = status === 'success';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment ${isSuccess ? 'Successful' : 'Failed'}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, #c78eff, #d0dfff);
      padding: 16px;
    }
    .card {
      width: 100%;
      max-width: 420px;
      background: #ffffff;
      border-radius: 24px;
      padding: 24px 20px 16px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
    }
    .status-icon {
      width: 72px;
      height: 72px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      font-size: 40px;
      color: #ffffff;
    }
    .status-success { background: #22c55e; }
    .status-failed { background: #ef4444; }
    h1 {
      text-align: center;
      font-size: 22px;
      margin-bottom: 4px;
      font-weight: 700;
      color: #111827;
    }
    p.subtitle {
      text-align: center;
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f9fafb;
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 13px;
      color: #111827;
      margin-bottom: 20px;
    }
    .info-row span.label {
      font-weight: 600;
    }
    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 6px;
    }
    .btn {
      flex: 1;
      border-radius: 999px;
      padding: 10px 0;
      font-size: 14px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
    }
    .btn-secondary {
      background: #ffffff;
      color: #111827;
      border: 1px solid #e5e7eb;
    }
    .debug-toggle {
      font-size: 12px;
      color: #6b7280;
      cursor: pointer;
      margin-top: 6px;
    }
    .debug-content {
      display: none;
      margin-top: 8px;
      background: #0f172a;
      color: #e5e7eb;
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 11px;
      max-height: 160px;
      overflow: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-icon ${isSuccess ? 'status-success' : 'status-failed'}">
      ${isSuccess ? '✔' : '✖'}
    </div>
    <h1>${isSuccess ? 'Payment Successful' : 'Payment Failed'}</h1>
    <p class="subtitle">
      ${isSuccess ? 'Thank you, your payment was received.' : 'Something went wrong while processing your payment.'}
    </p>
    <div class="info-box">
      <div class="info-row">
        <span class="label">Order ID:</span> ${orderId || '-'}
      </div>
      <div class="info-row">
        <span class="label">Payment ID:</span> ${paymentId || '-'}
      </div>
    </div>
    <div class="buttons">
      <!-- Close button: try to close tab / webview; if not possible, just go back -->
      <button class="btn btn-primary" onclick="handleClose()">Close</button>
      <!-- Home button: send to your REAL backend home route -->
      <button class="btn btn-secondary" onclick="goHome()">Go to Home</button>
    </div>
    <div class="debug-toggle" onclick="toggleDebug()">
      ▶ Debug info from MyFatoorah (GetPaymentStatus)
    </div>
    <pre id="debugBox" class="debug-content">${debugJson || ''}</pre>
  </div>
  <script>
    function handleClose() {
      // Always go to your backend home page
      window.location.href = 'flamingdelivery://exit-app';
    }
    function goHome() {
      // Same as Close: force navigation to your home
      window.location.href = 'flamingdelivery://home';
    }
    function toggleDebug() {
      var box = document.getElementById('debugBox');
      box.style.display = box.style.display === 'block' ? 'none' : 'block';
    }
  </script>
</body>
</html>
`;
}
/* -----------------------------
   POST /order/mobile-checkout
------------------------------*/
router.post('/mobile-checkout', async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerMobile,
      city,
      street,
      building,
      floor,
      zone,
      addressNote,
      latitude,
      longitude,
      aptNo,
      cartItems = [],
    } = req.body;
    console.log("📥 mobile-checkout customerName =", customerName);
    console.log("📥 mobile-checkout customerMobile =", customerMobile);
    console.log('📥 mobile-checkout body =', req.body);

    // 1) Normalize items from cartItems
    const normalizedItems = cartItems.map((it) => ({
      mealId: it?.mealId || '',
      name: it?.name || 'Item',
      quantity: getSafeNumber(it?.quantity, 1),
      price: getSafeNumber(it?.price, 0),
      restaurantId: it?.restaurantId || '',
    }));
    console.log('🧮 normalizedItems =', normalizedItems);
    // ✅ basic validation BEFORE touching DB
    if (!Array.isArray(normalizedItems) || normalizedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty.',
      });
    }
    const totalAmount = normalizedItems.reduce(
      (sum, it) => sum + it.quantity * it.price,
      0
    );
    console.log('💰 totalAmount =', totalAmount);
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice amount.',
      });
    }
    if (!MF_TOKEN) {
      console.log('❌ MF_TOKEN missing – check your .env');
      return res.status(500).json({
        success: false,
        message: 'Payment gateway not configured.',
      });
    }
    // 👉 Take restaurantId from the first item
    const mainRestaurantId = normalizedItems[0]?.restaurantId || null;
    // Full address snapshot
    const fullAddress =
      addressNote && addressNote.trim().length > 0
        ? addressNote
        : `${city || ''} ${street || ''} ${building || ''} ${zone || ''}`.trim();
    // 2) Prepare GeoJSON coordinates (for your 2dsphere index)
    const latNum = getSafeNumber(latitude, null);
    const lngNum = getSafeNumber(longitude, null);
    let geoLocation;
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      geoLocation = {
        type: 'Point',
        coordinates: [lngNum, latNum], // [lng, lat]
      };
    }
    // 3) Create order in DB (ONLY ONCE)
    let orderId = null;
    try {
      const orderPayload = {
        // ✅ restaurant for driver screen
        restaurant: mainRestaurantId || null,

        // ✅ items as required by OrderSchema
        mealItems: normalizedItems.map((it) => ({
          mealId: it.mealId || it._id || null,
          name: it.name || "Item",
          price: getSafeNumber(it.price, 0),
          quantity: getSafeNumber(it.quantity, 1),
        })),
        // ✅ main order fields
        totalAmount,
        status: "Pending",
        // ✅ customer snapshot (used by driver API)
        customerName: customerName || "Mobile Customer",
        customerMobile: customerMobile || "50000000",
        // ✅ address goes into deliveryDetails (matches OrderSchema)
        deliveryDetails: {
          city: city || "",
          street: street || "",
          building: building || "",
          aptNo: aptNo || "",
          floor: floor || "",
          zone: zone || "",
          latitude: latNum,    // from earlier conversion
          longitude: lngNum,
          addressNote: addressNote || "",
        },
      };
      // ✅ GeoJSON coordinates for map (if we have them)
      if (geoLocation) {
        orderPayload.coordinates = geoLocation;
      }
      const order = await Order.create(orderPayload);
      console.log("✅ Created mobile order", order._id, {
        customerName: order.customerName,
        customerMobile: order.customerMobile,
      });
      orderId = order._id.toString();
    } catch (e) {
      console.error("❌ Failed to create Order:", e);
      return res.status(500).json({
        success: false,
        message: "Could not create order.",
      });
    }
    // 4) Build success / error URLs, including orderId
    const baseSuccessUrl = `${APP_BASE_URL}/order/mobile-payment-success`;
    const baseErrorUrl = `${APP_BASE_URL}/order/mobile-payment-error`;
    const successUrl = orderId
      ? `${baseSuccessUrl}?orderId=${orderId}`
      : baseSuccessUrl;
    const errorUrl = orderId
      ? `${baseErrorUrl}?orderId=${orderId}`
      : baseErrorUrl;
    console.log('➡️  APP_BASE_URL =', APP_BASE_URL);
    console.log('➡️  successUrl   =', successUrl);
    console.log('➡️  errorUrl     =', errorUrl);
    console.log('➡️  MF_API_URL   =', MF_API_URL);
    console.log('🔑 MF_TOKEN present?', !!MF_TOKEN);
    // 5) Build MyFatoorah ExecutePayment request
// build the base object WITHOUT email first
const executeBody = {
  PaymentMethodId: MF_PAYMENT_METHOD_ID,
  CustomerName:
    (customerName && String(customerName).trim()) || 'Mobile Customer',
  CustomerMobile: customerMobile || '',
  DisplayCurrencyIso: 'KWD',
  InvoiceValue: Number(totalAmount.toFixed(3)),
  CallBackUrl: successUrl,
  ErrorUrl: errorUrl,
  CustomerReference: orderId || '',
  UserDefinedField: orderId || '',
  InvoiceItems: normalizedItems.map((it) => ({
    ItemName: it.name || 'Item',
    Quantity: it.quantity,
    UnitPrice: it.price,
  })),
};

// ✅ Only send CustomerEmail if it looks like a real email
if (customerEmail && String(customerEmail).includes('@')) {
  executeBody.CustomerEmail = customerEmail.trim();
}

    if (
      !Number.isFinite(executeBody.InvoiceValue) ||
      executeBody.InvoiceValue <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'InvoiceValue must be a positive number.',
      });
    }
    console.log(
      '📤 ExecutePayment body =',
      JSON.stringify(executeBody, null, 2)
    );
    const mfResp = await fetch(`${MF_API_URL}/v2/ExecutePayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MF_TOKEN}`,
      },
      body: JSON.stringify(executeBody),
    });
    const rawText = await mfResp.text();
    console.log('📥 ExecutePayment HTTP status =', mfResp.status);
    console.log('📥 ExecutePayment raw body   =', rawText);
    let mfData = null;
    try {
      mfData = JSON.parse(rawText);
    } catch (e) {
      console.error('⚠️ Cannot parse MyFatoorah JSON:', e.message);
    }
    if (!mfData || !mfData.IsSuccess) {
      console.error('❌ MyFatoorah error (ExecutePayment) object =', mfData);
      return res.status(500).json({
        success: false,
        message: 'MyFatoorah ExecutePayment failed.',
        gatewayMessage: mfData?.ValidationErrors
          ? JSON.stringify(mfData.ValidationErrors)
          : mfData?.Message || rawText || 'Unknown error from MyFatoorah',
      });
    }
    const paymentUrl = mfData?.Data?.PaymentURL;
    const invoiceId = mfData?.Data?.InvoiceId;
    if (!paymentUrl) {
      return res.status(500).json({
        success: false,
        message: 'No payment URL returned from MyFatoorah.',
      });
    }
    // 6) Attach invoiceId to our order
    try {
      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          gatewayInvoiceId: invoiceId || null,
          paymentStatus: 'Pending',
        });
      }
    } catch (e) {
      console.error('⚠️ Failed to attach invoiceId to Order:', e);
    }
    return res.json({
      success: true,
      paymentUrl,
      invoiceId,
      orderId, 
    });
  } catch (err) {
    console.error('❌ mobile-checkout unexpected error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error during mobile checkout.',
      error: err.message,
    });
  }
});
/*-----------------------------
   GET /order/mobile-payment-success
------------------------------*/
router.get('/mobile-payment-success', async (req, res) => {
  try {
    const orderId = req.query.orderId || '';
    const paymentId = req.query.paymentId || ''; 
    const debugJson = ''; 
    return res.send(
      renderPaymentPage({
        status: 'success',
        orderId,
        paymentId,
        appBaseUrl: APP_BASE_URL,
        debugJson,
      })
    );
  } catch (err) {
    console.error('❌ mobile-payment-success error:', err);
    return res.status(500).send('Error rendering payment success page');
  }
});
/* -----------------------------
   GET /order/mobile-payment-error
------------------------------*/
router.get('/mobile-payment-error', async (req, res) => {
  const { orderId, paymentId, Id } = req.query; // Id is InvoiceId
  console.log('❌ ERROR callback (raw query):', { orderId, paymentId, Id });
  // 1) Ask MyFatoorah for full details
  let mfStatusData = null;
  try {
    if (MF_TOKEN) {
      const statusPayload = {
        Key: paymentId || Id, // prefer PaymentId, else InvoiceId
        KeyType: paymentId ? 'PaymentId' : 'InvoiceId',
      };
      console.log('🔎 Calling GetPaymentStatus with', statusPayload);
      const statusRes = await fetch(`${MF_API_URL}/v2/GetPaymentStatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MF_TOKEN}`,
        },
        body: JSON.stringify(statusPayload),
      });
      const statusText = await statusRes.text();
      console.log('📡 GetPaymentStatus status:', statusRes.status);
      console.log('📡 GetPaymentStatus raw body:', statusText);
      try {
        mfStatusData = JSON.parse(statusText);
      } catch (e) {
        console.error('❌ Failed to parse GetPaymentStatus JSON:', e.message);
      }
    } else {
      console.warn('⚠️ MF_TOKEN not set – cannot call GetPaymentStatus');
    }
  } catch (e) {
    console.error('❌ Error while calling GetPaymentStatus:', e);
  }
  // 2) Decide success or failure based on MF status
  const invoiceStatus = String(
    mfStatusData?.Data?.InvoiceStatus ||
      mfStatusData?.Data?.InvoiceStatusEn ||    ''
  );
  const isPaid =
    mfStatusData?.IsSuccess === true ||
    invoiceStatus.toLowerCase().includes('paid');
  console.log(
    '💳 Decoded status → IsSuccess =',
    mfStatusData?.IsSuccess,
    ', InvoiceStatus =',
    invoiceStatus
  );
  let heading;
  let message;
  if (isPaid) {
    heading = 'Payment Successful';
    message = 'Thank you, your payment was received.';
    // (optional) mark order as Paid if you use Order model
    try {
      if (orderId && typeof Order !== 'undefined') {
        await Order.findByIdAndUpdate(orderId, {
          status: 'Paid',
          paymentStatus: 'Paid',
        });
      }
    } catch (e) {
      console.error(
        '❌ Error updating order on success (from error callback):',
        e
      );
    }
  } else {
    heading = 'Payment Failed';
    message = 'Please try again.';
    try {
      if (orderId && typeof Order !== 'undefined') {
        await Order.findByIdAndUpdate(orderId, {
          status: 'PaymentFailed',
          paymentStatus: 'PaymentFailed',
        });
      }
    } catch (e) {
      console.error('❌ Error updating order on failure:', e);
    }
  }
  // 3) Render page
res.send(
    renderPaymentPage({
      title: heading,                       
      status: isPaid ? 'success' : 'error',
      message,
      orderId,
      paymentId,
      debugTitle: 'Debug info from MyFatoorah (GetPaymentStatus)',
      debugJson: mfStatusData
        ? JSON.stringify(mfStatusData, null, 2)
        : 'No extra info available.',
    })
  );
 }); 
 // ✅ MyFatoorah success callback
router.get('/payment/success', (req, res) => {
  // Here you can verify payment status, update DB, etc.
  res.send('Payment successful');
});
// ✅ MyFatoorah error callback
router.get('/payment/error', (req, res) => {
  // Here you can log error / show message
  res.send('Payment failed or cancelled');
});
module.exports = router;