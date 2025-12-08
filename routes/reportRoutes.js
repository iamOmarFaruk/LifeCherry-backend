const express = require('express');
const router = express.Router();
const {
  createReport,
  getUserReports,
  checkUserReport,
  withdrawReport,
  getAllReports,
  reviewReport,
} = require('../controllers/reportController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

// User creates a report on a lesson
router.post('/lessons/:lessonId/reports', verifyToken, createReport);

// User gets their own reports
router.get('/reports/my-reports', verifyToken, getUserReports);

// Check if user reported a specific lesson
router.get('/lessons/:lessonId/my-report', verifyToken, checkUserReport);

// User withdraws their report
router.delete('/reports/:reportId', verifyToken, withdrawReport);

// Admin gets all reports
router.get('/reports', verifyToken, verifyAdmin, getAllReports);

// Admin reviews a report
router.patch('/reports/:reportId', verifyToken, verifyAdmin, reviewReport);

module.exports = router;
