/**
 * Advanced Multi-Layer Caching System
 * Browser cache, Service Worker cache, Memory cache, and API cache
 */

import config from '../config';

/**
 * Smart Cache Manager with multiple layers
 */
class AdvancedCacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.cacheConfig = {
      maxMemoryItems: 500,
      defaultTTL: 300000, // 5 minutes
      longTTL: 3600000,   // 1 hour
      shortTTL: 60000     // 1 minute
    };
  }

  /**
   * Multi-layer cache get
   */
  async get(key, options = {}) {
    try {
      // 1. Check memory cache first (fastest)
      const memoryResult = this.getFromMemory(key);
      if (memoryResult && !this.isExpired(memoryResult)) {

        return memoryResult.data;
      }

      // 2. Check Service Worker cache
      if ('caches' in window) {
        const swResult = await this.getFromServiceWorker(key);
        if (swResult) {

          // Store in memory for faster access
          this.setInMemory(key, swResult, options.ttl);
          return swResult;
        }
      }

      // 3. Check localStorage cache
      const localResult = this.getFromLocalStorage(key);
      if (localResult && !this.isExpired(localResult)) {

        this.setInMemory(key, localResult.data, options.ttl);
        return localResult.data;
      }


      return null;
    } catch (error) {

      return null;
    }
  }

  /**
   * Multi-layer cache set
   */
  async set(key, data, options = {}) {
    const ttl = options.ttl || this.cacheConfig.defaultTTL;
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl,
      expires: Date.now() + ttl
    };

    try {
      // 1. Store in memory cache
      this.setInMemory(key, data, ttl);

      // 2. Store in Service Worker cache
      if ('caches' in window && options.serviceWorker !== false) {
        await this.setInServiceWorker(key, data);
      }

      // 3. Store in localStorage (for non-sensitive data)
      if (options.localStorage !== false && this.canStoreInLocalStorage(data)) {
        this.setInLocalStorage(key, cacheItem);
      }
  } catch (error) {
  }
  }

  /**
   * Memory cache operations
   */
  getFromMemory(key) {
    return this.memoryCache.get(key);
  }

  setInMemory(key, data, ttl = this.cacheConfig.defaultTTL) {
    // Cleanup if cache is too large
    if (this.memoryCache.size >= this.cacheConfig.maxMemoryItems) {
      this.cleanupMemoryCache();
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    });
  }

  /**
   * Service Worker cache operations
   */
  async getFromServiceWorker(key) {
    try {
      const cache = await caches.open('api-cache-v1');
      const response = await cache.match(key);
      if (response) {
        return await response.json();
      }
    } catch (error) {
  }
    return null;
  }

  async setInServiceWorker(key, data) {
    try {
      const cache = await caches.open('api-cache-v1');
      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300'
        }
      });
      await cache.put(key, response);
    } catch (error) {
  }
  }

  /**
   * localStorage cache operations
   */
  getFromLocalStorage(key) {
    try {
      const item = localStorage.getItem(`cache_${key}`);
      return item ? JSON.parse(item) : null;
    } catch (error) {

      return null;
    }
  }

  setInLocalStorage(key, cacheItem) {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheItem));
    } catch (error) {
  }
  }

  /**
   * Cache utility methods
   */
  isExpired(cacheItem) {
    return Date.now() > cacheItem.expires;
  }

  canStoreInLocalStorage(data) {
    try {
      const size = JSON.stringify(data).length;
      return size < 500000; // Don't store items > 500KB in localStorage
    } catch {
      return false;
    }
  }

  cleanupMemoryCache() {
    const now = Date.now();
    const itemsToDelete = [];

    // Find expired items
    this.memoryCache.forEach((item, key) => {
      if (now > item.expires) {
        itemsToDelete.push(key);
      }
    });

    // Delete expired items
    itemsToDelete.forEach(key => this.memoryCache.delete(key));

    // If still too large, delete oldest items
    if (this.memoryCache.size >= this.cacheConfig.maxMemoryItems) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, Math.floor(this.cacheConfig.maxMemoryItems * 0.2));
      toDelete.forEach(([key]) => this.memoryCache.delete(key));
    }
  }

  /**
   * Cache invalidation
   */
  invalidate(key) {
    this.memoryCache.delete(key);
    localStorage.removeItem(`cache_${key}`);
    
    if ('caches' in window) {
      caches.open('api-cache-v1').then(cache => {
        cache.delete(key);
      });
    }
  }

  invalidatePattern(pattern) {
    // Invalidate all keys matching pattern
    const regex = new RegExp(pattern);
    
    // Memory cache
    this.memoryCache.forEach((_, key) => {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
      }
    });

    // localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('cache_') && regex.test(key.substring(6))) {
        localStorage.removeItem(key);
      }
    });
  }

  /**
   * Cache statistics
   */
  getStats() {
    const memoryKeys = Array.from(this.memoryCache.keys());
    const localStorageKeys = Object.keys(localStorage).filter(key => key.startsWith('cache_'));
    
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.cacheConfig.maxMemoryItems,
        keys: memoryKeys
      },
      localStorage: {
        size: localStorageKeys.length,
        keys: localStorageKeys.map(key => key.substring(6))
      },
      config: this.cacheConfig
    };
  }
}

