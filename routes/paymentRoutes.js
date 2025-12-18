const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook, getAllPayments, verifyPayment } = require('../controllers/paymentController');
const verifyToken = require('../middleware/verifyToken');
const verifyAdmin = require('../middleware/verifyAdmin');

// Webhook must be first and likely doesn't use verifyToken
router.post('/payments/webhook', handleWebhook);

router.post('/payments/create-checkout-session', verifyToken, createCheckoutSession);
router.post('/payments/verify', verifyToken, verifyPayment);
router.get('/payments', verifyToken, verifyAdmin, getAllPayments);

module.exports = router;
