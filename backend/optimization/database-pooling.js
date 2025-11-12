/**
 * Optimized MongoDB Connection Pooling
 * For handling 10,000+ concurrent connections
 */

const mongoose = require('mongoose');

const optimizedConnectionOptions = {
  // Connection pool settings
  maxPoolSize: 50, // Maximum number of connections in the pool
  minPoolSize: 10, // Minimum number of connections to maintain
  maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
  
  // Timeout settings
  serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
  socketTimeoutMS: 45000, // Close sockets after 45s
  connectTimeoutMS: 10000, // Connection timeout
  
  // Note: bufferMaxEntries and bufferCommands are Mongoose-specific, not MongoDB options
  // These should be set on mongoose, not in connection options
  
  // Retry settings
  retryWrites: true,
  retryReads: true,
  
  // Performance settings
  readPreference: 'primary', // Use primary for better compatibility
  // readConcern and writeConcern removed for compatibility - can be added if needed
  
  // Compression (optional - may not be supported by all MongoDB versions)
  // compressors: ['zlib'],
  // zlibCompressionLevel: 6,
};

/**
 * Connect to MongoDB with optimized pooling
 */
async function connectWithOptimizedPooling(uri) {
  try {
    // Note: We don't set bufferCommands: false globally as it prevents
    // queries from working if connection fails. Mongoose will handle buffering.
    
    // Connect with MongoDB connection options only
    await mongoose.connect(uri, optimizedConnectionOptions);
    
    // Monitor connection pool
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB: Connected with optimized pooling');
      console.log(`   Max Pool Size: ${optimizedConnectionOptions.maxPoolSize}`);
      console.log(`   Min Pool Size: ${optimizedConnectionOptions.minPoolSize}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB: Disconnected');
    });

    // Log pool statistics periodically
    setInterval(() => {
      const poolSize = mongoose.connection.readyState === 1 
        ? mongoose.connection.db?.serverConfig?.pool?.totalConnectionCount || 0
        : 0;
      console.log(`📊 MongoDB Pool Size: ${poolSize}/${optimizedConnectionOptions.maxPoolSize}`);
    }, 60000); // Every minute

    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Get connection pool statistics
 */
function getPoolStats() {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false };
  }

  return {
    connected: true,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
  };
}

module.exports = {
  connectWithOptimizedPooling,
  getPoolStats,
  optimizedConnectionOptions
};

