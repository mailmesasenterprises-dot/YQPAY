/**
 * Offline POS Interface
 * Identical to TheaterOrderInterface but with offline capabilities
 * - Works without internet connection
 * - Caches products/categories locally
 * - Queues orders offline
 * - Auto-syncs every 5 seconds when connection restored
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import OfflineStatusBadge from '../../components/OfflineStatusBadge';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import { calculateOrderTotals } from '../../utils/orderCalculation'; // 📊 Centralized calculation
import {
  cacheProducts,
  getCachedProducts,
  cacheCategories,
  getCachedCategories,
  cacheProductImages,
  getCachedImage
} from '../../utils/offlineStorage';
import ImageUpload from '../../components/ImageUpload';
import config from '../../config/index';
import '../../styles/TheaterList.css';
import '../../styles/Dashboard.css';
import '../../styles/ImageUpload.css';
import '../../styles/TheaterOrderInterface.css';

// Modern POS Product Card Component - Click to Add
const StaffProductCard = React.memo(({ product, onAddToCart, currentOrder }) => {
  const formatPrice = (price) => {
    if (price === 0) {
      return '';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const getQuantityInCart = () => {
    const orderItem = currentOrder.find(item => item._id === product._id);
    return orderItem ? orderItem.quantity : 0;
  };

  const quantityInCart = getQuantityInCart();

  const handleCardClick = () => {
    if (!isOutOfStock) {
      onAddToCart(product, quantityInCart + 1);
    }
  };

  const currentStock = product.inventory?.currentStock ?? product.stockQuantity ?? 0;
  const isOutOfStock = currentStock <= 0 || !product.isActive || !product.isAvailable;

  const originalPrice = product.pricing?.basePrice ?? product.sellingPrice ?? 0;
  const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
  const productPrice = discountPercentage > 0 
    ? originalPrice * (1 - discountPercentage / 100)
    : originalPrice;
  const hasDiscount = discountPercentage > 0;

  const getProductImage = () => {
    let imageUrl = null;
    
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      const firstImage = product.images[0];
      imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
    }
    else if (product.productImage) {
      imageUrl = product.productImage;
    }
    
    // Try to get cached base64 version for offline use
    if (imageUrl) {
      const cachedBase64 = getCachedImage(imageUrl);
      if (cachedBase64) {
        console.log(`🖼️ Using cached image for: ${product.name}`);
        return cachedBase64; // Return base64 image
      } else {
        console.log(`📡 No cache for: ${product.name}, URL: ${imageUrl.substring(0, 50)}...`);
      }
    }
    
    return imageUrl; // Return original URL
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
    // Don't show any price in demo mode (when price is 0)
    if (price === 0) {
      return '';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const sellingPrice = parseFloat(item.sellingPrice) || 0;
  const quantity = parseInt(item.quantity) || 0;
  const itemTotal = sellingPrice * quantity;

  return (
    <div className="pos-order-item">
      <div className="pos-item-content">
        <div className="pos-item-name">{item.name || 'Unknown Item'}</div>
        <div className="pos-item-price">₹{sellingPrice.toFixed(2)}</div>
        
        <div className="pos-quantity-controls">
          <button 
            className="pos-qty-btn pos-qty-minus"
            onClick={() => onUpdateQuantity(item._id, Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            −
          </button>
          <span className="pos-qty-display">{quantity}</span>
          <button 
            className="pos-qty-btn pos-qty-plus"
            onClick={() => onUpdateQuantity(item._id, quantity + 1)}
          >
            +
          </button>
        </div>
        
        <div className="pos-item-total">₹{itemTotal.toFixed(2)}</div>
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

// Main Offline POS Interface
const OfflinePOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const urlMatch = window.location.pathname.match(/\/offline-pos\/([^/]+)/);
  const theaterId = routeTheaterId || (urlMatch ? urlMatch[1] : null);
  
  // Get auth token for offline queue
  const [authToken, setAuthToken] = useState(null);
  
  useEffect(() => {
    const getToken = async () => {
      let token = getAuthToken();
      if (!token) {
        token = await autoLogin();
      }
      setAuthToken(token);
    };
    getToken();
  }, []);
  
  // Initialize offline queue hook
  const {
    pendingCount,
    lastSyncTime,
    isSyncing,
    syncError,
    syncProgress,
    connectionStatus,
    addOrder: queueOrder,
    manualSync,
    retryFailed
  } = useOfflineQueue(theaterId, authToken);

  // UI cleanup
  useEffect(() => {
    const cleanup = () => {
      const statsContainers = document.querySelectorAll('.qr-stats, .theater-stats, .product-stats, .stat-card');
      statsContainers.forEach(container => {
        if (container && container.parentNode) {
          container.style.display = 'none';
          container.remove();
        }
      });
      
      const floatingElements = document.querySelectorAll('[style*="position: fixed"], [style*="position: absolute"][style*="z-index"]');
      floatingElements.forEach(element => {
        if (element.className.includes('stat') || element.className.includes('count')) {
          element.style.display = 'none';
        }
      });
    };
    
    cleanup();
    setTimeout(cleanup, 100);
    
    return cleanup;
  }, []);

  // State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [currentOrder, setCurrentOrder] = useState(() => {
    try {
      const savedCart = localStorage.getItem(`offline_pos_cart_${theaterId}`);
      if (savedCart) {
        const cartItems = JSON.parse(savedCart);
        return Array.isArray(cartItems) ? cartItems : [];
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
    return [];
  });
  
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderImages, setOrderImages] = useState([]);
  const isMountedRef = useRef(true);
  
  usePerformanceMonitoring('OfflinePOSInterface');

  // Cleanup
  useEffect(() => {
    const existingOverlays = document.querySelectorAll('.qr-stats, .theater-stats, .product-stats');
    existingOverlays.forEach(overlay => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    });
    
    document.body.style.position = '';
    document.body.style.overflow = '';
    document.body.classList.remove('modal-open', 'no-scroll');
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Save cart to localStorage
  useEffect(() => {
    if (theaterId && currentOrder.length >= 0) {
      try {
        localStorage.setItem(`offline_pos_cart_${theaterId}`, JSON.stringify(currentOrder));
      } catch (error) {
        console.error('Error saving cart:', error);
      }
    }
  }, [currentOrder, theaterId]);

  // Restore cart from navigation state
  useEffect(() => {
    if (location.state) {
      if (location.state.orderSuccess) {
        setCurrentOrder([]);
        setCustomerName('');
        setOrderNotes('');
        setOrderImages([]);
        setLoading(true);
        setTimeout(() => setLoading(false), 100);
      }
      else if (location.state.cartItems) {
        setCurrentOrder(location.state.cartItems || []);
        setCustomerName(location.state.customerName || '');
      }
      
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);

  // Order management functions
  const addToOrder = useCallback((product, quantity = 1) => {
    setCurrentOrder(prevOrder => {
      const existingItem = prevOrder.find(item => item._id === product._id);
      
      if (quantity <= 0) {
        return prevOrder.filter(item => item._id !== product._id);
      }
      
      if (existingItem) {
        return prevOrder.map(item => 
          item._id === product._id 
            ? { ...item, quantity: quantity }
            : item
        );
      } else {
        const originalPrice = product.pricing?.basePrice ?? product.sellingPrice ?? 0;
        const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
        
        // Store ORIGINAL price in sellingPrice (discount will be calculated by utility)
        const sellingPrice = originalPrice;
        
        const taxRate = parseFloat(product.pricing?.taxRate ?? product.taxRate) || 0;
        
        // Check pricing object first for gstType
        const gstTypeRaw = product.pricing?.gstType || product.gstType || 'EXCLUDE';
        const gstType = gstTypeRaw.toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
        
        return [...prevOrder, { 
          ...product, 
          quantity: quantity,
          sellingPrice: sellingPrice,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          taxRate: taxRate,
          gstType: gstType,
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
    
    if (theaterId) {
      try {
        localStorage.removeItem(`offline_pos_cart_${theaterId}`);
      } catch (error) {
        console.error('Error clearing cart:', error);
      }
    }
  }, [theaterId]);

  // Image handling
  const handleImageUpload = useCallback((imageData) => {
    setOrderImages(prev => [...prev, imageData]);
  }, []);

  const handleImageRemove = useCallback((index, imageData) => {
    setOrderImages(prev => prev.filter((_, i) => i !== index));
    
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
        console.log('📦 Using cached categories');
        const activeCategories = cachedCats.filter(cat => cat.isActive);
        const categoryNames = activeCategories.map(cat => cat.categoryName || cat.name);
        const mapping = activeCategories.reduce((map, cat) => {
          const catName = cat.categoryName || cat.name;
          map[catName] = cat._id;
          return map;
        }, {});
        setCategories(categoryNames);
        setCategoryMapping(mapping);
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
      console.log('🔍 Cached products check:', {
        hasCache: !!cachedProds,
        count: cachedProds?.length || 0,
        firstProduct: cachedProds?.[0]
      });
      
      if (cachedProds && cachedProds.length > 0) {
        console.log('📦 Using cached products:', cachedProds.length, 'products');
        setProducts(cachedProds);
        setLoading(false);
      }

      // Try network if online
      if (navigator.onLine) {
        console.log('🌐 Online - fetching fresh products');
        let token = getAuthToken();
        if (!token) {
          token = await autoLogin();
          if (!token) {
            if (!cachedProds) {
              throw new Error('Authentication failed - unable to login');
            }
            console.log('⚠️ Auth failed but using cache');
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
          
          // Cache product images in background (non-blocking)
          cacheProductImages(productList).catch(err => {
            console.warn('⚠️ Some images failed to cache:', err);
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
        console.log('📴 Offline mode - using cache only');
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

  // Initial load
  useEffect(() => {
    if (theaterId) {
      fetchProducts();
      loadCategories();
    }
  }, [theaterId, fetchProducts, loadCategories]);

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    if (selectedCategory !== 'all') {
      const categoryId = categoryMapping[selectedCategory];
      filtered = filtered.filter(product => {
        const prodCatId = product.category?._id || product.category;
        return prodCatId === categoryId;
      });
    }
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [products, selectedCategory, categoryMapping, searchTerm]);

  // Calculate order totals using centralized utility
  const orderTotals = useMemo(() => {
    return calculateOrderTotals(currentOrder);
  }, [currentOrder]);

  // Process order (offline-capable)
  const handleProcessOrder = useCallback(() => {
    if (currentOrder.length === 0) return;

    // Prepare cart data with current order
    const cartData = {
      items: currentOrder,
      customerName: customerName.trim() || 'POS', // Default customer name
      notes: orderNotes.trim(),
      images: orderImages,
      subtotal: orderTotals.subtotal,
      tax: orderTotals.tax,
      total: orderTotals.total,
      totalDiscount: orderTotals.totalDiscount,
      theaterId
    };
    
    // Store in sessionStorage for ViewCart page
    sessionStorage.setItem('cartData', JSON.stringify(cartData));
    
    // Navigate to view cart
    window.location.href = `/view-cart/${theaterId}`;
  }, [currentOrder, theaterId, customerName, orderNotes, orderImages, orderTotals]);

  // Render loading state
  if (loading && products.length === 0) {
    return (
      <TheaterLayout>
        <div className="pos-container">
          <div className="pos-loading">
            <div className="spinner"></div>
            <p>Loading POS...</p>
          </div>
        </div>
      </TheaterLayout>
    );
  }

  // Render error state
  if (error && products.length === 0) {
    return (
      <TheaterLayout>
        <div className="pos-container">
          <div className="pos-error">
            <h2>Error</h2>
            <p>{error}</p>
            <button onClick={() => {
              setError('');
              fetchProducts();
            }}>
              Retry
            </button>
          </div>
        </div>
      </TheaterLayout>
    );
  }

  return (
    <TheaterLayout pageTitle="Offline POS System">
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
          .offline-pos-header {
            background: linear-gradient(135deg, #6B0E9B 0%, #8B2FB8 100%);
            padding: 16px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
          }
          .offline-pos-title {
            color: white;
            font-size: 24px;
            font-weight: 700;
            margin: 0;
          }
          .offline-status-inline {
            display: flex;
            gap: 20px;
            align-items: center;
          }
          .status-item {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
          }
          .status-label {
            color: rgba(255,255,255,0.8);
            font-size: 11px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .status-value {
            color: white;
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
          }
          .status-badge.online {
            background: rgba(16, 185, 129, 0.2);
            color: #10B981;
            border: 2px solid #10B981;
          }
          .status-badge.offline {
            background: rgba(239, 68, 68, 0.2);
            color: #EF4444;
            border: 2px solid #EF4444;
          }
          .status-icon {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
          }
          .status-icon.online {
            background: #10B981;
          }
          .status-icon.offline {
            background: #EF4444;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
        
        {/* Inline Header with Status */}
        <div className="offline-pos-header">
          <h1 className="offline-pos-title">Offline POS System</h1>
          <div className="offline-status-inline">
            <div className="status-item">
              <span className="status-label">Connection</span>
              <div className={`status-badge ${connectionStatus}`}>
                <span className={`status-icon ${connectionStatus}`}></span>
                {connectionStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>
            <div className="status-item">
              <span className="status-label">Pending Orders</span>
              <div className="status-value">
                🔄 {pendingCount}
              </div>
            </div>
            <div className="status-item">
              <span className="status-label">Last Sync</span>
              <div className="status-value">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main POS Layout */}
        <div className="pos-main-container">
          {/* Left Side - Product Menu */}
          <div className="pos-menu-section">{/* Category Tabs - POS Style */}
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
              ) : null}
            </div>

            {/* Products Grid */}
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
                      onClick={handleProcessOrder}
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

export default OfflinePOSInterface;
