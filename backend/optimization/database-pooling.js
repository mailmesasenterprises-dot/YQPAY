/**
 * Optimized MongoDB Connection Pooling
 * For handling 10,000+ concurrent connections
 */

const mongoose = require('mongoose');

const optimizedConnectionOptions = {
  // Connection pool settings - Optimized for MongoDB Atlas
  maxPoolSize: 100, // Increased for Atlas (was 50)
  minPoolSize: 5, // Reduced minimum (was 10) - Atlas manages this better
  maxIdleTimeMS: 60000, // Increased to 60s for Atlas (was 30s)
  
  // Timeout settings - Increased for Atlas network latency
  serverSelectionTimeoutMS: 30000, // Increased to 30s for Atlas (was 5s - too short!)
  socketTimeoutMS: 120000, // Increased to 120s for Atlas (was 45s)
  connectTimeoutMS: 30000, // Increased to 30s for Atlas (was 10s)
  heartbeatFrequencyMS: 10000, // Check connection health every 10s
  
  // Note: bufferMaxEntries and bufferCommands are Mongoose-specific, not MongoDB options
  // These should be set on mongoose, not in connection options
  
  // Retry settings - Critical for Atlas
  retryWrites: true,
  retryReads: true,
  
  // Performance settings
  readPreference: 'primary', // Use primary for better compatibility
  
  // Atlas-specific optimizations
  compressors: ['zlib'], // Enable compression for Atlas
  zlibCompressionLevel: 6,
  
  // Connection monitoring
  monitorCommands: true, // Enable command monitoring for debugging
};

/**
 * Connect to MongoDB with optimized pooling
 */
async function connectWithOptimizedPooling(uri) {
  try {
    // Note: We don't set bufferCommands: false globally as it prevents
    // queries from working if connection fails. Mongoose will handle buffering.
    
    // ✅ FIX: Add connection timeout wrapper to prevent hanging
    const connectionPromise = mongoose.connect(uri, optimizedConnectionOptions);
    
    // Add timeout wrapper (35 seconds - slightly longer than serverSelectionTimeoutMS)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Connection timeout after 35 seconds - check network, IP whitelist, and connection string'));
      }, 35000);
    });
    
    // Race between connection and timeout
    await Promise.race([connectionPromise, timeoutPromise]);
    
    // Monitor connection pool
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB: Connected with optimized pooling');
      console.log(`   Max Pool Size: ${optimizedConnectionOptions.maxPoolSize}`);
      console.log(`   Min Pool Size: ${optimizedConnectionOptions.minPoolSize}`);
      console.log(`   Server Selection Timeout: ${optimizedConnectionOptions.serverSelectionTimeoutMS}ms`);
      console.log(`   Socket Timeout: ${optimizedConnectionOptions.socketTimeoutMS}ms`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      
      // Provide specific guidance based on error type
      if (err.name === 'MongooseServerSelectionError' || err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        console.error('\n🔍 Troubleshooting steps:');
        console.error('1. Check MONGODB_URI in backend/.env file');
        console.error('2. Verify IP is whitelisted in MongoDB Atlas Network Access');
        console.error('3. Check if cluster is running (not paused) in Atlas Dashboard');
        console.error('4. Verify network connectivity and firewall settings');
      } else if (err.message.includes('Authentication failed') || err.message.includes('bad auth')) {
        console.error('\n🔍 Authentication issue:');
        console.error('1. Check username and password in connection string');
        console.error('2. Verify user exists in MongoDB Atlas Database Access');
        console.error('3. Ensure password is URL-encoded if it has special characters');
      }
      // Don't exit - let the reconnection logic handle it
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB: Disconnected - Attempting to reconnect...');
      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (mongoose.connection.readyState === 0) {
          console.log('🔄 Attempting to reconnect to MongoDB...');
          mongoose.connect(uri, optimizedConnectionOptions).catch(err => {
            console.error('❌ Auto-reconnect failed:', err.message);
          });
        }
      }, 5000);
    });
    
    // Handle reconnection
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB: Reconnected successfully');
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

