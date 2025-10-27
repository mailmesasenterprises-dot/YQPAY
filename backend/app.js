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

const app = express();

// ==============================================
// UTILITY - Get Network IP for Mobile Access
// ==============================================
const getNetworkIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
};
const NETWORK_IP = getNetworkIP();

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration - Allow localhost and network IP for mobile QR scanning
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

// Add network IP for mobile device access
if (NETWORK_IP) {
  allowedOrigins.push(`http://${NETWORK_IP}:3000`);
  allowedOrigins.push(`http://${NETWORK_IP}:3001`);
}

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==============================================
// DATABASE CONNECTION
// ==============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
  bufferCommands: false, // Disable mongoose buffering
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  console.log('Continuing without MongoDB - some features may not work');
  // Don't exit, allow server to start without DB for testing
});

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
const pageAccessRoutes = require('./routes/pageAccess'); // OLD global routes
const pageAccessArrayRoutes = require('./routes/pageAccessArray'); // NEW theater-based routes
const qrCodeRoutes = require('./routes/qrcodes');
const qrCodeNameRoutes = require('./routes/qrcodenames');
const singleQRCodeRoutes = require('./routes/singleqrcodes');
console.log('✅ qrCodeNameRoutes loaded in app.js:', typeof qrCodeNameRoutes);
console.log('✅ singleQRCodeRoutes loaded in app.js:', typeof singleQRCodeRoutes);
const syncRoutes = require('./routes/sync');
const rolesRoutes = require('./routes/roles');
const reportsRoutes = require('./routes/reports'); // ✅ NEW

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/theaters', theaterRoutes);
app.use('/api/theater-products', productRoutes.products);
// Use new category structure (one doc per theater with categoryList array)
const theaterCategoriesRoutes = require('./routes/theater-categories-new');
app.use('/api/theater-categories', theaterCategoriesRoutes);
const theaterKioskTypesRoutes = require('./routes/theater-kiosk-types');
app.use('/api/theater-kiosk-types', theaterKioskTypesRoutes);
app.use('/api/theater-product-types', productRoutes.productTypes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/theater-stock', stockRoutes);
// Page Access Routes - NEW theater-based array structure (prioritized)
app.use('/api/page-access', pageAccessArrayRoutes);
// OLD global routes still available for backward compatibility
// app.use('/api/page-access-old', pageAccessRoutes); // Uncomment if needed
app.use('/api/qrcodes', qrCodeRoutes);
app.use('/api/qrcodenames', qrCodeNameRoutes);
console.log('🎯 Mounting singleQRCodeRoutes at /api/single-qrcodes');
app.use('/api/single-qrcodes', singleQRCodeRoutes);
console.log('✅ singleQRCodeRoutes mounted successfully');
app.use('/api/sync', syncRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/theater-users', require('./routes/theaterUsersArray')); // USING ARRAY-BASED ROUTES

// Theater Users Array Routes - REMOVED (now using original endpoint)

app.use('/api/reports', reportsRoutes); // ✅ NEW

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
      kioskTypes: '/api/theater-kiosk-types',
      productTypes: '/api/theater-product-types',
      orders: '/api/orders',
      settings: '/api/settings',
      upload: '/api/upload',
      stock: '/api/theater-stock',
      pageAccess: '/api/page-access',
      qrcodes: '/api/qrcodes',
      singleQRCodes: '/api/single-qrcodes',
      qrcodenames: '/api/qrcodenames',
      sync: '/api/sync',
      roles: '/api/roles',
      theaterUsers: '/api/theater-users', // ARRAY-BASED ROUTES
      reports: '/api/reports',
      health: '/api/health'
    }
  });
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
  console.error('Error:', error);
  
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

// ==============================================
// SERVER STARTUP
// ==============================================

const PORT = process.env.PORT || 5000; // Backend on port 5000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 YQPayNow Backend Server - RUNNING`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📍 Local Access:    http://localhost:${PORT}/api`);
  if (NETWORK_IP) {
    console.log(`📱 Mobile Access:   http://${NETWORK_IP}:${PORT}/api`);
    console.log(`   (For QR Code Scanning)`);
  }
  console.log(`🏥 Health Check:    http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment:     ${process.env.NODE_ENV || 'development'}`);
  console.log(`${'='.repeat(60)}\n`);
  
  if (NETWORK_IP) {
    console.log(`✅ Both PC and Mobile can access the server`);
    console.log(`   - On PC: Use localhost or ${NETWORK_IP}`);
    console.log(`   - On Mobile: Use ${NETWORK_IP} (same WiFi required)\n`);
  }
});

module.exports = app;