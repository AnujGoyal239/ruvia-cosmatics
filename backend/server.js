const express = require('express');
const dotenv = require('dotenv');

// Load environment variables as early as possible
dotenv.config();

// Validate required environment variables
const { validateEnvVars } = require('./config/envValidation');
validateEnvVars();

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { sanitizeRequest } = require('./middleware/sanitizeMiddleware');
const { requestTimingMiddleware } = require('./middleware/requestTimingMiddleware');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const returnRoutes = require('./routes/returnRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const { protect } = require('./middleware/authMiddleware');
const { getOrderTracking } = require('./controllers/orderController');

// Connect to database
connectDB();

const app = express();

// Security middlewares
app.use(helmet());

// Dev/ops timing logs (disabled by default; enable with LOG_REQUESTS=true)
app.use(requestTimingMiddleware({ slowMs: 500 }));

// Parse cookies
app.use(cookieParser());

// Sanitize request body, query, and params to prevent NoSQL injection
app.use(sanitizeRequest);

// CORS whitelist
const whitelist = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like curl, server-to-server)
    if (!origin) return callback(null, true);
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Next.js dev + React StrictMode can trigger extra requests (double-invoked effects).
  // Keep production strict, but be more permissive in development to avoid blocking local testing.
  max: process.env.NODE_ENV === 'production' ? 200 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next */) => {
    // Always return JSON so the frontend can parse errors safely.
    res.status(429).json({
      message: 'Too many requests, please try again later.',
    });
  },
});
app.use(limiter);

// Webhook endpoint: use raw body parser to verify signature exactly
const paymentController = require('./controllers/paymentController');
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json' }), paymentController.handleRazorpayWebhook);

// Body parser for regular JSON routes
app.use(express.json());

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
// Safety net: ensure tracking endpoint exists even if router isn't refreshed
app.get('/api/orders/:id/tracking', protect, getOrderTracking);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/promotions', promotionRoutes);

// Routes
app.get('/', (req, res) => {
  res.send('Ruvia Cosmetics API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Centralized error handler (last middleware)
const { errorHandler } = require('./middleware/errorMiddleware');
app.use(errorHandler);
