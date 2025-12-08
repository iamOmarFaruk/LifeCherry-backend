const express = require('express');
const { listAdminChanges, listUserChanges } = require('../controllers/auditController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

router.get('/audit/admin', verifyToken, verifyAdmin, listAdminChanges);
router.get('/audit/user', verifyToken, listUserChanges);

module.exports = router;
