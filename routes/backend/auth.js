// routes/backend/auth.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");

// GET: show login form
router.get("/login", (req, res) => {
  res.render("frontend/login", {
    layout: false,
    error: null,
  });
});

// POST: handle login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username, password }); // (later: use bcrypt)

    if (!user) {
      return res.render("frontend/login", {
        layout: false,
        error: "❌ Invalid username or password",
      });
    }

    // ✅ STORE SESSION INFO HERE
    req.session.userId = user._id;
    req.session.userRole = user.role; // "admin" or "delivery" etc.

    console.log("🟢 Logged in as:", user.username, "role:", user.role);

    // ✅ Redirect based on role
    if (user.role === "admin") {
      return res.redirect("/dashboard");
    } else if (user.role === "delivery") {
      return res.redirect("/delivery/available");
    } else {
      // you can change this later if you add more roles
      return res.redirect("/");
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).send("Server error during login");
  }
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Logout error:", err);
      return res.status(500).send("Error logging out.");
    }
    res.redirect("/login");
  });
});
// Step 1: Show form to enter phone
router.get('/enter-phone', (req, res) => {
  res.render('enter-phone'); // create this view
});

// Step 2: Send OTP
router.post('/send-otp', (req, res) => {
  const { phone } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

  req.session.otp = otp;
  req.session.phone = phone;

  // console.log(`📱 OTP for ${phone} is: ${otp}`);

  res.redirect('/verify-otp');
});

// Step 3: Show OTP form
router.get('/verify-otp', (req, res) => {
  res.render('verify-otp'); // create this view
});

// Step 4: Verify OTP
router.post('/verify-otp', (req, res) => {
  const { otp } = req.body;

  if (otp === req.session.otp) {
    // ✅ Phone verified
    req.session.isVerified = true;

    // You can save to DB here
    res.send(`✅ Phone verified: ${req.session.phone}`);
  } else {
    res.send('❌ Invalid OTP. Please try again.');
  }
});
// GET: show registration form
router.get('/register', (req, res) => {
  res.render('frontend/register', {
    layout: false,                // set to your main layout if you want header/footer
    title: 'Customer Registration'
  });
});
// POST: handle registration form submission
router.post('/register', (req, res) => {
  const { name, email, phone } = req.body;

  // store in session (so confirm-order can use it)
  req.session.customerInfo = { name, email, phone };

  // continue to confirm order
  res.redirect('/order/confirm');
});

module.exports = router;
