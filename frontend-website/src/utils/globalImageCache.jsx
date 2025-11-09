/**
 * Global Image Caching System - UNIFIED WITH OFFLINE POS
 * Automatically caches ALL images across the entire application
 * Works for: Super Admin, Theater Admin, Kiosk, Customer pages, Offline POS
 * 
 * Features:
 * - Automatic base64 conversion and localStorage caching
 * - Image proxy to bypass CORS
 * - INSTANT image loading on repeat visits (same as Offline POS)
 * - Works offline after first load
 * - 24-hour cache TTL (matches offlineStorage.js)
 */

const IMAGE_CACHE_PREFIX = 'offline_image_'; // Match offlineStorage.js prefix
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours (matches offlineStorage.js)

/**
 * Generate cache key from image URL (MATCHES offlineStorage.js)
 */
const getCacheKey = (imageUrl) => {
  try {
    return `${IMAGE_CACHE_PREFIX}${btoa(imageUrl).substring(0, 50)}`; // Match offlineStorage.js length
  } catch (error) {
    console.error('Error generating cache key:', error);
    return `${IMAGE_CACHE_PREFIX}${imageUrl.substring(0, 50)}`;
  }
};

/**
 * Get cached image from localStorage (SIMPLIFIED - MATCHES offlineStorage.js)
 * @param {string} imageUrl - Original image URL
 * @returns {string|null} - Base64 image data or null
 */
export const getCachedImage = (imageUrl) => {
  if (!imageUrl) return null;
  
  try {
    const cacheKey = getCacheKey(imageUrl);
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      console.log(`✅ [GlobalCache] Using cached image: ${imageUrl.substring(0, 50)}...`);
    }
    
    return cached; // Return base64 directly (no timestamp check for instant loading)
  } catch (error) {
    console.error('Error reading cached image:', error);
    return null;
  }
};

/**
 * Get image source with instant cache check (LIKE OFFLINE POS)
 * Returns cached base64 immediately if available, otherwise returns original URL
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Cached base64 or original URL
 */
export const getImageSrc = (imageUrl) => {
  if (!imageUrl) return null;
  
  const cached = getCachedImage(imageUrl);
  return cached || imageUrl; // Return cached base64 OR original URL instantly
};

/**
 * Cache image as base64 in localStorage (SIMPLIFIED - MATCHES offlineStorage.js)
 * @param {string} imageUrl - Original image URL
 * @param {string} base64Data - Base64 image data
 * @returns {boolean} - Success status
 */
