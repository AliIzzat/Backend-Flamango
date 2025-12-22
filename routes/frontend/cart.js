const express = require('express');
const router = express.Router();
const Food = require('../../models/Meal');
// ---------- helpers ----------
const toNum = v => Number(v?.toString?.() ?? v) || 0;
function summarize(cart = []) {
  const items = (cart || []).map(i => ({
    id: String(i.mealId),
    name: i.name,
    qty: Number(i.quantity) || 0,
    price: toNum(i.price),
    lineTotal: toNum(i.price) * (Number(i.quantity) || 0),
  }));
  const total = items.reduce((s, i) => s + i.lineTotal, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { items, total: Number(total.toFixed(2)), count };
}
// ---------- ensure cart exists on this router ----------
router.use((req, _res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});
// =============== Mini-cart APIs ===============
// GET /cart/mini  → current summary (for popup/indicator)
router.get('/mini', (req, res) => {
  try {
    res.json({ success: true, summary: summarize(req.session.cart) });
  } catch (_e) {
    res.status(500).json({ success: false, message: 'Failed to load mini cart' });
  }
});
// POST /cart/add  → add/increment one item, return summary
// Accepts body: { mealId? , id?, qty? }
router.post('/add', async (req, res) => {
  try {
    console.log('➡️ /cart/add body:', req.body);
    const mealId = req.body.mealId || (req.body && req.body.id);
    const qty    = Number(req.body.qty ?? 1) || 1;
    if (!mealId) return res.status(400).json({ error: 'mealId required' });

    const meal = await Food.findById(mealId).select('name price restaurant');
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    if (!req.session.cart) req.session.cart = [];
    const existing = req.session.cart.find(i => i.mealId === String(meal._id));
    if (existing) existing.quantity += qty;
    else req.session.cart.push({
      mealId: String(meal._id),
      name: meal.name,
      price: Number(meal.price) || 0,
      restaurant: String(meal.restaurant ?? ''),
      quantity: qty
    });
    console.log('cart now:', req.session.cart);
    await new Promise(r => req.session.save(r));
    const isJsonBody = (req.headers['content-type'] || '').includes('application/json');
    const isXHR = req.xhr || req.get('X-Requested-With') === 'XMLHttpRequest';
    const wantsJson = isJsonBody || isXHR || (req.get('accept') || '').includes('application/json');
    const summary = {
      items: req.session.cart.map(i => ({
        id: i.mealId, name: i.name, qty: i.quantity, price: i.price,
        lineTotal: i.price * i.quantity
      })),
      total: req.session.cart.reduce((s,i)=> s + i.price * i.quantity, 0),
      count: req.session.cart.reduce((n,i)=> n + i.quantity, 0)
    };
    if (wantsJson) return res.json({ success: true, summary });
    const back = req.body.redirect || req.get('referer') || '/home';
    return res.redirect(back);
  } catch (e) {
    console.error('POST /cart/add error:', e);
    return res.status(500).json({ error: 'Failed to add to cart' });
  }
});
// POST /cart/update  → change quantity (+/−) or set exact qty, return summary
// body: { mealId OR id, delta? , qty? }
router.post('/update', (req, res) => {
  try {
    const body = req.body || {};
    const chosenId = body.mealId || body.id;
    if (!chosenId) return res.status(400).json({ success: false, message: 'mealId (or id) is required' });
    const cart = req.session.cart || [];
    const item = cart.find(i => String(i.mealId) === String(chosenId));
    if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });
    let newQty;
    if (body.qty !== undefined) {
      const q = Number(body.qty);
      newQty = Number.isFinite(q) ? Math.floor(q) : item.quantity;
    } else {
      newQty = item.quantity + (Number(body.delta) || 0);
    }
    newQty = Math.max(0, newQty);
    if (newQty <= 0) {
      req.session.cart = cart.filter(i => String(i.mealId) !== String(chosenId));
    } else {
      item.quantity = newQty;
    }
    req.session.save(err => {
      if (err) return res.status(500).json({ success: false, message: 'Session save failed' });
      res.json({ success: true, summary: summarize(req.session.cart) });
    });
  } catch (e) {
    console.error('❌ /cart/update error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// POST /cart/remove  → remove a single item, return summary
router.post('/remove', (req, res) => {
  const body = req.body || {};
  const chosenId = body.mealId || body.id;
  if (!chosenId) return res.status(400).json({ success: false, message: 'mealId (or id) is required' });
  try {
    req.session.cart = (req.session.cart || []).filter(i => String(i.mealId) !== String(chosenId));
    req.session.save(err => {
      if (err) return res.status(500).json({ success: false, message: 'Session save failed' });
      res.json({ success: true, summary: summarize(req.session.cart) });
    });
  } catch (_e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// =============== Full cart page (server-rendered) ===============
// GET /cart/view
router.get('/view', async (req, res) => {
  try {
    const rawCart = Array.isArray(req.session.cart) ? req.session.cart : [];
    const mealIds = [...new Set(rawCart.map(i => String(i.mealId)))];
    const meals = mealIds.length
      ? await Food.find({ _id: { $in: mealIds } }).select('name price image restaurant_en').lean()
      : [];
    const cartItems = rawCart.map(ci => {
      const m = meals.find(mm => String(mm._id) === String(ci.mealId));
      const qty = Number(ci.quantity) > 0 ? Number(ci.quantity) : 1;
      return {
        mealId: String(ci.mealId),
        name: m?.name ?? ci.name,
        price: toNum(m?.price ?? ci.price),
        image: m?.image ?? ci.image,
        restaurantName: m?.restaurant_en ?? ci.restaurantName ?? '',
        quantity: qty,
      };
    });
    req.session.cart = cartItems;
    await new Promise(resolve => req.session.save(resolve));
    const total = cartItems.reduce((s, i) => s + toNum(i.price) * (Number(i.quantity) || 0), 0);
    res.set('Cache-Control', 'no-store');
    return res.render('frontend/cart', {
      cart: cartItems,
      total: Number(total.toFixed(2)),
      hideFooter: true,
    });
  } catch (err) {
    console.error('❌ Error rendering cart:', err);
    return res.status(500).send(`Failed to load cart: ${err.message}`);
  }
});
// POST /cart/remove-selected (from full cart page)
router.post('/remove-selected', (req, res) => {
  const selectedIds = req.body.selectedMeals;
  const ids = Array.isArray(selectedIds) ? selectedIds : (selectedIds ? [selectedIds] : []);
  req.session.cart = (req.session.cart || []).filter(i => !ids.includes(String(i.mealId)));
  req.session.save(() => res.redirect('/cart/view'));
});
// POST /cart/clear
router.post('/clear', (req, res) => {
  req.session.cart = [];
  req.session.save(() => res.sendStatus(204));
});
// GET /cart/preview  (optional)
router.get('/preview', (req, res) => {
  const { name, price, restaurant } = req.query;
  res.render('cart-preview', { mealName: name, mealPrice: price, restaurantName: restaurant });
});
// GET /cart/back
router.get('/back', (_req, res) => res.redirect('/cart/view'));
module.exports = router;
