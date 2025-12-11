const express = require('express');
const {
  createLesson,
  listLessons,
  getLessonById,
  getLessonsByUser,
  updateLesson,
  deleteLesson,
  recordLessonView,
  toggleLike,
  toggleFavorite,
  getLessonStats,
  syncReportCounts,
} = require('../controllers/lessonController');
const verifyToken = require('../middleware/verifyToken');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

router.get('/lessons/stats', verifyToken, getLessonStats);
router.post('/lessons/sync-counts', verifyToken, syncReportCounts);
router.post('/lessons', verifyToken, createLesson);
router.get('/lessons', optionalAuth, listLessons);
router.get('/lessons/user/:email', verifyToken, getLessonsByUser);
router.get('/lessons/:id', optionalAuth, getLessonById);
router.post('/lessons/:id/view', verifyToken, recordLessonView);
router.post('/lessons/:id/like', verifyToken, toggleLike);
router.post('/lessons/:id/favorite', verifyToken, toggleFavorite);
router.patch('/lessons/:id', verifyToken, updateLesson);
router.delete('/lessons/:id', verifyToken, deleteLesson);

module.exports = router;
