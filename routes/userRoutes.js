const express = require('express');
const {
  upsertUser,
  getUserByEmail,
  updateUserProfile,
  getMe,
  listUsers,
  updateUserRole,
  updateUserPremium,
  checkAdmin,
  checkPremium,
} = require('../controllers/userController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

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

router.get('/users/me', verifyToken, (req, res, next) => {
  return getMe(req, res, next);
});

router.patch('/users/me', verifyToken, (req, res, next) => {
  req.params.email = req.user?.email?.toLowerCase();
  return updateUserProfile(req, res, next);
});

router.get('/users', verifyToken, verifyAdmin, (req, res, next) => {
  return listUsers(req, res, next);
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

router.patch('/users/:email/role', verifyToken, verifyAdmin, (req, res, next) => {
  return updateUserRole(req, res, next);
});

router.patch('/users/:email/premium', verifyToken, verifyAdmin, (req, res, next) => {
  return updateUserPremium(req, res, next);
});

router.get('/users/admin/:email', verifyToken, (req, res, next) => {
  const requester = req.user?.email?.toLowerCase();
  const target = req.params.email?.toLowerCase();
  if (!isSelfOrAdmin(requester, target)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return checkAdmin(req, res, next);
});

router.get('/users/premium/:email', verifyToken, (req, res, next) => {
  const requester = req.user?.email?.toLowerCase();
  const target = req.params.email?.toLowerCase();
  if (!isSelfOrAdmin(requester, target)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return checkPremium(req, res, next);
});

module.exports = router;