// Create singleton instance
const cacheManager = new AdvancedCacheManager();

/**
 * React hook for cached API calls
 */
export const useCachedAPI = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWithCache = async () => {
      try {
        setLoading(true);
        
        // Try cache first
        const cachedData = await cacheManager.get(url, options);
        if (cachedData) {
          setData(cachedData);
          setLoading(false);
          return;
        }

        // Fetch from API
        const response = await fetch(url, options.fetchOptions);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();
        
        // Cache the result
        await cacheManager.set(url, responseData, options);
        
        setData(responseData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWithCache();
  }, [url, JSON.stringify(options)]);

  const refetch = async () => {
    cacheManager.invalidate(url);
    setLoading(true);
    setError(null);
    // Trigger re-fetch
    const event = new CustomEvent('refetch');
    window.dispatchEvent(event);
  };

  return { data, loading, error, refetch };
};

/**
 * Cache-aware fetch wrapper
 */
export const cachedFetch = async (url, options = {}) => {
  const cacheKey = `${url}_${JSON.stringify(options.params || {})}`;
  
  // Check cache first
  const cachedData = await cacheManager.get(cacheKey, options.cache);
  if (cachedData && !options.force) {
    return cachedData;
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache successful responses
    if (options.cache !== false) {
      await cacheManager.set(cacheKey, data, options.cache);
    }

    return data;
  } catch (error) {

    throw error;
  }
};

/**
 * Preloading with cache
 */
export const preloadWithCache = {
  /**
   * Preload API endpoints
   */
  api: async (endpoints) => {
    const promises = endpoints.map(endpoint => {
      return cachedFetch(endpoint.url, {
        ...endpoint.options,
        cache: { ttl: endpoint.ttl || cacheManager.cacheConfig.longTTL }
      });
    });

    try {
      await Promise.all(promises);
  } catch (error) {
  }
  },

  /**
   * Preload based on user behavior
   */
  predictive: (userActions) => {
    // Analyze user patterns and preload likely next requests
    const predictions = userActions
      .filter(action => action.frequency > 0.5)
      .map(action => action.endpoint);

    if (predictions.length > 0) {
      preloadWithCache.api(predictions);
    }
  }
};

/**
 * Cache warming strategies
 */
export const cacheWarming = {
  /**
   * Warm cache on app load
   */
  onAppLoad: () => {
    const criticalEndpoints = [
      { url: '/api/settings/general', ttl: cacheManager.cacheConfig.longTTL },
      { url: '/api/health', ttl: cacheManager.cacheConfig.shortTTL }
    ];

    requestIdleCallback(() => {
      preloadWithCache.api(criticalEndpoints);
    });
  },

  /**
   * Warm cache based on route
   */
  onRouteChange: (route) => {
    const routeEndpoints = {
      '/dashboard': [
        { url: '/api/orders', ttl: cacheManager.cacheConfig.defaultTTL },
        { url: '/api/stats', ttl: cacheManager.cacheConfig.defaultTTL }
      ],
      '/settings': [
        { url: '/api/settings/firebase', ttl: cacheManager.cacheConfig.longTTL },
        { url: '/api/settings/gcs', ttl: cacheManager.cacheConfig.longTTL }
      ]
    };

    const endpoints = routeEndpoints[route];
    if (endpoints) {
      preloadWithCache.api(endpoints);
    }
  }
};

export { cacheManager };
export default {
  useCachedAPI,
  cachedFetch,
  preloadWithCache,
  cacheWarming,
  cacheManager
};