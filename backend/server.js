const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const os = require('os');
require('dotenv').config();

// ==============================================
// ULTRA OPTIMIZATION IMPORTS
// ==============================================
let redisCache, connectWithOptimizedPooling, cacheMiddleware;
let generalLimiter, authenticatedLimiter, adminLimiter, strictLimiter;

// Try to load optimization modules (graceful fallback if not available)
// NOTE: Redis cache is DISABLED - removed to prevent caching issues
try {
  // Check if optimization directory exists
  const fs = require('fs');
  const optPath = path.join(__dirname, 'optimization');
  
  if (fs.existsSync(optPath)) {
    // Redis cache is DISABLED - set to null
    redisCache = null;
    console.log('ℹ️  Redis cache is disabled');
    
    try {
      const dbPooling = require('./optimization/database-pooling');
      connectWithOptimizedPooling = dbPooling.connectWithOptimizedPooling;
    } catch (e) {
      console.log('⚠️  Database pooling module not available:', e.message);
    }
    
    // Cache middleware is DISABLED - set to null
    cacheMiddleware = null;
    console.log('ℹ️  API cache middleware is disabled');
    
    try {
      const rateLimiters = require('./optimization/advanced-rate-limit');
      generalLimiter = rateLimiters.generalLimiter;
      authenticatedLimiter = rateLimiters.authenticatedLimiter;
      adminLimiter = rateLimiters.adminLimiter;
      strictLimiter = rateLimiters.strictLimiter;
    } catch (e) {
      console.log('⚠️  Advanced rate limiting not available:', e.message);
    }
    
    if (connectWithOptimizedPooling || generalLimiter) {
      console.log('✅ Optimization modules loaded (Redis cache disabled)');
    }
  } else {
    console.log('⚠️  Optimization directory not found, using basic setup');
  }
} catch (error) {
  console.log('⚠️  Optimization modules not available, using basic setup');
  console.log('   Error:', error.message);
  // Set all to null/undefined to ensure graceful fallback
  redisCache = null;
  connectWithOptimizedPooling = null;
  cacheMiddleware = null;
  generalLimiter = null;
  authenticatedLimiter = null;
  adminLimiter = null;
  strictLimiter = null;
}

const app = express();

// ==============================================
const baseUrl =
  process.env.BASE_URL && process.env.BASE_URL.trim() !== ''
    ? process.env.BASE_URL
    : process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim() !== ''
      ? process.env.FRONTEND_URL
      : 'https://yqpaynow.com';

console.log(`🌐 QR Code Base URL: ${baseUrl}`);


// ==============================================
// MIDDLEWARE SETUP
// ==============================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// Logging middleware - simplified for development
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// ==============================================
// RATE LIMITING (Ultra Optimized)
// ==============================================
if (generalLimiter) {
  // Use advanced tiered rate limiting if available
  app.use('/api/', generalLimiter);
  app.use('/api/auth/login', strictLimiter);
  app.use('/api/auth/register', strictLimiter);
  console.log('✅ Advanced rate limiting enabled');
} else {
  // Fallback to basic rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
  console.log('⚠️  Using basic rate limiting (install redis for advanced)');
}

// CORS configuration - Allow localhost and network IP for mobile QR scanning
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://yqpaynow.com',
  'https://yqpay-78918378061.us-central1.run.app',
  
  // optional: your LAN IP if testing on mobile
  'http://192.168.1.8:3001',
  'http://172.20.10.2:3001'
];


app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`⚠️  CORS Warning - Origin not in whitelist: ${origin}`);
      callback(null, true); // Allow for development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Origin',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==============================================
// DATABASE CONNECTION (Ultra Optimized)
// ==============================================

const MONGODB_URI = process.env.MONGODB_URI ;

// Redis cache is DISABLED - removed to prevent caching issues
// All routes will now return fresh data from database
console.log('ℹ️  Redis cache is disabled - all API responses are fresh from database');

