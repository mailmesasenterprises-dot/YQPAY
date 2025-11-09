import React, { useState, useRef, useEffect } from 'react';
import config from '../config';

const OptimizedImage = ({ 
  src, 
  alt, 
  className, 
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PC9zdmc+',
  quality = 80,
  format = 'webp',
  sizes,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const imgRef = useRef();

  // Generate optimized image URLs
  const getOptimizedSrc = (originalSrc, width) => {
    if (originalSrc.includes('unsplash.com')) {
      return `${originalSrc}&w=${width}&q=${quality}&fm=${format}&auto=format&fit=crop`;
    }
    return originalSrc;
  };

  // Generate responsive srcSet
  const generateSrcSet = () => {
    if (!src.includes('unsplash.com')) return '';
    
    const widths = [400, 800, 1200, 1600];
    return widths
      .map(width => `${getOptimizedSrc(src, width)} ${width}w`)
      .join(', ');
  };

  useEffect(() => {
    // Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before visible
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      // Preload the image
      const img = new Image();
      
      img.onload = () => {
        setCurrentSrc(src);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        setHasError(true);
  };
      
      // Use optimized source
      img.src = getOptimizedSrc(src, 800);
    }
  }, [isInView, src, isLoaded, hasError]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  return (
    <div 
      ref={imgRef}
      className={`optimized-image-container ${isLoaded ? 'loaded' : 'loading'} ${className || ''}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Skeleton loader */}
      {!isLoaded && !hasError && (
        <div className="image-skeleton">
          <div className="skeleton-shimmer"></div>
        </div>
      )}
      
      {/* Main image */}
      <img
        src={currentSrc}
        srcSet={isInView ? generateSrcSet() : ''}
        sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s ease, filter 0.3s ease',
          opacity: isLoaded ? 1 : 0,
          filter: isLoaded ? 'none' : 'blur(5px)'
        }}
        {...props}
      />
      
      {/* Error fallback */}
      {hasError && (
        <div className="image-error">
          <div className="error-icon">📷</div>
          <p>Image failed to load</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;
