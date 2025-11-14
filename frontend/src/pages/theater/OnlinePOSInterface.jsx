import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import { getImageSrc, cacheProductImages } from '../../utils/globalImageCache'; // 🚀 Instant image loading
import { calculateOrderTotals } from '../../utils/orderCalculation'; // 📊 Centralized calculation
import {
  cacheProducts,
  getCachedProducts,
  cacheCategories,
  getCachedCategories,
  cacheProductImages as cacheProductImagesOffline,
  getCachedImage
} from '../../utils/offlineStorage'; // 📦 Offline-first caching
import ImageUpload from '../../components/ImageUpload';
import config from '../../config';
import '../../styles/TheaterList.css';
import '../../styles/Dashboard.css';
import '../../styles/ImageUpload.css';
import '../../styles/TheaterOrderInterface.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



// Modern POS Product Card Component - Click to Add (Same as Professional POS)
const StaffProductCard = React.memo(({ product, onAddToCart, currentOrder }) => {
  const formatPrice = (price) => {
    // Don't show any price in demo mode (when price is 0)
    if (price === 0) {
      return '';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  // Get current quantity in cart
  const getQuantityInCart = () => {
    const orderItem = currentOrder.find(item => item._id === product._id);
    return orderItem ? orderItem.quantity : 0;
  };

  const quantityInCart = getQuantityInCart();

  // Handle card click - add one item to cart
  const handleCardClick = () => {
    if (!isOutOfStock) {
      onAddToCart(product, quantityInCart + 1);
    }
  };

  // Check stock using array structure fields
  const currentStock = product.inventory?.currentStock ?? product.stockQuantity ?? 0;
  const isOutOfStock = currentStock <= 0 || !product.isActive || !product.isAvailable;

  // Get price from array structure and calculate discount
  const originalPrice = product.pricing?.basePrice ?? product.sellingPrice ?? 0;
  const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
  const productPrice = discountPercentage > 0 
    ? originalPrice * (1 - discountPercentage / 100)
    : originalPrice;
  const hasDiscount = discountPercentage > 0;

  // Get product image WITH INSTANT CACHE CHECK (offline-first)
  const getProductImage = () => {
    let imageUrl = null;
    
    // New format: images array (array structure)
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
    }
    // Old format: productImage string
    else if (product.productImage) {
      imageUrl = product.productImage;
    }
    
    // 🚀 INSTANT: Try offline cache first, then global cache
    if (imageUrl) {
      const cachedBase64 = getCachedImage(imageUrl);
      if (cachedBase64) {
        return cachedBase64; // Return base64 image from offline cache
      }
      // Fallback to global image cache
      return getImageSrc(imageUrl);
    }
    
    return null;
  };

  const imageUrl = getProductImage();

  return (
    <div className="modern-product-card-wrapper">
      <div 
        className={`modern-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
        onClick={handleCardClick}
      >
        {/* Product Image */}
        <div className="modern-product-image">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={product.name || 'Product'}
              loading="eager"
              decoding="async"
              style={{imageRendering: 'auto'}}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : (
            <div className="modern-product-placeholder">
              <span className="placeholder-icon">🍽️</span>
            </div>
          )}
          <div className="modern-product-placeholder" style={{ display: imageUrl ? 'none' : 'flex' }}>
            <span className="placeholder-icon">🍽️</span>
          </div>
        </div>

        {/* Product Info Overlay */}
        <div className="modern-product-overlay">
          <div className="modern-product-details">
            <div className="modern-product-detail-item">
              {/* <span className="detail-label">Price</span> */}
              {hasDiscount ? (
                <div className="price-with-discount">
                  <span className="detail-value original-price">{formatPrice(originalPrice)}</span>
                  <span className="detail-value discounted-price">{formatPrice(productPrice)}</span>
                </div>
              ) : (
                <span className="detail-value">{formatPrice(productPrice)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Discount Badge - Top Right */}
        {hasDiscount && !isOutOfStock && (
          <div className="modern-discount-badge">
            {discountPercentage}% OFF
          </div>
        )}

        {/* Out of Stock Overlay */}
        {isOutOfStock && (
          <div className="modern-out-of-stock-overlay">
            <span className="out-of-stock-text">OUT OF STOCK</span>
          </div>
        )}

        {/* Quantity Badge */}
        {quantityInCart > 0 && !isOutOfStock && (
          <div className="modern-quantity-badge">
            {quantityInCart}
          </div>
        )}
      </div>
      
      {/* Product Name - Outside Card */}
      <div className="modern-product-name-section">
        <h3 className="modern-product-name">
          {product.name || 'Unknown Product'}
          {(product.quantity || product.sizeLabel) && (
            <span className="modern-product-size"> {product.quantity || product.sizeLabel}</span>
          )}
        </h3>
      </div>
    </div>
  );
});

StaffProductCard.displayName = 'StaffProductCard';

// Staff Order Item Component - Professional order management
const StaffOrderItem = React.memo(({ item, onUpdateQuantity, onRemove }) => {
  const formatPrice = (price) => {
    // Don't show any price in offline mode (when price is 0 or product is mock)
    if (price === 0) {
      return '';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const itemTotal = (parseFloat(item.sellingPrice) || 0) * (parseInt(item.quantity) || 0);

  return (
    <div className="pos-order-item">
      <div className="pos-item-content">
        <div className="pos-item-name">{item.name || 'Unknown Item'}</div>
        <div className="pos-item-price">₹{(parseFloat(item.sellingPrice) || 0).toFixed(2)}</div>
        
        <div className="pos-quantity-controls">
          <button 
            className="pos-qty-btn pos-qty-minus"
            onClick={() => onUpdateQuantity(item._id, (item.quantity || 1) - 1)}
            disabled={(item.quantity || 0) <= 1}
          >
            −
          </button>
          <span className="pos-qty-display">{item.quantity || 0}</span>
          <button 
            className="pos-qty-btn pos-qty-plus"
            onClick={() => onUpdateQuantity(item._id, (item.quantity || 0) + 1)}
          >
            +
          </button>
        </div>
        
        <div className="pos-item-total">₹{(parseFloat(itemTotal) || 0).toFixed(2)}</div>
        <button 
          className="pos-remove-btn"
          onClick={() => onRemove(item._id)}
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
});

StaffOrderItem.displayName = 'StaffOrderItem';

// POS Interface - Modern Design with Customer Orders Management
const OnlinePOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Reliable theaterId extraction - Updated for POS URLs
  const urlMatch = window.location.pathname.match(/\/pos\/([^/]+)/);
  const theaterId = routeTheaterId || (urlMatch ? urlMatch[1] : null);
  
  // Debug theater ID extraction

  // IMMEDIATE CLEANUP - Remove any lingering UI elements from other pages
  useEffect(() => {
    const cleanup = () => {
      // Remove any stat containers that might be lingering
      const statsContainers = document.querySelectorAll('.qr-stats, .theater-stats, .product-stats, .stat-card');
      statsContainers.forEach(container => {
        if (container && container.parentNode) {
          container.style.display = 'none';
          container.remove();
        }
      });
      
      // Remove any floating/positioned elements
      const floatingElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: absolute"][style*="z-index"]');
      floatingElements.forEach(element => {
        if (element.className.includes('stat') || element.className.includes('count')) {
          element.style.display = 'none';
        }
      });
    };
    
    cleanup();
    // Run cleanup again after a short delay to catch any delayed renders
    setTimeout(cleanup, 100);
    
    return cleanup;
  }, []);
  

  
  // State for staff ordering interface
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Persistent cart state - Load from localStorage
  const [currentOrder, setCurrentOrder] = useState(() => {
    try {
      // Check both old and new localStorage keys for backward compatibility
      const savedCart = localStorage.getItem(`pos_cart_${theaterId}`) || localStorage.getItem(`online_pos_cart_${theaterId}`);
      if (savedCart) {
        const cartItems = JSON.parse(savedCart);

        return Array.isArray(cartItems) ? cartItems : [];
      }
    } catch (error) {
  }
    return [];
  });
  
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderImages, setOrderImages] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]); // Customer orders from QR code
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [newOrderIds, setNewOrderIds] = useState([]); // Track new orders for flashing
  const isMountedRef = useRef(true);
  const isInitialLoadRef = useRef(true); // Track if this is the first load
  const hasLoadedOrdersRef = useRef(false); // Track if we've ever loaded orders
  
  // Performance monitoring
  usePerformanceMonitoring('TheaterOrderInterface');

  // MOUNT EFFECT - Clear flash animation state on component mount
  useEffect(() => {

    setNewOrderIds([]); // Clear any flash animations
    isInitialLoadRef.current = true; // Reset initial load flag
    hasLoadedOrdersRef.current = false; // Reset loaded flag
    
    return () => {

      setNewOrderIds([]); // Clear on unmount too
      hasLoadedOrdersRef.current = false;
    };
  }, []); // Empty dependency - run only on mount/unmount

  // CLEANUP FUNCTION - Clear any persistent state/CSS issues
  useEffect(() => {
    // Clear any existing overlays or persistent elements
    const existingOverlays = document.querySelectorAll('.qr-stats, .theater-stats, .product-stats');
    existingOverlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    
    // Clear any sticky positioning issues
    document.body.style.position = '';
    document.body.style.overflow = '';
    
    // Reset any global CSS classes that might interfere
    document.body.classList.remove('modal-open', 'no-scroll');
    
    return () => {
      // Cleanup on unmount
      isMountedRef.current = false;
    };
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (theaterId && currentOrder.length >= 0) {
      try {
        localStorage.setItem(`pos_cart_${theaterId}`, JSON.stringify(currentOrder));
        // Remove old key for cleanup
        localStorage.removeItem(`online_pos_cart_${theaterId}`);
  } catch (error) {
  }
    }
  }, [currentOrder, theaterId]);

  // Restore cart data when coming back from ViewCart (Edit Order functionality)
  useEffect(() => {
    if (location.state) {
      
      // Handle order success (clear cart and show message)
      if (location.state.orderSuccess) {
        setCurrentOrder([]);
        setCustomerName('');
        setOrderNotes('');
        setOrderImages([]);
        
        if (location.state.orderNumber) {
  }
        
        // Trigger product refresh by updating a refresh flag
        setLoading(true);
        setTimeout(() => setLoading(false), 100);
      }
      // Handle cart restoration (Edit Order functionality)
      else if (location.state.cartItems) {
        setCurrentOrder(location.state.cartItems || []);
        setCustomerName(location.state.customerName || '');
      }
      
      // Clear the location state to prevent re-processing on re-renders
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);

  // Refs for performance and cleanup
  // Removed abortController as it was causing "signal aborted" errors

  // Staff order management functions
  const addToOrder = useCallback((product, quantity = 1) => {
    setCurrentOrder(prevOrder => {
      const existingItem = prevOrder.find(item => item._id === product._id);
      
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        return prevOrder.filter(item => item._id !== product._id);
      }
      
      if (existingItem) {
        // Update existing item with new quantity
        return prevOrder.map(item => 
          item._id === product._id 
            ? { ...item, quantity: quantity }
            : item
        );
      } else {
        // Add new item with specified quantity
        // Extract price from array structure (pricing.basePrice) or old structure (sellingPrice)
        const originalPrice = parseFloat(product.pricing?.basePrice ?? product.sellingPrice ?? 0) || 0;
        const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
        
        // Store ORIGINAL price in sellingPrice (discount will be calculated by utility)
        const sellingPrice = originalPrice;
        
        // Extract tax information
        const taxRate = parseFloat(product.pricing?.taxRate ?? product.taxRate) || 0;
        
        // Check pricing object first for gstType
        const gstTypeRaw = product.pricing?.gstType || product.gstType || 'EXCLUDE';
        const gstType = gstTypeRaw.toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
        
        return [...prevOrder, { 
          ...product, 
          quantity: quantity,
          sellingPrice: parseFloat(sellingPrice) || 0,
          originalPrice: parseFloat(originalPrice) || 0,
          discountPercentage: discountPercentage,
          taxRate: taxRate, // Ensure tax rate is available
          gstType: gstType, // Ensure GST type is available
          pricing: product.pricing // Keep pricing object for GST Type detection
        }];
      }
    });
  }, []);

  const updateQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromOrder(productId);
      return;
    }
    setCurrentOrder(prevOrder => 
      prevOrder.map(item => 
        item._id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }, []);

  const removeFromOrder = useCallback((productId) => {
    setCurrentOrder(prevOrder => 
      prevOrder.filter(item => item._id !== productId)
    );
  }, []);

  const clearOrder = useCallback(() => {
    setCurrentOrder([]);
    setCustomerName('');
    setOrderNotes('');
    setOrderImages([]);
    
    // Also clear from localStorage
    if (theaterId) {
      try {
        localStorage.removeItem(`pos_cart_${theaterId}`);
        localStorage.removeItem(`online_pos_cart_${theaterId}`); // Remove old key
  } catch (error) {
  }
    }
  }, [theaterId]);

  // Image handling functions
  const handleImageUpload = useCallback((imageData) => {
    setOrderImages(prev => [...prev, imageData]);
  }, []);

  const handleImageRemove = useCallback((index, imageData) => {
    setOrderImages(prev => prev.filter((_, i) => i !== index));
    
    // Clean up blob URL if it exists
    if (imageData.previewUrl && imageData.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageData.previewUrl);
    }
  }, []);

  // Load categories (offline-first)
  const loadCategories = useCallback(async () => {
    try {
      // Try cached first
      const cachedCats = getCachedCategories(theaterId);
      if (cachedCats) {
        console.log('📦 [POS] Using cached categories');
        const activeCategories = cachedCats.filter(cat => cat.isActive);
        const categoryNames = activeCategories.map(cat => cat.categoryName || cat.name);
        const mapping = activeCategories.reduce((map, cat) => {
          const catName = cat.categoryName || cat.name;
          map[catName] = cat._id;
          return map;
        }, {});
        setCategories(categoryNames);
        setCategoryMapping(mapping);
      } else {
        // Fallback categories if no cache
        setCategories(['SNACKS', 'BEVERAGES', 'COMBO DEALS', 'DESSERTS']);
      }

      // Try network if online
      if (navigator.onLine) {
        let token = getAuthToken();
        if (!token) {
          token = await autoLogin();
          if (!token) return;
        }

        const categoriesResponse = await fetch(`${config.api.baseUrl}/theater-categories/${theaterId}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json();
          
          if (categoriesData.success && categoriesData.data) {
            const categoryList = categoriesData.data.categories || categoriesData.data;
            
            // Cache for offline use
            cacheCategories(theaterId, categoryList);
            
            const activeCategories = categoryList.filter(cat => cat.isActive);
            const categoryNames = activeCategories.map(cat => cat.categoryName || cat.name);
            const mapping = activeCategories.reduce((map, cat) => {
              const catName = cat.categoryName || cat.name;
              map[catName] = cat._id;
              return map;
            }, {});
            
            setCategories(categoryNames);
            setCategoryMapping(mapping);
          }
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Set fallback categories on error only if we don't have any categories
      setCategories(prev => {
        if (prev.length === 0) {
          return ['SNACKS', 'BEVERAGES', 'COMBO DEALS', 'DESSERTS'];
        }
        return prev;
      });
    }
  }, [theaterId]);

  // Fetch products (offline-first)
  const fetchProducts = useCallback(async () => {
    if (!theaterId) {
      setError('Theater ID not available');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Try cached first
      const cachedProds = getCachedProducts(theaterId);
      console.log('🔍 [POS] Cached products check:', {
        hasCache: !!cachedProds,
        count: cachedProds?.length || 0
      });
      
      if (cachedProds && cachedProds.length > 0) {
        console.log('📦 [POS] Using cached products:', cachedProds.length, 'products');
        setProducts(cachedProds);
        setLoading(false);
      }

      // Try network if online
      if (navigator.onLine) {
        console.log('🌐 [POS] Online - fetching fresh products');
        let token = getAuthToken();
        if (!token) {
          token = await autoLogin();
          if (!token) {
            if (!cachedProds) {
              throw new Error('Authentication failed - unable to login');
            }
            console.log('⚠️ [POS] Auth failed but using cache');
            return;
          }
        }
        
        const params = new URLSearchParams({
          page: 1,
          limit: 100,
          _cacheBuster: Date.now(),
          _random: Math.random()
        });

        const baseUrl = `${config.api.baseUrl}/theater-products/${theaterId}?${params.toString()}`;
        
        const response = await fetch(baseUrl, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.success) {
          let productList = [];
          
          if (data.data && Array.isArray(data.data.products)) {
            productList = data.data.products;
          } else if (Array.isArray(data.data)) {
            productList = data.data;
          } else if (Array.isArray(data.products)) {
            productList = data.products;
          }
          
          // Cache for offline use
          cacheProducts(theaterId, productList);
          
          // Cache product images in background (non-blocking) - use offline storage
          cacheProductImagesOffline(productList).catch(err => {
            console.warn('⚠️ [POS] Some images failed to cache:', err);
          });
          
          // Also cache using global image cache for compatibility
          cacheProductImages(productList).catch(err => {
            console.warn('⚠️ [POS] Some images failed to cache in global cache:', err);
          });
          
          if (productList.length > 0) {
            setProducts(productList);
          } else {
            setError('No products available');
          }
        } else {
          throw new Error(data.message || 'Failed to load products');
        }
      } else {
        // Offline - use only cached data
        console.log('📴 [POS] Offline mode - using cache only');
        if (!cachedProds || cachedProds.length === 0) {
          setError('No cached products available. Please connect to internet to load products first.');
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError(error.message || 'Failed to load products');
      setLoading(false);
    }
  }, [theaterId]);

  // Load initial data - Load categories and products (offline-first)
  useEffect(() => {
    if (theaterId) {
      // Load categories and products in parallel (both use offline-first caching)
      loadCategories();
      fetchProducts();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [theaterId, fetchProducts, loadCategories]);

  // Audio context for beep sound
  const [audioContext, setAudioContext] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Initialize audio context on user interaction
  const initializeAudio = useCallback(() => {
    if (!audioContext) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        setAudioContext(ctx);
        setAudioEnabled(true);

        return ctx;
      } catch (error) {

        return null;
      }
    }
    return audioContext;
  }, [audioContext]);

  // Function to play beep sound
  const playBeepSound = useCallback(async () => {
    try {
      let ctx = audioContext;
      
      // Initialize audio context if not already done
      if (!ctx) {
        ctx = initializeAudio();
        if (!ctx) return;
      }

      // Resume audio context if suspended (required by browser policy)
      if (ctx.state === 'suspended') {
        await ctx.resume();
  }

      // Create and play beep sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(800, ctx.currentTime); // 800Hz beep
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
      
  } catch (error) {

      // Fallback: Try HTML5 Audio with data URL
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBjiR1+zGeiwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmQlBg==');
        audio.volume = 0.3;
        audio.play();
  } catch (fallbackError) {  

        // Visual notification as final fallback
        document.title = '🔔 NEW ORDER! - ' + (document.title.replace('🔔 NEW ORDER! - ', ''));
        setTimeout(() => {
          document.title = document.title.replace('🔔 NEW ORDER! - ', '');
        }, 3000);
      }
    }
  }, [audioContext, initializeAudio]);

  // Fetch online/customer orders from theaterorders collection
  const fetchOnlineOrders = useCallback(async () => {
    if (!theaterId) return;

    try {
      setLoadingOrders(true);
      const response = await fetch(`${config.api.baseUrl}/orders/theater/${theaterId}?source=qr_code&limit=20&_cacheBuster=${Date.now()}&_random=${Math.random()}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.orders) {

          // Filter to show ONLY online orders (customer orders with qrName or seat)
          // Exclude kiosk orders (which don't have qrName or seat)
          const onlineOnlyOrders = data.orders.filter(order => 
            (order.qrName && order.qrName.trim() !== '') || 
            (order.seat && order.seat.trim() !== '')
          );

          // Debug: Log filtered order count
          console.log(`📱 [POS] Filtered ${onlineOnlyOrders.length} online orders from ${data.orders.length} total orders`);
          
          // Check for new orders
          setOnlineOrders(prevOrders => {

            // Skip notifications if this is the first time loading orders
            // This covers: page refresh, initial navigation, and component mount
            if (!hasLoadedOrdersRef.current) {

              hasLoadedOrdersRef.current = true;
              isInitialLoadRef.current = false;
              return onlineOnlyOrders;
            }
            
            // For subsequent loads, check for genuinely new orders
            const prevOrderIds = prevOrders.map(order => order._id);
            const newOrders = onlineOnlyOrders.filter(order => !prevOrderIds.includes(order._id));
            

            if (newOrders.length > 0) {

              // Play beep sound for new orders
              playBeepSound();
              
              // Mark new orders for flashing
              const newIds = newOrders.map(order => order._id);

              setNewOrderIds(newIds);
              
              // Remove flashing after 5 seconds
              setTimeout(() => {

                setNewOrderIds([]);
              }, 5000);
            }
            
            return onlineOnlyOrders;
          });
        }
      }
    } catch (error) {
  } finally {
      setLoadingOrders(false);
    }
  }, [theaterId, playBeepSound]);

  // Track previous theaterId to detect actual theater changes vs initial mount
  const prevTheaterIdRef = useRef(null);

  // Poll for new online orders every 10 seconds
  useEffect(() => {
    if (!theaterId) return;

    // Only reset flags if theater actually changed (not on first mount)
    if (prevTheaterIdRef.current !== null && prevTheaterIdRef.current !== theaterId) {

      isInitialLoadRef.current = true;
      hasLoadedOrdersRef.current = false;
    }
    
    prevTheaterIdRef.current = theaterId;

    fetchOnlineOrders(); // Initial fetch

    const interval = setInterval(() => {
      fetchOnlineOrders();
    }, 1000); // Poll every 1 second (real-time updates)

    return () => {
      clearInterval(interval);
    };
  }, [theaterId, fetchOnlineOrders]);

  // Calculate order totals using centralized utility
  const orderTotals = useMemo(() => {
    return calculateOrderTotals(currentOrder);
  }, [currentOrder]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    // Filter by category
    if (selectedCategory && selectedCategory !== 'all') {
      const categoryId = categoryMapping[selectedCategory];
      
      filtered = filtered.filter(product => {
        // Products use categoryId field (ObjectId) - need to match with category _id
        const productCategoryId = product.categoryId || product.category || '';
        
        // Convert to string for comparison
        const categoryIdStr = String(productCategoryId);
        const selectedCategoryIdStr = String(categoryId);
        
        // Match by category ID
        const match = categoryIdStr === selectedCategoryIdStr;
        

        return match;
      });
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        (product.name || '').toLowerCase().includes(searchLower) ||
        (product.description || '').toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm, categories, categoryMapping]);

  // Navigate to view-cart page with order data
  const processOrder = useCallback(() => {
    if (!currentOrder.length) {
      alert('Please add items to order');
      return;
    }

    // ✅ FIX: Optimize cart data to reduce size - only include essential fields
    const optimizedItems = currentOrder.map(item => ({
      _id: item._id,
      name: item.name,
      quantity: item.quantity,
      sellingPrice: item.sellingPrice || item.pricing?.basePrice || item.pricing?.salePrice || 0,
      discountPercentage: item.discountPercentage || item.pricing?.discountPercentage || 0,
      taxRate: item.taxRate || item.pricing?.taxRate || 5,
      gstType: item.gstType || item.pricing?.gstType || 'EXCLUDE',
      // Don't include full product object, images, or other large fields
    }));

    // Prepare optimized cart data (without images to reduce size)
    const cartData = {
      items: optimizedItems,
      customerName: customerName.trim() || 'POS Customer',
      notes: orderNotes.trim(),
      // ✅ FIX: Don't include images in cart data - they're too large
      // Images can be re-uploaded on ViewCart page if needed
      images: [], // Remove images to prevent storage quota issues
      subtotal: orderTotals.subtotal,
      tax: orderTotals.tax,
      total: orderTotals.total,
      totalDiscount: orderTotals.totalDiscount,
      theaterId,
      source: 'pos'
    };
    
    try {
      // ✅ FIX: Use React Router navigate with state (preferred - doesn't use sessionStorage)
      // This avoids sessionStorage quota issues
      navigate(`/view-cart/${theaterId}?source=pos`, {
        state: cartData
      });
      console.log('✅ Navigating to cart with state data (optimized, no images)');
    } catch (error) {
      console.error('❌ Navigation error:', error);
      // Fallback: try sessionStorage (without images already)
      try {
        // Clear old cart data first to free up space
        sessionStorage.removeItem('cartData');
        sessionStorage.setItem('cartData', JSON.stringify(cartData));
        console.log('⚠️ Using sessionStorage fallback (optimized, no images)');
        window.location.href = `/view-cart/${theaterId}?source=pos`;
      } catch (storageError) {
        console.error('❌ SessionStorage failed:', storageError);
        // Last resort: navigate without state, ViewCart will show empty cart
        alert('Unable to save cart data. Please try again or reduce order size.');
        window.location.href = `/view-cart/${theaterId}?source=pos`;
      }
    }
  }, [currentOrder, customerName, orderNotes, orderImages, orderTotals, theaterId, navigate]);

  // Loading and error states - REMOVED loading screen to show UI immediately
  
  // Skip loading screen - show clean UI immediately
  // if (loading) { ... }

  // Only show error if we have an error AND no products loaded
  if (error && products.length === 0) {
    const handleManualTokenSet = () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDkzNTdiYWE4YmMyYjYxMDFlMjk3YyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInRoZWF0ZXJJZCI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInBlcm1pc3Npb25zIjpbXSwiaWF0IjoxNzU5MTE4MzM0LCJleHAiOjE3NTkyMDQ3MzR9.gvOS5xxIlcOlgSx6D_xDH3Z_alrqdp5uMtMLOVWIEJs";
      localStorage.setItem('authToken', token);
      window.location.reload();
    };

    return (
      <TheaterLayout pageTitle="POS System">
        <ErrorBoundary>
          <div className="staff-error-container">
            <div className="error-icon">❌</div>
            <h3>Unable to Load Menu</h3>
            <p>{error}</p>
            <div style={{ marginTop: '20px' }}>
              <button 
                className="retry-button"
                onClick={() => window.location.reload()}
                style={{ marginRight: '10px' }}
              >
                Retry
              </button>
              <button 
                className="retry-button"
                onClick={handleManualTokenSet}
                style={{ backgroundColor: '#8B5CF6' }}
              >
                Set Demo Token
              </button>
            </div>
          </div>
        </ErrorBoundary>
      </TheaterLayout>
    );
  }

  return (
    <TheaterLayout pageTitle="Online POS System">
      <div className="professional-pos-content" style={{
        position: 'relative',
        zIndex: 1,
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        overflow: 'hidden'
      }}>
        {/* CSS Reset and Isolation */}
        <style jsx>{`
          .professional-pos-content * {
            box-sizing: border-box;
          }
          .professional-pos-content .qr-stats,
          .professional-pos-content .theater-stats,
          .professional-pos-content .product-stats {
            display: none !important;
          }
          .professional-pos-content {
            isolation: isolate;
          }
          .discount-line .discount-amount {
            color: #10B981;
            font-weight: 600;
          }
          .discount-line {
            color: #10B981;
          }
        `}</style>
        
        {/* Main POS Layout */}
        <div className="pos-main-container">
          {/* Left Order Panel - Order Queue */}
          <div className="pos-order-section">
            <div className="pos-order-header" style={{backgroundColor: '#6B0E9B', background: '#6B0E9B', color: 'white'}}>
              <div>
                <h2 className="pos-order-title" style={{color: 'white', margin: 0}}>
                  Online Orders ({onlineOrders.length})
                </h2>
                
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!audioEnabled && (
                  <button 
                    onClick={initializeAudio}
                    style={{
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                    title="Click to enable new order beep sounds"
                  >
                    🔊 Enable Sound
                  </button>
                )}
              </div>
            </div>

            <div className="pos-order-content" style={{ padding: '16px', maxHeight: '600px', overflowY: 'auto' }}>
              {onlineOrders.length === 0 ? (
                <div className="pos-empty-order">
                  <div className="empty-order-icon">📱</div>
                  <h3>No Online Orders</h3>
                  <p>Customer orders from QR codes will appear here.</p>
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                    (Kiosk orders are excluded)
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {onlineOrders.map((order, index) => {
                    const shouldFlash = newOrderIds.includes(order._id);
                    if (index === 0) {
                      console.log('📱 Order data:', {
                        orderNumber: order.orderNumber,
                        customerInfo: order.customerInfo,
                        phoneNumber: order.customerInfo?.phoneNumber,
                        phone: order.customerInfo?.phone,
                        name: order.customerInfo?.name
                      });
                    }
                    
                    return (
                      <div 
                        key={order._id || index} 
                        className={shouldFlash ? 'new-order-flash' : ''}
                        style={{
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: '#fafafa',
                          fontSize: '13px'
                        }}>
                        {/* 1. Order Number with Total Amount in Same Line */}
                        <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #6B0E9B'
                      }}>
                        <span style={{
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#1f2937'
                        }}>
                           {order.orderNumber || `Order #${index + 1}`}
                        </span>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#6B0E9B'
                        }}>
                          ₹{order.pricing?.total?.toFixed(2) || order.total?.toFixed(2) || '0.00'}
                        </span>
                      </div>

                      {/* 2. Screen & Seat (Same Line) */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}>
                        <span style={{ color: '#4b5563', fontWeight: '600' }}>Screen & Seat:</span>
                        <span style={{ color: '#1f2937', fontWeight: 'bold' }}>
                           {order.qrName || order.screenName || order.tableNumber || 'N/A'} |  {order.seat || order.seatNumber || order.customerInfo?.seat || 'N/A'}
                        </span>
                      </div>

                      {/* 3. Phone Number */}
                      {(order.customerInfo?.phoneNumber || order.customerInfo?.phone || order.customerInfo?.name) && (
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <span style={{ color: '#4b5563', fontWeight: '600' }}>Phone:</span>
                          <span style={{ color: '#1f2937', fontWeight: 'bold' }}>
                            {order.customerInfo.phoneNumber || order.customerInfo.phone || order.customerInfo.name || 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Center - Product Menu */}
          <div className="pos-menu-section">
            {/* Category Tabs - POS Style */}
            <div className="pos-category-tabs" style={{backgroundColor: '#6B0E9B', background: '#6B0E9B'}}>
              <button 
                className={`pos-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
                style={selectedCategory === 'all' ? {backgroundColor: 'white', color: '#6B0E9B'} : {color: 'white'}}
              >
                ALL ITEMS ({products.length})
              </button>
              {categories.length > 0 ? (
                categories.map((category, index) => (
                  <button
                    key={category || `category-${index}`}
                    className={`pos-tab ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                    style={selectedCategory === category ? {backgroundColor: 'white', color: '#6B0E9B'} : {color: 'white'}}
                  >
                    {(category || 'CATEGORY').toUpperCase()}
                  </button>
                ))
              ) : (
                <button className="pos-tab" disabled style={{color: 'white'}}>
                  Loading Categories...
                </button>
              )}
            </div>

            {/* Products Grid - Professional POS Style */}
            <div className="pos-products-grid">
              {filteredProducts.length === 0 ? (
                <div className="pos-no-products">
                  <div className="no-products-icon">🍽️</div>
                  <h3>No Items Available</h3>
                  <p>No items found in this category.</p>
                </div>
              ) : (
                filteredProducts.map((product, index) => (
                  <StaffProductCard
                    key={product._id || `product-${index}`}
                    product={product}
                    onAddToCart={addToOrder}
                    currentOrder={currentOrder}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right Side - Order Panel - POS Style */}
          <div className="pos-order-section">
            <div className="pos-order-header" style={{backgroundColor: '#6B0E9B', background: '#6B0E9B', color: 'white'}}>
              <h2 className="pos-order-title" style={{color: 'white', margin: 0}}>
                Current Order ({currentOrder.length})
              </h2>
              {currentOrder.length > 0 && (
                <button 
                  className="pos-clear-btn"
                  onClick={clearOrder}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="pos-order-content">
              {currentOrder.length === 0 ? (
                <div className="pos-empty-order">
                  <div className="empty-order-icon">🛒</div>
                  <h3>No Items</h3>
                  <p>Select items from the menu to add to order.</p>
                </div>
              ) : (
                <>
                  {/* Order Items - POS Style */}
                  <div className="pos-order-items">
                    {currentOrder.map((item, index) => (
                      <StaffOrderItem
                        key={item._id || `order-item-${index}`}
                        item={item}
                        onUpdateQuantity={updateQuantity}
                        onRemove={removeFromOrder}
                      />
                    ))}
                  </div>

                  {/* Order Notes - POS Style */}
                  <div className="pos-order-notes">
                    <textarea
                      placeholder="Add order notes..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="pos-notes-textarea"
                      rows="3"
                    />
                  </div>



                  {/* Order Summary - POS Style */}
                  <div className="pos-order-summary">
                    <div className="pos-summary-line">
                      <span>Subtotal:</span>
                      <span>₹{orderTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="pos-summary-line">
                      <span>Tax (GST):</span>
                      <span>₹{orderTotals.tax.toFixed(2)}</span>
                    </div>
                    {orderTotals.totalDiscount > 0 && (
                      <div className="pos-summary-line discount-line">
                        <span>Discount:</span>
                        <span className="discount-amount">-₹{orderTotals.totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="pos-summary-total">
                      <span>TOTAL:</span>
                      <span>₹{orderTotals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Buttons - POS Style */}
                  <div className="pos-actions">
                    <button 
                      className="pos-process-btn"
                      onClick={processOrder}
                      disabled={currentOrder.length === 0}
                      style={{
                        backgroundColor: currentOrder.length === 0 ? '#9ca3af' : '#6B0E9B',
                        background: currentOrder.length === 0 ? '#9ca3af' : '#6B0E9B',
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      PROCESS ORDER
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </TheaterLayout>
  );
};

export default OnlinePOSInterface;
