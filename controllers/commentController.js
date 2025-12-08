const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Lesson = require('../models/Lesson');
const User = require('../models/User');
const { logChange } = require('./auditController');

// Helper function to get user context from request
async function getRequesterContext(req) {
  const email = req.user?.email?.toLowerCase();
  if (!email) {
    return { email: null, user: null };
  }
  
  const user = await User.findOne({ email }).lean();
  return { email, user };
}

// Create a comment
exports.createComment = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { content } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const comment = new Comment({
      lessonId,
      userEmail: email,
      userName: user?.name || 'User',
      userPhoto: user?.photoURL || '',
      content: content.trim(),
      reactions: [],
      replies: [],
    });

    await comment.save();

    // Log activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'User',
      actorRole: 'user',
      targetType: 'comment',
      targetId: comment._id.toString(),
      targetOwnerEmail: lesson.creatorEmail,
      action: 'create',
      summary: `Commented on lesson "${lesson.title}"`,
      metadata: {
        lessonTitle: lesson.title,
        commentId: comment._id.toString(),
      },
    });

    return res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ message: 'Failed to create comment', error: error.message });
  }
};

// Get comments for a lesson
exports.getComments = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ message: 'Invalid lesson id' });
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      Comment.find({ lessonId }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Comment.countDocuments({ lessonId }),
    ]);

    return res.status(200).json({
      comments,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Failed to fetch comments', error: error.message });
  }
};

// Update comment
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment id' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userEmail !== email) {
      return res.status(403).json({ message: 'Can only edit your own comments' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    comment.content = content.trim();
    comment.updatedAt = Date.now();
    await comment.save();

    return res.status(200).json(comment);
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).json({ message: 'Failed to update comment', error: error.message });
  }
};

// Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment id' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userEmail !== email) {
      return res.status(403).json({ message: 'Can only delete your own comments' });
    }

    await Comment.findByIdAndDelete(commentId);

    // Log activity
    await logChange({
      actorEmail: email,
      actorName: user?.name || 'User',
      actorRole: 'user',
      targetType: 'comment',
      targetId: commentId,
      targetOwnerEmail: comment.userEmail,
      action: 'delete',
      summary: 'Deleted a comment',
      metadata: { commentId },
    });

    return res.status(200).json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Failed to delete comment', error: error.message });
  }
};

// Add/remove reaction to comment
exports.toggleCommentReaction = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { emoji } = req.body; // 👍, ❤️, 😂, 😮, 😢, 😡
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    if (!validEmojis.includes(emoji)) {
      return res.status(400).json({ message: 'Invalid reaction emoji' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment id' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user already reacted with same emoji
    const existingReactionIndex = comment.reactions.findIndex(
      (r) => r.userEmail === email && r.emoji === emoji
    );

    if (existingReactionIndex > -1) {
      // Remove reaction
      comment.reactions.splice(existingReactionIndex, 1);
    } else {
      // Remove any existing reaction from this user and add new one
      comment.reactions = comment.reactions.filter((r) => r.userEmail !== email);
      comment.reactions.push({
        userEmail: email,
        emoji,
        createdAt: Date.now(),
      });
    }

    await comment.save();
    return res.status(200).json(comment);
  } catch (error) {
    console.error('Error toggling reaction:', error);
    return res.status(500).json({ message: 'Failed to toggle reaction', error: error.message });
  }
};

// Add reply to comment (Level 1)
exports.addReply = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid comment id' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const reply = {
      _id: new mongoose.Types.ObjectId(),
      userEmail: email,
      userName: user?.name || 'User',
      userPhoto: user?.photoURL || '',
      content: content.trim(),
      reactions: [],
      replies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    comment.replies.push(reply);
    await comment.save();

    return res.status(201).json({ comment, replyId: reply._id });
  } catch (error) {
    console.error('Error adding reply:', error);
    return res.status(500).json({ message: 'Failed to add reply', error: error.message });
  }
};

