const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const Report = require('../models/Report');
const { logChange } = require('./auditController');
const { moveToTrash } = require('./trashController');

const visibilityOptions = new Set(['public', 'private', 'draft']);
const accessLevelOptions = new Set(['free', 'premium']);
const sortableFields = new Set(['createdAt', 'updatedAt', 'likesCount', 'favoritesCount', 'reportCount']);

const sanitizeLesson = (lesson) => {
  if (!lesson) return null;
  const doc = lesson.toObject ? lesson.toObject() : lesson;
  const {
    _id,
    title,
    description,
    category,
    emotionalTone,
    image,
    visibility,
    accessLevel,
    creatorEmail,
    creatorName,
    creatorPhoto,
    isFeatured,
    isReviewed,
    isArchived,
    likes,
    likesCount,
    favorites,
    favoritesCount,
    reportCount,
    views,
    createdAt,
    updatedAt,
  } = doc;

  return {
    id: _id,
    _id,
    title,
    description,
    category,
    emotionalTone,
    image,
    visibility,
    accessLevel,
    creatorEmail,
    creatorName,
    creatorPhoto,
    isFeatured,
    isReviewed,
    isArchived,
    likes,
    likesCount,
    favorites,
    favoritesCount,
    reportCount,
    views,
    createdAt,
    updatedAt,
  };
};

const parseSort = (value) => {
  if (!value) return { createdAt: -1 };
  let direction = 1;
  let field = value;
  if (value.startsWith('-')) {
    direction = -1;
    field = value.slice(1);
  }
  if (!sortableFields.has(field)) return { createdAt: -1 };
  return { [field]: direction };
};

const getRequesterContext = async (req) => {
  const email = req.user?.email?.toLowerCase() || null;
  if (!email) return { email: null, role: 'guest', isPremium: false, user: null };

  const user = await User.findOne({ email }).lean();
  return {
    email,
    role: user?.role || req.user?.role || 'user',
    isPremium: !!user?.isPremium || user?.role === 'admin',
    user,
  };
};

