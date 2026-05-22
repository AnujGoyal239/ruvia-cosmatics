const Order = require('../models/orderModel');
const Product = require('../models/productModel');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      paymentMethod,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: 'Payment method is required' });
    }

    const validPaymentMethods = ['Razorpay', 'COD', 'UPI'];
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // ✅ Verify items and calculate correct prices
    let itemsPrice = 0;
    const verifiedItems = [];
    
    for (const item of items) {
      const product = await Product.findOne({ id: String(item.id) });
      if (!product) {
        return res.status(400).json({ message: `Product ${item.id} not found` });
      }

      // Check stock
      if (product.countInStock < item.qty) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${product.countInStock}` 
        });
      }

      const itemTotal = product.price * item.qty;
      itemsPrice += itemTotal;

      verifiedItems.push({
        product: String(product.id),
        name: product.name,
        price: product.price,  // ✅ Use database price
        qty: item.qty,
        img: product.image
      });
    }

    // ✅ Calculate totals on server
    const gst = Math.round(itemsPrice * 0.18); // 18% GST
    const shippingFee = itemsPrice > 500 ? 0 : 50; // Free shipping over ₹500
    const total = itemsPrice + gst + shippingFee;

    // For COD, order is created but not marked as paid
    const isPaid = paymentMethod === 'COD' ? false : false;

    const order = new Order({
      items: verifiedItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      subtotal: itemsPrice,  // ✅ Server-calculated
      gst,  // ✅ Server-calculated
      shippingFee,  // ✅ Server-calculated
      total,  // ✅ Server-calculated
      isPaid,
    });

    const createdOrder = await order.save();

    // ✅ Update stock
    for (const item of verifiedItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { countInStock: -item.qty } }
      );
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error while creating order' });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'user',
      'name email'
    );

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ Check if user owns the order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching order' });
  }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ✅ Check if user owns the order or is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    // Payment result comes from Razorpay webhook/frontend confirmation
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };

    const updatedOrder = await order.save();

    res.json(updatedOrder);
  } catch (error) {
    console.error('Update order to paid error:', error);
    res.status(500).json({ message: 'Server error while updating order payment status' });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Server error while fetching orders' });
  }
};

// @desc    Admin: Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = status || order.status;
    await order.save();
    res.json(order);
  } catch (err) {
    console.error('updateOrderStatus error', err);
    res.status(500).json({ message: 'Could not update order status' });
  }
};

// @desc    Admin: Get all orders
// @route   GET /api/orders/all
// @access  Private/Admin
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).populate('user', 'name email');
    res.json(orders);
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Server error while fetching all orders' });
  }
};

module.exports = {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};
