const express = require('express');
const {
  listTrash,
  restoreFromTrash,
  permanentlyDeleteFromTrash,
} = require('../controllers/trashController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

// Admin only routes
router.get('/admin/trash', verifyToken, verifyAdmin, listTrash);
router.post('/admin/trash/:id/restore', verifyToken, verifyAdmin, restoreFromTrash);
router.delete('/admin/trash/:id/permanent', verifyToken, verifyAdmin, permanentlyDeleteFromTrash);

module.exports = router;