// Connect to MongoDB with optimized pooling
if (connectWithOptimizedPooling) {
  connectWithOptimizedPooling(MONGODB_URI)
    .then(() => {
      console.log('✅ MongoDB connected with optimized connection pooling');
      
      // Start expired stock scheduler after DB connection
      const { startExpiredStockScheduler } = require('./jobs/expiredStockScheduler');
      startExpiredStockScheduler();
      
      // Initialize stock email notification jobs
      try {
        const { initializeStockEmailJobs } = require('./jobs/stockEmailNotifications');
        initializeStockEmailJobs();
        console.log('✅ Stock email notification jobs initialized');
      } catch (error) {
        console.warn('⚠️  Failed to initialize stock email jobs:', error.message);
      }
    })
    .catch((error) => {
      console.error('❌ MongoDB connection error:', error);
      console.log('Continuing without MongoDB - some features may not work');
    });
} else {
  // Fallback to basic connection
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB (basic mode)');
    
    // Start expired stock scheduler after DB connection
    const { startExpiredStockScheduler } = require('./jobs/expiredStockScheduler');
    startExpiredStockScheduler();
    
    // Initialize stock email notification jobs
    try {
      const { initializeStockEmailJobs } = require('./jobs/stockEmailNotifications');
      initializeStockEmailJobs();
      console.log('✅ Stock email notification jobs initialized');
    } catch (error) {
      console.warn('⚠️  Failed to initialize stock email jobs:', error.message);
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    console.log('Continuing without MongoDB - some features may not work');
  });
}

// ==============================================
// ROUTES
// ==============================================

// Import route modules
const authRoutes = require('./routes/auth');
const theaterRoutes = require('./routes/theaters');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const settingsRoutes = require('./routes/settings');
const uploadRoutes = require('./routes/upload');
const stockRoutes = require('./routes/stock');
// const pageAccessRoutes = require('./routes/pageAccess'); // OLD - DISABLED
const pageAccessArrayRoutes = require('./routes/pageAccessArray'); // NEW - Array-based structure
const qrCodeRoutes = require('./routes/qrcodes');
const qrCodeNameRoutes = require('./routes/qrcodenamesArray'); // Use array-based structure
const singleQRCodeRoutes = require('./routes/singleqrcodes');
const syncRoutes = require('./routes/sync');
const rolesRoutes = require('./routes/rolesArray'); // Use array-based structure
const reportsRoutes = require('./routes/reports'); // Reports route
const paymentRoutes = require('./routes/payments'); // Payment gateway routes

// Health check endpoint (with optimization status)
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    optimizations: {
      redis: false, // Redis cache is disabled
      databasePooling: !!connectWithOptimizedPooling,
      advancedRateLimit: !!generalLimiter,
      apiCaching: false // API caching is disabled
    }
  };
  
  res.json(health);
});

