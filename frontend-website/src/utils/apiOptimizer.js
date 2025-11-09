/**
 * API Optimizer Utility
 * Provides request deduplication, batching, and intelligent caching
 */

// Request deduplication: prevents duplicate simultaneous requests
const pendingRequests = new Map();

// Request queue for batching
const requestQueue = [];
let queueTimer = null;
const BATCH_DELAY = 50; // Batch requests within 50ms

/**
 * Optimized fetch with deduplication and caching
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @param {string} cacheKey - Cache key (optional)
 * @param {number} cacheTTL - Cache TTL in ms (default: 2 minutes)
 * @returns {Promise} - Fetch promise
 */
export const optimizedFetch = async (url, options = {}, cacheKey = null, cacheTTL = 120000) => {
  if (!url) return null;

  const { getCachedData, setCachedData } = await import('./cacheUtils');
  
  // Check cache first
  const key = cacheKey || `fetch_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cached = getCachedData(key, cacheTTL);
  if (cached) {
    console.log(`⚡ [optimizedFetch] Cache HIT: ${key}`);
    return cached;
  }

  // Check for duplicate pending request
  const requestKey = `${url}_${JSON.stringify(options)}`;
  if (pendingRequests.has(requestKey)) {
    console.log(`🔄 [optimizedFetch] Deduplicating: ${requestKey}`);
    try {
      const result = await pendingRequests.get(requestKey);
      return result;
    } catch (err) {
      // If pending request failed, continue with new request
      console.warn(`⚠️ [optimizedFetch] Pending request failed, retrying:`, err);
    }
  }

  // Create fetch promise
  const fetchPromise = fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  .then(async (response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then((result) => {
    // Cache the result
    setCachedData(key, result);
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    return result;
  })
  .catch((err) => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    throw err;
  });

  // Store promise for deduplication
  pendingRequests.set(requestKey, fetchPromise);

  return fetchPromise;
};

/**
 * Batch multiple requests together
 * @param {Array} requests - Array of {url, options, cacheKey, cacheTTL}
 * @returns {Promise<Array>} - Array of results
 */
export const batchFetch = async (requests = []) => {
  if (requests.length === 0) return [];

  const { getCachedData, setCachedData } = await import('./cacheUtils');

  // Check caches first
  const cachedResults = requests.map(req => {
    const key = req.cacheKey || `fetch_${req.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    return getCachedData(key, req.cacheTTL || 120000);
  });

  // If all cached, return immediately
  if (cachedResults.every(r => r !== null)) {
    console.log('⚡ [batchFetch] All data from cache');
    return cachedResults;
  }

  // Fetch missing data in parallel
  const fetchPromises = requests.map(async (req, index) => {
    // Return cached if available
    if (cachedResults[index]) {
      return cachedResults[index];
    }

    const key = req.cacheKey || `fetch_${req.url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const requestKey = `${req.url}_${JSON.stringify(req.options || {})}`;
    
    // Check for duplicate pending request
    if (pendingRequests.has(requestKey)) {
      console.log(`🔄 [batchFetch] Deduplicating: ${requestKey}`);
      return pendingRequests.get(requestKey);
    }

    const fetchPromise = fetch(req.url, {
      ...req.options,
      headers: {
        'Content-Type': 'application/json',
        ...req.options?.headers
      }
    })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((result) => {
      setCachedData(key, result);
      pendingRequests.delete(requestKey);
      return result;
    })
    .catch((err) => {
      pendingRequests.delete(requestKey);
      throw err;
    });

    pendingRequests.set(requestKey, fetchPromise);
    return fetchPromise;
  });

  return Promise.all(fetchPromises);
};

/**
 * Clear all pending requests (useful for cleanup)
 */
export const clearPendingRequests = () => {
  pendingRequests.clear();
  console.log('🧹 [apiOptimizer] Cleared all pending requests');
};

/**
 * Get pending requests count (for debugging)
 */
export const getPendingRequestsCount = () => {
  return pendingRequests.size;
};

export default {
  optimizedFetch,
  batchFetch,
  clearPendingRequests,
  getPendingRequestsCount
};

