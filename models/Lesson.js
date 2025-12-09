const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    emotionalTone: { type: String, trim: true },
    image: { type: String, trim: true },
    visibility: {
      type: String,
      enum: ['public', 'private', 'draft'],
      default: 'public',
    },
    accessLevel: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free',
    },
    creatorEmail: { type: String, required: true, lowercase: true, trim: true },
    creatorName: { type: String, trim: true },
    creatorPhoto: { type: String, trim: true },
    isFeatured: { type: Boolean, default: false },
    isReviewed: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    likes: { type: [String], default: [] },
    likesCount: { type: Number, default: 0 },
    favorites: { type: [String], default: [] },
    favoritesCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

lessonSchema.index({ title: 'text', description: 'text' });
lessonSchema.index({ creatorEmail: 1, createdAt: -1 });

module.exports = mongoose.model('Lesson', lessonSchema);
