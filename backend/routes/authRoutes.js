const express = require('express');
const router = express.Router();
const { authUser, registerUser, getUserProfile, updateUserProfile, addAddress, removeAddress } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { clerkAuth } = require('../middleware/clerkMiddleware');

router.post('/register', registerUser);
router.post('/login', authUser);
router.get('/me', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/address', protect, addAddress);
router.delete('/address/:addressId', protect, removeAddress);

// Clerk SSO integration route
router.post('/clerk-login', clerkAuth, (req, res) => {
  // If clerkAuth succeeds, req.user is populated. Return custom token and user info.
  const generateToken = require('../utils/generateToken');
  res.json({
    _id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    clerkId: req.user.clerkId,
    token: generateToken(req.user._id),
  });
});

module.exports = router;
