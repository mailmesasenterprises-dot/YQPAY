/**
 * API Optimizer Utility
 * Provides request deduplication, batching, and intelligent caching
 * 🚀 OPTIMIZED: Now uses synchronous cache checks for instant loading
 */

import { getCachedData, setCachedData } from './cacheUtils'; // 🚀 SYNC IMPORT - No delay!

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
  if (!url) {
    console.error('❌ [optimizedFetch] No URL provided');
    return null;
  }

  // 🚀 INSTANT SYNCHRONOUS CACHE CHECK - No async import delay!
  const key = cacheKey || `fetch_${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const cached = getCachedData(key, cacheTTL);
  if (cached) {
    console.log(`⚡ [optimizedFetch] Cache HIT: ${key}`, cached);
    return cached;
  }

  console.log(`🌐 [optimizedFetch] Cache MISS, fetching: ${url}`);

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

  console.log(`📡 [optimizedFetch] Making network request to: ${url}`);
  
  // Create fetch promise
  // Add flag to skip withCaching.js auto-cache (we handle caching ourselves)
  // Note: _skipAutoCache is a property, not a header, so it won't cause CORS issues
  const fetchPromise = fetch(url, {
    ...options,
    _skipAutoCache: true, // Skip withCaching.js auto-cache (property, not header)
    headers: {
      'Content-Type': 'application/json',
      // Note: We don't add X-Skip-Auto-Cache header to avoid CORS issues
      // withCaching.js checks the _skipAutoCache property instead
      ...options.headers
    }
  })
  .then(async (response) => {
    console.log(`📥 [optimizedFetch] Response received: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`✅ [optimizedFetch] Response parsed successfully:`, data);
    return data;
  })
  .then((result) => {
    // Cache the result
    setCachedData(key, result);
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    console.log(`💾 [optimizedFetch] Cached result for: ${key}`);
    return result;
  })
  .catch((err) => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    // Preserve AbortError for proper handling by calling code
    if (err.name === 'AbortError') {
      throw err;
    }
    // For other errors, check cache one more time as fallback
    const fallbackCache = getCachedData(key, cacheTTL * 2); // Use longer TTL for fallback
    if (fallbackCache) {
      console.log(`⚠️ [optimizedFetch] Request failed, using stale cache: ${key}`);
      return fallbackCache;
    }
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

  // 🚀 INSTANT SYNCHRONOUS CACHE CHECK - No async import delay!
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