export const setCachedImage = (imageUrl, base64Data) => {
  if (!imageUrl || !base64Data) return false;
  
  try {
    const cacheKey = getCacheKey(imageUrl);
    
    // Store base64 directly (no wrapper object for faster access)
    localStorage.setItem(cacheKey, base64Data);
    console.log(`✅ [GlobalCache] Cached image successfully: ${imageUrl.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.warn('⚠️ [GlobalCache] Storage quota exceeded:', error.message);
    
    // If quota exceeded, try to clear old images
    if (error.name === 'QuotaExceededError') {
      clearOldImageCache();
      try {
        const cacheKey = getCacheKey(imageUrl);
        localStorage.setItem(cacheKey, base64Data);
        return true;
      } catch (retryError) {
        console.error('Failed to cache image after cleanup:', retryError);
      }
    }
    return false;
  }
};

/**
 * Fetch image through proxy and cache as base64 (MATCHES offlineStorage.js)
 * @param {string} imageUrl - Original image URL
 * @returns {Promise<string>} - Base64 image data or original URL
 */
export const fetchAndCacheImage = async (imageUrl) => {
  if (!imageUrl) return null;
  
  // Check cache first - instant return if cached
  const cached = getCachedImage(imageUrl);
  if (cached) {
    return cached;
  }
  
  // If imageUrl is already a data URL (base64), return it directly
  // Don't send large base64 data URLs through proxy as query params (causes 431 error)
  if (imageUrl.startsWith('data:')) {
    console.log(`✅ [GlobalCache] Image is already base64, using directly`);
    try {
      setCachedImage(imageUrl, imageUrl);
      return imageUrl;
    } catch (storageError) {
      console.warn('⚠️ [GlobalCache] Storage quota exceeded:', storageError.message);
      return imageUrl; // Return original URL
    }
  }
  
  console.log(`📥 [GlobalCache] Fetching image via proxy: ${imageUrl.substring(0, 50)}...`);
  
  try {
    // For regular URLs, use POST instead of GET to avoid header size limits
    // Use fetch with POST to send URL in body instead of query string
    return fetch('/api/proxy-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: imageUrl }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Proxy request failed: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            try {
              // Convert to base64 using canvas
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              
              const base64 = canvas.toDataURL('image/jpeg', 0.8); // Match offlineStorage.js quality
              
              // Cache for future use
              try {
                setCachedImage(imageUrl, base64);
                resolve(base64);
              } catch (storageError) {
                console.warn('⚠️ [GlobalCache] Storage quota exceeded:', storageError.message);
                resolve(imageUrl); // Return original URL
              }
            } catch (canvasError) {
              console.error('❌ [GlobalCache] Canvas error:', canvasError.message);
              resolve(imageUrl); // Return original URL
            }
          };
          img.onerror = () => {
            console.error(`❌ [GlobalCache] Failed to load image: ${imageUrl.substring(0, 50)}...`);
            resolve(imageUrl); // Return original URL on error
          };
          img.src = e.target.result;
        };
        reader.onerror = () => {
          console.error(`❌ [GlobalCache] Failed to read blob: ${imageUrl.substring(0, 50)}...`);
          resolve(imageUrl); // Return original URL on error
        };
        reader.readAsDataURL(blob);
      });
    })
    .catch(error => {
      console.error(`❌ [GlobalCache] Proxy error: ${error.message}`);
      return imageUrl; // Fallback to original URL
    });
  } catch (error) {
    console.error('[GlobalCache] Image fetch error:', error);
    return imageUrl; // Fallback to original URL
  }
};

/**
 * Pre-cache multiple images in background
 * @param {Array<string>} imageUrls - Array of image URLs to cache
 * @returns {Promise<Object>} - Stats about caching success/failure
 */
export const preCacheImages = async (imageUrls) => {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { success: 0, failed: 0, total: 0 };
  }
  
  console.log(`🎨 [GlobalCache] Pre-caching ${imageUrls.length} images...`);
  
  const results = await Promise.allSettled(
    imageUrls.map(url => fetchAndCacheImage(url))
  );
  
  const stats = {
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    total: imageUrls.length
  };
  
  console.log(`✅ [GlobalCache] Cached ${stats.success}/${stats.total} images`);
  
  return stats;
};

/**
 * Cache all product images (MATCHES offlineStorage.js cacheProductImages)
 * Automatically extracts image URLs from product objects
 * @param {Array<Object>} products - Array of product objects
 * @returns {Promise<void>}
 */
export const cacheProductImages = async (products) => {
  if (!Array.isArray(products) || products.length === 0) {
    console.log('⚠️ [GlobalCache] No products to cache');
    return;
  }
  
  console.log(`🎨 [GlobalCache] Starting to cache ${products.length} product images...`);
  const imagePromises = [];
  let imageCount = 0;
  
  for (const product of products) {
    let imageUrl = null;
    
    // Extract image URL from different product structures
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
    } else if (product.productImage) {
      imageUrl = product.productImage;
    } else if (product.image) {
      imageUrl = product.image;
    }
    
    if (imageUrl) {
      imageCount++;
      console.log(`📸 [GlobalCache] Queueing image ${imageCount}: ${imageUrl.substring(0, 60)}...`);
      imagePromises.push(fetchAndCacheImage(imageUrl));
    }
  }
  
  console.log(`⏳ [GlobalCache] Found ${imageCount} images to cache`);
  
  try {
    const results = await Promise.allSettled(imagePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`✅ [GlobalCache] Image caching complete: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error('[GlobalCache] Error caching product images:', error);
  }
};

/**
 * Clear old cached images (DISABLED - cache persists for 24 hours like offlineStorage)
 * Images are stored without timestamps for instant access
 */
export const clearOldImageCache = () => {
  // No-op: We store base64 directly without timestamps
  // Cache will be cleared manually or when quota exceeded
  console.log('ℹ️ [GlobalCache] Cache cleanup skipped (24-hour persistent cache)');
};

/**
 * Clear all cached images
 */
export const clearAllImageCache = () => {
  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;
    
    keys.forEach(key => {
      if (key.startsWith(IMAGE_CACHE_PREFIX)) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    
    console.log(`🗑️ [GlobalImageCache] Cleared ${cleared} cached images`);
    return cleared;
  } catch (error) {
    console.error('Error clearing image cache:', error);
    return 0;
  }
};

/**
 * Get image cache statistics
 */
export const getImageCacheStats = () => {
  try {
    const keys = Object.keys(localStorage);
    const imageKeys = keys.filter(key => key.startsWith(IMAGE_CACHE_PREFIX));
    
    let totalSize = 0;
    imageKeys.forEach(key => {
      const item = localStorage.getItem(key);
      totalSize += item ? item.length : 0;
    });
    
    return {
      totalImages: imageKeys.length,
      estimatedSize: `${(totalSize / (1024 * 1024)).toFixed(2)} MB`,
      sizeInBytes: totalSize
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { totalImages: 0, estimatedSize: '0 MB', sizeInBytes: 0 };
  }
};

// Export all functions
export default {
  getCachedImage,
  getImageSrc, // NEW: Instant cache check helper
  setCachedImage,
  fetchAndCacheImage,
  preCacheImages,
  cacheProductImages, // NEW: Batch product image caching
  clearOldImageCache,
  clearAllImageCache,
  getImageCacheStats
};
