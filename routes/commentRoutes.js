const express = require('express');
const {
  createComment,
  getComments,
  updateComment,
  deleteComment,
  toggleCommentReaction,
  addReply,
  addNestedReply,
  addDeepNestedReply,
  updateReply,
  deleteReply,
  toggleReplyReaction,
} = require('../controllers/commentController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

// Comment CRUD
router.post('/lessons/:lessonId/comments', verifyToken, createComment);
router.get('/lessons/:lessonId/comments', getComments);
router.patch('/comments/:commentId', verifyToken, updateComment);
router.delete('/comments/:commentId', verifyToken, deleteComment);

// Comment reactions
router.post('/comments/:commentId/reactions', verifyToken, toggleCommentReaction);

// Replies (Level 1)
router.post('/comments/:commentId/replies', verifyToken, addReply);

// Nested replies (Level 2)
router.post('/comments/:commentId/replies/:replyId/replies', verifyToken, addNestedReply);

// Deep nested replies (Level 3)
router.post(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId/replies',
  verifyToken,
  addDeepNestedReply
);

// Update and delete replies at any level
router.patch('/comments/:commentId/replies/:replyId', verifyToken, updateReply);
router.patch(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId',
  verifyToken,
  updateReply
);
router.patch(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId/replies/:deepNestedReplyId',
  verifyToken,
  updateReply
);

router.delete('/comments/:commentId/replies/:replyId', verifyToken, deleteReply);
router.delete(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId',
  verifyToken,
  deleteReply
);
router.delete(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId/replies/:deepNestedReplyId',
  verifyToken,
  deleteReply
);

// Reactions on replies at any level
router.post(
  '/comments/:commentId/replies/:replyId/reactions',
  verifyToken,
  toggleReplyReaction
);
router.post(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId/reactions',
  verifyToken,
  toggleReplyReaction
);
router.post(
  '/comments/:commentId/replies/:replyId/replies/:nestedReplyId/replies/:deepNestedReplyId/reactions',
  verifyToken,
  toggleReplyReaction
);

module.exports = router;
