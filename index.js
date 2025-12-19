const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const userRoutes = require('./routes/userRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const auditRoutes = require('./routes/auditRoutes');
const trashRoutes = require('./routes/trashRoutes');
const commentRoutes = require('./routes/commentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const sanitizeHtml = require('sanitize-html');
const hpp = require('hpp');
const app = express();
const PORT = process.env.PORT || 5050;
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://life-cherry-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in the environment');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error(
      'Failed to connect to MongoDB. Verify MONGODB_URI and that your current IP is whitelisted in Atlas.',
      error
    );
    throw error;
  }
};

// Middleware to ensure DB connection before handling requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

const sanitizePayload = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      return;
    }
    if (typeof value === 'object') sanitizePayload(value);
  });
};

const sanitizeStrings = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
    } else if (Array.isArray(value)) {
      obj[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeHtml(item, { allowedTags: [], allowedAttributes: {} })
          : sanitizeStrings(item) || item
      );
    } else if (typeof value === 'object') {
      sanitizeStrings(value);
    }
  });
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow any origin for now to fix deployment issues
    return callback(null, true);
  },
  credentials: true
}));
app.use(hpp());

// Custom middleware to capture raw body for Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/payments/webhook')) {
    next();
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});

// For webhook route, we need raw body. For others, we need generic JSON parsing if not handled above.
// However, reusing express.json for others is cleaner.
// Actually, let's use a cleaner approach:
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    // Only store rawBody if needed (e.g., for Stripe)
    if (req.originalUrl.includes('/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));

app.use((req, _res, next) => {
  // Skip sanitization for webhook rawBody
  if (req.originalUrl.includes('/webhook')) return next();

  sanitizePayload(req.body);
  sanitizePayload(req.params);
  sanitizePayload(req.query);
  sanitizeStrings(req.body);
  sanitizeStrings(req.params);
  sanitizeStrings(req.query);
  return next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/', (req, res) => {
  res.json({ message: 'Hello LifeCherry' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', userRoutes);
app.use('/api', lessonRoutes);
app.use('/api', auditRoutes);
app.use('/api', trashRoutes);
app.use('/api', commentRoutes);
app.use('/api', reportRoutes);
app.use('/api', adminRoutes);
app.use('/api', paymentRoutes);



// Initialize DB connection for serverless


// Export app for Verce
module.exports = app;

// Only start the server if running directly (dev/local mode)
if (require.main === module) {
  const startServer = async () => {
    try {
      await connectDB();
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };

  startServer();
}

