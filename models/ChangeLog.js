const mongoose = require('mongoose');

const changeLogSchema = new mongoose.Schema(
  {
    actorEmail: { type: String, required: true, lowercase: true, trim: true },
    actorName: { type: String, trim: true },
    actorRole: { type: String, default: 'user', trim: true },
    targetType: { type: String, required: true, trim: true },
    targetId: { type: String, trim: true },
    targetOwnerEmail: { type: String, lowercase: true, trim: true },
    action: { type: String, required: true, trim: true },
    summary: { type: String, trim: true },
    metadata: { type: Object },
  },
  { timestamps: true }
);

changeLogSchema.index({ actorEmail: 1, createdAt: -1 });
changeLogSchema.index({ targetOwnerEmail: 1, createdAt: -1 });
changeLogSchema.index({ targetType: 1, createdAt: -1 });

module.exports = mongoose.model('ChangeLog', changeLogSchema);
