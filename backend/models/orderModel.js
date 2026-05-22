const mongoose = require('mongoose');

const orderSchema = mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  status: { type: String, enum: ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'], default: 'Processing' },
  total: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  gst: { type: Number, required: true },
  shippingFee: { type: Number, required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true },
    img: { type: String, required: true }
  }],
  shippingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
  },
  paymentMethod: { type: String, enum: ['Razorpay', 'COD'], required: true },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String,
  },
  isPaid: { type: Boolean, required: true, default: false },
  paidAt: { type: Date },
  trackingEvents: [{
    status: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
