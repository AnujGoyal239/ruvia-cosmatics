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

    console.log('Order request body:', { items: items?.length, shippingAddress: !!shippingAddress, paymentMethod });

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address is required' });
    }

    // Normalize shipping address keys (frontend uses address/pin; schema supports both)
    const normalizedShippingAddress = {
      firstName: shippingAddress.firstName || '',
      lastName: shippingAddress.lastName || '',
      phone: shippingAddress.phone || '',
      address: shippingAddress.address || shippingAddress.street || '',
      city: shippingAddress.city || '',
      pin: shippingAddress.pin || shippingAddress.zipCode || '',
      street: shippingAddress.street || shippingAddress.address || '',
      state: shippingAddress.state || '',
      zipCode: shippingAddress.zipCode || shippingAddress.pin || '',
    };

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
      console.log('Looking for product with id:', item.id);
      const product = await Product.findOne({ id: String(item.id) });
      if (!product) {
        console.error(`Product not found with id: ${item.id}`);
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
      shippingAddress: normalizedShippingAddress,
      paymentMethod,
      subtotal: itemsPrice,  // ✅ Server-calculated
      gst,  // ✅ Server-calculated
      shippingFee,  // ✅ Server-calculated
      total,  // ✅ Server-calculated
      isPaid,
      trackingEvents: [{ status: 'Ordered', timestamp: new Date() }],
    });

    const createdOrder = await order.save();

    // ✅ Update stock
    for (const item of verifiedItems) {
      // NOTE: `item.product` stores the product "public id" (slug), not Mongo _id.
      // So we must update by `id` field (unique + indexed) instead of findByIdAndUpdate.
      await Product.findOneAndUpdate(
        { id: String(item.product) },
        { $inc: { countInStock: -item.qty } },
        { new: false }
      );
    }

    res.status(201).json(createdOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error while creating order', error: error.message });
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
    const nextStatus = status || order.status;
    const prevStatus = order.status;
    order.status = nextStatus;
    // Add a tracking event when status changes
    if (nextStatus && nextStatus !== prevStatus) {
      order.trackingEvents = order.trackingEvents || [];
      order.trackingEvents.push({ status: nextStatus, timestamp: new Date() });
    }
    await order.save();
    res.json(order);
  } catch (err) {
    console.error('updateOrderStatus error', err);
    res.status(500).json({ message: 'Could not update order status' });
  }
};

// @desc    Get tracking events for an order (customer or admin)
// @route   GET /api/orders/:id/tracking
// @access  Private
const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Ownership check (or admin)
    if (order.user?._id?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this order' });
    }

    const events = Array.isArray(order.trackingEvents) ? order.trackingEvents : [];
    // Sort ascending by time
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      orderId: order._id,
      status: order.status,
      isPaid: order.isPaid,
      paymentMethod: order.paymentMethod,
      trackingEvents: events,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error('getOrderTracking error:', error);
    res.status(500).json({ message: 'Server error while fetching tracking' });
  }
};

// @desc    Admin: add a tracking event manually
// @route   POST /api/orders/:id/tracking
// @access  Private/Admin
const addOrderTrackingEvent = async (req, res) => {
  try {
    const { status, timestamp } = req.body || {};
    if (!status) return res.status(400).json({ message: 'status is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.trackingEvents = order.trackingEvents || [];
    order.trackingEvents.push({ status, timestamp: timestamp ? new Date(timestamp) : new Date() });
    await order.save();
    res.json({ message: 'Tracking event added', trackingEvents: order.trackingEvents });
  } catch (error) {
    console.error('addOrderTrackingEvent error:', error);
    res.status(500).json({ message: 'Server error while updating tracking' });
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
  getOrderTracking,
  addOrderTrackingEvent,
};
