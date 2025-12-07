const mongoose = require('mongoose');
const Lesson = require('../models/Lesson');
const User = require('../models/User');

const visibilityOptions = new Set(['public', 'private', 'draft']);
const accessLevelOptions = new Set(['free', 'premium']);
const sortableFields = new Set(['createdAt', 'updatedAt', 'likesCount', 'favoritesCount']);

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
    likes,
    likesCount,
    favoritesCount,
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
    likes,
    likesCount,
    favoritesCount,
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
    isPremium: !!user?.isPremium,
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

    return res.status(201).json({ lesson: sanitizeLesson(lesson) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create lesson', error: error.message });
  }
};

exports.listLessons = async (req, res) => {
  try {
    const { role } = await getRequesterContext(req);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sort = parseSort(req.query.sort);

    const filters = {};

    const requestedVisibility = req.query.visibility;
    if (requestedVisibility === 'all' && role === 'admin') {
      // admin can see everything
    } else if (visibilityOptions.has(requestedVisibility)) {
      filters.visibility = requestedVisibility;
    } else {
      filters.visibility = 'public';
    }

    if (req.query.accessLevel && accessLevelOptions.has(req.query.accessLevel)) {
      filters.accessLevel = req.query.accessLevel;
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

    const { email, role, isPremium } = await getRequesterContext(req);
    const isOwner = email && email === lesson.creatorEmail;

    if (lesson.visibility !== 'public' && !isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (lesson.accessLevel === 'premium' && !isOwner && role !== 'admin') {
      if (!email) return res.status(401).json({ message: 'Login required for premium lessons' });
      if (!isPremium) return res.status(403).json({ message: 'Premium access required' });
    }

    return res.status(200).json({ lesson: sanitizeLesson(lesson) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch lesson', error: error.message });
  }
};

exports.recordLessonView = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(id).lean();
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

    const { email, role, isPremium } = await getRequesterContext(req);
    if (!email) return res.status(401).json({ message: 'Login required to record view' });

    const isOwner = email === lesson.creatorEmail;
    if (lesson.visibility !== 'public' && !isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (lesson.accessLevel === 'premium' && !isOwner && role !== 'admin' && !isPremium) {
      return res.status(403).json({ message: 'Premium access required' });
    }

    const updated = await Lesson.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
    return res.status(200).json({ views: updated.views });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record view', error: error.message });
  }
};

exports.getLessonsByUser = async (req, res) => {
  try {
    const targetEmail = req.params.email?.toLowerCase();
    if (!targetEmail) return res.status(400).json({ message: 'Email is required' });

    const { email, role } = await getRequesterContext(req);
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

    const { email, role } = await getRequesterContext(req);
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

    const { email, role } = await getRequesterContext(req);
    const isOwner = email && email === lesson.creatorEmail;

    if (!isOwner && role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await Lesson.deleteOne({ _id: id });
    return res.status(200).json({ message: 'Lesson deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete lesson', error: error.message });
  }
};
