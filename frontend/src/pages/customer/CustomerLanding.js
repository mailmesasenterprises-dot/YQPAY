import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import OfflineNotice from '../../components/OfflineNotice';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import BannerCarousel from '../../components/customer/BannerCarousel';
import { getCachedData, setCachedData } from '../../utils/cacheUtils';
import config from '../../config';
import '../../styles/customer/CustomerLanding.css';

// Exact cinema combo image - purple popcorn bucket with gold designs and black drink cup
const CINEMA_COMBO_IMAGE = "/images/cinema-combo.jpg.png"; // Local branded cinema combo image

// Lazy loading image component
const LazyFoodImage = React.memo(({ src, alt, className }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setIsLoading(false);
      };
      img.onerror = () => {
        setHasError(true);
        setIsLoading(false);
      };
      img.src = src;
    }
  }, [src]);

  if (isLoading) {
    return (
      <div className={`${className} loading-placeholder`}>
        <div className="loading-shimmer"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`${className} error-placeholder`}>
        <span>🍿</span>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy"
    />
  );
});

LazyFoodImage.displayName = 'LazyFoodImage';

const CustomerLanding = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams(); // Get route parameters (for /menu/:theaterId)
  
  // Network status for offline handling
  const { shouldShowOfflineUI, isNetworkError } = useNetworkStatus();
  
  // State management
  const [theater, setTheater] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [theaterId, setTheaterId] = useState(null);
  const [screenName, setScreenName] = useState(null);
  const [seatId, setSeatId] = useState(null);
  const [qrName, setQrName] = useState(null); // QR name from scanned code

  // Extract parameters from URL (theater ID, screen name, seat ID, QR name)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    
    // Theater ID can come from route parameter (/menu/:theaterId) or query string (?theaterid=...)
    const routeTheaterId = params.theaterId; // From /menu/:theaterId
    const queryTheaterId = urlParams.get('theaterid') || urlParams.get('theaterId') || urlParams.get('THEATERID');
    const id = routeTheaterId || queryTheaterId;
    
    // Support both lowercase and uppercase parameter names for backwards compatibility
    const screen = urlParams.get('screen') || urlParams.get('SCREEN');
    const seat = urlParams.get('seat') || urlParams.get('SEAT');
    const qr = urlParams.get('qrName') || urlParams.get('qrname') || urlParams.get('QRNAME');
    
    if (!id) {
      setError('Theater ID is required');
      setLoading(false);
      return;
    }
    

    setTheaterId(id);
    setScreenName(screen);
    setSeatId(seat);
    setQrName(qr);

    // Verify QR code if qrName is present
    if (qr && id) {
      verifyQRCode(qr, id);
    }
  }, [location.search, params.theaterId]);

  // Verify QR code status
  const verifyQRCode = async (qrName, theaterId) => {
    try {

      const apiUrl = `${config.api.baseUrl}/single-qrcodes/verify-qr/${qrName}?theaterId=${theaterId}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });


      const data = await response.json();

      if (!response.ok || !data.success || !data.isActive) {
        // QR code is deactivated or not found

        // Redirect to error page
        navigate(`/qr-unavailable?theaterid=${theaterId}`);
        return;
      }
      
  } catch (error) {

      // If verification fails (network error), redirect to error page
      navigate(`/qr-unavailable?theaterid=${theaterId}`);
    }
  };

  // Load data when theater ID is available with cache-first strategy
  useEffect(() => {
    if (theaterId) {
      const cacheKey = `customerLanding_${theaterId}`;
      
      // Check cache first for instant loading
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log('⚡ [CustomerLanding] Loading from cache');
        if (cached.theater) setTheater(cached.theater);
        if (cached.settings) setSettings(cached.settings);
        setLoading(false);
      }
      
      // Fetch fresh data in parallel (background refresh)
      const fetchFreshData = async () => {
        try {
          const [theaterRes, settingsRes] = await Promise.all([
            fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              mode: 'cors'
            }),
            fetch(`${config.api.baseUrl}/settings/general`)
          ]);
          
          const [theaterData, settingsData] = await Promise.all([
            theaterRes.json(),
            settingsRes.json()
          ]);
          
          // Process theater data
          let freshTheater = null;
          if (theaterRes.ok && theaterData.success && theaterData.data) {
            freshTheater = theaterData.data;
            setTheater(freshTheater);
          } else {
            throw new Error(theaterData.error || theaterData.message || 'Theater not found');
          }
          
          // Process settings data
          let freshSettings = null;
          if (settingsData.success && settingsData.data.config) {
            freshSettings = settingsData.data.config;
            setSettings(freshSettings);
          }
          
          // Cache the fresh data
          setCachedData(cacheKey, {
            theater: freshTheater,
            settings: freshSettings
          });
          
          setLoading(false);
        } catch (error) {
          console.error('💥 [CustomerLanding] Error loading data:', error);
          setError(`Theater not found: Load failed\n${error.message || 'Unknown error'}`);
          setLoading(false);
        }
      };
      
      fetchFreshData();
    }
  }, [theaterId]);

  // Navigation handlers
  const handleOrderFood = () => {
    let url = `/customer/order?theaterid=${theaterId}`;
    if (qrName) url += `&qrName=${encodeURIComponent(qrName)}`;
    if (screenName) url += `&screen=${encodeURIComponent(screenName)}`;
    if (seatId) url += `&seat=${encodeURIComponent(seatId)}`;
    // Try to extract seatClass from qrName or use a default
    const sClass = qrName || 'General';
    url += `&seatClass=${encodeURIComponent(sClass)}`;
    navigate(url);
  };

  const handleOrderHistory = () => {
    const params = new URLSearchParams();
    params.set('theaterid', theaterId);
    if (theater?.name) {
      params.set('theaterName', theater.name);
    }
    if (screenName) {
      params.set('screen', encodeURIComponent(screenName));
    }
    if (seatId) {
      params.set('seat', encodeURIComponent(seatId));
    }
    
    navigate(`/customer/order-history?${params.toString()}`);
  };

  // Loading state
  if (loading) {
    return (
      <div className="customer-landing loading">
        <div className="welcome-section fade-in">
          <div className="loading-text">Loading...</div>
          <div className="loading-shimmer-bar"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="customer-landing error">
        <div className="error-section fade-in">
          <div className="error-icon">⚠️</div>
          <h2>Theater Not Found</h2>
          <p>{error}</p>
          <p className="error-hint">Please check the QR code and try again.</p>
          <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
            <p>Debug Info:</p>
            <p>Theater ID: {theaterId || 'Not set'}</p>
            <p>API URL: {config.api.baseUrl}</p>
            <p>Current URL: {window.location.href}</p>
          </div>
          <button 
            onClick={() => {
              setError(null);
              setLoading(true);
              if (theaterId) {
                // Clear cache and reload
                const cacheKey = `customerLanding_${theaterId}`;
                sessionStorage.removeItem(cacheKey);
                window.location.reload();
              }
            }}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#6B0E9B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="customer-landing">
        {/* Show offline notice if in offline mode */}
        {shouldShowOfflineUI && <OfflineNotice />}
        
        {/* Header Section - Clean welcome without seat info */}
        <div className="welcome-section fade-in">
          <h1 className="welcome-title">WELCOME TO</h1>
          <h2 className="theater-name">{theater?.name || 'THEATER NAME'}</h2>
          <p className="theater-location">
            {theater?.location?.city || theater?.location?.address || 'LOCATION'}
          </p>
        </div>

        {/* Banner Carousel Section */}
        {theaterId && <BannerCarousel theaterId={theaterId} />}

          {/* Cinema Combo Display - Direct Image */}
          <div className="food-section fade-in-delay">
            <LazyFoodImage
              src={CINEMA_COMBO_IMAGE}
              alt="Purple Popcorn Bucket & Black Drink Cup"
              className="cinema-combo-direct"
            />
          </div>

          {/* Action Buttons Section */}
          <div className="action-section fade-in-delay">
            <button 
              className="order-button primary-button"
              onClick={handleOrderFood}
            >
              <span className="button-arrows">»</span>
              FOOD ORDER
              <span className="button-arrows">«</span>
            </button>
            
            <button 
              className="history-link"
              onClick={handleOrderHistory}
            >
              ORDER HISTORY
            </button>
          </div>

          {/* Footer Section */}
          <div className="footer-section fade-in-delay">
            <p className="powered-by">Powered By</p>
            <div className="logo-container">
              {settings?.logoUrl ? (
                <img 
                  src="/api/settings/image/logo" 
                  alt={settings?.applicationName || 'YQPayNow'}
                  className="logo-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <div className="logo-text" style={{ display: settings?.logoUrl ? 'none' : 'block' }}>
                {settings?.applicationName || 'YQPayNow'}
              </div>
            </div>
          </div>
        </div>
    </ErrorBoundary>
  );
};

export default CustomerLanding;