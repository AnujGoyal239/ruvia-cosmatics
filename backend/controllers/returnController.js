const ReturnRequest = require('../models/returnModel');
const Order = require('../models/orderModel');

// @desc    Create return request
// @route   POST /api/returns
// @access  Private
const createReturnRequest = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    if (!orderId || !reason) {
      return res.status(400).json({ message: 'Order ID and reason are required' });
    }

    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to request return for this order' });
    }

    // Check if return already exists
    const existingReturn = await ReturnRequest.findOne({ order: orderId });
    if (existingReturn) {
      return res.status(400).json({ message: 'Return request already exists for this order' });
    }

    const returnRequest = await ReturnRequest.create({
      order: orderId,
      user: req.user._id,
      reason
    });

    res.status(201).json(returnRequest);
  } catch (error) {
    console.error('Create return request error:', error);
    res.status(500).json({ message: 'Server error while creating return request' });
  }
};

// @desc    Get user's return requests
// @route   GET /api/returns/myreturns
// @access  Private
const getMyReturns = async (req, res) => {
  try {
    const returns = await ReturnRequest.find({ user: req.user._id })
      .populate('order', 'total status items')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    console.error('Get my returns error:', error);
    res.status(500).json({ message: 'Server error while fetching return requests' });
  }
};

// @desc    Get all return requests (Admin)
// @route   GET /api/returns
// @access  Private/Admin
const getAllReturns = async (req, res) => {
  try {
    const returns = await ReturnRequest.find({})
      .populate('order', 'total status items')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (error) {
    console.error('Get all returns error:', error);
    res.status(500).json({ message: 'Server error while fetching return requests' });
  }
};

// @desc    Update return status (Admin)
// @route   PUT /api/returns/:id/status
// @access  Private/Admin
const updateReturnStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const returnRequest = await ReturnRequest.findById(req.params.id);

    if (!returnRequest) {
      return res.status(404).json({ message: 'Return request not found' });
    }

    const validStatuses = ['Pending', 'Approved', 'Refunded', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    returnRequest.status = status;
    await returnRequest.save();

    res.json(returnRequest);
  } catch (error) {
    console.error('Update return status error:', error);
    res.status(500).json({ message: 'Server error while updating return status' });
  }
};

module.exports = {
  createReturnRequest,
  getMyReturns,
  getAllReturns,
  updateReturnStatus
};
