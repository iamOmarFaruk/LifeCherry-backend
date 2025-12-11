const User = require('../models/User');
const Lesson = require('../models/Lesson');
const Comment = require('../models/Comment');
const { logChange } = require('./auditController');

const sanitizeUser = (user) => {
  if (!user) return null;
  const {
    _id,
    name,
    email,
    photoURL,
    bio,
    role,
    isPremium,
    status,
    disableRequestDate,
    disableReason,
    archivedAt,
    archiveReason,
    reactivationRequest,
    reactivationMessage,
    reactivationRequestDate,
    createdAt,
    updatedAt,
  } = user;
  return {
    id: _id,
    name,
    email,
    photoURL,
    bio,
    role,
    isPremium,
    status,
    disableRequestDate,
    disableReason,
    archivedAt,
    archiveReason,
    reactivationRequest,
    reactivationMessage,
    reactivationRequestDate,
    createdAt,
    updatedAt,
  };
};

// GET /users/me - current user profile
exports.getMe = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
};

// POST /users - create or update user on login
exports.upsertUser = async (req, res) => {
  try {
    const { email, name, photoURL } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check if user exists and is archived
    const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existingUser && (existingUser.status === 'archived' || existingUser.status === 'reactivation_requested')) {
      return res.status(403).json({
        message: 'Your account has been disabled by an administrator.',
        isArchived: true,
        archiveReason: existingUser.archiveReason || 'No reason provided',
        archivedAt: existingUser.archivedAt,
        hasRequestedReactivation: existingUser.reactivationRequest || existingUser.status === 'reactivation_requested',
        reactivationRequestDate: existingUser.reactivationRequestDate,
        userEmail: existingUser.email,
        userName: existingUser.name,
      });
    }

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

    const allowed = ['name', 'photoURL', 'bio'];
    const update = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    });

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findOneAndUpdate({ email }, { $set: update }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const actorEmail = req.user?.email?.toLowerCase();
    const actorRole = actorEmail === user.email ? 'user' : req.user?.role || 'admin';

    await logChange({
      actorEmail,
      actorName: req.user?.name || req.user?.displayName,
      actorRole,
      targetType: 'user',
      targetId: user._id?.toString(),
      targetOwnerEmail: user.email,
      action: 'update',
      summary: 'Updated profile',
      metadata: { fields: Object.keys(update) },
    });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
};

// POST /users/request-disable - user requests account disable
exports.requestDisable = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    const { reason } = req.body;
    if (!email) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          status: 'disable_requested',
          disableRequestDate: new Date(),
          disableReason: reason || '',
        },
      },
      { new: true }
    ).lean();

    await logChange({
      actorEmail: email,
      actorName: user.name,
      actorRole: user.role,
      targetType: 'user',
      targetId: user._id.toString(),
      targetOwnerEmail: email,
      action: 'request-disable',
      summary: `User requested account disable. Reason: ${reason || 'No reason provided'}`,
      metadata: { reason },
    });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request disable', error: error.message });
  }
};

// POST /users/cancel-disable-request - user cancels request
exports.cancelDisableRequest = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          status: 'active',
          disableRequestDate: null,
          disableReason: null,
        },
      },
      { new: true }
    ).lean();

    await logChange({
      actorEmail: email,
      actorName: user.name,
      actorRole: user.role,
      targetType: 'user',
      targetId: user._id.toString(),
      targetOwnerEmail: email,
      action: 'cancel-disable-request',
      summary: 'User cancelled account disable request',
    });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel request', error: error.message });
  }
};

// DELETE /users/me - delete own account permanently
exports.deleteAccount = async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase();
    if (!email) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete user's lessons
    await Lesson.deleteMany({ creatorEmail: email });

    // Delete user's comments
    await Comment.deleteMany({ userEmail: email });

    // Delete the user
    await User.deleteOne({ email });

    await logChange({
      actorEmail: email,
      actorName: user.name,
      actorRole: user.role,
      targetType: 'user',
      targetId: user._id.toString(),
      targetOwnerEmail: email,
      action: 'delete-account',
      summary: 'User deleted their own account permanently',
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete account', error: error.message });
  }
};

