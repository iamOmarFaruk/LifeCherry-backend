const Trash = require('../models/Trash');
const Lesson = require('../models/Lesson');
const { logChange } = require('./auditController');

const sanitizeTrashItem = (item) => {
  if (!item) return null;
  const doc = item.toObject ? item.toObject() : item;
  const {
    _id,
    originalId,
    itemType,
    itemData,
    deletedBy,
    deletedByName,
    itemOwner,
    itemOwnerName,
    deletionReason,
    status,
    createdAt,
  } = doc;

  return {
    id: _id,
    _id,
    originalId,
    itemType,
    itemData,
    deletedBy,
    deletedByName,
    itemOwner,
    itemOwnerName,
    deletionReason,
    status,
    createdAt,
  };
};

// Add item to trash (called when user deletes)
exports.moveToTrash = async (originalId, itemType, itemData, deletedByEmail, deletedByName, itemOwnerEmail, itemOwnerName) => {
  try {
    const trash = await Trash.create({
      originalId,
      itemType,
      itemData,
      deletedBy: deletedByEmail.toLowerCase(),
      deletedByName: deletedByName || '',
      itemOwner: itemOwnerEmail?.toLowerCase() || null,
      itemOwnerName: itemOwnerName || '',
      status: 'trashed',
    });
    return trash;
  } catch (error) {
    console.error('Failed to move to trash', error.message);
    return null;
  }
};

// Get all trashed items (admin only)
exports.listTrash = async (req, res) => {
  try {
    const { role } = req.user;

    // Only admins can view trash
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can access trash' });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const itemType = req.query.itemType;
    const filters = { status: 'trashed' };
    if (itemType && ['lesson', 'profile'].includes(itemType)) {
      filters.itemType = itemType;
    }

    const [total, items] = await Promise.all([
      Trash.countDocuments(filters),
      Trash.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      items: items.map(sanitizeTrashItem),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch trash', error: error.message });
  }
};

// Restore item from trash (admin only)
exports.restoreFromTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, email, name } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can restore items' });
    }

    const trashItem = await Trash.findById(id);
    if (!trashItem) {
      return res.status(404).json({ message: 'Item not found in trash' });
    }

    if (trashItem.status !== 'trashed') {
      return res.status(400).json({ message: 'Item cannot be restored' });
    }

    // Restore the item based on type
    if (trashItem.itemType === 'lesson') {
      // Restore lesson with original ID
      const lesson = await Lesson.findByIdAndUpdate(
        trashItem.originalId,
        { $set: trashItem.itemData },
        { new: true, upsert: true }
      ).lean();

      // Remove from trash
      await Trash.findByIdAndDelete(id);

      // Log the restore action
      await logChange({
        actorEmail: email.toLowerCase(),
        actorName: name,
        actorRole: role,
        targetType: 'lesson',
        targetId: trashItem.originalId,
        targetOwnerEmail: trashItem.itemOwner,
        action: 'restore',
        summary: `Restored lesson "${trashItem.itemData.title}" from trash`,
        metadata: { restoredFrom: 'trash' },
      });

      return res.status(200).json({ message: 'Item restored successfully', lesson });
    }

    return res.status(400).json({ message: 'Unsupported item type' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to restore item', error: error.message });
  }
};

// Permanently delete from trash (admin only)
exports.permanentlyDeleteFromTrash = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, email, name } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can permanently delete items' });
    }

    const trashItem = await Trash.findById(id);
    if (!trashItem) {
      return res.status(404).json({ message: 'Item not found in trash' });
    }

    const itemTitle = trashItem.itemData?.title || 'Unknown item';

    // Update trash status to permanently_deleted
    await Trash.findByIdAndUpdate(id, { status: 'permanently_deleted' });

    // Log the permanent deletion
    await logChange({
      actorEmail: email.toLowerCase(),
      actorName: name,
      actorRole: role,
      targetType: trashItem.itemType,
      targetId: trashItem.originalId,
      targetOwnerEmail: trashItem.itemOwner,
      action: 'permanently_delete',
      summary: `Permanently deleted "${itemTitle}" from trash`,
      metadata: { deletedFrom: 'trash', itemType: trashItem.itemType },
    });

    return res.status(200).json({ message: 'Item permanently deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to permanently delete item', error: error.message });
  }
};


