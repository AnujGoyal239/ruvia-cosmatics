const Cart = require('../models/cartModel');

// Save or replace the user's cart
const saveCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items) {
      return res.status(400).json({ message: 'Items are required' });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items format' });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    const mapped = items.map(i => ({
      productId: i.product || i.id,
      id: i.id,
      name: i.name,
      price: i.price,
      qty: i.quantity || i.qty || 1,
      img: i.img || i.image
    }));

    if (cart) {
      cart.items = mapped;
      await cart.save();
    } else {
      cart = await Cart.create({ user: req.user._id, items: mapped });
    }

    res.json(cart);
  } catch (err) {
    console.error('saveCart error', err);
    res.status(500).json({ message: 'Server error while saving cart' });
  }
};

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    res.json(cart || { items: [] });
  } catch (err) {
    console.error('getCart error', err);
    res.status(500).json({ message: 'Server error while fetching cart' });
  }
};

module.exports = { saveCart, getCart };
