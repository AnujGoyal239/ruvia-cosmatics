const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/orderModel');

// Initialize Razorpay if credentials are present; otherwise operate in degraded mode (for local testing)
let razorpay = null;
try {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    console.warn('Razorpay keys not set — payment creation will be disabled');
  }
} catch (e) {
  console.warn('Razorpay initialization failed:', e.message);
  razorpay = null;
}

// @desc    Create Razorpay Order
// @route   POST /api/payments/razorpay
// @access  Private
const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, orderId } = req.body; // amount in INR, and our internal Order ID
    if (!amount) return res.status(400).json({ message: 'Amount is required' });

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_order_${Math.floor(Math.random() * 1000000)}`,
      notes: { orderId: orderId || '' }
    };

    const rpOrder = await razorpay.orders.create(options);
    if (!rpOrder) return res.status(500).json({ message: 'Failed to create Razorpay order' });

    // If an internal orderId was provided, save the razorpay order id on that order for reconciliation
    if (orderId) {
      try {
        await Order.findByIdAndUpdate(orderId, { $set: { 'paymentResult.razorpay_order_id': rpOrder.id, 'razorpayOrderId': rpOrder.id } });
      } catch (e) {
        console.warn('Could not attach razorpay order id to Order', e.message);
      }
    }

    // Return order and public key id for client
    res.json({ razorpayOrder: rpOrder, key: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error('createRazorpayOrder error', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify Razorpay Payment signature
// @route   POST /api/payments/razorpay/verify
// @access  Private
const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign.toString()).digest('hex');

    if (razorpay_signature !== expectedSign) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    // Mark order as paid (prefer using provided internal orderId, else try to find by razorpay_order_id)
    let order;
    if (orderId) order = await Order.findById(orderId);
    if (!order) order = await Order.findOne({ 'paymentResult.razorpay_order_id': razorpay_order_id }) || await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: razorpay_payment_id,
        status: 'COMPLETED',
        update_time: new Date().toISOString(),
        email_address: order.user?.email || ''
      };
      await order.save();
    }

    res.json({ message: 'Payment verified and order updated', orderId: order ? order._id : null });
  } catch (error) {
    console.error('verifyRazorpayPayment error', error);
    res.status(500).json({ message: error.message });
  }
};



// Razorpay webhook handler with idempotency
const WebhookEvent = require('../models/webhookEventModel');
const handleRazorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    let raw = req.body;

    // Determine raw string to compute signature and hash
    const rawBuffer = Buffer.isBuffer(raw) ? raw : Buffer.from(JSON.stringify(raw || {}));
    const rawHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    // Idempotency: if we've already processed this exact payload hash, return 200
    const exists = await WebhookEvent.findOne({ hash: rawHash });
    if (exists) {
      console.log(JSON.stringify({ msg: 'Duplicate webhook received', hash: rawHash }));
      return res.json({ ok: true });
    }

    // Verify signature
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
    if (expected !== signature) return res.status(400).json({ message: 'Invalid signature' });

    const payload = JSON.parse(rawBuffer.toString('utf8'));
    // Process payload
    await processRazorpayPayload(payload, rawHash);

    // Record processed hash
    try {
      await WebhookEvent.create({ hash: rawHash, event: payload.event });
    } catch (e) {
      console.warn('Could not record webhook event hash', e.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Razorpay webhook error', err);
    res.status(500).json({ message: 'Webhook handling failed' });
  }
};

// Helper to process parsed Razorpay payload and reconcile orders
const processRazorpayPayload = async (payload) => {
  try {
    // Identify event and payment/order entity
    const event = payload.event;
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderEntity = payload?.payload?.order?.entity;

    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const notesOrderId = orderEntity?.notes?.orderId || null;

    // Try to find our internal Order
    let order = null;
    if (notesOrderId) {
      const OrderModel = require('../models/orderModel');
      order = await OrderModel.findById(notesOrderId);
    }
    if (!order && razorpayOrderId) {
      const OrderModel = require('../models/orderModel');
      order = await OrderModel.findOne({ razorpayOrderId: razorpayOrderId }) || await OrderModel.findOne({ 'paymentResult.razorpay_order_id': razorpayOrderId });
    }

    if (!order) {
      console.log('Razorpay webhook: could not find internal Order for', razorpayOrderId || notesOrderId);
      return;
    }

    // For successful payment events, mark order paid
    if (event && (event === 'payment.captured' || event === 'payment.authorized' || event === 'order.paid')) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: paymentEntity?.id || '',
        status: paymentEntity?.status || 'captured',
        update_time: new Date().toISOString(),
        email_address: order.user?.email || ''
      };
      await order.save();
      console.log('Order marked paid via Razorpay webhook:', order._id.toString());
    }
  } catch (err) {
    console.error('processRazorpayPayload error', err);
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
};
