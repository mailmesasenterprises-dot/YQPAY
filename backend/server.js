const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const os = require('os');

// Load environment variables - specify path explicitly to ensure .env is found
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// CORS configuration - Use environment variable for allowed origins
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://yqpaynow.com'
    ];

console.log('🔒 CORS allowed origins:', allowedOrigins);

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

const MONGODB_URI = process.env.MONGODB_URI?.trim();

// Validate MongoDB URI
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment variables!');
  console.error('   Please set MONGODB_URI in your .env file');
  console.error('   Expected location: backend/.env');
  console.error('   Format: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name');
  process.exit(1);
}

// Validate MongoDB URI format
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  console.error('❌ Invalid MONGODB_URI format!');
  console.error('   Must start with mongodb:// or mongodb+srv://');
  console.error('   Current value starts with:', MONGODB_URI.substring(0, 20));
  process.exit(1);
}

// Check for common connection string issues
if (MONGODB_URI.startsWith('mongodb+srv://')) {
  console.log('ℹ️  Using MongoDB Atlas connection (mongodb+srv://)');
  console.log('ℹ️  Ensure your IP is whitelisted in Atlas Network Access');
  
  // Check for multiple @ symbols (indicates password encoding issue)
  const atCount = (MONGODB_URI.match(/@/g) || []).length;
  if (atCount > 1) {
    console.warn('⚠️  WARNING: Connection string contains multiple @ symbols.');
    console.warn('   Password might need URL encoding if it contains special characters.');
    console.warn('   Special characters (@, :, /, ?, #, [, ]) must be URL-encoded.');
  }
  
  // Check if database name is included
  if (!MONGODB_URI.includes('/') || MONGODB_URI.split('/').length < 4) {
    console.warn('⚠️  WARNING: Connection string might be missing database name.');
    console.warn('   Format should be: mongodb+srv://user:pass@cluster.mongodb.net/database_name');
  }
}

// Log connection string info (without exposing password)
const uriInfo = MONGODB_URI.replace(/:[^:@]+@/, ':****@');
console.log('🔍 MongoDB URI loaded:', uriInfo.substring(0, 50) + '...');

// Redis cache is DISABLED - removed to prevent caching issues
// All routes will now return fresh data from database
console.log('ℹ️  Redis cache is disabled - all API responses are fresh from database');

