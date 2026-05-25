const Promotion = require('../models/promotionModel');

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

const isPromoActiveNow = (promo) => {
  if (!promo?.isActive) return false;
  const now = new Date();
  if (promo.startAt && now < new Date(promo.startAt)) return false;
  if (promo.endAt && now > new Date(promo.endAt)) return false;
  if (promo.usageLimit && promo.usedCount >= promo.usageLimit) return false;
  return true;
};

// Admin: list promotions
const listPromotions = async (req, res) => {
  const promos = await Promotion.find({}).sort({ createdAt: -1 });
  res.json(promos);
};

// Admin: create promotion
const createPromotion = async (req, res) => {
  const payload = { ...(req.body || {}) };
  payload.code = normalizeCode(payload.code);
  if (!payload.code) return res.status(400).json({ message: 'code is required' });
  if (!payload.type) return res.status(400).json({ message: 'type is required' });

  const exists = await Promotion.findOne({ code: payload.code });
  if (exists) return res.status(400).json({ message: 'Promotion code already exists' });

  const promo = await Promotion.create(payload);
  res.status(201).json(promo);
};

// Admin: update promotion
const updatePromotion = async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ message: 'Promotion not found' });

  const payload = { ...(req.body || {}) };
  if (payload.code) payload.code = normalizeCode(payload.code);

  Object.assign(promo, payload);
  await promo.save();
  res.json(promo);
};

// Admin: delete promotion
const deletePromotion = async (req, res) => {
  const promo = await Promotion.findById(req.params.id);
  if (!promo) return res.status(404).json({ message: 'Promotion not found' });
  await Promotion.findByIdAndDelete(req.params.id);
  res.json({ message: 'Promotion deleted' });
};

// Public/protected: validate a promo code (does not apply pricing)
const validatePromotion = async (req, res) => {
  const code = normalizeCode(req.params.code || req.query.code);
  if (!code) return res.status(400).json({ message: 'code is required' });

  const promo = await Promotion.findOne({ code });
  if (!promo) return res.status(404).json({ message: 'Invalid promo code' });

  const active = isPromoActiveNow(promo);
  if (!active) return res.status(400).json({ message: 'Promo code is not active' });

  res.json({
    code: promo.code,
    type: promo.type,
    minSubtotal: promo.minSubtotal || 0,
    maxDiscount: promo.maxDiscount ?? null,
    isActive: true,
    startAt: promo.startAt ?? null,
    endAt: promo.endAt ?? null,
  });
};

module.exports = {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
};

