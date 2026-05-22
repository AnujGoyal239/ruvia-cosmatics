const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const { getAdminDashboard } = require('../controllers/adminController');

// @desc    Admin dashboard aggregated stats
// @route   GET /api/admin/dashboard?range=7d|30d|90d&lowStockThreshold=5
// @access  Private/Admin
router.get('/dashboard', protect, admin, getAdminDashboard);

module.exports = router;