// Connect to MongoDB with optimized pooling
// IMPORTANT: Connection is asynchronous, but we don't block server startup
// Routes will check connection status before using database
if (connectWithOptimizedPooling) {
  console.log('🔄 Attempting to connect to MongoDB Atlas...');
  
  // ✅ FIX: Add connection timeout monitor
  const connectionStartTime = Date.now();
  const connectionTimeout = 35000; // 35 seconds (slightly longer than serverSelectionTimeoutMS)
  
  const connectionTimeoutId = setTimeout(() => {
    if (mongoose.connection.readyState === 2) {
      console.error('❌ MongoDB connection timeout - stuck in connecting state');
      console.error('   Connection has been attempting for more than 35 seconds');
      console.error('   This usually indicates:');
      console.error('   1. Network connectivity issues');
      console.error('   2. IP not whitelisted in MongoDB Atlas');
      console.error('   3. Incorrect connection string');
      console.error('   4. MongoDB Atlas cluster is paused or down');
      console.error('\n   Attempting to close and retry connection...');
      
      // Close the stuck connection
      mongoose.connection.close().catch(() => {});
      
      // Retry after 5 seconds
      setTimeout(() => {
        console.log('🔄 Retrying MongoDB connection...');
        connectWithOptimizedPooling(MONGODB_URI)
          .then(() => {
            console.log('✅ MongoDB connected on retry');
          })
          .catch((retryError) => {
            console.error('❌ Retry also failed:', retryError.message);
          });
      }, 5000);
    }
  }, connectionTimeout);
  
  connectWithOptimizedPooling(MONGODB_URI)
    .then(() => {
      clearTimeout(connectionTimeoutId);
      const connectionDuration = Date.now() - connectionStartTime;
      console.log(`✅ MongoDB connected with optimized connection pooling (took ${connectionDuration}ms)`);
      console.log(`   Database: ${mongoose.connection.name}`);
      console.log(`   Host: ${mongoose.connection.host}`);
      console.log(`   Ready State: ${mongoose.connection.readyState}`);
      
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
      clearTimeout(connectionTimeoutId);
      console.error('❌ MongoDB connection error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      
      // Provide specific guidance based on error type
      if (error.name === 'MongooseServerSelectionError' || error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('\n🔍 Troubleshooting steps:');
        console.error('1. Check MONGODB_URI in backend/.env file');
        console.error('2. Verify IP is whitelisted in MongoDB Atlas Network Access');
        console.error('   - Go to: Atlas Dashboard → Network Access → IP Access List');
        console.error('   - Add your IP or use 0.0.0.0/0 for development (NOT for production!)');
        console.error('3. Check if cluster is running (not paused) in Atlas Dashboard');
        console.error('4. Verify network connectivity and firewall settings');
        console.error('5. Check if connection string format is correct');
      } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth') || error.message.includes('user not found')) {
        console.error('\n🔍 Authentication issue:');
        console.error('1. Check username and password in connection string');
        console.error('2. Verify user exists in MongoDB Atlas Database Access');
        console.error('3. Ensure password doesn\'t have special characters (or is URL-encoded)');
        console.error('4. Reset password in Atlas if needed');
      } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
        console.error('\n🔍 Connection timeout:');
        console.error('1. Check internet connectivity');
        console.error('2. Verify MongoDB Atlas cluster is running');
        console.error('3. Check firewall/VPN settings');
        console.error('4. Verify IP whitelist in Atlas');
      }
      
      console.log('\n⚠️  Continuing without MongoDB - some features may not work');
      console.log('   Fix the connection issue and restart the server');
      // Don't exit - let the server continue so user can see the error
    });
} else {
  // Fallback to basic connection - Optimized for Atlas
  console.log('🔄 Attempting to connect to MongoDB Atlas (basic mode)...');
  
  // ✅ FIX: Add connection timeout monitor
  const connectionStartTime = Date.now();
  const connectionTimeout = 35000; // 35 seconds (slightly longer than serverSelectionTimeoutMS)
  
  const connectionTimeoutId = setTimeout(() => {
    if (mongoose.connection.readyState === 2) {
      console.error('❌ MongoDB connection timeout - stuck in connecting state');
      console.error('   Connection has been attempting for more than 35 seconds');
      console.error('   This usually indicates:');
      console.error('   1. Network connectivity issues');
      console.error('   2. IP not whitelisted in MongoDB Atlas');
      console.error('   3. Incorrect connection string');
      console.error('   4. MongoDB Atlas cluster is paused or down');
      console.error('\n   Attempting to close and retry connection...');
      
      // Close the stuck connection
      mongoose.connection.close().catch(() => {});
      
      // Retry after 5 seconds
      setTimeout(() => {
        console.log('🔄 Retrying MongoDB connection...');
        mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 120000,
          connectTimeoutMS: 30000,
          maxPoolSize: 100,
          minPoolSize: 5,
          retryWrites: true,
          retryReads: true,
          heartbeatFrequencyMS: 10000,
        })
        .then(() => {
          console.log('✅ MongoDB connected on retry');
        })
        .catch((retryError) => {
          console.error('❌ Retry also failed:', retryError.message);
        });
      }, 5000);
    }
  }, connectionTimeout);
  
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000, // Increased for Atlas (was 5000)
    socketTimeoutMS: 120000, // Increased for Atlas (was 45000)
    connectTimeoutMS: 30000, // Added for Atlas
    maxPoolSize: 100, // Increased for Atlas
    minPoolSize: 5,
    retryWrites: true,
    retryReads: true,
    heartbeatFrequencyMS: 10000,
  })
  .then(() => {
    clearTimeout(connectionTimeoutId);
    const connectionDuration = Date.now() - connectionStartTime;
    console.log(`✅ Connected to MongoDB (basic mode) (took ${connectionDuration}ms)`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Ready State: ${mongoose.connection.readyState}`);
    
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
    clearTimeout(connectionTimeoutId);
    console.error('❌ MongoDB connection error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Provide specific guidance based on error type
    if (error.name === 'MongooseServerSelectionError' || error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n🔍 Troubleshooting steps:');
      console.error('1. Check MONGODB_URI in backend/.env file');
      console.error('2. Verify IP is whitelisted in MongoDB Atlas Network Access');
      console.error('   - Go to: Atlas Dashboard → Network Access → IP Access List');
      console.error('   - Add your IP or use 0.0.0.0/0 for development (NOT for production!)');
      console.error('3. Check if cluster is running (not paused) in Atlas Dashboard');
      console.error('4. Verify network connectivity and firewall settings');
      console.error('5. Check if connection string format is correct');
    } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth') || error.message.includes('user not found')) {
      console.error('\n🔍 Authentication issue:');
      console.error('1. Check username and password in connection string');
      console.error('2. Verify user exists in MongoDB Atlas Database Access');
      console.error('3. Ensure password doesn\'t have special characters (or is URL-encoded)');
      console.error('4. Reset password in Atlas if needed');
    } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
      console.error('\n🔍 Connection timeout:');
      console.error('1. Check internet connectivity');
      console.error('2. Verify MongoDB Atlas cluster is running');
      console.error('3. Check firewall/VPN settings');
      console.error('4. Verify IP whitelist in Atlas');
    }
    
    console.log('\n⚠️  Continuing without MongoDB - some features may not work');
    console.log('   Fix the connection issue and restart the server');
  });
}

// ==============================================
// ROUTES
// ==============================================

// Import route modules
const authRoutes = require('./routes/auth');
// Use MVC pattern for theaters (new optimized structure)
const theaterRoutes = require('./routes/theaters.mvc');
// const theaterRoutes = require('./routes/theaters'); // OLD - kept for reference
// Use MVC pattern for products (new optimized structure)
const productRoutesMVC = require('./routes/products.mvc');
const productRoutes = require('./routes/products'); // Keep for categories and productTypes
// Use MVC pattern for orders (new optimized structure)
const orderRoutesMVC = require('./routes/orders.mvc');
// const orderRoutes = require('./routes/orders'); // OLD - file removed
// Use MVC pattern for settings (new optimized structure)
const settingsRoutesMVC = require('./routes/settings.mvc');
// const settingsRoutes = require('./routes/settings'); // OLD - file removed
// Use MVC pattern for upload (new optimized structure)
const uploadRoutesMVC = require('./routes/upload.mvc');
// const uploadRoutes = require('./routes/upload'); // OLD - file removed
// Use MVC pattern for stock (new optimized structure)
const stockRoutesMVC = require('./routes/stock.mvc');
// const stockRoutes = require('./routes/stock'); // OLD - file removed
// const pageAccessRoutes = require('./routes/pageAccess'); // OLD - DISABLED
// const pageAccessArrayRoutes = require('./routes/pageAccessArray'); // OLD - file removed, using MVC version
// const qrCodeRoutes = require('./routes/qrcodes'); // OLD - file removed, using MVC version
// const qrCodeNameRoutes = require('./routes/qrcodenamesArray'); // OLD - file removed, using MVC version
const singleQRCodeRoutes = require('./routes/singleqrcodes');
const syncRoutes = require('./routes/sync');
// const rolesRoutes = require('./routes/rolesArray'); // OLD - file removed, using MVC version
const reportsRoutes = require('./routes/reports'); // Reports route
// const paymentRoutes = require('./routes/payments'); // OLD - file removed, using MVC version

// Health check endpoint (with optimization status)
app.get('/api/health', (req, res) => {
  const connectionState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  
  const health = {
    status: connectionState === 1 ? 'OK' : 'WARNING',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    database: {
      connected: connectionState === 1,
      state: states[connectionState] || 'unknown',
      readyState: connectionState,
      name: connectionState === 1 ? mongoose.connection.name : null,
      host: connectionState === 1 ? mongoose.connection.host : null
    },
    optimizations: {
      redis: false, // Redis cache is disabled
      databasePooling: !!connectWithOptimizedPooling,
      advancedRateLimit: !!generalLimiter,
      apiCaching: false // API caching is disabled
    }
  };
  
  res.json(health);
});

// Helper function to normalize URL to absolute URL
function normalizeImageUrl(url) {
  if (!url) return null;
  
  // Don't process data URLs
  if (url.startsWith('data:')) {
    return null; // Data URLs should not be proxied
  }
  
  // Already absolute URL (http/https)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Handle Google Cloud Storage URLs (gs://)
  if (url.startsWith('gs://')) {
    // Convert gs:// URL to https:// public URL
    return url.replace('gs://yqpaynow-theater-qr-codes/', 'https://storage.googleapis.com/yqpaynow-theater-qr-codes/');
  }
  
  // Handle relative paths (e.g., /images/logo.jpg)
  if (url.startsWith('/')) {
    // Convert relative path to full URL using environment variables
    const baseUrl = process.env.BASE_URL?.trim() || process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
    return `${baseUrl}${url}`;
  }
  
  // If URL doesn't have protocol, assume it's a relative path and prepend base URL
  const baseUrl = process.env.BASE_URL?.trim() || process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  return `${baseUrl}/${url}`;
}

// Image proxy endpoint to bypass CORS
// Supports both GET (for small URLs) and POST (for large URLs to avoid 431 header size errors)
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Normalize URL to absolute URL
  const absoluteUrl = normalizeImageUrl(url);
  
  if (!absoluteUrl) {
    if (url.startsWith('data:')) {
      return res.status(400).json({ error: 'Data URLs should not be proxied' });
    }
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(absoluteUrl);
    
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
    res.status(500).json({ error: 'Failed to proxy image', details: error.message });
  }
});

// POST endpoint for large URLs (avoids header size limits)
app.post('/api/proxy-image', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  // Normalize URL to absolute URL
  const absoluteUrl = normalizeImageUrl(url);
  
  if (!absoluteUrl) {
    if (url.startsWith('data:')) {
      return res.status(400).json({ error: 'Data URLs should not be proxied' });
    }
    return res.status(400).json({ error: 'Invalid URL format' });
  }
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(absoluteUrl);
    
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
    res.status(500).json({ error: 'Failed to proxy image', details: error.message });
  }
});

// ==============================================
// MOUNT API ROUTES (With Caching)
// ==============================================

// Auth routes (strict rate limiting already applied above)
app.use('/api/auth', authRoutes);

// Dashboard (MVC pattern - cache for 2 minutes)
const dashboardRoutesMVC = require('./routes/dashboard.mvc');
// const dashboardRoutes = require('./routes/dashboard'); // OLD - file removed
if (cacheMiddleware) {
  app.use('/api/dashboard', cacheMiddleware({ ttl: 120 }), dashboardRoutesMVC);
} else {
  app.use('/api/dashboard', dashboardRoutesMVC);
}
// app.use('/api/dashboard', dashboardRoutes); // OLD - kept for reference

// Theaters (cache for 5 minutes - frequently accessed)
// if (cacheMiddleware) {
//   app.use('/api/theaters', cacheMiddleware({ ttl: 300 }), authenticatedLimiter || generalLimiter, theaterRoutes);
// } else {
  app.use('/api/theaters', theaterRoutes);
// }

// Products (MVC pattern - cache for 3 minutes)
if (cacheMiddleware) {
  app.use('/api/theater-products', cacheMiddleware({ ttl: 180 }), productRoutesMVC);
  app.use('/api/theater-categories', cacheMiddleware({ ttl: 300 }), productRoutes.categories);
  app.use('/api/theater-product-types', cacheMiddleware({ ttl: 300 }), productRoutes.productTypes);
} else {
  app.use('/api/theater-products', productRoutesMVC);
  app.use('/api/theater-categories', productRoutes.categories);
  app.use('/api/theater-product-types', productRoutes.productTypes);
}

app.use('/api/theater-kiosk-types', require('./routes/theater-kiosk-types'));
app.use('/api/theater-banners', require('./routes/theater-banners')); // Theater Banners CRUD

// Orders (MVC pattern - no cache - real-time data)
app.use('/api/orders', authenticatedLimiter || generalLimiter, orderRoutesMVC);
// app.use('/api/orders', authenticatedLimiter || generalLimiter, orderRoutes); // OLD - kept for reference

// Settings (MVC pattern - cache for 10 minutes - rarely changes)
if (cacheMiddleware) {
  app.use('/api/settings', cacheMiddleware({ ttl: 600 }), settingsRoutesMVC);
} else {
  app.use('/api/settings', settingsRoutesMVC);
}
// app.use('/api/settings', settingsRoutes); // OLD - kept for reference

// SMS (MVC pattern - no cache - real-time operations)
const smsRoutesMVC = require('./routes/sms.mvc');
app.use('/api/sms', smsRoutesMVC);

app.use('/api/chat', require('./routes/chat')); // Chat messaging routes
app.use('/api/notifications', require('./routes/notifications')); // Real-time notifications

// Upload (MVC pattern)
app.use('/api/upload', uploadRoutesMVC);
// app.use('/api/upload', uploadRoutes); // OLD - kept for reference

// Stock (MVC pattern - cache for 1 minute - frequently updated)
if (cacheMiddleware) {
  app.use('/api/theater-stock', cacheMiddleware({ ttl: 60 }), stockRoutesMVC);
} else {
  app.use('/api/theater-stock', stockRoutesMVC);
}
// app.use('/api/theater-stock', stockRoutes); // OLD - kept for reference

// Page access (MVC pattern - cache for 5 minutes)
const pageAccessRoutesMVC = require('./routes/pageAccess.mvc');
if (cacheMiddleware) {
  app.use('/api/page-access', cacheMiddleware({ ttl: 300 }), pageAccessRoutesMVC);
} else {
  app.use('/api/page-access', pageAccessRoutesMVC);
}
// app.use('/api/page-access', pageAccessArrayRoutes); // OLD - kept for reference

// QR Codes (MVC pattern - cache for 5 minutes)
const qrCodeRoutesMVC = require('./routes/qrcodes.mvc');
const qrCodeNameRoutesMVC = require('./routes/qrcodenames.mvc');
if (cacheMiddleware) {
  app.use('/api/qrcodes', cacheMiddleware({ ttl: 300 }), qrCodeRoutesMVC);
  app.use('/api/qrcodenames', cacheMiddleware({ ttl: 300 }), qrCodeNameRoutesMVC);
  app.use('/api/single-qrcodes', cacheMiddleware({ ttl: 300 }), singleQRCodeRoutes);
} else {
  app.use('/api/qrcodes', qrCodeRoutesMVC);
  app.use('/api/qrcodenames', qrCodeNameRoutesMVC);
  app.use('/api/single-qrcodes', singleQRCodeRoutes);
}
// app.use('/api/qrcodes', qrCodeRoutes); // OLD - kept for reference
// app.use('/api/qrcodenames', qrCodeNameRoutes); // OLD - kept for reference

app.use('/api/sync', syncRoutes);

// Roles (MVC pattern)
const rolesRoutesMVC = require('./routes/roles.mvc');
app.use('/api/roles', rolesRoutesMVC);
// app.use('/api/roles', rolesRoutes); // OLD - kept for reference

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

// Payments (MVC pattern - no cache - sensitive real-time data)
const paymentRoutesMVC = require('./routes/payments.mvc');
app.use('/api/payments', paymentRoutesMVC);
// app.use('/api/payments', paymentRoutes); // OLD - kept for reference

// Theater users (MVC pattern - cache for 2 minutes)
const theaterUserRoutesMVC = require('./routes/theaterUsers.mvc');
// const theaterUserRoutes = require('./routes/theaterUsersArray'); // OLD - file removed
if (cacheMiddleware) {
  app.use('/api/theater-users', cacheMiddleware({ ttl: 120 }), theaterUserRoutesMVC);
} else {
  app.use('/api/theater-users', theaterUserRoutesMVC);
}
// app.use('/api/theater-users', theaterUserRoutes); // OLD - kept for reference

// Theater dashboard (MVC pattern - cache for 1 minute)
const theaterDashboardRoutesMVC = require('./routes/theater-dashboard.mvc');
// const theaterDashboardRoutes = require('./routes/theater-dashboard'); // OLD - file removed
if (cacheMiddleware) {
  app.use('/api/theater-dashboard', cacheMiddleware({ ttl: 60 }), theaterDashboardRoutesMVC);
} else {
  app.use('/api/theater-dashboard', theaterDashboardRoutesMVC);
}
// app.use('/api/theater-dashboard', theaterDashboardRoutes); // OLD - kept for reference

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
const fs = require('fs');

// Only serve static files if build directory exists
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath, { maxAge: "1y" }));
  
  // Catch-all route for frontend - only for non-API routes
  app.get("/*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Only serve index.html if it exists
    const indexPath = path.join(buildPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next(); // Pass to 404 handler
    }
  });
}

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

// ------------------------------
// START SERVER
// ------------------------------
const PORT = process.env.PORT || 8080;
const HOST = process.env.SERVER_HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 YQPayNow Server running on ${HOST}:${PORT}`);
  console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
  
  // Show MongoDB connection status
  const connectionState = mongoose.connection.readyState;
  const states = { 0: '❌ Disconnected', 1: '✅ Connected', 2: '⏳ Connecting...', 3: '⏳ Disconnecting...' };
  console.log(`📡 MongoDB Connection Status: ${states[connectionState] || 'Unknown'} (State: ${connectionState})`);
  
  if (connectionState === 1) {
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
  } else if (connectionState === 0) {
    console.log('   ⚠️  Server started, but MongoDB is not connected');
    console.log('   Routes will wait for connection before processing database requests');
    console.log('   Check connection logs above for errors');
  } else if (connectionState === 2) {
    console.log('   ⏳ MongoDB connection is still establishing...');
    console.log('   Routes will wait for connection before processing database requests');
  }
  console.log(`🔗 Base URL: ${process.env.BASE_URL || 'Not configured'}`);
  console.log(`🗄️  Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
});

module.exports = app;
