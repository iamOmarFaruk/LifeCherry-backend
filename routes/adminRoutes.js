const express = require('express');
const { getDashboardStats } = require('../controllers/adminController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

const router = express.Router();

router.get('/admin/stats', verifyToken, verifyAdmin, getDashboardStats);

module.exports = router;
