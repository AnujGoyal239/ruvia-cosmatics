const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, handleRazorpayWebhook } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/razorpay', protect, createRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);
// Webhooks (do not protect with JWT)
// NOTE: webhook route is handled with a raw parser registered in server.js to preserve the exact body

module.exports = router;
