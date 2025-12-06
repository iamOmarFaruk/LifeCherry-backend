const User = require('../models/User');

const sanitizeUser = (user) => {
  if (!user) return null;
  const { _id, name, email, photoURL, role, isPremium, createdAt, updatedAt } = user;
  return { id: _id, name, email, photoURL, role, isPremium, createdAt, updatedAt };
};

// POST /users - create or update user on login
exports.upsertUser = async (req, res) => {
  try {
    const { email, name, photoURL } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const update = {
      email: email.toLowerCase(),
    };
    if (name) update.name = name;
    if (photoURL) update.photoURL = photoURL;

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: update, $setOnInsert: { role: 'user', isPremium: false } },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to upsert user', error: error.message });
  }
};

// GET /users/:email - get user details
exports.getUserByEmail = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
};

// PATCH /users/:email - update profile
exports.updateUserProfile = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const allowed = ['name', 'photoURL'];
    const update = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findOneAndUpdate({ email }, { $set: update }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
};