// Image proxy endpoint to bypass CORS
// Supports both GET (for small URLs) and POST (for large URLs to avoid 431 header size errors)
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Don't proxy data URLs (base64) - they're already complete
  if (url.startsWith('data:')) {
    return res.status(400).json({ error: 'Data URLs should not be proxied' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(buffer);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// POST endpoint for large URLs (avoids header size limits)
app.post('/api/proxy-image', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Don't proxy data URLs (base64) - they're already complete
  if (url.startsWith('data:')) {
    return res.status(400).json({ error: 'Data URLs should not be proxied' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(buffer);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// ==============================================
// MOUNT API ROUTES (With Caching)
// ==============================================

// Auth routes (strict rate limiting already applied above)
app.use('/api/auth', authRoutes);

// Dashboard (cache for 2 minutes)
if (cacheMiddleware) {
  app.use('/api/dashboard', cacheMiddleware({ ttl: 120 }), require('./routes/dashboard'));
} else {
  app.use('/api/dashboard', require('./routes/dashboard'));
}

// Theaters (cache for 5 minutes - frequently accessed)
if (cacheMiddleware) {
  app.use('/api/theaters', cacheMiddleware({ ttl: 300 }), authenticatedLimiter || generalLimiter, theaterRoutes);
} else {
  app.use('/api/theaters', theaterRoutes);
}

// Products (cache for 3 minutes)
if (cacheMiddleware) {
  app.use('/api/theater-products', cacheMiddleware({ ttl: 180 }), productRoutes.products);
  app.use('/api/theater-categories', cacheMiddleware({ ttl: 300 }), productRoutes.categories);
  app.use('/api/theater-product-types', cacheMiddleware({ ttl: 300 }), productRoutes.productTypes);
} else {
  app.use('/api/theater-products', productRoutes.products);
  app.use('/api/theater-categories', productRoutes.categories);
  app.use('/api/theater-product-types', productRoutes.productTypes);
}

app.use('/api/theater-kiosk-types', require('./routes/theater-kiosk-types'));
app.use('/api/theater-banners', require('./routes/theater-banners')); // Theater Banners CRUD

// Orders (no cache - real-time data)
app.use('/api/orders', authenticatedLimiter || generalLimiter, orderRoutes);

// Settings (cache for 10 minutes - rarely changes)
if (cacheMiddleware) {
  app.use('/api/settings', cacheMiddleware({ ttl: 600 }), settingsRoutes);
} else {
  app.use('/api/settings', settingsRoutes);
}
app.use('/api/chat', require('./routes/chat')); // Chat messaging routes
app.use('/api/notifications', require('./routes/notifications')); // Real-time notifications
app.use('/api/upload', uploadRoutes);

// Stock (cache for 1 minute - frequently updated)
if (cacheMiddleware) {
  app.use('/api/theater-stock', cacheMiddleware({ ttl: 60 }), stockRoutes);
} else {
  app.use('/api/theater-stock', stockRoutes);
}

// Page access (cache for 5 minutes)
if (cacheMiddleware) {
  app.use('/api/page-access', cacheMiddleware({ ttl: 300 }), pageAccessArrayRoutes);
} else {
  app.use('/api/page-access', pageAccessArrayRoutes);
}

// QR Codes (cache for 5 minutes)
if (cacheMiddleware) {
  app.use('/api/qrcodes', cacheMiddleware({ ttl: 300 }), qrCodeRoutes);
  app.use('/api/qrcodenames', cacheMiddleware({ ttl: 300 }), qrCodeNameRoutes);
  app.use('/api/single-qrcodes', cacheMiddleware({ ttl: 300 }), singleQRCodeRoutes);
} else {
  app.use('/api/qrcodes', qrCodeRoutes);
  app.use('/api/qrcodenames', qrCodeNameRoutes);
  app.use('/api/single-qrcodes', singleQRCodeRoutes);
}

app.use('/api/sync', syncRoutes);
app.use('/api/roles', rolesRoutes);

// Roles (cache for 10 minutes)
if (cacheMiddleware) {
  app.use('/api/email-notification', cacheMiddleware({ ttl: 600 }), require('./routes/emailNotificationsArray'));
  app.use('/api/email-notifications-array', cacheMiddleware({ ttl: 600 }), require('./routes/emailNotificationsArray'));
} else {
  // app.use('/api/roles', rolesRoutes);
  app.use('/api/email-notification', require('./routes/emailNotificationsArray'));
  app.use('/api/email-notifications-array', require('./routes/emailNotificationsArray'));
}

// Reports (no cache - dynamic data)
app.use('/api/reports', reportsRoutes);

// Payments (no cache - sensitive real-time data)
app.use('/api/payments', paymentRoutes);

// Theater users (cache for 2 minutes)
if (cacheMiddleware) {
  app.use('/api/theater-users', cacheMiddleware({ ttl: 120 }), require('./routes/theaterUsersArray'));
} else {
  app.use('/api/theater-users', require('./routes/theaterUsersArray'));
}

// Theater dashboard (cache for 1 minute)
if (cacheMiddleware) {
  app.use('/api/theater-dashboard', cacheMiddleware({ ttl: 60 }), require('./routes/theater-dashboard'));
} else {
  app.use('/api/theater-dashboard', require('./routes/theater-dashboard'));
}

// Default API route
app.get('/api', (req, res) => {
  res.json({
    message: 'YQPayNow Theater Canteen API',
    version: require('./package.json').version,
    endpoints: {
      auth: '/api/auth',
      theaters: '/api/theaters',
      products: '/api/theater-products',
      categories: '/api/theater-categories',
      productTypes: '/api/theater-product-types',
      orders: '/api/orders',
      settings: '/api/settings',
      upload: '/api/upload',
      stock: '/api/theater-stock',
      pageAccess: '/api/page-access',
      qrcodes: '/api/qrcodes',
      sync: '/api/sync',
      payments: '/api/payments',
      health: '/api/health'
    }
  });
});

// ------------------------------
// FRONTEND (REACT BUILD)
// ------------------------------

const buildPath = path.join(__dirname, "build");
app.use(express.static(buildPath, { maxAge: "1y" }));
app.get("/*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==============================================
// ERROR HANDLING
// ==============================================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌❌❌ [GLOBAL ERROR HANDLER] ❌❌❌');
  console.error('Error:', error);
  console.error('Error Stack:', error.stack);
  console.error('Request:', req.method, req.path);
  console.error('Request Body:', req.body);
  
  // MongoDB validation errors
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors
    });
  }
  
  // MongoDB duplicate key errors
  if (error.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: 'A record with this information already exists'
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }
  
  // Default error response
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// 
// ------------------------------
// START SERVER
// ------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 YQPayNow Server running on port ${PORT}`);
});

module.exports = app;
