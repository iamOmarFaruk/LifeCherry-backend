const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    photoURL: { type: String, trim: true },
    bio: { type: String, trim: true, maxLength: 500, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isPremium: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'archived', 'disable_requested'],
      default: 'active',
    },
    disableReason: { type: String, trim: true },
    disableRequestDate: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
