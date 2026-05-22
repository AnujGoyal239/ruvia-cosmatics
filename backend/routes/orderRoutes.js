const express = require('express');
const router = express.Router();
const { addOrderItems, getOrderById, updateOrderToPaid, getMyOrders, getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');
const { check } = require('express-validator');
const { runValidation } = require('../middleware/validateMiddleware');

router.route('/').post(
	protect,
	[
		check('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
		check('total').isNumeric().withMessage('Total must be a number'),
		check('paymentMethod')
			.customSanitizer((value) => {
				if (typeof value !== 'string') return value;
				const normalized = value.trim().toLowerCase();
				if (normalized === 'cod') return 'COD';
				if (normalized === 'razorpay' || normalized === 'upi' || normalized === 'card') return 'Razorpay';
				return value;
			})
			.isIn(['Razorpay', 'COD'])
			.withMessage('Invalid payment method')
	],
	runValidation,
	addOrderItems
);
router.route('/myorders').get(protect, getMyOrders);
router.route('/all').get(protect, admin, getAllOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/status').put(protect, admin, updateOrderStatus);

module.exports = router;
