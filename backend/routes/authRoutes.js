const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authUser, registerUser, getUserProfile, updateUserProfile, addAddress, removeAddress } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { runValidation } = require('../middleware/validateMiddleware');

// Login validation
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Register validation
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// Profile update validation
const profileValidation = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone('en-IN'),
  body('password').optional().isLength({ min: 8 }),
];

router.post('/register', registerValidation, runValidation, registerUser);
router.post('/login', loginValidation, runValidation, authUser);
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});
router.get('/me', protect, getUserProfile);
router.put('/profile', protect, profileValidation, runValidation, updateUserProfile);
router.post('/address', protect, addAddress);
router.delete('/address/:addressId', protect, removeAddress);

module.exports = router;
