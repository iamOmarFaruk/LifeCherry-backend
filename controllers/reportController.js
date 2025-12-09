const mongoose = require('mongoose');
const Report = require('../models/Report');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const { logChange } = require('./auditController');
const validator = require('validator');
const xss = require('xss');

// Helper function to get user context from request
async function getRequesterContext(req) {
  const email = req.user?.email?.toLowerCase();
  if (!email) {
    return { email: null, user: null };
  }
  
  const user = await User.findOne({ email }).lean();
  return { email, user };
}

// Helper function to sanitize content
function sanitizeContent(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }
  
  let sanitized = content.trim();
  sanitized = xss(sanitized, {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  });
  sanitized = validator.stripLow(sanitized);
  sanitized = validator.escape(sanitized);
  
  return sanitized;
}

// Create a report
exports.createReport = async (req, res) => {
  try {
    const { lessonId } = req.params;
    let { reason, description } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Prevent reporting own lesson
    if (lesson.creatorEmail === email) {
      return res.status(400).json({ message: 'You cannot report your own lesson' });
    }

    // Check if user already reported this lesson
    const existingReport = await Report.findOne({ lessonId, reporterEmail: email });
    if (existingReport) {
      return res.status(400).json({ message: 'You have already reported this lesson' });
    }

    const validReasons = ['inappropriate-content', 'spam', 'misinformation', 'copyright', 'harassment', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({ message: 'Invalid report reason' });
    }

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ message: 'Description is required' });
    }

    if (description.length > 500) {
      return res.status(400).json({ message: 'Description is too long (max 500 characters)' });
    }

    // Sanitize description
    const sanitizedDescription = sanitizeContent(description);
    if (!sanitizedDescription) {
      return res.status(400).json({ message: 'Invalid description' });
    }

    const report = new Report({
      lessonId,
      reporterEmail: email,
      reporterName: user?.name || 'User',
      reason,
      description: sanitizedDescription,
      status: 'pending',
    });

    await report.save();

    // Log activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'User',
      actorRole: 'user',
      targetType: 'lesson',
      targetId: lessonId,
      targetOwnerEmail: lesson.creatorEmail,
      action: 'report',
      summary: `Reported lesson "${lesson.title}"`,
      metadata: {
        lessonTitle: lesson.title,
        reportId: report._id.toString(),
        reason,
      },
    });

    return res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    return res.status(500).json({ message: 'Failed to create report', error: error.message });
  }
};

// Get user's reports
exports.getUserReports = async (req, res) => {
  try {
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { reporterEmail: email };
    if (status) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('lessonId', 'title image category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query),
    ]);

    return res.status(200).json({
      reports,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
};

// Check if user reported a lesson
exports.checkUserReport = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(200).json({ reported: false });
    }

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const report = await Report.findOne({ lessonId, reporterEmail: email }).lean();
    
    return res.status(200).json({
      reported: !!report,
      report: report || null,
    });
  } catch (error) {
    console.error('Error checking report:', error);
    return res.status(500).json({ message: 'Failed to check report', error: error.message });
  }
};

// Withdraw a report
exports.withdrawReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: 'Invalid report id' });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.reporterEmail !== email) {
      return res.status(403).json({ message: 'Can only withdraw your own reports' });
    }

    if (report.status === 'resolved' || report.status === 'rejected') {
      return res.status(400).json({ message: 'Cannot withdraw a report that has been reviewed' });
    }

    report.status = 'withdrawn';
    await report.save();

    // Log activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'User',
      actorRole: 'user',
      targetType: 'report',
      targetId: reportId,
      targetOwnerEmail: email,
      action: 'withdraw',
      summary: 'Withdrew a report',
      metadata: { reportId },
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error withdrawing report:', error);
    return res.status(500).json({ message: 'Failed to withdraw report', error: error.message });
  }
};

// Get all reports (Admin only)
exports.getAllReports = async (req, res) => {
  try {
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) {
      query.status = status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('lessonId', 'title image category creatorEmail creatorName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query),
    ]);

    // Get stats
    const stats = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    stats.forEach(s => {
      statusCounts[s._id] = s.count;
    });

    return res.status(200).json({
      reports,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
      stats: statusCounts,
    });
  } catch (error) {
    console.error('Error fetching all reports:', error);
    return res.status(500).json({ message: 'Failed to fetch reports', error: error.message });
  }
};

// Review a report (Admin only)
exports.reviewReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    let { status, adminMessage } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: 'Invalid report id' });
    }

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const validStatuses = ['reviewing', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Sanitize admin message if provided
    if (adminMessage) {
      if (adminMessage.length > 1000) {
        return res.status(400).json({ message: 'Admin message is too long (max 1000 characters)' });
      }
      adminMessage = sanitizeContent(adminMessage);
    }

    report.status = status;
    report.reviewedBy = email;
    report.reviewerName = user?.name || 'Admin';
    report.adminMessage = adminMessage || '';
    report.reviewedAt = Date.now();
    await report.save();

    // Log activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'Admin',
      actorRole: 'admin',
      targetType: 'report',
      targetId: reportId,
      targetOwnerEmail: report.reporterEmail,
      action: 'review',
      summary: `Reviewed report: ${status}`,
      metadata: {
        reportId,
        status,
        lessonId: report.lessonId.toString(),
      },
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error('Error reviewing report:', error);
    return res.status(500).json({ message: 'Failed to review report', error: error.message });
  }
};

module.exports = {
  createReport: exports.createReport,
  getUserReports: exports.getUserReports,
  checkUserReport: exports.checkUserReport,
  withdrawReport: exports.withdrawReport,
  getAllReports: exports.getAllReports,
  reviewReport: exports.reviewReport,
};
