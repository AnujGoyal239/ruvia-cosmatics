const express = require('express');
const router = express.Router();

const { protect, admin } = require('../middleware/authMiddleware');
const {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
} = require('../controllers/promotionController');

// Public validation endpoint (useful for checkout UI)
router.get('/validate/:code', validatePromotion);

// Admin CRUD
router.get('/', protect, admin, listPromotions);
router.post('/', protect, admin, createPromotion);
router.put('/:id', protect, admin, updatePromotion);
router.delete('/:id', protect, admin, deletePromotion);

module.exports = router;