// POST /users/manage-status - admin manages user status
exports.manageUserStatus = async (req, res) => {
  try {
    const { email, action, reason } = req.body; // action: 'archive', 'restore', or 'approve-reactivation'
    if (!email || !action) return res.status(400).json({ message: 'Email and action required' });

    const targetUser = await User.findOne({ email: email.toLowerCase() });
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    if (action === 'archive') {
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: 'Archive reason is required' });
      }
      targetUser.status = 'archived';
      targetUser.archivedAt = new Date();
      targetUser.archiveReason = reason.trim();
      targetUser.reactivationRequest = false;
      targetUser.reactivationMessage = null;
      targetUser.reactivationRequestDate = null;
      await targetUser.save();

      // Hide all lessons
      await Lesson.updateMany({ creatorEmail: email.toLowerCase() }, { $set: { isArchived: true } });
    } else if (action === 'restore' || action === 'approve-reactivation') {
      targetUser.status = 'active';
      targetUser.disableRequestDate = null;
      targetUser.archivedAt = null;
      targetUser.archiveReason = null;
      targetUser.reactivationRequest = false;
      targetUser.reactivationMessage = null;
      targetUser.reactivationRequestDate = null;
      await targetUser.save();

      // Restore lessons
      await Lesson.updateMany({ creatorEmail: email.toLowerCase() }, { $set: { isArchived: false } });
    } else if (action === 'reject-reactivation') {
      // Keep archived but clear the request
      targetUser.status = 'archived';
      targetUser.reactivationRequest = false;
      targetUser.reactivationMessage = null;
      targetUser.reactivationRequestDate = null;
      await targetUser.save();
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const actionSummary = {
      'archive': `Admin archived user account. Reason: ${reason}`,
      'restore': 'Admin restored user account',
      'approve-reactivation': 'Admin approved reactivation request and restored user account',
      'reject-reactivation': 'Admin rejected reactivation request',
    };

    await logChange({
      actorEmail: req.user?.email,
      actorName: req.user?.name,
      actorRole: 'admin',
      targetType: 'user',
      targetId: targetUser._id.toString(),
      targetOwnerEmail: targetUser.email,
      action: `admin-${action}-user`,
      summary: actionSummary[action] || `Admin ${action}d user account`,
      metadata: action === 'archive' ? { reason } : undefined,
    });

    return res.status(200).json({ user: sanitizeUser(targetUser) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to manage user status', error: error.message });
  }
};

// GET /users - list users (admin)
exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.isPremium !== undefined) filters.isPremium = req.query.isPremium === 'true';
    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filters),
      User.find(filters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      users: users.map(sanitizeUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list users', error: error.message });
  }
};

// PATCH /users/:email/role - admin toggle role
exports.updateUserRole = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    const { role } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findOneAndUpdate({ email }, { $set: { role } }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logChange({
      actorEmail: req.user?.email?.toLowerCase(),
      actorName: req.user?.name || req.user?.displayName,
      actorRole: req.user?.role || 'admin',
      targetType: 'user',
      targetId: user._id?.toString(),
      targetOwnerEmail: user.email,
      action: 'update-role',
      summary: `Set role to ${role}`,
      metadata: { role },
    });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update role', error: error.message });
  }
};

// PATCH /users/:email/premium - admin toggle premium
exports.updateUserPremium = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    const { isPremium } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (typeof isPremium !== 'boolean') {
      return res.status(400).json({ message: 'isPremium must be boolean' });
    }

    const user = await User.findOneAndUpdate({ email }, { $set: { isPremium } }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    await logChange({
      actorEmail: req.user?.email?.toLowerCase(),
      actorName: req.user?.name || req.user?.displayName,
      actorRole: req.user?.role || 'admin',
      targetType: 'user',
      targetId: user._id?.toString(),
      targetOwnerEmail: user.email,
      action: 'update-premium',
      summary: `Set premium to ${isPremium}`,
      metadata: { isPremium },
    });

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update premium status', error: error.message });
  }
};

// GET /users/admin/:email - admin check
exports.checkAdmin = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email }).lean();
    return res.status(200).json({ isAdmin: user?.role === 'admin' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check admin', error: error.message });
  }
};

// GET /users/premium/:email - premium check
exports.checkPremium = async (req, res) => {
  try {
    const email = req.params.email?.toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const user = await User.findOne({ email }).lean();
    return res.status(200).json({ isPremium: !!user?.isPremium });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check premium', error: error.message });
  }
};

// POST /users/request-reactivation - archived user requests account reactivation
exports.requestReactivation = async (req, res) => {
  try {
    const { email, message } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: 'Reactivation message is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.status !== 'archived' && user.status !== 'reactivation_requested') {
      return res.status(400).json({ message: 'Account is not archived' });
    }

    user.status = 'reactivation_requested';
    user.reactivationRequest = true;
    user.reactivationMessage = message.trim();
    user.reactivationRequestDate = new Date();
    await user.save();

    await logChange({
      actorEmail: email,
      actorName: user.name,
      actorRole: 'user',
      targetType: 'user',
      targetId: user._id.toString(),
      targetOwnerEmail: email,
      action: 'request-reactivation',
      summary: `User requested account reactivation: ${message.trim().substring(0, 100)}`,
      metadata: { message: message.trim() },
    });

    return res.status(200).json({
      message: 'Reactivation request submitted successfully',
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to request reactivation', error: error.message });
  }
};

// GET /users/reactivation-requests - admin gets list of pending reactivation requests
exports.getReactivationRequests = async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { status: 'reactivation_requested' },
        { reactivationRequest: true }
      ]
    }).sort({ reactivationRequestDate: -1 }).lean();

    return res.status(200).json({
      total: users.length,
      users: users.map(sanitizeUser),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch reactivation requests', error: error.message });
  }
};
