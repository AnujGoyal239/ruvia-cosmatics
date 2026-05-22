const express = require('express');
const dotenv = require('dotenv');

// Load environment variables as early as possible
dotenv.config();

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const returnRoutes = require('./routes/returnRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');

// Connect to database
connectDB();

const app = express();

// Security middlewares
app.use(helmet());

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
};
app.use(cors(corsOptions));

// Rate limiter
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }); // 200 requests per 15 minutes
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
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/wishlist', wishlistRoutes);

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
