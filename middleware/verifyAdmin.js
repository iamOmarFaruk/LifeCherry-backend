const User = require('../models/User');

module.exports = async function verifyAdmin(req, res, next) {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(403).json({ message: 'Forbidden: missing user context' });

    const user = await User.findOne({ email }).lean();
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: admin only' });
    }

    req.user.role = user.role;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to verify admin', error: error.message });
  }
};
