// middleware/auth.js

// ✅ Basic "must be logged in"
function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // not logged in
  return res.redirect('/login');
}

// ✅ Role-based guard: require one of the given roles
function requireRole(...roles) {
  return (req, res, next) => {
    // first make sure logged in
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }

    const role = req.session.userRole;

    if (roles.includes(role)) {
      return next();
    }

    // logged in but not allowed
    return res.status(403).send('⛔ Not authorized for this area');
  };
}

// Convenience helpers (you can still use them if you like)
const isAdmin      = requireRole('admin');
const isDelivery   = requireRole('delivery');
const isSupport    = requireRole('support', 'admin');
const isDataEntry  = requireRole('data_entry', 'admin');

module.exports = {
  requireLogin,
  requireRole,
  isAdmin,
  isDelivery,
  isSupport,
  isDataEntry,
};



