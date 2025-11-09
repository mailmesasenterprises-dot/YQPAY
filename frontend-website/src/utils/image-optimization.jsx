/**
 * Advanced Image Optimization Pipeline
 * WebP conversion, responsive images, and smart compression
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Smart Image Component with WebP support and optimization
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '', 
  sizes = '100vw',
  quality = 85,
  loading = 'lazy',
  ...props 
}) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  // WebP support detection
  const supportsWebP = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  };

  // Generate optimized image URLs
  const generateImageUrls = (originalSrc) => {
    const isWebPSupported = supportsWebP();
    const baseUrl = originalSrc.includes('http') ? originalSrc : `/api/image/optimized`;
    
    return {
      webp: isWebPSupported ? `${baseUrl}?format=webp&quality=${quality}` : null,
      original: `${baseUrl}?quality=${quality}`,
      thumbnail: `${baseUrl}?quality=${quality}&width=300`,
      placeholder: `${baseUrl}?quality=20&width=50&blur=5`
    };
  };

  // Responsive image sizes
  const generateSrcSet = (originalSrc) => {
    const sizes = [320, 640, 960, 1280, 1920];
    const urls = generateImageUrls(originalSrc);
    
    return sizes.map(size => 
      `${urls.original}&width=${size} ${size}w`
    ).join(', ');
  };

  useEffect(() => {
    if (!src) return;

    const urls = generateImageUrls(src);
    
    // Try WebP first, fallback to original
    const imageToLoad = urls.webp || urls.original;
    setImageSrc(imageToLoad);
  }, [src, quality]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
    // Fallback to original format
    const urls = generateImageUrls(src);
    if (imageSrc !== urls.original) {
      setImageSrc(urls.original);
    }
  };

  if (!imageSrc) {
    return (
      <div className={`image-placeholder ${className}`} {...props}>
        <div className="placeholder-content">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`optimized-image-container ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc}
        srcSet={generateSrcSet(src)}
        sizes={sizes}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
          filter: hasError ? 'grayscale(100%)' : 'none'
        }}
        {...props}
      />
      {!isLoaded && !hasError && (
        <div className="image-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      {hasError && (
        <div className="image-error-overlay">
          <span>Failed to load image</span>
        </div>
      )}
    </div>
  );
};

/**
 * Progressive Image Loading Hook
 */
export const useProgressiveImage = (src, placeholderSrc) => {
  const [imgSrc, setImgSrc] = useState(placeholderSrc || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      setIsLoading(false);
    };
    img.src = src;
  }, [src]);

  return { imgSrc, isLoading };
};

/**
 * Image optimization utilities for backend integration
 */
export const imageOptimization = {
  /**
   * Client-side image compression before upload
   */
  compressImage: (file, maxWidth = 1920, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;

        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  },

  /**
   * Generate responsive image parameters
   */
  getResponsiveParams: (containerWidth) => {
    if (containerWidth <= 480) return { width: 480, quality: 75 };
    if (containerWidth <= 768) return { width: 768, quality: 80 };
    if (containerWidth <= 1024) return { width: 1024, quality: 85 };
    return { width: 1920, quality: 90 };
  },

  /**
   * Image format detection and optimization
   */
  optimizeForFormat: (file) => {
    const fileType = file.type;
    
    // Optimization recommendations based on format
    if (fileType.includes('png')) {
      return { format: 'webp', quality: 90, lossless: true };
    }
    if (fileType.includes('jpeg') || fileType.includes('jpg')) {
      return { format: 'webp', quality: 85, lossless: false };
    }
    if (fileType.includes('gif')) {
      return { format: 'webp', quality: 80, animated: true };
    }
    
    return { format: 'webp', quality: 85, lossless: false };
  }
};

/**
 * Lazy loading with intersection observer optimization
 */
export const useLazyImageLoading = (threshold = 0.1, rootMargin = '50px') => {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { imgRef, isVisible };
};

/**
 * Image preloading strategies
 */
export const imagePreloader = {
  /**
   * Preload critical images
   */
  preloadCritical: (imageUrls) => {
    imageUrls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  },

  /**
   * Preload images on hover
   */
  preloadOnHover: (imageUrl) => {
    let preloaded = false;
    
    return {
      onMouseEnter: () => {
        if (!preloaded) {
          const img = new Image();
          img.src = imageUrl;
          preloaded = true;
        }
      }
    };
  },

  /**
   * Background preloading with priority
   */
  backgroundPreload: (imageUrls, priority = 'low') => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        imageUrls.forEach(url => {
          const img = new Image();
          img.loading = priority;
          img.src = url;
        });
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        imageUrls.forEach(url => {
          const img = new Image();
          img.src = url;
        });
      }, 1000);
    }
  }
};

/**
 * Image performance monitoring
 */
export const imagePerformanceMonitor = {
  /**
   * Monitor image loading times
   */
  trackLoadTime: (imageUrl) => {
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      
      if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
  }
      
      // Log slow images
      if (loadTime > 2000) {
  }
      
      return loadTime;
    };
  },

  /**
   * Monitor image sizes and optimization opportunities
   */
  analyzeImageOptimization: (img) => {
    const naturalSize = img.naturalWidth * img.naturalHeight;
    const displaySize = img.width * img.height;
    const oversizeRatio = naturalSize / displaySize;
    
    if (oversizeRatio > 2) {
  }
    
    return {
      naturalSize,
      displaySize,
      oversizeRatio,
      recommendations: oversizeRatio > 2 ? ['Consider using smaller image', 'Implement responsive images'] : []
    };
  }
};

export default {
  OptimizedImage,
  useProgressiveImage,
  imageOptimization,
  useLazyImageLoading,
  imagePreloader,
  imagePerformanceMonitor
};