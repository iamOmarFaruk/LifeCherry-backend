const ChangeLog = require('../models/ChangeLog');

const sanitizeChange = (change) => {
  if (!change) return null;
  const doc = change.toObject ? change.toObject() : change;
  const {
    _id,
    actorEmail,
    actorName,
    actorRole,
    targetType,
    targetId,
    targetOwnerEmail,
    action,
    summary,
    metadata,
    createdAt,
    updatedAt,
  } = doc;

  return {
    id: _id,
    actorEmail,
    actorName,
    actorRole,
    targetType,
    targetId,
    targetOwnerEmail,
    action,
    summary,
    metadata,
    createdAt,
    updatedAt,
  };
};

exports.logChange = async (payload = {}) => {
  try {
    const record = {
      actorEmail: payload.actorEmail?.toLowerCase(),
      actorName: payload.actorName || '',
      actorRole: payload.actorRole || 'user',
      targetType: payload.targetType || 'unknown',
      targetId: payload.targetId || '',
      targetOwnerEmail: payload.targetOwnerEmail?.toLowerCase() || undefined,
      action: payload.action || 'update',
      summary: payload.summary || '',
      metadata: payload.metadata || {},
    };

    if (!record.actorEmail) return null;
    return await ChangeLog.create(record);
  } catch (error) {
    console.error('Failed to log change', error.message);
    return null;
  }
};

exports.listAdminChanges = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.actorRole) filters.actorRole = req.query.actorRole;
    if (req.query.targetType) filters.targetType = req.query.targetType;

    const [total, changes] = await Promise.all([
      ChangeLog.countDocuments(filters),
      ChangeLog.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({ page, limit, total, changes: changes.map(sanitizeChange) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch changes', error: error.message });
  }
};

const User = require('../models/User');

exports.listUserChanges = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch user to check premium status
    const user = await User.findOne({ email });
    const isPremium = user?.isPremium || user?.role === 'admin' || false;

    let page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    let limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    // Enforce limits for free users
    if (!isPremium) {
      if (page > 1) {
        // Free users only get the first page
        return res.status(200).json({ 
          page, 
          limit, 
          total: 0, // Or real total, but changes empty
          changes: [], 
          isPremium: false 
        });
      }
      limit = Math.min(limit, 10); // Cap limit at 10 for free users, but allow lower
    }

    const skip = (page - 1) * limit;

    const filters = {
      $or: [
        { actorEmail: email },
        { targetOwnerEmail: email },
      ],
    };
    if (req.query.targetType) filters.targetType = req.query.targetType;

    const [total, changes] = await Promise.all([
      ChangeLog.countDocuments(filters),
      ChangeLog.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({ 
      page, 
      limit, 
      total, 
      changes: changes.map(sanitizeChange),
      isPremium 
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user changes', error: error.message });
  }
};
