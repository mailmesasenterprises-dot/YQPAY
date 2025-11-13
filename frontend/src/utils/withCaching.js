/**
 * Higher-Order Component for Automatic API Caching
 * Wraps fetch calls globally with automatic caching
 */

import { getCachedData, setCachedData } from './cacheUtils';

/**
 * Global fetch wrapper with automatic caching
 * Intercepts all fetch calls and adds caching automatically
 */
const originalFetch = window.fetch;

let isCachingEnabled = true;

// Performance tracking
const performanceStats = {
  cacheHits: 0,
  cacheMisses: 0,
  totalSavedTime: 0,
  avgCacheTime: 0,
  avgNetworkTime: 0
};

export const getPerformanceStats = () => ({ ...performanceStats });

export const resetPerformanceStats = () => {
  performanceStats.cacheHits = 0;
  performanceStats.cacheMisses = 0;
  performanceStats.totalSavedTime = 0;
  performanceStats.avgCacheTime = 0;
  performanceStats.avgNetworkTime = 0;
};

export const enableCaching = () => {
  isCachingEnabled = true;
};

export const disableCaching = () => {
  isCachingEnabled = false;
};

// Request deduplication map to prevent duplicate requests
const pendingAutoCacheRequests = new Map();

/**
 * Enhanced fetch with automatic caching
 * Automatically caches GET requests
 * 🚀 OPTIMIZED: Added request deduplication to prevent duplicate requests
 * 
 * NOTE: This wrapper intercepts ALL fetch calls, including those from apiService/optimizedFetch.
 * To avoid double-caching, we skip requests that are already being handled by optimizedFetch.
 */
window.fetch = async function(...args) {
  const [url, options = {}] = args;
  const method = (options.method || 'GET').toUpperCase();
  
  // Skip caching for requests that are already being handled by optimizedFetch/apiService
  // These requests have their own caching mechanism and don't need double-caching
  const urlString = url.toString();
  const isApiServiceRequest = 
    options._skipAutoCache || // Property flag to skip auto-cache (not sent as header to avoid CORS)
    // Skip if it's a known API endpoint that uses optimizedFetch
    (urlString.includes('/api/') && urlString.match(/\/api\/(theaters|roles|products|orders|theater-products|theater-stock|settings)/));
  
  // Only cache GET requests that aren't already being handled by apiService
  if (!isCachingEnabled || method !== 'GET' || isApiServiceRequest) {
    return originalFetch.apply(this, args);
  }

  // Generate cache key from URL
  const cacheKey = `auto_${url.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  // 🚀 DEDUPLICATION: Check if same request is already pending
  const requestId = `${url}_${JSON.stringify(options)}`;
  if (pendingAutoCacheRequests.has(requestId)) {
    console.log(`🔄 [AutoCache] Deduplicating request: ${url}`);
    try {
      return await pendingAutoCacheRequests.get(requestId);
    } catch (err) {
      // If pending request failed, continue with new request
      pendingAutoCacheRequests.delete(requestId);
    }
  }
  
  // Check cache first
  const startTime = performance.now();
  const cached = getCachedData(cacheKey, 120000); // 2-minute default TTL
  
  if (cached) {
    const cacheTime = performance.now() - startTime;
    performanceStats.cacheHits++;
    performanceStats.avgCacheTime = 
      (performanceStats.avgCacheTime * (performanceStats.cacheHits - 1) + cacheTime) / performanceStats.cacheHits;
    
    // Return cached data as a Response-like object
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => cached,
      text: async () => JSON.stringify(cached),
      clone: function() { return this; }
    });
  }

  // Create fetch promise and store it for deduplication
  const fetchPromise = (async () => {
    try {
      // Fetch fresh data
      const fetchStart = performance.now();
      const response = await originalFetch.apply(this, args);
      const networkTime = performance.now() - fetchStart;
      
      performanceStats.cacheMisses++;
      performanceStats.avgNetworkTime = 
        (performanceStats.avgNetworkTime * (performanceStats.cacheMisses - 1) + networkTime) / performanceStats.cacheMisses;
      
      // Calculate time savings
      if (performanceStats.avgCacheTime > 0) {
        const savedTime = networkTime - performanceStats.avgCacheTime;
        performanceStats.totalSavedTime += savedTime;
      }
      
      // Clone response BEFORE reading to avoid "body stream already read" errors
      // The clone allows us to read the body for caching while returning the original response
      let clonedResponse = null;
      
      // Cache successful GET responses
      if (response.ok) {
        try {
          // Clone the response before reading
          clonedResponse = response.clone();
          const data = await clonedResponse.json();
          setCachedData(cacheKey, data);
        } catch (e) {
          // Not JSON or clone failed, skip caching but still return response
          console.warn('⚠️ [AutoCache] Failed to cache response:', e.message);
        }
      }

      // Return the original response (body not consumed if we cloned properly)
      return response;
    } finally {
      // Remove from pending requests
      pendingAutoCacheRequests.delete(requestId);
    }
  })();

  // Store promise for deduplication
  pendingAutoCacheRequests.set(requestId, fetchPromise);
  
  return fetchPromise;
};

// Restore original fetch if needed
export const restoreFetch = () => {
  window.fetch = originalFetch;
};

// Display performance summary in console
export const showPerformanceReport = () => {
  if (performanceStats.cacheHits === 0) {
    console.log('📊 [AutoCache] No cache hits yet. Visit pages to see performance improvements!');
    return;
  }
  
  const speedImprovement = performanceStats.avgNetworkTime > 0 
    ? ((performanceStats.avgNetworkTime - performanceStats.avgCacheTime) / performanceStats.avgNetworkTime * 100)
    : 0;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 YQPAY AUTO-CACHING PERFORMANCE REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`⚡ Cache Hits: ${performanceStats.cacheHits}`);
  console.log(`🌐 Cache Misses: ${performanceStats.cacheMisses}`);
  console.log(`📈 Hit Rate: ${(performanceStats.cacheHits / (performanceStats.cacheHits + performanceStats.cacheMisses) * 100).toFixed(1)}%`);
  console.log(`⏱️  Avg Cache Load: ${performanceStats.avgCacheTime.toFixed(2)}ms`);
  console.log(`⏱️  Avg Network Load: ${performanceStats.avgNetworkTime.toFixed(2)}ms`);
  console.log(`🚀 Speed Improvement: ${speedImprovement.toFixed(1)}% faster with cache`);
  console.log(`💰 Total Time Saved: ${(performanceStats.totalSavedTime / 1000).toFixed(2)}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
};

// Auto-report every 30 seconds
setInterval(() => {
  if (performanceStats.cacheHits > 0) {
    showPerformanceReport();
  }
}, 30000);

export default {
  enableCaching,
  disableCaching,
  restoreFetch,
  getPerformanceStats,
  resetPerformanceStats,
  showPerformanceReport
};
