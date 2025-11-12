/**
 * InstantImage Component - ZERO-DELAY IMAGE LOADING
 * Works EXACTLY like Offline POS - checks cache synchronously
 * 
 * Usage:
 * <InstantImage src={imageUrl} alt="Product" className="product-img" />
 * 
 * Features:
 * - INSTANT loading from cache (no async delays)
 * - Synchronous cache check
 * - Falls back to original URL if not cached
 * - No lazy loading delays
 * - No state management delays
 */

import { getCachedImage } from '../utils/globalImageCache';

const InstantImage = ({ 
  src, 
  alt = '', 
  className = '', 
  style = {},
  onError = null,
  loading = 'eager',
  decoding = 'async'
}) => {
  // 🚀 SYNCHRONOUS cache check - INSTANT!
  const cachedBase64 = getCachedImage(src);
  const imageSrc = cachedBase64 || src; // Use cache OR original URL instantly
  
  const handleError = (e) => {
    if (onError) {
      onError(e);
    } else {
      // Default fallback
      e.target.style.display = 'none';
      if (e.target.nextSibling) {
        e.target.nextSibling.style.display = 'flex';
      }
    }
  };
  
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      style={{imageRendering: 'auto', ...style}}
      loading={loading}
      decoding={decoding}
      onError={handleError}
    />
  );
};

export default InstantImage;
