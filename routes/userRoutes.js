const express = require('express');
const { upsertUser, getUserByEmail, updateUserProfile } = require('../controllers/userController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const isSelfOrAdmin = (reqEmail, targetEmail) => {
  if (!reqEmail || !targetEmail) return false;
  if (reqEmail === targetEmail) return true;
  return req.user?.role === 'admin';
};

router.post('/users', verifyToken, (req, res, next) => {
  const requester = req.user?.email?.toLowerCase();
  const target = req.body.email?.toLowerCase();
  if (!isSelfOrAdmin(requester, target)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return upsertUser(req, res, next);
});

router.get('/users/:email', verifyToken, (req, res, next) => {
  const requester = req.user?.email?.toLowerCase();
  const target = req.params.email?.toLowerCase();
  if (!isSelfOrAdmin(requester, target)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return getUserByEmail(req, res, next);
});

router.patch('/users/:email', verifyToken, (req, res, next) => {
  const requester = req.user?.email?.toLowerCase();
  const target = req.params.email?.toLowerCase();
  if (!isSelfOrAdmin(requester, target)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return updateUserProfile(req, res, next);
});

module.exports = router;
