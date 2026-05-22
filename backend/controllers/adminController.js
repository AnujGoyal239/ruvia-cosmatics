const Order = require('../models/orderModel');
const Product = require('../models/productModel');
const ReturnRequest = require('../models/returnModel');
const Review = require('../models/reviewModel');

const parseRangeToDays = (range = '30d') => {
  const normalized = String(range || '').trim().toLowerCase();
  if (normalized === '7d') return 7;
  if (normalized === '90d') return 90;
  return 30;
};

// @desc    Admin dashboard aggregated stats
// @route   GET /api/admin/dashboard?range=7d|30d|90d&lowStockThreshold=5
// @access  Private/Admin
const getAdminDashboard = async (req, res) => {
  try {
    const days = parseRangeToDays(req.query.range);
    const lowStockThreshold = Number(req.query.lowStockThreshold ?? 5);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalProducts,
      totalOrders,
      totalReviews,
      pendingReturns,
      lowStockProducts,
      recentOrders,
      revenueAgg,
      ordersByStatusAgg,
      paymentBreakdownAgg,
      timeseriesAgg,
    ] = await Promise.all([
      Product.countDocuments({}),
      Order.countDocuments({}),
      Review.countDocuments({}),
      ReturnRequest.countDocuments({ status: 'Pending' }),
      Product.find({ countInStock: { $lte: lowStockThreshold } })
        .sort({ countInStock: 1 })
        .select('name id price countInStock category image')
        .limit(10),
      Order.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('user', 'name email')
        .select('total subtotal gst shippingFee status isPaid paymentMethod createdAt user'),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const revenueInRange = revenueAgg?.[0]?.revenue || 0;
    const ordersInRange = revenueAgg?.[0]?.orders || 0;
    const aovInRange = ordersInRange > 0 ? Math.round((revenueInRange / ordersInRange) * 100) / 100 : 0;

    // Normalize chart series (ensure every day exists)
    const byDay = new Map(timeseriesAgg.map((d) => [d._id, d]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0, 10);
      const entry = byDay.get(key);
      series.push({
        date: key,
        orders: entry?.orders || 0,
        revenue: entry?.revenue || 0,
      });
    }

    res.json({
      rangeDays: days,
      kpis: {
        totalProducts,
        totalOrders,
        totalReviews,
        pendingReturns,
        revenueInRange,
        ordersInRange,
        aovInRange,
        lowStockCount: lowStockProducts.length,
      },
      charts: {
        ordersRevenueByDay: series,
        ordersByStatus: ordersByStatusAgg.map((x) => ({ status: x._id || 'Unknown', count: x.count })),
        paymentBreakdown: paymentBreakdownAgg.map((x) => ({ method: x._id || 'Unknown', count: x.count })),
      },
      lists: {
        lowStock: lowStockProducts,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('getAdminDashboard error:', error);
    res.status(500).json({ message: 'Server error while fetching admin dashboard' });
  }
};

module.exports = { getAdminDashboard };

