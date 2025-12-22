// routes/session.js
const express = require('express');
const router = express.Router();

// POST /session/clear-all  -> JSON 204 (no content)
router.post('/clear-all', (req, res) => {
  if (!req.session) return res.sendStatus(204);
  req.session.cart = [];
  req.session.favorites = [];
  req.session.save(err => {
    if (err) {
      console.error('❌ clear-all save failed:', err);
      return res.sendStatus(500);
    }
    //console.log('🧹 clear-all: cart & favorites cleared');
    res.sendStatus(204);
  });
});

// POST /session/clear-cart -> JSON 204 (no content)
router.post('/clear-cart', (req, res) => {
  if (!req.session) return res.sendStatus(204);
  req.session.cart = [];
  req.session.save(err => {
    if (err) {
      console.error('❌ clear-cart save failed:', err);
      return res.sendStatus(500);
    }
   // console.log('🛒 clear-cart: cart cleared');
    res.sendStatus(204);
  });
});

// POST /session/start-new -> clears and redirects to /home
router.post('/start-new', (req, res) => {
  if (!req.session) return res.redirect(303, '/home');
  req.session.cart = [];
  req.session.favorites = [];
  req.session.save(err => {
    if (err) {
      console.error('❌ start-new save failed:', err);
      // still try to send user to home
    }
    res.redirect(303, '/home'); // 303: See Other
  });
});

module.exports = router;
