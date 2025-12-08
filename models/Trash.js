const mongoose = require('mongoose');

const trashSchema = new mongoose.Schema(
  {
    // Original item data
    originalId: { type: String, required: true, index: true },
    itemType: { type: String, enum: ['lesson', 'profile'], required: true },
    itemData: { type: mongoose.Schema.Types.Mixed, required: true },
    
    // User who deleted it
    deletedBy: { type: String, required: true, lowercase: true, trim: true },
    deletedByName: { type: String, trim: true },
    
    // Item owner
    itemOwner: { type: String, lowercase: true, trim: true },
    itemOwnerName: { type: String, trim: true },
    
    // Deletion info
    deletionReason: { type: String, trim: true },
    
    // Status - can restore or permanently delete
    status: { type: String, enum: ['trashed', 'permanently_deleted'], default: 'trashed' },
  },
  { timestamps: true }
);

// Index for finding user's trashed items and by deletion date
trashSchema.index({ deletedBy: 1, createdAt: -1 });
trashSchema.index({ itemOwner: 1, createdAt: -1 });
trashSchema.index({ itemType: 1, status: 1 });

module.exports = mongoose.model('Trash', trashSchema);
