/**
 * MongoDB Query Helper Utility
 * Provides retry logic, timeouts, and error handling for MongoDB Atlas queries
 */

const mongoose = require('mongoose');

/**
 * Execute a MongoDB query with retry logic and timeout
 * @param {Function} queryFn - Function that returns a Promise (the query)
 * @param {Object} options - Options for the query
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.timeout - Query timeout in milliseconds (default: 30000)
 * @param {string} options.queryName - Name of the query for logging (default: 'Query')
 * @returns {Promise} The query result
 */
async function executeWithRetry(queryFn, options = {}) {
  const {
    maxRetries = 3,
    timeout = 30000,
    queryName = 'Query'
  } = options;

  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Check connection state
      const connectionState = mongoose.connection.readyState;
      
      if (connectionState === 0) {
        throw new Error('MongoDB connection is disconnected');
      }

      // Wait if connecting
      if (connectionState === 2) {
        console.log(`⏳ [${queryName}] Connection is connecting, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Execute query with timeout
      const result = await Promise.race([
        queryFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
        )
      ]);

      if (retryCount > 0) {
        console.log(`✅ [${queryName}] Query succeeded after ${retryCount} retries`);
      }

      return result;

    } catch (error) {
      retryCount++;
      console.error(`❌ [${queryName}] Query error (attempt ${retryCount}/${maxRetries}):`, error.message);

      // Check if it's a retryable error
      const isRetryableError =
        error.name === 'MongoServerError' ||
        error.name === 'MongoNetworkError' ||
        error.name === 'MongooseError' ||
        error.message?.includes('timeout') ||
        error.message?.includes('buffering') ||
        error.message?.includes('disconnected');

      if (retryCount >= maxRetries || !isRetryableError) {
        console.error(`❌ [${queryName}] Query failed after ${retryCount} attempts`);
        throw error;
      }

      // Exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
      console.log(`⏳ [${queryName}] Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Check MongoDB connection health
 * @returns {Object} Connection health status
 */
function checkConnectionHealth() {
  const connectionState = mongoose.connection.readyState;
  const stateDescriptions = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    isConnected: connectionState === 1,
    isConnecting: connectionState === 2,
    isDisconnected: connectionState === 0,
    readyState: connectionState,
    stateDescription: stateDescriptions[connectionState] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name
  };
}

/**
 * Wait for MongoDB connection to be ready
 * @param {number} maxWait - Maximum time to wait in milliseconds (default: 10000)
 * @returns {Promise<boolean>} True if connected, false if timeout
 */
async function waitForConnection(maxWait = 10000) {
  const checkInterval = 500;
  let waited = 0;

  while (mongoose.connection.readyState !== 1 && waited < maxWait) {
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    waited += checkInterval;
  }

  return mongoose.connection.readyState === 1;
}

module.exports = {
  executeWithRetry,
  checkConnectionHealth,
  waitForConnection
};