exports.createLesson = async (req, res) => {
  try {
    const { email, role, user } = await getRequesterContext(req);
    if (!email) return res.status(401).json({ message: 'Unauthorized' });
    if (!user) return res.status(403).json({ message: 'User profile not found' });

    const { title, description, category, emotionalTone, image } = req.body;
    let { visibility, accessLevel } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    visibility = visibilityOptions.has(visibility) ? visibility : 'public';
    accessLevel = accessLevelOptions.has(accessLevel) ? accessLevel : 'free';

    const lesson = await Lesson.create({
      title,
      description,
      category,
      emotionalTone,
      image,
      visibility,
      accessLevel,
      creatorEmail: email,
      creatorName: user.name || req.user?.name || req.user?.displayName || '',
      creatorPhoto: user.photoURL || req.user?.picture || '',
      isFeatured: role === 'admin' ? !!req.body.isFeatured : false,
      isReviewed: role === 'admin' ? !!req.body.isReviewed : false,
    });

    await logChange({
      actorEmail: email,
      actorName: user.name || req.user?.name || req.user?.displayName,
      actorRole: role,
      targetType: 'lesson',
      targetId: lesson._id.toString(),
      targetOwnerEmail: lesson.creatorEmail,
      action: 'create',
      summary: `Created lesson "${lesson.title}" (${lesson.accessLevel})`,
      metadata: { visibility: lesson.visibility, accessLevel: lesson.accessLevel },
    });

    return res.status(201).json({ lesson: sanitizeLesson(lesson) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create lesson', error: error.message });
  }
};

exports.listLessons = async (req, res) => {
  try {
    const { role, email, isPremium } = await getRequesterContext(req);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sort = parseSort(req.query.sort);

    const filters = {};
    // By default, hide archived lessons
    filters.isArchived = { $ne: true };

    const requestedVisibility = req.query.visibility;
    if (role === 'admin' && requestedVisibility === 'all') {
      // admin can see everything, including archived if they want?
      // If admin explicitly asks for 'all', maybe we should show archived too?
      // For now, let's keep archived hidden in the main list unless specifically requested?
      // Actually, let's just allow admin to override isArchived if they want.
      if (req.query.includeArchived === 'true') {
        delete filters.isArchived;
      }
    } else if (role === 'admin' && visibilityOptions.has(requestedVisibility)) {
      filters.visibility = requestedVisibility;
    } else {
      // non-admins only see public lessons regardless of query
      filters.visibility = 'public';
    }

    // Access gating
    const requestedAccess = req.query.accessLevel;
    if (!email) {
      // Guests: only public free lessons regardless of query params
      filters.accessLevel = 'free';
    } else if (role === 'admin') {
      if (requestedAccess && accessLevelOptions.has(requestedAccess)) {
        filters.accessLevel = requestedAccess;
      }
    } else if (isPremium) {
      if (requestedAccess && accessLevelOptions.has(requestedAccess)) {
        filters.accessLevel = requestedAccess;
      }
    } else {
      // Logged-in free users can see both free and premium (as locked in UI), so no filter
      if (requestedAccess && accessLevelOptions.has(requestedAccess)) {
        filters.accessLevel = requestedAccess;
      }
    }

    if (req.query.category) filters.category = req.query.category;
    if (req.query.emotionalTone) filters.emotionalTone = req.query.emotionalTone;
    if (req.query.creatorEmail) filters.creatorEmail = req.query.creatorEmail.toLowerCase();

    if (req.query.isFeatured !== undefined) {
      filters.isFeatured = req.query.isFeatured === 'true';
    }

    if (req.query.isReviewed !== undefined && role === 'admin') {
      filters.isReviewed = req.query.isReviewed === 'true';
    }

    if (req.query.search) {
      const regex = new RegExp(req.query.search, 'i');
      filters.$or = [{ title: regex }, { description: regex }];
    }

    if (req.query.favoritedBy) {
      filters.favorites = req.query.favoritedBy.toLowerCase();
    }

    const [total, lessons] = await Promise.all([
      Lesson.countDocuments(filters),
      Lesson.find(filters).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    return res.status(200).json({
      page,
      limit,
      total,
      lessons: lessons.map(sanitizeLesson),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch lessons', error: error.message });
  }
};

exports.getLessonById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    // Fetch creator bio
    const creator = await User.findOne({ email: lesson.creatorEmail }).select('bio').lean();
    const creatorBio = creator?.bio || '';

    const { email, role, isPremium } = await getRequesterContext(req);
    const isOwner = email && email === lesson.creatorEmail;

    if (lesson.visibility !== 'public' && !isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (lesson.accessLevel === 'premium' && !isOwner && role !== 'admin') {
      if (!email) return res.status(401).json({ message: 'Login required for premium lessons' });
      if (!isPremium) return res.status(403).json({ message: 'Premium access required' });
    }

    const sanitizedLesson = sanitizeLesson(lesson);
    sanitizedLesson.creatorBio = creatorBio;

    return res.status(200).json({ lesson: sanitizedLesson });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch lesson', error: error.message });
  }
};

exports.recordLessonView = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role } = await getRequesterContext(req);

    console.log('[View Recording] Request received:', { lessonId: id, userEmail: email, userRole: role });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('[View Recording] ❌ Invalid lesson ID:', id);
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) {
      console.log('[View Recording] ❌ Lesson not found:', id);
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const { isPremium, user } = await getRequesterContext(req);
    if (!email) {
      console.log('[View Recording] ❌ Not authenticated');
      return res.status(401).json({ message: 'Login required to record view' });
    }

    // Prevent recording views for own lessons
    const isOwner = email === lesson.creatorEmail;
    if (isOwner) {
      console.log('[View Recording] ❌ User is lesson creator, cannot record own post view');
      return res.status(403).json({ message: 'Cannot record view on your own lesson' });
    }

    if (lesson.visibility !== 'public' && !isOwner && role !== 'admin') {
      console.log('[View Recording] ❌ Lesson not public and user is not owner/admin');
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (lesson.accessLevel === 'premium' && !isOwner && role !== 'admin' && !isPremium) {
      console.log('[View Recording] ❌ Premium lesson and user not premium');
      return res.status(403).json({ message: 'Premium access required' });
    }

    // Increment view count
    console.log('[View Recording] ✅ Recording view for lesson:', lesson.title);
    const updated = await Lesson.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
    console.log('[View Recording] ✅ View recorded. New view count:', updated.views);

    // Log the view activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'User',
      actorRole: role,
      targetType: 'lesson',
      targetId: id,
      targetOwnerEmail: lesson.creatorEmail,
      action: 'view',
      summary: `Viewed lesson "${lesson.title}"`,
      metadata: {
        lessonTitle: lesson.title,
        category: lesson.category,
        totalViews: updated.views
      },
    });
    console.log('[View Recording] ✅ Activity logged');

    return res.status(200).json({ views: updated.views });
  } catch (error) {
    console.error('[View Recording] ❌ Error:', error.message);
    return res.status(500).json({ message: 'Failed to record view', error: error.message });
  }
};

exports.getLessonsByUser = async (req, res) => {
  try {
    const targetEmail = req.params.email?.toLowerCase();
    if (!targetEmail) return res.status(400).json({ message: 'Email is required' });

    const { email, role, user } = await getRequesterContext(req);
    const isOwner = email === targetEmail;

    if (!isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const filters = { creatorEmail: targetEmail };
    if (!isOwner && role === 'admin' && req.query.visibility) {
      if (visibilityOptions.has(req.query.visibility)) {
        filters.visibility = req.query.visibility;
      }
    }

    const lessons = await Lesson.find(filters).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ lessons: lessons.map(sanitizeLesson) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch user lessons', error: error.message });
  }
};

exports.updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const { email, role, user } = await getRequesterContext(req);
    const isOwner = email && email === lesson.creatorEmail;
    if (!isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const updates = {};
    const allowed = ['title', 'description', 'category', 'emotionalTone', 'image'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.visibility && visibilityOptions.has(req.body.visibility)) {
      updates.visibility = req.body.visibility;
    }

    if (req.body.accessLevel && accessLevelOptions.has(req.body.accessLevel)) {
      updates.accessLevel = req.body.accessLevel;
    }

    if (role === 'admin') {
      if (req.body.isFeatured !== undefined) updates.isFeatured = !!req.body.isFeatured;
      if (req.body.isReviewed !== undefined) updates.isReviewed = !!req.body.isReviewed;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updated = await Lesson.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    // Calculate detailed changes for the log
    const detailedChanges = [];
    Object.keys(updates).forEach((key) => {
      const oldValue = lesson[key];
      const newValue = updates[key];
      // Simple equality check (works for strings, numbers, booleans in this context)
      if (oldValue !== newValue) {
        detailedChanges.push({
          field: key,
          from: oldValue,
          to: newValue
        });
      }
    });

    await logChange({
      actorEmail: email,
      actorName: user?.name || req.user?.name || req.user?.displayName,
      actorRole: role,
      targetType: 'lesson',
      targetId: id,
      targetOwnerEmail: lesson.creatorEmail,
      action: 'update',
      summary: `Updated lesson "${lesson.title}"`,
      metadata: {
        fields: Object.keys(updates),
        detailedChanges
      },
    });

    return res.status(200).json({ lesson: sanitizeLesson(updated) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update lesson', error: error.message });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const { email, role, user } = await getRequesterContext(req);
    const isOwner = email && email === lesson.creatorEmail;

    if (!isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Move to trash instead of permanently deleting
    const lessonData = lesson.toObject ? lesson.toObject() : lesson;
    await moveToTrash(
      id,
      'lesson',
      lessonData,
      email,
      user?.name || req.user?.name || req.user?.displayName || 'Unknown',
      lesson.creatorEmail,
      lesson.creatorName
    );

    // Remove from Lesson collection
    await Lesson.deleteOne({ _id: id });

    await logChange({
      actorEmail: email,
      actorName: user?.name || req.user?.name || req.user?.displayName,
      actorRole: role,
      targetType: 'lesson',
      targetId: id,
      targetOwnerEmail: lesson.creatorEmail,
      action: 'delete',
      summary: `Moved lesson "${lesson.title}" to trash`,
      metadata: { visibility: lesson.visibility, accessLevel: lesson.accessLevel, movedToTrash: true },
    });

    return res.status(200).json({ message: 'Lesson moved to trash' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete lesson', error: error.message });
  }
};

// Toggle like on a lesson
exports.toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson ID' });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Prevent self-liking
    if (email === lesson.creatorEmail) {
      return res.status(403).json({ message: 'You cannot like your own lesson' });
    }

    const likes = lesson.likes || [];
    const userEmail = email.toLowerCase();
    const hasLiked = likes.includes(userEmail);

    if (hasLiked) {
      // Remove like
      lesson.likes = likes.filter((e) => e !== userEmail);
      lesson.likesCount = Math.max(0, lesson.likesCount - 1);
    } else {
      // Add like
      lesson.likes.push(userEmail);
      lesson.likesCount = (lesson.likesCount || 0) + 1;
    }

    await lesson.save();

    await logChange({
      actorEmail: email,
      actorName: user?.name || req.user?.name || req.user?.displayName || 'User',
      actorRole: role,
      targetType: 'lesson',
      targetId: id,
      targetOwnerEmail: lesson.creatorEmail,
      action: hasLiked ? 'unlike' : 'like',
      summary: `${hasLiked ? 'Removed like from' : 'Liked'} lesson "${lesson.title}"`,
    });

    return res.status(200).json({
      message: hasLiked ? 'Like removed' : 'Like added',
      lesson: sanitizeLesson(lesson),
      isLiked: !hasLiked,
      likesCount: lesson.likesCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to toggle like', error: error.message });
  }
};

// Toggle favorite on a lesson
exports.toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, role, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson ID' });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Prevent self-favoriting
    if (email === lesson.creatorEmail) {
      return res.status(403).json({ message: 'You cannot favorite your own lesson' });
    }

    const favorites = lesson.favorites || [];
    const userEmail = email.toLowerCase();
    const hasFavorited = favorites.includes(userEmail);

    if (hasFavorited) {
      // Remove favorite
      lesson.favorites = favorites.filter((e) => e !== userEmail);
      lesson.favoritesCount = Math.max(0, lesson.favoritesCount - 1);
    } else {
      // Add favorite
      lesson.favorites.push(userEmail);
      lesson.favoritesCount = (lesson.favoritesCount || 0) + 1;
    }

    await lesson.save();

    await logChange({
      actorEmail: email,
      actorName: user?.name || req.user?.name || req.user?.displayName || 'User',
      actorRole: role,
      targetType: 'lesson',
      targetId: id,
      targetOwnerEmail: lesson.creatorEmail,
      action: hasFavorited ? 'unfavorite' : 'favorite',
      summary: `${hasFavorited ? 'Removed from' : 'Saved to'} favorites: "${lesson.title}"`,
    });

    return res.status(200).json({
      message: hasFavorited ? 'Removed from favorites' : 'Added to favorites',
      lesson: sanitizeLesson(lesson),
      isFavorited: !hasFavorited,
      favoritesCount: lesson.favoritesCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to toggle favorite', error: error.message });
  }
};

exports.getLessonStats = async (req, res) => {
  try {
    const { email, role } = await getRequesterContext(req);

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const [total, publicCount, privateCount, featured, flagged, premium] = await Promise.all([
      Lesson.countDocuments({}),
      Lesson.countDocuments({ visibility: 'public' }),
      Lesson.countDocuments({ visibility: 'private' }),
      Lesson.countDocuments({ isFeatured: true }),
      Lesson.countDocuments({ reportCount: { $gt: 0 } }),
      Lesson.countDocuments({ accessLevel: 'premium' })
    ]);

    return res.status(200).json({
      total,
      public: publicCount,
      private: privateCount,
      featured,
      flagged,
      premium
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch stats', error: error.message });
  }
};

exports.syncReportCounts = async (req, res) => {
  try {
    const { role } = await getRequesterContext(req);
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('[Sync] Starting report count sync...');

    // 1. Reset all counts to 0
    await Lesson.updateMany({}, { reportCount: 0 });

    // 2. Aggregate active reports (not withdrawn)
    const reportCounts = await Report.aggregate([
      {
        $match: {
          status: { $ne: 'withdrawn' }
        }
      },
      {
        $group: {
          _id: '$lessonId',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log(`[Sync] Found reports for ${reportCounts.length} lessons`);

    // 3. Update lessons with new counts
    const updatePromises = reportCounts.map(({ _id, count }) =>
      Lesson.findByIdAndUpdate(_id, { reportCount: count })
    );

    await Promise.all(updatePromises);
    console.log('[Sync] Completed report count sync');

    return res.status(200).json({
      message: 'Report counts synced successfully',
      updatedLessons: reportCounts.length
    });
  } catch (error) {
    console.error('[Sync] Failed:', error);
    return res.status(500).json({ message: 'Failed to sync report counts', error: error.message });
  }
};
