import React, { useState, useEffect, useCallback, useRef } from 'react';
import config from '../../config';
import './BannerCarousel.css';

const BannerCarousel = ({ theaterId, autoScrollInterval = 4000 }) => {
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  
  const autoScrollTimerRef = useRef(null);
  const minSwipeDistance = 50;

  // Fetch banners from API
  const fetchBanners = useCallback(async () => {
    console.log('🎯 BannerCarousel: fetchBanners called with theaterId:', theaterId);
    
    if (!theaterId) {
      console.log('❌ BannerCarousel: No theaterId provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const url = `${config.api.baseUrl}/theater-banners/${theaterId}?page=1&limit=10`;
      console.log('📡 BannerCarousel: Fetching from URL:', url);
      
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      console.log('📥 BannerCarousel: Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📦 BannerCarousel: Response data:', data);
        
        if (data.success && data.data.banners) {
          // Filter only active banners and sort by sortOrder
          const activeBanners = data.data.banners
            .filter(banner => banner.isActive)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          
          console.log('✅ BannerCarousel: Active banners found:', activeBanners.length);
          console.log('🖼️  BannerCarousel: Banners:', activeBanners);
          setBanners(activeBanners);
        } else {
          console.log('⚠️ BannerCarousel: No banners in response');
          setBanners([]);
        }
      } else {
        console.log('❌ BannerCarousel: Response not OK');
        setBanners([]);
      }
    } catch (error) {
      console.error('💥 BannerCarousel: Error fetching banners:', error);
      setBanners([]);
    } finally {
      setLoading(false);
      console.log('🏁 BannerCarousel: Loading finished');
    }
  }, [theaterId]);

  // Fetch banners on mount and when theaterId changes
  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Auto-scroll functionality
  useEffect(() => {
    if (!isPaused && banners.length > 1) {
      autoScrollTimerRef.current = setInterval(() => {
        setCurrentIndex((prevIndex) => 
          prevIndex === banners.length - 1 ? 0 : prevIndex + 1
        );
      }, autoScrollInterval);

      return () => {
        if (autoScrollTimerRef.current) {
          clearInterval(autoScrollTimerRef.current);
        }
      };
    }
  }, [isPaused, banners.length, autoScrollInterval]);

  // Handle touch start
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsPaused(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  // Handle touch end
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsPaused(false);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left - next banner
      setCurrentIndex((prevIndex) => 
        prevIndex === banners.length - 1 ? 0 : prevIndex + 1
      );
    } else if (isRightSwipe) {
      // Swipe right - previous banner
      setCurrentIndex((prevIndex) => 
        prevIndex === 0 ? banners.length - 1 : prevIndex - 1
      );
    }

    setTimeout(() => setIsPaused(false), 300);
  };

  // Handle indicator dot click
  const handleDotClick = (index) => {
    setCurrentIndex(index);
    setIsPaused(true);
    setTimeout(() => setIsPaused(false), 2000);
  };

  // Handle mouse enter/leave for desktop
  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  // Don't render anything if loading or no banners
  if (loading) {
    console.log('⏳ BannerCarousel: Still loading...');
    return (
      <div className="banner-carousel">
        <div className="banner-skeleton">
          <div className="skeleton-shimmer"></div>
        </div>
      </div>
    );
  }

  if (!banners || banners.length === 0) {
    console.log('🚫 BannerCarousel: No banners to display, hiding component');
    // Always show a message in development to help debugging
    return (
      <div style={{ 
        padding: '12px 16px', 
        margin: '16px', 
        background: '#fef3c7', 
        color: '#92400e', 
        borderRadius: '8px',
        fontSize: '13px',
        textAlign: 'center',
        border: '1px solid #fbbf24'
      }}>
        📢 No banners available for this theater. Please add banners in Theater Banner Management.
      </div>
    );
  }

  console.log('🎨 BannerCarousel: Rendering carousel with', banners.length, 'banners');
  console.log('🎯 BannerCarousel: Current index:', currentIndex);
  console.log('🖼️  BannerCarousel: First banner:', banners[0]);

  return (
    <div 
      className="banner-carousel"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="banner-carousel__track"
        style={{
          transform: `translate3d(-${currentIndex * 100}%, 0, 0)`,
          transition: 'transform 300ms ease-out'
        }}
      >
        {banners.map((banner, index) => (
          <div 
            key={banner._id} 
            className="banner-carousel__slide"
          >
            <img
              src={banner.imageUrl}
              alt={`Banner ${index + 1}`}
              className="banner-carousel__image"
              loading={index === 0 ? 'eager' : 'lazy'}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        ))}
      </div>

      {/* Indicator dots - only show if more than one banner */}
      {banners.length > 1 && (
        <div className="banner-carousel__indicators">
          {banners.map((_, index) => (
            <button
              key={index}
              className={`banner-carousel__dot ${index === currentIndex ? 'banner-carousel__dot--active' : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BannerCarousel;
