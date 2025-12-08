const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true,
      index: true,
    },
    reporterEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    reporterName: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      enum: [
        'inappropriate-content',
        'spam',
        'misinformation',
        'copyright',
        'harassment',
        'other'
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'rejected', 'withdrawn'],
      default: 'pending',
      index: true,
    },
    reviewedBy: {
      type: String,
      lowercase: true,
      trim: true,
    },
    reviewerName: {
      type: String,
      trim: true,
    },
    adminMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound index to ensure one user can only report a lesson once
reportSchema.index({ lessonId: 1, reporterEmail: 1 }, { unique: true });

// Index for admin queries
reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
