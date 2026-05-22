const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authUser, registerUser, getUserProfile, updateUserProfile, addAddress, removeAddress } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { clerkAuth } = require('../middleware/clerkMiddleware');
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

// Clerk SSO integration route
router.post('/clerk-login', clerkAuth, (req, res) => {
  // If clerkAuth succeeds, req.user is populated. Return custom token and user info.
  const generateToken = require('../utils/generateToken');
  
  // Set HTTP-only cookie with JWT token
  res.cookie('token', generateToken(req.user._id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
  
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    clerkId: req.user.clerkId,
  });
});

module.exports = router;
