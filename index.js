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
const sanitizeHtml = require('sanitize-html');

const app = express();
const PORT = process.env.PORT || 5050;
const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

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

app.use(helmet());
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
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

const startServer = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in the environment');
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });


    app.listen(PORT, () => {
    });
  } catch (error) {
    console.error(
      'Failed to connect to MongoDB. Verify MONGODB_URI and that your current IP is whitelisted in Atlas.',
      error
    );
    process.exit(1);
  }
};

startServer();

module.exports = app;
