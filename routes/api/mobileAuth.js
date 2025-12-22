// routes/api/mobileAuth.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const bcrypt = require("bcryptjs");

// POST /api/mobile/register
router.post("/register", async (req, res) => {
  try {
    const { name, mobile, email, password } = req.body;

    if (!name || !mobile || !password) {
      return res
        .status(400)
        .json({ success: false, error: "MISSING_FIELDS" });
    }

    // check if mobile already registered
    const existing = await User.findOne({ mobile });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: "MOBILE_ALREADY_REGISTERED" });
    }

    // hash password (recommended)
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      username: mobile,     // or separate username field
      mobile,
      email,
      password: hashed,
      role: "customer",     // important so we know it's a customer
    });

    return res.json({
      success: true,
      userId: user._id,
      name: user.name,
    });
  } catch (err) {
    console.error("❌ /api/mobile/register error:", err);
    return res
      .status(500)
      .json({ success: false, error: "SERVER_ERROR" });
  }
});

module.exports = router;
