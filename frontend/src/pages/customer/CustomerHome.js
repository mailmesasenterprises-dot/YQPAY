import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import ProductCollectionModal from '../../components/customer/ProductCollectionModal';
import BannerCarousel from '../../components/customer/BannerCarousel';
import OfflineNotice from '../../components/OfflineNotice';
import CachedImage from '../../components/CachedImage'; // 🖼️ Global image caching
import InstantImage from '../../components/InstantImage'; // 🚀 INSTANT image loading (like Offline POS)
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { 
  groupProductsIntoCollections, 
  filterCollections,
  getDefaultVariant 
} from '../../utils/productCollections';
import { getCachedData, setCachedData } from '../../utils/cacheUtils';
import { preCacheImages, cacheProductImages } from '../../utils/globalImageCache'; // 🎨 Pre-cache product images
import config from '../../config';
import './../../styles/customer/CustomerHome.css';

const CustomerHome = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const { items, addItem, updateQuantity, removeItem, getTotalItems, getItemQuantity } = cart;
  
  // Network status for offline handling
  const { shouldShowOfflineUI, isNetworkError } = useNetworkStatus();
  const [theaterId, setTheaterId] = useState(null);
  const [theater, setTheater] = useState(null);
  const [products, setProducts] = useState([]);
  const [productCollections, setProductCollections] = useState([]);
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrName, setQrName] = useState(null);
  const [seat, setSeat] = useState(null);
  const [screenName, setScreenName] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scannedQRData, setScannedQRData] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Initialize state from localStorage if URL params are missing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('theaterid') || params.get('theaterId') || params.get('THEATERID');
    
    // If no theaterId in URL, try to restore from localStorage and redirect
    if (!id) {
      const savedId = localStorage.getItem('customerTheaterId');
      if (savedId) {
        const savedQr = localStorage.getItem('customerQrName');
        const savedScreen = localStorage.getItem('customerScreenName');
        const savedSeat = localStorage.getItem('customerSeat');
        
        const newParams = new URLSearchParams();
        newParams.set('theaterid', savedId);
        if (savedQr) newParams.set('qrName', savedQr);
        if (savedScreen) newParams.set('screen', savedScreen);
        if (savedSeat) newParams.set('seat', savedSeat);
        
        // Redirect with saved parameters
        navigate(`/customer/home?${newParams.toString()}`, { replace: true });
        return;
      }
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Support multiple parameter name variations for backwards compatibility
    const id = params.get('theaterid') || params.get('theaterId') || params.get('THEATERID');
    const qr = params.get('qrName') || params.get('qrname') || params.get('QRNAME');
    const seatNum = params.get('seat') || params.get('SEAT');
    const screen = params.get('screen') || params.get('SCREEN') || params.get('screenName');
    const category = params.get('category'); // Get saved category from URL
    

    // Save to localStorage for persistence on refresh
    if (id) {
      console.log('✅ [CustomerHome] Setting theaterId:', id);
      setTheaterId(id);
      localStorage.setItem('customerTheaterId', id);
    } else {
      console.warn('⚠️ [CustomerHome] No theaterId found in URL parameters');
    }
    
    if (qr) {

      setQrName(qr);
      localStorage.setItem('customerQrName', qr);
      // If no screen name is provided, use qrName as screen name
      if (!screen) {

        setScreenName(qr);
        localStorage.setItem('customerScreenName', qr);
      }
    }
    
    if (seatNum) {
      setSeat(seatNum);
      localStorage.setItem('customerSeat', seatNum);
    }
    
    if (screen) {
      setScreenName(screen);
      localStorage.setItem('customerScreenName', screen);
    }
    
    if (category) setSelectedCategory(category); // Restore selected category
  }, [location.search, navigate]);

  // Main data loading with cache-first strategy
  useEffect(() => {
    if (theaterId) {
      const cacheKey = `customerHome_${theaterId}`;
      
      // Check cache first for instant loading
      const cached = getCachedData(cacheKey);
      if (cached) {
        console.log('⚡ [CustomerHome] Loading from cache');
        if (cached.theater) setTheater(cached.theater);
        if (cached.products) {
          setProducts(cached.products);
          const collections = groupProductsIntoCollections(cached.products);
          setProductCollections(collections);
        }
        if (cached.categories) setCategories(cached.categories);
        setLoading(false);
      }
      
      // Fetch fresh data in parallel (background refresh)
      const fetchFreshData = async () => {
        try {
          const [theaterRes, productsRes, categoriesRes] = await Promise.all([
            fetch(`${config.api.baseUrl}/theaters/${theaterId}`),
            fetch(`${config.api.baseUrl}/theater-products/${theaterId}`),
            fetch(`${config.api.baseUrl}/theater-categories/${theaterId}`)
          ]);
          
          const [theaterData, productsData, categoriesData] = await Promise.all([
            theaterRes.json(),
            productsRes.json(),
            categoriesRes.json()
          ]);
          
          // Process theater data
          let freshTheater = null;
          if (theaterData.success && theaterData.data) {
            freshTheater = theaterData.data;
            setTheater(freshTheater);
          }
          
          // Process products data
          let freshProducts = [];
          if (productsData.success && productsData.data.products) {
            freshProducts = productsData.data.products.map(p => {
              let imageUrl = null;
              if (p.images && Array.isArray(p.images) && p.images.length > 0) {
                if (typeof p.images[0] === 'object' && p.images[0].url) {
                  imageUrl = p.images[0].url;
                } else if (typeof p.images[0] === 'string') {
                  imageUrl = p.images[0];
                }
              } else if (p.productImage) {
                imageUrl = p.productImage;
              } else if (p.image) {
                imageUrl = p.image;
              }
              
              const isActive = p.isActive === true;
              const trackStock = p.inventory?.trackStock !== false;
              const currentStock = p.inventory?.currentStock || 0;
              const hasStock = !trackStock || currentStock > 0;
              const isAvailable = isActive && hasStock;
              
              return {
                _id: p._id,
                name: p.name || p.productName,
                price: p.pricing?.salePrice || p.price || p.sellingPrice || 0,
                description: p.description || '',
                image: imageUrl,
                categoryId: p.categoryId || (typeof p.category === 'object' ? p.category?._id : p.category),
                category: typeof p.category === 'object' ? (p.category?.categoryName || p.category?.name) : p.category,
                quantity: p.quantity || null,
                size: p.size || null,
                pricing: p.pricing,
                taxRate: p.pricing?.taxRate || p.taxRate || 0,
                gstType: p.gstType || 'EXCLUDE',
                discountPercentage: p.pricing?.discountPercentage || p.discountPercentage || 0,
                isActive: p.isActive,
                status: p.status,
                inventory: p.inventory,
                currentStock: currentStock,
                trackStock: trackStock,
                isAvailable: isAvailable,
              };
            });
            
            setProducts(freshProducts);
            const collections = groupProductsIntoCollections(freshProducts);
            setProductCollections(collections);
          }
          
          // Process categories data
          let freshCategories = [];
          if (categoriesData.success && categoriesData.data.categories) {
            freshCategories = categoriesData.data.categories
              .filter(cat => cat.isActive)
              .slice(0, 6)
              .map(cat => ({
                _id: cat._id,
                name: cat.categoryName || cat.name,
                image: cat.imageUrl || cat.image,
                icon: cat.icon || '📦',
                isActive: cat.isActive
              }));
            setCategories(freshCategories);
          }
          
          // Cache the fresh data
          setCachedData(cacheKey, {
            theater: freshTheater,
            products: freshProducts,
            categories: freshCategories
          });
          
          // 🎨 AUTO-CACHE ALL PRODUCT IMAGES (LIKE OFFLINE POS)
          if (freshProducts.length > 0) {
            console.log(`🎨 [CustomerHome] Auto-caching ${freshProducts.length} product images...`);
            cacheProductImages(freshProducts).catch(err => {
              console.error('Error caching product images:', err);
            });
          }
          
          setLoading(false);
        } catch (err) {
          console.error('💥 [CustomerHome] Error loading data:', err);
          setLoading(false);
        }
      };
      
      fetchFreshData();
    }
  }, [theaterId]);

  // Auto-refresh products every 30 seconds to get admin updates
  useEffect(() => {
    if (!theaterId) return;
    
    const refreshInterval = setInterval(() => {
      // Trigger data refresh by invalidating cache
      const cacheKey = `customerHome_${theaterId}`;
      sessionStorage.removeItem(cacheKey);
      window.location.reload(); // Simple full reload to get fresh data
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [theaterId]);

  // Filter collections based on search query and selected category
  const filterProductCollections = useCallback(() => {
    console.log(`🔍 [CustomerHome] Filtering - Category: ${selectedCategory}, Search: "${searchQuery}"`);

    // For "All" category: show grouped collections
    if (selectedCategory === 'all') {
      const filtered = filterCollections(productCollections, searchQuery, selectedCategory);
      console.log(`🎯 [CustomerHome] Filtered collections for "All": ${filtered.length} collections`);

      setFilteredCollections(filtered);
    } else {
      // For specific categories: show individual products
      // Filter by category ID (not name)

      let individualProducts = products.filter(p => {
        const matches = p.categoryId === selectedCategory;

        return matches;
      });
      

      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        individualProducts = individualProducts.filter(p =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
        );
      }
      
      // Apply veg filter (only for category view, not "all")
      // When toggle is ON, show only NON-VEG items
      if (isVegOnly) {
        individualProducts = individualProducts.filter(p => 
          p.isVeg === false || (!p.isVeg && !p.category?.toLowerCase().includes('veg'))
        );
      }
      
      // Apply price range filter (only for category view, not "all")
      if (selectedPriceRange !== 'all') {
        individualProducts = individualProducts.filter(p => {
          const price = parseFloat(p.price) || 0;
          switch (selectedPriceRange) {
            case 'under100':
              return price < 100;
            case '100-200':
              return price >= 100 && price <= 200;
            case '200-300':
              return price > 200 && price <= 300;
            case 'above300':
              return price > 300;
            default:
              return true;
          }
        });
      }
      
      // Convert to collection format for consistent rendering
      const productItems = individualProducts.map(p => ({
        name: p.name,
        baseImage: p.image,
        category: p.category,
        isCollection: false,
        basePrice: parseFloat(p.price) || 0,
        singleVariant: {
          _id: p._id,
          size: p.size || 'Regular',
          sizeLabel: p.quantity || null,
          price: parseFloat(p.price) || 0,
          description: p.description,
          image: p.image,
          originalProduct: p
        },
        variants: [{
          _id: p._id,
          size: p.size || 'Regular',
          sizeLabel: p.quantity || null,
          price: parseFloat(p.price) || 0,
          description: p.description,
          image: p.image,
          originalProduct: p
        }]
      }));
      

      setFilteredCollections(productItems);
    }
  }, [productCollections, products, selectedCategory, searchQuery, isVegOnly, selectedPriceRange]);

  // Update filtered collections when filters change
  useEffect(() => {
    console.log('🔄 [CustomerHome] Filters changed, running filterProductCollections');
    filterProductCollections();
  }, [productCollections, products, selectedCategory, searchQuery, isVegOnly, selectedPriceRange]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle QR Scanner
  const handleQRScan = async () => {
    setShowQRScanner(true);
    
    // Wait for modal to render, then start camera
    setTimeout(async () => {
      try {
        const video = document.getElementById('qr-video');
        if (video) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' } // Use back camera on mobile
          });
          video.srcObject = stream;
          video.play();
          
          // Start scanning with BarcodeDetector if available
          if ('BarcodeDetector' in window) {
            const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
            startBarcodeScanning(video, barcodeDetector);
          } else {
  }
        }
      } catch (error) {

        alert('❌ Unable to access camera. Please allow camera access or enter QR code data manually.');
        handleCloseQRScanner();
      }
    }, 100);
  };

  const startBarcodeScanning = (video, detector) => {
    scanIntervalRef.current = setInterval(async () => {
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const qrCode = barcodes[0].rawValue;
          handleQRScanSuccess(qrCode);
          clearInterval(scanIntervalRef.current);
        }
      } catch (error) {
        // Silently handle detection errors
      }
    }, 500); // Scan every 500ms
  };

  const handleQRScanSuccess = async (decodedText) => {

    // Stop the camera
    stopCamera();
    
    try {
      // Parse QR code URL to extract screen and seat info
      const url = new URL(decodedText);
      const params = new URLSearchParams(url.search);
      
      const scannedScreen = params.get('screen') || params.get('SCREEN');
      const scannedSeat = params.get('seat') || params.get('SEAT');
      const scannedQrName = params.get('qrName') || params.get('qrname') || params.get('QRNAME');
      
      if (scannedQrName) {
        // Verify QR code status with backend

        try {
          const verifyResponse = await fetch(
            `http://localhost:5000/api/single-qrcodes/verify-qr/${scannedQrName}?theaterId=${theaterId}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          const verifyData = await verifyResponse.json();
          
          if (!verifyResponse.ok || !verifyData.success || !verifyData.isActive) {
            // QR code is deactivated or not found

            setShowQRScanner(false);
            
            // Redirect to error page
            navigate(`/qr-unavailable?theaterid=${theaterId}`);
            return;
          }
          
  } catch (verifyError) {

          // If verification fails (network error), redirect to error page
          setShowQRScanner(false);
          navigate(`/qr-unavailable?theaterid=${theaterId}`);
          return;
        }
      }
      
      if (scannedScreen || scannedSeat || scannedQrName) {
        // Update the state with scanned info
        if (scannedScreen) {
          setScreenName(scannedScreen);
          localStorage.setItem('customerScreenName', scannedScreen);
        }
        if (scannedSeat) {
          setSeat(scannedSeat);
          localStorage.setItem('customerSeat', scannedSeat);
        }
        if (scannedQrName) {
          setQrName(scannedQrName);
          localStorage.setItem('customerQrName', scannedQrName);
        }
        
        setScannedQRData({ screen: scannedScreen, seat: scannedSeat, qrName: scannedQrName });
        setShowQRScanner(false);
        
        // Show success message
        alert(`✅ QR Code Scanned Successfully!\nScreen: ${scannedScreen || 'N/A'}\nSeat: ${scannedSeat || 'N/A'}`);
      } else {
        alert('❌ Invalid QR Code. No screen or seat information found.');
        setShowQRScanner(false);
      }
    } catch (error) {

      alert('❌ Invalid QR Code format.');
      setShowQRScanner(false);
    }
  };

  const stopCamera = () => {
    const video = document.getElementById('qr-video');
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      video.srcObject = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
  };

  const handleQRScanError = (error) => {
  };

  const handleCloseQRScanner = () => {
    stopCamera();
    setShowQRScanner(false);
  };

  const handleCategoryChange = (categoryId) => {

    // Store the category ID (not the name) for filtering, except for 'all'

    setSelectedCategory(categoryId === 'all' ? 'all' : categoryId);
    
    // Update URL to persist category selection on refresh
    const params = new URLSearchParams(location.search);
    if (categoryId === 'all') {
      params.delete('category'); // Remove category param for 'all'
    } else {
      params.set('category', categoryId);
    }
    // Replace URL without reloading the page
    window.history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
  };

  // Handle adding product to cart
  const handleAddToCart = (product) => {
    // Check if product is available
    if (product.isAvailable === false) {
      return; // Don't add to cart if not available
    }
    
    addItem({
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      taxRate: product.pricing?.taxRate || product.taxRate || 0,
      gstType: product.pricing?.gstType || product.gstType || 'EXCLUDE',
      discountPercentage: product.pricing?.discountPercentage || product.discountPercentage || 0,
      theaterId: theaterId // Add theater ID to cart item
    });
  };

  // Handle increasing quantity
  const handleIncreaseQuantity = (product) => {
    // Check if product is available
    if (product.isAvailable === false) {
      return; // Don't allow adding if not available
    }
    
    const currentQty = getItemQuantity(product._id);
    if (currentQty > 0) {
      updateQuantity(product._id, currentQty + 1);
    } else {
      handleAddToCart(product);
    }
  };

  // Handle decreasing quantity
  const handleDecreaseQuantity = (product) => {
    const currentQty = getItemQuantity(product._id);
    if (currentQty > 1) {
      updateQuantity(product._id, currentQty - 1);
    } else if (currentQty === 1) {
      removeItem({ _id: product._id });
    }
  };

  // Handle collection click
  const handleCollectionClick = (collection) => {
    if (collection.isCollection) {
      setSelectedCollection(collection);
      setIsCollectionModalOpen(true);
    }
  };

  // Handle profile dropdown toggle
  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  // Handle order history navigation
  const handleOrderHistory = () => {
    setShowProfileDropdown(false);
    

    // Navigate to order history page with theater info in URL params
    // The order history page will handle login if needed
    const params = new URLSearchParams();
    params.set('theaterid', theaterId);
    if (theater?.name) {
      params.set('theaterName', theater.name);
    }
    
    navigate(`/customer/order-history?${params.toString()}`);
  };

  // Handle logout
  const handleLogout = () => {
    setShowProfileDropdown(false);
    // Clear customer data
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('cart');
    localStorage.removeItem('yqpay_cart');
    localStorage.removeItem('checkoutData');
    
    // Redirect to customer landing page with theater ID preserved
    if (theaterId) {
      let landingUrl = `/menu/${theaterId}`;
      const params = new URLSearchParams();
      
      // Preserve screen and seat info if available
      if (screenName) params.set('screen', screenName);
      if (seat) params.set('seat', seat);
      if (qrName) params.set('qrName', qrName);
      
      if (params.toString()) {
        landingUrl += `?${params.toString()}`;
      }
      
      navigate(landingUrl);
    } else {
      // Fallback to generic customer page
      navigate('/customer');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  if (loading) {
    console.log('⏳ [CustomerHome] Still loading...');
    return <div className="customer-loading"><div className="spinner"></div></div>;
  }

  const totalItems = getTotalItems();
  const defaultEmojis = ['🍔', '🥤', '🥤', '🍿'];
  
  // Debug: Log header values and filtered collections
  console.log('🎯 [CustomerHome] Rendering with:', {
    theater: theater?.name,
    productsCount: products.length,
    collectionsCount: productCollections.length,
    filteredCollectionsCount: filteredCollections.length,
    selectedCategory,
    loading
  });

  return (
    <div className="customer-home">
      {/* Show offline notice if in offline mode */}
      {shouldShowOfflineUI && <OfflineNotice />}
      
      <header className="customer-header">
        {/* Theater Name - First Line */}
        <div className="theater-name-row">
          <h1 className="theater-name">{theater?.name || 'Theater Name'}</h1>
        </div>

        {/* Balance Icons - Second Line */}
        <div className="balance-row">
          <div className="balance-info">
            {screenName && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                </svg>
                <span className="balance-text">{screenName}</span>
              </div>
            )}
            {qrName && qrName !== screenName && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h5v-5zm0 7h2v-2h-2v2zm-2-2h-2v2h2v-2z"/>
                </svg>
                <span className="balance-text">QR: {qrName}</span>
              </div>
            )}
            {seat && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 18v3h3v-3h10v3h3v-6H4zm15-8h3v3h-3zM2 10h3v3H2zm15 3H7V5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v8z"/>
                </svg>
                <span className="balance-text">Seat {seat}</span>
              </div>
            )}
          </div>
          <div className="header-actions">
            <div className="profile-dropdown-container">
              <button 
                className="profile-btn" 
                aria-label="User profile"
                onClick={handleProfileClick}
              >
                <svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              
              {showProfileDropdown && (
                <div className="profile-dropdown modern-dropdown">
                  <button 
                    className="dropdown-card"
                    onClick={handleOrderHistory}
                  >
                    <div className="card-icon recent-contacts">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                      </svg>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Order History</h3>
                      <p className="card-subtitle">View your past orders</p>
                    </div>
                    <svg className="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                  
                  <button 
                    className="dropdown-card"
                    onClick={() => {/* Handle favorites */}}
                  >
                    <div className="card-icon favourites">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Favourites</h3>
                      <p className="card-subtitle">Your favorite items</p>
                    </div>
                    <svg className="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                  
                  <button 
                    className="dropdown-card"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      const params = new URLSearchParams();
                      params.set('theaterid', theaterId);
                      if (theater?.name) params.set('theaterName', theater.name);
                      navigate(`/customer/help-support?${params.toString()}`);
                    }}
                  >
                    <div className="card-icon schedules">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">Help & Support</h3>
                      <p className="card-subtitle">Get assistance</p>
                    </div>
                    <svg className="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                  
                  {/* Only show logout if user is logged in */}
                  {localStorage.getItem('customerPhone') && (
                    <button 
                      className="dropdown-card logout-card"
                      onClick={handleLogout}
                    >
                      <div className="card-icon logout-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                        </svg>
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">Logout</h3>
                        <p className="card-subtitle">Sign out from your account</p>
                      </div>
                      <svg className="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="search-container">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for products..." 
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search products"
          />
          <button className="qr-scan-btn" aria-label="Scan QR Code" onClick={handleQRScan}>
            <svg className="qr-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3v-3z"/>
            </svg>
          </button>
        </div>

        {/* Categories Section */}
        <div className="categories-section">
          <button
            className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
            aria-label="All categories"
          >
            <div className="category-content">
              <div className="category-icon-large">
                <InstantImage
                  src="https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=200&h=200&fit=crop&q=80"
                  alt="All Categories"
                  className="category-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="80"%3E🍿%3C/text%3E%3C/svg%3E';
                  }}
                />
              </div>
              <span className="category-name">All</span>
            </div>
          </button>
          {categories.map((category) => {
            // Use actual category image or provide default based on category name
            let categoryImgUrl = category.image && typeof category.image === 'string' 
              ? (category.image.startsWith('http') ? category.image : `${config.api.baseUrl}${category.image}`) 
              : null;
            
            // Fallback to high-quality default images based on category type/name
            if (!categoryImgUrl) {
              const categoryLower = (category.name || '').toLowerCase();
              if (categoryLower.includes('pop') || categoryLower.includes('corn')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('burger') || categoryLower.includes('sandwich')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('french') || categoryLower.includes('fries')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('ice') || categoryLower.includes('cream')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('pizza')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('drink') || categoryLower.includes('beverage') || categoryLower.includes('cola') || categoryLower.includes('soda')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('coffee')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('snack') || categoryLower.includes('chips')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('sweet') || categoryLower.includes('dessert') || categoryLower.includes('candy')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('hot') || categoryLower.includes('dog')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1612392062798-2ba2c6bb84e0?w=200&h=200&fit=crop&q=80';
              } else if (categoryLower.includes('nachos')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=200&h=200&fit=crop&q=80';
              } else {
                // Default food image
                categoryImgUrl = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=200&fit=crop&q=80';
              }
            }
            
            return (
              <button
                key={category._id}
                className={`category-chip ${selectedCategory === category._id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category._id)}
                aria-label={`Filter by ${category.name}`}
              >
                <div className="category-content">
                  <div className="category-icon-large">
                    <InstantImage
                      src={categoryImgUrl}
                      alt={category.name}
                      className="category-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        // Simple emoji fallback
                        const emoji = category.name.toLowerCase().includes('burger') ? '🍔' :
                                     category.name.toLowerCase().includes('fries') ? '🍟' :
                                     category.name.toLowerCase().includes('ice') ? '🍦' :
                                     category.name.toLowerCase().includes('pizza') ? '🍕' :
                                     category.name.toLowerCase().includes('pop') ? '🍿' :
                                     category.name.toLowerCase().includes('drink') ? '🥤' :
                                     category.name.toLowerCase().includes('coffee') ? '☕' : '🍽️';
                        e.target.src = `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23e5e7eb" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236b7280" font-size="80"%3E${emoji}%3C/text%3E%3C/svg%3E`;
                      }}
                    />
                  </div>
                  <span className="category-name">{category.name}</span>
                </div>
              </button>
            );
          })}
        </div>
      </header>
      <main className="customer-main">
       
        {/* Banner Carousel - Theater-specific scrolling banners */}
        {theaterId ? (
          <BannerCarousel 
            theaterId={theaterId}
            autoScrollInterval={4000}
          />
        ) : (
          <div style={{ 
            padding: '12px 16px', 
            margin: '16px', 
            background: '#fee2e2', 
            color: '#991b1b', 
            borderRadius: '8px',
            fontSize: '13px',
            textAlign: 'center',
            border: '1px solid #f87171'
          }}>
            ⚠️ Theater ID not found. Please scan a valid QR code.
          </div>
        )}

        {/* Filter Section - Only show when not in "All" category */}
        {selectedCategory !== 'all' && (
          <div className="filter-section">
            <div className="filter-chips-container">
              {/* Veg Toggle Switch */}
              <div className="veg-toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isVegOnly}
                    onChange={() => setIsVegOnly(!isVegOnly)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              {/* All Button - Clear all filters */}
              <button
                className={`filter-chip ${!isVegOnly && selectedPriceRange === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setIsVegOnly(false);
                  setSelectedPriceRange('all');
                }}
              >
                <span>All</span>
              </button>
              
              {/* Price Range Filters */}
              <button
                className={`filter-chip ${selectedPriceRange === 'under100' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === 'under100' ? 'all' : 'under100')}
              >
                <span>Under ₹100</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === '100-200' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === '100-200' ? 'all' : '100-200')}
              >
                <span>₹100-200</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === '200-300' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === '200-300' ? 'all' : '200-300')}
              >
                <span>₹200-300</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === 'above300' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === 'above300' ? 'all' : 'above300')}
              >
                <span>Above ₹300</span>
              </button>
              
              {/* Clear Filters - Show only when filters are active */}
              {(isVegOnly || selectedPriceRange !== 'all') && (
                <button
                  className="filter-chip clear-filter"
                  onClick={() => {
                    setIsVegOnly(false);
                    setSelectedPriceRange('all');
                  }}
                >
                  <span>✕ Clear</span>
                </button>
              )}
            </div>
          </div>
        )}
       
        {/* Products List - Collection Design */}
        <section className="products-section">
          <div className="products-list">
            {(() => {
              console.log('📋 [CustomerHome] Rendering products section:', {
                filteredCollectionsLength: filteredCollections.length,
                firstCollection: filteredCollections[0]
              });
              
              if (filteredCollections.length > 0) {
                return filteredCollections.map((collection, index) => {
                const defaultVariant = getDefaultVariant(collection);
                const imgUrl = defaultVariant?.image || collection.baseImage;
                const product = defaultVariant?.originalProduct || defaultVariant;
                const productQty = product ? getItemQuantity(product._id) : 0;
                
                // Check if ANY variant in the collection is available
                const hasAvailableVariant = collection.variants?.some(variant => 
                  variant.originalProduct?.isAvailable === true
                );
                const isProductAvailable = collection.isCollection 
                  ? hasAvailableVariant 
                  : (product?.isAvailable === true);
                
                // Debug logging
                if (!isProductAvailable) {
  }
                
                return (
                  <div 
                    key={collection.isCollection ? `collection-${collection.name}` : defaultVariant?._id} 
                    className={`product-card ${collection.isCollection ? 'collection-card' : 'single-product-card'} ${!isProductAvailable ? 'out-of-stock' : ''}`}
                    onClick={() => isProductAvailable && handleCollectionClick(collection)}
                    style={{ cursor: (collection.isCollection && isProductAvailable) ? 'pointer' : 'default' }}
                  >
                    {/* Image Container */}
                    <div className="product-image-container">
                      {imgUrl ? (
                        <InstantImage
                          src={imgUrl && typeof imgUrl === 'string' 
                            ? (imgUrl.startsWith('http') ? imgUrl : `${config.api.baseUrl}${imgUrl}`) 
                            : null
                          }
                          alt={collection.name}
                          className="product-img"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="40"%3E🍽️%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="product-placeholder">
                          <span>🍽️</span>
                        </div>
                      )}
                      {/* Discount Badge */}
                      {product?.discountPercentage > 0 && isProductAvailable && (
                        <div className="product-discount-badge">
                          {product.discountPercentage}% OFF
                        </div>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="product-details">
                      <h3 className="product-name">{collection.name}</h3>
                      {collection.isCollection ? (
                        <>
                          <p className="product-collection-info">
                            {collection.variants.length > 1 ? `${collection.variants.length} sizes available` : '1 size available'}
                          </p>
                          <p className="product-price-range">
                            {collection.variants.length > 1 ? `From ₹${parseFloat(collection.basePrice || 0).toFixed(2)}` : `₹${parseFloat(collection.basePrice || 0).toFixed(2)}`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="product-quantity">{defaultVariant?.sizeLabel || defaultVariant?.originalProduct?.quantity || 'Regular'}</p>
                          {product?.discountPercentage > 0 ? (
                            <div className="product-price-container">
                              <span className="product-discounted-price">
                                ₹{(parseFloat(defaultVariant?.price || 0) * (1 - product.discountPercentage / 100)).toFixed(2)}
                              </span>
                              <span className="product-original-price">
                                ₹{parseFloat(defaultVariant?.price || 0).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <p className="product-regular-price">
                              ₹{parseFloat(defaultVariant?.price || 0).toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions Section - Only for single products */}
                    {!collection.isCollection && product && (
                      <div className="product-item-actions" onClick={(e) => e.stopPropagation()}>
                        {isProductAvailable ? (
                          <>
                            <div className="product-actions">
                              <button 
                                className="quantity-btn minus"
                                onClick={() => handleDecreaseQuantity(product)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                              
                              <span className="quantity-display">{productQty}</span>
                              
                              <button 
                                className="quantity-btn plus"
                                onClick={() => handleIncreaseQuantity(product)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </button>
                            </div>
                            {/* Veg/Non-Veg Indicator */}
                            <div className="product-veg-indicator">
                              {product.isVeg === true ? (
                                <span className="veg-badge">
                                  <span className="veg-dot">●</span> Veg
                                </span>
                              ) : product.isVeg === false ? (
                                <span className="non-veg-badge">
                                  <span className="non-veg-dot">●</span> Non-Veg
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <div className="out-of-stock-section">
                            <svg className="out-of-stock-icon" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="rgba(220, 38, 38, 0.1)" stroke="#dc2626" strokeWidth="2"/>
                              <path d="M15 9L9 15M9 9l6 6" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                            <span className="out-of-stock-text">Out of Stock</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            } else {
              console.warn('⚠️ [CustomerHome] No filtered collections to display');
              return (
                <div className="empty-products">
                  <p>No products found {searchQuery ? `for "${searchQuery}"` : 'in this category'}</p>
                </div>
              );
            }
            })()}
          </div>
        </section>
      </main>

      {/* Floating Cart Icon */}
      {cart.items && cart.items.length > 0 && (
        <button 
          className="floating-cart-icon"
          onClick={() => {
            const params = new URLSearchParams({
              ...(theaterId && { theaterid: theaterId }),
              ...(theater?.name && { theatername: theater.name }),
              ...(qrName && { qrname: qrName }),
              ...(seat && { seat: seat }),
              ...(selectedCategory && selectedCategory !== 'all' && { category: selectedCategory })
            });
            navigate(`/customer/cart?${params.toString()}`);
          }}
          aria-label={`View Cart (${cart.items.length} items)`}
        >
          <span className="cart-icon">🛒</span>
          <span className="cart-count">{cart.items.length}</span>
        </button>
      )}

      {/* Product Collection Modal */}
      <ProductCollectionModal
        collection={selectedCollection}
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
      />

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="qr-scanner-modal">
          <div className="qr-scanner-overlay" onClick={handleCloseQRScanner}></div>
          <div className="qr-scanner-container">
            <div className="qr-scanner-header">
              <h2>Scan QR Code</h2>
              <button className="qr-close-btn" onClick={handleCloseQRScanner}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="qr-scanner-content">
              <div className="qr-scanner-instructions">
                <p>📱 Point your camera at a QR code</p>
                <p>The screen and seat info will be updated automatically</p>
              </div>
              <div className="qr-scanner-video-container">
                <video 
                  id="qr-video" 
                  className="qr-scanner-video"
                  autoPlay 
                  playsInline
                ></video>
                <div className="qr-scanner-frame"></div>
              </div>
              <button className="qr-cancel-btn" onClick={handleCloseQRScanner}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerHome;
