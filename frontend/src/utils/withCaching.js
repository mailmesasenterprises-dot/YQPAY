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

/**
 * Enhanced fetch with automatic caching
 * Automatically caches GET requests
 */
window.fetch = async function(...args) {
  const [url, options = {}] = args;
  const method = (options.method || 'GET').toUpperCase();
  
  // Only cache GET requests
  if (!isCachingEnabled || method !== 'GET') {
    return originalFetch.apply(this, args);
  }

  // Generate cache key from URL
  const cacheKey = `auto_${url.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  // Check cache first
  const startTime = performance.now();
  const cached = getCachedData(cacheKey, 120000); // 2-minute default TTL
  
  if (cached) {
    const cacheTime = performance.now() - startTime;
    performanceStats.cacheHits++;
    performanceStats.avgCacheTime = 
      (performanceStats.avgCacheTime * (performanceStats.cacheHits - 1) + cacheTime) / performanceStats.cacheHits;
    
    console.log(`⚡ [AutoCache] Cache HIT for ${url} (${cacheTime.toFixed(2)}ms) 🚀 ${performanceStats.cacheHits} hits, ${(performanceStats.avgCacheTime).toFixed(2)}ms avg`);
    
    // Return cached data as a Response-like object
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => cached,
      text: async () => JSON.stringify(cached),
      clone: function() { return this; }
    });
  }

  // Fetch fresh data
  const fetchStart = performance.now();
  console.log(`🌐 [AutoCache] Fetching ${url}`);
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
  
  // Clone response to read it
  const clonedResponse = response.clone();
  
  // Cache successful GET responses
  if (response.ok) {
    try {
      const data = await clonedResponse.json();
      setCachedData(cacheKey, data);
      console.log(`💾 [AutoCache] Cache SET for ${url} (${networkTime.toFixed(2)}ms)`);
    } catch (e) {
      // Not JSON, skip caching
    }
  }

  return response;
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
