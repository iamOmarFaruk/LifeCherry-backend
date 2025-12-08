const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    userEmail: String,
    emoji: String, // 👍, ❤️, 😂, 😮, 😢, 😡
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Define reply schema with self-reference
const replySchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    userPhoto: { type: String, default: '' },
    content: { type: String, required: true },
    reactions: [reactionSchema],
    replies: [], // Will be populated with same structure
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// Enable nested replies
replySchema.add({ replies: [replySchema] });

const commentSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userPhoto: String,
    content: {
      type: String,
      required: true,
    },
    reactions: [reactionSchema],
    replies: [replySchema],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Index for faster queries
commentSchema.index({ lessonId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