// Add nested reply to a reply (Level 2)
exports.addNestedReply = async (req, res) => {
  try {
    const { commentId, replyId } = req.params;
    const { content } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const parentReply = comment.replies.id(replyId);
    if (!parentReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    const nestedReply = {
      _id: new mongoose.Types.ObjectId(),
      userEmail: email,
      userName: user?.name || 'User',
      userPhoto: user?.photoURL || '',
      content: content.trim(),
      reactions: [],
      replies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    parentReply.replies.push(nestedReply);
    await comment.save();

    return res.status(201).json({ comment, nestedReplyId: nestedReply._id });
  } catch (error) {
    console.error('Error adding nested reply:', error);
    return res
      .status(500)
      .json({ message: 'Failed to add nested reply', error: error.message });
  }
};

// Add deep nested reply to a nested reply (Level 3)
exports.addDeepNestedReply = async (req, res) => {
  try {
    const { commentId, replyId, nestedReplyId } = req.params;
    const { content } = req.body;
    const { email, user } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const parentReply = comment.replies.id(replyId);
    if (!parentReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    const nestedReply = parentReply.replies.id(nestedReplyId);
    if (!nestedReply) {
      return res.status(404).json({ message: 'Nested reply not found' });
    }

    const deepNestedReply = {
      _id: new mongoose.Types.ObjectId(),
      userEmail: email,
      userName: user?.name || 'User',
      userPhoto: user?.photoURL || '',
      content: content.trim(),
      reactions: [],
      replies: [], // Max 3 levels - no deeper replies allowed
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    nestedReply.replies.push(deepNestedReply);
    await comment.save();

    return res.status(201).json({ comment, deepNestedReplyId: deepNestedReply._id });
  } catch (error) {
    console.error('Error adding deep nested reply:', error);
    return res.status(500).json({
      message: 'Failed to add deep nested reply',
      error: error.message,
    });
  }
};

// Update reply at any level
exports.updateReply = async (req, res) => {
  try {
    const { commentId, replyId, nestedReplyId, deepNestedReplyId } = req.params;
    const { content } = req.body;
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    let targetReply = comment.replies.id(replyId);
    if (!targetReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Level 2 nested reply
    if (nestedReplyId && !deepNestedReplyId) {
      targetReply = targetReply.replies.id(nestedReplyId);
      if (!targetReply) {
        return res.status(404).json({ message: 'Nested reply not found' });
      }
    }

    // Level 3 deeply nested reply
    if (deepNestedReplyId) {
      const nestedReply = comment.replies.id(replyId).replies.id(nestedReplyId);
      if (!nestedReply) {
        return res.status(404).json({ message: 'Nested reply not found' });
      }
      targetReply = nestedReply.replies.id(deepNestedReplyId);
      if (!targetReply) {
        return res.status(404).json({ message: 'Deep nested reply not found' });
      }
    }

    if (targetReply.userEmail !== email) {
      return res.status(403).json({ message: 'Can only edit your own replies' });
    }

    targetReply.content = content.trim();
    targetReply.updatedAt = Date.now();
    await comment.save();

    return res.status(200).json(comment);
  } catch (error) {
    console.error('Error updating reply:', error);
    return res.status(500).json({ message: 'Failed to update reply', error: error.message });
  }
};

// Delete reply at any level
exports.deleteReply = async (req, res) => {
  try {
    const { commentId, replyId, nestedReplyId, deepNestedReplyId } = req.params;
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    let parentArray = comment.replies;
    let targetIndex = parentArray.findIndex((r) => r._id.toString() === replyId);

    // Level 2 nested reply
    if (nestedReplyId && !deepNestedReplyId) {
      const parentReply = comment.replies.id(replyId);
      if (!parentReply) {
        return res.status(404).json({ message: 'Reply not found' });
      }
      parentArray = parentReply.replies;
      targetIndex = parentArray.findIndex((r) => r._id.toString() === nestedReplyId);
    }

    // Level 3 deeply nested reply
    if (deepNestedReplyId) {
      const parentReply = comment.replies.id(replyId);
      if (!parentReply) {
        return res.status(404).json({ message: 'Reply not found' });
      }
      const nestedReply = parentReply.replies.id(nestedReplyId);
      if (!nestedReply) {
        return res.status(404).json({ message: 'Nested reply not found' });
      }
      parentArray = nestedReply.replies;
      targetIndex = parentArray.findIndex((r) => r._id.toString() === deepNestedReplyId);
    }

    if (targetIndex === -1) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    if (parentArray[targetIndex].userEmail !== email) {
      return res.status(403).json({ message: 'Can only delete your own replies' });
    }

    parentArray.splice(targetIndex, 1);
    await comment.save();

    return res.status(200).json({ message: 'Reply deleted', comment });
  } catch (error) {
    console.error('Error deleting reply:', error);
    return res.status(500).json({ message: 'Failed to delete reply', error: error.message });
  }
};

// Toggle reaction on reply at any level
exports.toggleReplyReaction = async (req, res) => {
  try {
    const { commentId, replyId, nestedReplyId, deepNestedReplyId } = req.params;
    const { emoji } = req.body;
    const { email } = await getRequesterContext(req);

    if (!email) {
      return res.status(401).json({ message: 'Login required' });
    }

    const validEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    if (!validEmojis.includes(emoji)) {
      return res.status(400).json({ message: 'Invalid reaction emoji' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    let targetReply = comment.replies.id(replyId);
    if (!targetReply) {
      return res.status(404).json({ message: 'Reply not found' });
    }

    // Level 2 nested reply
    if (nestedReplyId && !deepNestedReplyId) {
      targetReply = targetReply.replies.id(nestedReplyId);
      if (!targetReply) {
        return res.status(404).json({ message: 'Nested reply not found' });
      }
    }

    // Level 3 deeply nested reply
    if (deepNestedReplyId) {
      const nestedReply = comment.replies.id(replyId).replies.id(nestedReplyId);
      if (!nestedReply) {
        return res.status(404).json({ message: 'Nested reply not found' });
      }
      targetReply = nestedReply.replies.id(deepNestedReplyId);
      if (!targetReply) {
        return res.status(404).json({ message: 'Deep nested reply not found' });
      }
    }

    // Toggle reaction
    const existingIndex = targetReply.reactions.findIndex(
      (r) => r.userEmail === email && r.emoji === emoji
    );

    if (existingIndex > -1) {
      targetReply.reactions.splice(existingIndex, 1);
    } else {
      targetReply.reactions = targetReply.reactions.filter((r) => r.userEmail !== email);
      targetReply.reactions.push({
        userEmail: email,
        emoji,
        createdAt: Date.now(),
      });
    }

    await comment.save();
    return res.status(200).json(comment);
  } catch (error) {
    console.error('Error toggling reply reaction:', error);
    return res
      .status(500)
      .json({ message: 'Failed to toggle reply reaction', error: error.message });
  }
};
