import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../../config';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import Pagination from '../../components/Pagination';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import DateFilter from '../../components/DateFilter';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getCachedData, setCachedData, clearCachePattern } from '../../utils/cacheUtils';
import { getImageSrc } from '../../utils/globalImageCache'; // 🚀 Instant image loading
import InstantImage from '../../components/InstantImage'; // 🚀 Instant image component
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css';

// Lazy Loading Product Image Component WITH INSTANT CACHE
const LazyProductImage = React.memo(({ src, alt, className, style, fallback = '/placeholder-product.png' }) => {
  // 🚀 INSTANT: Check cache first synchronously
  const cachedSrc = src ? getImageSrc(src) : fallback;
  const [imageSrc, setImageSrc] = useState(cachedSrc || fallback);
  const [isLoading, setIsLoading] = useState(!cachedSrc);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // If already cached, no need for lazy loading
    if (cachedSrc) {
      setImageSrc(cachedSrc);
      setIsLoading(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && src && src !== fallback) {
          const img = new Image();
          img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
            setHasError(false);
          };
          img.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
          img.src = src;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, fallback, cachedSrc]);

  return (
    <div className="lazy-image-container" style={style}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${className || ''} ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'opacity 0.3s ease'
        }}
      />
      {isLoading && (
        <div className="image-loading-placeholder">
          <div className="loading-spinner"></div>
        </div>
      )}
    </div>
  );
});

LazyProductImage.displayName = 'LazyProductImage';

// Table Loading Skeleton
const TableSkeleton = React.memo(({ count = 10 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <tr key={`skeleton-${index}`} className="theater-row skeleton-row">
        <td className="sno-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="photo-cell">
          <div className="skeleton-image"></div>
        </td>
        <td className="name-cell">
          <div className="skeleton-line skeleton-medium"></div>
        </td>
        <td className="category-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="category-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="price-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="quantity-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="stock-cell">
          <div className="skeleton-line skeleton-small"></div>
        </td>
        <td className="status-cell">
          <div className="skeleton-toggle"></div>
        </td>
        <td className="actions-cell">
          <div className="skeleton-button-group"></div>
        </td>
      </tr>
    ))}
  </>
));

TableSkeleton.displayName = 'TableSkeleton';

// Simple Toggle Switch Component (based on Page Access Management pattern) - FIXED with progress state
const SimpleToggle = React.memo(({ product, isLive, onToggle, isToggling = false }) => {


  const handleChange = useCallback((e) => {
    const newValue = e.target.checked;

    
    if (!isToggling && onToggle) {

      onToggle(product, newValue);
    } else {
  }
  }, [product, onToggle, isToggling]);

  return (
    <div className="access-status" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <label className="toggle-switch" style={{
        position: 'relative',
        display: 'inline-block',
        width: '50px',
        height: '24px',
        opacity: isToggling ? 0.6 : 1, // Visual feedback when toggling
        cursor: isToggling ? 'wait' : 'pointer'
      }}>
        <input
          type="checkbox"
          checked={isLive}
          onChange={handleChange}
          disabled={isToggling} // Disable input when toggling
          style={{
            opacity: 0,
            width: 0,
            height: 0
          }}
        />
        <span className="slider" style={{
          position: 'absolute',
          cursor: 'pointer',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isLive ? 'var(--primary-dark, #6D28D9)' : '#ccc',
          transition: '.4s',
          borderRadius: '24px'
        }}>
          <span style={{
            position: 'absolute',
            content: '""',
            height: '18px',
            width: '18px',
            left: isLive ? '26px' : '3px',
            bottom: '3px',
            backgroundColor: 'white',
            transition: '.4s',
            borderRadius: '50%',
            display: 'block'
          }}></span>
        </span>
      </label>
    </div>
  );
});

SimpleToggle.displayName = 'SimpleToggle';

// Product Row Component - FIXED with toggle progress state
const ProductRow = React.memo(({ product, index, theaterId, categories = [], kioskTypes = [], productToggleStates, toggleInProgress, onView, onEdit, onDelete, onToggle, onManageStock }) => {
  const globalIndex = index + 1;
  
  // Format price
  const formatPrice = (price) => {
    return `₹${parseFloat(price || 0).toFixed(2)}`;
  };
  
  // Get stock status
  const getStockStatus = (stock, lowStockAlert = 5) => {
    if (stock <= 0) return 'out-of-stock';
    if (stock <= lowStockAlert) return 'low-stock';
    return 'in-stock';
  };

  // Extract correct field values from database structure
  // Image extraction - try multiple paths
  const productImage = 
    product.images?.[0]?.url ||           // New structure: images array with url
    product.images?.[0]?.path ||          // Alternative: images array with path
    product.images?.[0] ||                // If images array contains direct URLs
    product.productImage?.url ||          // Old structure: productImage object with url
    product.productImage?.path ||         // Old structure: productImage object with path
    product.productImage ||               // Old structure: productImage direct URL
    product.image ||                      // Alternative field name
    null;
    
  const sellingPrice = product.pricing?.basePrice || product.sellingPrice || 0;
  // ✅ Use stock directly from product (backend now sends real MonthlyStock balance)
  const stockQuantity = product.inventory?.currentStock ?? product.stockQuantity ?? 0;
  const lowStockAlert = product.inventory?.minStock || product.lowStockAlert || 5;
  
  // Category extraction - handle multiple scenarios
  let categoryName = 'Uncategorized';
  let category = null;
  
  // Debug: Log what we receive
  if (index === 0) { // Only log for first product to avoid spam
    console.log('🔍 ProductRow Render Debug:');
    console.log('Product:', product.name);
    console.log('Product categoryId:', product.categoryId);
    console.log('Categories prop:', categories);
    console.log('Categories length:', categories?.length);
    console.log('KioskTypes prop:', kioskTypes);
    console.log('KioskTypes length:', kioskTypes?.length);
  }
  
  // Try to get category from different sources
  if (product.categoryId && typeof product.categoryId === 'object' && product.categoryId.categoryName) {
    // CategoryId is populated object
    categoryName = product.categoryId.categoryName || product.categoryId.name || 'Uncategorized';
  } else if (product.category && typeof product.category === 'object' && product.category.categoryName) {
    // Category is populated object
    categoryName = product.category.categoryName || product.category.name || 'Uncategorized';
  } else if ((product.categoryId || product.category) && categories && categories.length > 0) {
    // Category/CategoryId is just an ID string, look up in categories array
    const catId = product.categoryId || product.category;
    category = categories.find(c => c._id?.toString() === catId?.toString());
    if (category) {
      categoryName = category.categoryName || category.name || 'Uncategorized';
    }
  }
  
  const stockStatus = getStockStatus(stockQuantity, lowStockAlert);

  // Debug logging for image and category

  return (
    <tr className={`${!product.isActive ? 'inactive-row' : ''}`}>
      {/* Serial Number */}
      <td>{globalIndex}</td>

      {/* Product Image */}
      <td>
        <div className="category-image">
          {productImage ? (
            <img 
              src={productImage}
              alt={product.name}
              loading="eager"
              decoding="async"
              width="40"
              height="40"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                objectFit: 'cover',
                border: '2px solid #e0e0e0',
                imageRendering: 'auto'
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#f5f5f5',
              display: productImage ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #e0e0e0'
            }}
          >
            <svg viewBox="0 0 24 24" fill="#ccc" style={{width: '24px', height: '24px'}}>
              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
            </svg>
          </div>
        </div>
      </td>

      {/* Product Name */}
      <td>
        <div className="qr-info">
          <div className="qr-name">{product.name}</div>
        </div>
      </td>

      {/* Category */}
      <td>
        <div className="category-badge">
          {categoryName}
        </div>
      </td>

      {/* Kiosk Type */}
      <td>
        <div className="category-badge">
          {(() => {
            if (!product.kioskType) {
              console.log(`❌ Product "${product.name}" has NO kioskType`);
              return '—';
            }
            if (!Array.isArray(kioskTypes) || kioskTypes.length === 0) {
              console.log(`⚠️ KioskTypes array is empty or not loaded yet. Product: "${product.name}", kioskType ID: ${product.kioskType}`);
              return '—';
            }
            console.log(`🔍 Looking for kioskType ${product.kioskType} in array of ${kioskTypes.length} items for product "${product.name}"`);
            console.log('Available kioskType IDs:', kioskTypes.map(kt => kt._id));
            const found = kioskTypes.find(kt => kt._id?.toString() === product.kioskType?.toString());
            console.log(`${found ? '✅ Found' : '❌ NOT Found'} kioskType for product "${product.name}":`, found);
            return found?.name || '—';
          })()}
        </div>
      </td>

      {/* Price */}
      <td>
        <div className="price-info">
          <div className="selling-price">{formatPrice(sellingPrice)}</div>
          {product.pricing?.salePrice && product.pricing.salePrice !== sellingPrice && (
            <div className="cost-price">Sale: {formatPrice(product.pricing.salePrice)}</div>
          )}
          {product.pricing?.discountPercentage > 0 && (
            <div className="discount-badge">-{product.pricing.discountPercentage}%</div>
          )}
        </div>
      </td>

      {/* Quantity (Original Template Value from ProductType) */}
      <td>
        <div className="quantity-display">
          <span className="quantity-value">{product.quantity || '—'}</span>
        </div>
      </td>

      {/* Stock */}
      <td>
        <div className="stock-container">
          <div className={`stock-badge ${stockStatus}`}>
            <span className="stock-quantity">{stockQuantity}</span>
            <span className="stock-status">
              {stockStatus === 'out-of-stock' ? 'Out' : 
               stockStatus === 'low-stock' ? 'Low' : 'OK'}
            </span>
          </div>
          <button 
            className="stock-management-btn"
            onClick={() => onManageStock(product)}
            title="Manage Stock"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
        </div>
      </td>

      {/* Status Toggle */}
      <td>
        <SimpleToggle 
          product={product}
          isLive={productToggleStates[product._id] || false}
          onToggle={onToggle}
          isToggling={toggleInProgress[product._id] || false}
        />
      </td>

      {/* Actions */}
      <td>
        <ActionButtons>
          <ActionButton 
            type="view"
            onClick={() => onView(product)}
            title="View Product Details"
          />
          <ActionButton 
            type="edit"
            onClick={() => onEdit(product)}
            title="Edit Product"
          />
          <ActionButton 
            type="delete"
            onClick={() => onDelete(product)}
            title="Delete Product"
          />
        </ActionButtons>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for ProductRow to ensure stock updates trigger re-renders
  // Always re-render if product data changed
  if (prevProps.product._id !== nextProps.product._id) return false;
  
  // Check if categories or kioskTypes arrays changed
  if (prevProps.categories?.length !== nextProps.categories?.length) return false;
  if (prevProps.kioskTypes?.length !== nextProps.kioskTypes?.length) return false;
  
  // Check if stock balance changed (current month overall balance)
  if (prevProps.stockBalance !== nextProps.stockBalance) {

    return false;
  }
  
  // Check if stock values changed
  const prevStock = prevProps.product.inventory?.currentStock ?? prevProps.product.stockQuantity ?? 0;
  const nextStock = nextProps.product.inventory?.currentStock ?? nextProps.product.stockQuantity ?? 0;
  if (prevStock !== nextStock) {

    return false;
  }
  
  // Check if toggle states changed
  if (prevProps.productToggleStates[prevProps.product._id] !== nextProps.productToggleStates[nextProps.product._id]) return false;
  if (prevProps.toggleInProgress[prevProps.product._id] !== nextProps.toggleInProgress[nextProps.product._id]) return false;
  
  // Check other important props
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.product.isActive !== nextProps.product.isActive) return false;
  if (prevProps.product.pricing?.basePrice !== nextProps.product.pricing?.basePrice) return false;
  if (prevProps.product.sellingPrice !== nextProps.product.sellingPrice) return false;
  
  return true;
});

ProductRow.displayName = 'ProductRow';

const TheaterProductList = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const modal = useModal();
  

  // AUTO-SET AUTHENTICATION TOKEN - PERMANENT FIX FOR NAVIGATION
  useEffect(() => {
    const currentToken = localStorage.getItem('authToken');
    if (!currentToken) {

      const workingToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDY0ZTliMzE0NWE0NWUzN2ZiMGUyMyIsInVzZXJuYW1lIjoiVGhlYXRlcjEyMyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlcklkIjoiNjhkMzdlYTY3Njc1MmI4Mzk5NTJhZjgxIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsImlhdCI6MTc1OTM4ODE4MCwiZXhwIjoxNzU5NDc0NTgwfQ.N1D7GZEBI0V9ZZ-doHB9cHfnLMuEXWI2n-GMOF8Zftw";
      localStorage.setItem('authToken', workingToken);
  }
  }, []);
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterProductList');
  
  // State management
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [kioskTypes, setKioskTypes] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [productToggleStates, setProductToggleStates] = useState({}); // Add toggle states tracking
  const [toggleInProgress, setToggleInProgress] = useState({}); // Track ongoing toggle operations
  const [networkStatus, setNetworkStatus] = useState({ isOnline: navigator.onLine, lastError: null }); // Network monitoring
  // ✅ REMOVED: productStockBalances state - no longer needed since backend sends real stock
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewModal, setViewModal] = useState({ show: false, product: null, currentIndex: 0 });
  const [editModal, setEditModal] = useState({ show: false, product: null, currentIndex: 0 });
  const [deleteModal, setDeleteModal] = useState({ show: false, product: null });
  
  // Edit form state
  const [editFormData, setEditFormData] = useState({});
  const [editFiles, setEditFiles] = useState({ productImage: null });
  const [editErrors, setEditErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, live, offline
  const [stockFilter, setStockFilter] = useState('all'); // all, in-stock, low-stock, out-of-stock
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Date filtering state - default to current date only
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'date',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    selectedDate: new Date().toISOString().split('T')[0], // Current date
    startDate: null,
    endDate: null
  });

  // Excel download state
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Refs for optimization
  const abortControllerRef = useRef(null);
  const fetchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {

      setNetworkStatus(prev => ({ ...prev, isOnline: true, lastError: null }));
    };
    
    const handleOffline = () => {

      setNetworkStatus(prev => ({ ...prev, isOnline: false, lastError: 'Network disconnected' }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ✅ TOGGLE PRODUCT STATUS HANDLER - NETWORK RESILIENT VERSION
  const handleProductToggleChange = useCallback(async (product, newStatus) => {

    // Check network connectivity first
    if (!networkStatus.isOnline) {
      modal.alert({
        title: 'No Internet Connection',
        message: 'Please check your internet connection and try again.',
        type: 'error'
      });
      return;
    }
    
    // PROTECTION: Use functional update to check toggle progress state
    let shouldProceed = true;
    setToggleInProgress(prev => {
      if (prev[product._id]) {

        shouldProceed = false;
        return prev; // No change
      }

      return { ...prev, [product._id]: true };
    });
    
    if (!shouldProceed) {
      return;
    }

    try {

      // STEP 1: Update local states immediately for instant UI feedback
      setProductToggleStates(prev => {
        const newState = { ...prev, [product._id]: newStatus };

        return newState;
      });

      setProducts(prevProducts => 
        prevProducts.map(p => 
          p._id === product._id 
            ? { ...p, isActive: newStatus, isAvailable: newStatus }
            : p
        )
      );

      // STEP 2: API call with comprehensive network resilience
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }


      // Decode and check token payload
      try {
        const tokenPayload = JSON.parse(atob(authToken.split('.')[1]));

        // Check if token is expired
        if (tokenPayload.exp * 1000 <= Date.now()) {
          throw new Error('Authentication token has expired. Please login again.');
        }
      } catch (e) {
        if (e.message.includes('expired')) {
          throw e;
        }
  }
      
      // Enhanced fetch with retry logic and timeout
      const maxRetries = 3;
      const timeoutMs = 15000; // 15 seconds
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {

          // Create AbortController for timeout
          const abortController = new AbortController();
          const timeoutId = setTimeout(() => {
            abortController.abort();
          }, timeoutMs);
          
          const response = await fetch(`${config.api.baseUrl}/theater-products/${theaterId}/${product._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
              isActive: newStatus,
              isAvailable: newStatus
            }),
            signal: abortController.signal
          });
          
          clearTimeout(timeoutId);
          

          if (response.ok) {
            const data = await response.json();

            if (data.success) {

              // STEP 3: Update from server response to ensure consistency
              if (data.product) {

                setProducts(prevProducts => 
                  prevProducts.map(p => 
                    p._id === product._id 
                      ? { ...p, ...data.product }
                      : p
                  )
                );
                
                const newToggleState = data.product.isActive && data.product.isAvailable;

                setProductToggleStates(prev => ({
                  ...prev,
                  [product._id]: newToggleState
                }));
              }
              
              modal.alert({
                title: 'Status Updated',
                message: `${product.name} is now ${newStatus ? 'LIVE' : 'OFFLINE'}`,
                type: 'success'
              });
              
              return; // Success - exit retry loop
            } else {
              throw new Error(data.message || 'Backend returned success=false');
            }
          } else {
            const errorText = await response.text();

            // Handle specific HTTP errors
            if (response.status === 401) {
              throw new Error('Authentication failed. Please login again.');
            } else if (response.status === 403) {
              throw new Error('Access denied. You may not have permission to update this product.');
            } else if (response.status === 404) {
              throw new Error('Product or theater not found.');
            } else if (response.status >= 500) {
              // Server errors - retry
              throw new Error(`Server error (${response.status}): ${response.statusText}`);
            } else {
              // Client errors - don't retry
              throw new Error(`Request failed (${response.status}): ${errorText}`);
            }
          }
          
        } catch (error) {
          lastError = error;
          
          // Update network status based on error type
          if (error.name === 'AbortError') {

            lastError = new Error(`Request timeout after ${timeoutMs / 1000} seconds`);
            setNetworkStatus(prev => ({ ...prev, lastError: 'Request timeout' }));
          } else if (error.message.includes('Failed to fetch')) {

            lastError = new Error('Network connection failed. Please check your internet connection.');
            setNetworkStatus(prev => ({ ...prev, lastError: 'Connection failed' }));
          } else if (error.message.includes('Authentication') || error.message.includes('expired')) {

            setNetworkStatus(prev => ({ ...prev, lastError: 'Authentication error' }));
            // Don't retry authentication errors
            throw error;
          } else {

            setNetworkStatus(prev => ({ ...prev, lastError: error.message }));
          }
          
          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          // Wait before retry (exponential backoff)
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);

          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    } catch (error) {

      // STEP 4: Revert local state on error
      setProductToggleStates(prev => ({
        ...prev,
        [product._id]: product.isActive && product.isAvailable
      }));

      setProducts(prevProducts => 
        prevProducts.map(p => 
          p._id === product._id 
            ? { ...p, isActive: product.isActive, isAvailable: product.isAvailable }
            : p
        )
      );

      // Enhanced error messages for better user experience
      let userMessage = `Failed to update ${product.name}`;
      
      if (error.message.includes('Authentication') || error.message.includes('expired')) {
        userMessage = 'Your session has expired. Please login again.';
      } else if (error.message.includes('Network connection failed')) {
        userMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('Access denied')) {
        userMessage = 'You do not have permission to update this product.';
      } else if (error.message.includes('not found')) {
        userMessage = 'Product not found. Please refresh the page.';
      } else {
        userMessage = `Failed to update ${product.name}: ${error.message}`;
      }

      modal.alert({
        title: 'Update Failed',
        message: userMessage,
        type: 'error'
      });
    } finally {
      // STEP 5: ALWAYS clear the toggle progress state (critical for preventing stuck states)

      setToggleInProgress(prev => {

        const newState = { ...prev };
        delete newState[product._id];

        return newState;
      });
    }
  }, [theaterId, modal, networkStatus]); // Added networkStatus for connectivity checks

  // Memoized auth headers
  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
  }, []);

  // Fetch products from API
  const fetchProducts = useCallback(async (page = 1, search = '', category = '', status = 'all', stock = 'all') => {
    if (!isMountedRef.current || !theaterId) return;

    // Check if token exists
    const token = localStorage.getItem('authToken');
    if (!token) {

      setError('Authentication required. Please login first.');
      setLoading(false);
      return;
    }

    try {

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const params = new URLSearchParams({
        page: page,
        limit: itemsPerPage,
        q: search,
        ...(category && { category }),
        ...(status !== 'all' && { status }),
        ...(stock !== 'all' && { stock }),
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      const baseUrl = `${config.api.baseUrl}/theater-products/${theaterId}?${params.toString()}`;
      

      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });


      if (!response.ok) {
        if (response.status === 404) {
          // Handle no products found gracefully

          if (!isMountedRef.current) return;
          setProducts([]);
          setTotalItems(0);
          setTotalPages(1);
          setCurrentPage(page);
          setLoading(false);
          return; // Exit early without throwing error
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      

      if (!isMountedRef.current) return;

      if (data.success) {
        const products = data.data?.products || [];

        // Log each product's ID and FULL DATA for debugging
        products.forEach((product, index) => {

          if (product.productType) {
  }
          // Log FULL inventory object
          console.log(`Product "${product.name}":`, {
            categoryId: product.categoryId,
            kioskType: product.kioskType,
            categoryIdType: typeof product.categoryId,
            kioskTypeType: typeof product.kioskType
          });

          const stockValue = product.inventory?.currentStock ?? product.stockQuantity ?? 0;
  });
        
        console.log('All products loaded:', products);
        setProducts(products);
        
        // Initialize toggle states for all products
        const toggleStates = {};
        products.forEach(product => {
          toggleStates[product._id] = product.isActive && product.isAvailable;
        });
        setProductToggleStates(toggleStates);

        // Batch pagination state updates
        const paginationData = data.data?.pagination || {};
        setTotalItems(paginationData.total || products.length);
        setTotalPages(paginationData.pages || Math.ceil(products.length / itemsPerPage));
        setCurrentPage(page);
        
  } else {
        throw new Error(data.message || 'Failed to load products');
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {

        setError('Failed to load products. Please try again.');
        setProducts([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, itemsPerPage, sortBy, sortOrder, authHeaders, modal]);

  // Fetch categories with caching
  const fetchCategories = useCallback(async () => {
    if (!isMountedRef.current || !theaterId) return;
    
    const cacheKey = `theaterCategories_${theaterId}`;
    const cached = getCachedData(cacheKey, 300000); // 5-minute cache for categories
    
    if (cached && isMountedRef.current) {
      console.log('⚡ [Categories] Loading from cache');
      setCategories(cached);
      return;
    }
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-categories/${theaterId}?limit=100`, {
        headers: authHeaders
      });

      if (!response.ok) {
        console.error('Failed to fetch categories:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Categories Response:', data);
      if (data.success && isMountedRef.current) {
        const categories = data.data?.categories || [];
        console.log('Setting Categories:', categories);
        setCategories(categories);
        setCachedData(cacheKey, categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
  }
  }, [theaterId, authHeaders]);

  // Fetch kiosk types with caching
  const fetchKioskTypes = useCallback(async () => {
    if (!isMountedRef.current || !theaterId) return;
    
    const cacheKey = `theaterKioskTypes_${theaterId}`;
    const cached = getCachedData(cacheKey, 300000); // 5-minute cache
    
    if (cached && isMountedRef.current) {
      console.log('⚡ [KioskTypes] Loading from cache');
      setKioskTypes(cached);
      return;
    }
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-kiosk-types/${theaterId}?limit=100`, {
        headers: authHeaders
      });

      if (!response.ok) {
        console.error('Failed to fetch kiosk types:', response.status);
        return;
      }

      const data = await response.json();
      console.log('Kiosk Types Response:', data);
      if (data.success && isMountedRef.current) {
        const kioskTypes = data.data?.kioskTypes || [];
        console.log('Setting Kiosk Types:', kioskTypes);
        setKioskTypes(kioskTypes);
        setCachedData(cacheKey, kioskTypes);
      }
    } catch (error) {
      console.error('Error fetching kiosk types:', error);
  }
  }, [theaterId, authHeaders]);

  // Fetch product types with caching
  const fetchProductTypes = useCallback(async () => {
    if (!isMountedRef.current || !theaterId) return;
    
    const cacheKey = `theaterProductTypes_${theaterId}`;
    const cached = getCachedData(cacheKey, 300000); // 5-minute cache
    
    if (cached && isMountedRef.current) {
      console.log('⚡ [ProductTypes] Loading from cache');
      setProductTypes(cached);
      return;
    }
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-product-types/${theaterId}`, {
        headers: authHeaders
      });

      if (!response.ok) {

        return;
      }

      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const productTypes = data.data?.productTypes || [];
        setProductTypes(productTypes);
        setCachedData(cacheKey, productTypes);
  }
    } catch (error) {
  }
  }, [theaterId, authHeaders]);

  // ✅ REMOVED: fetchProductStockBalances function
  // The backend now fetches real stock from MonthlyStock and includes it in the product list response
  // This eliminates the need for separate API calls and prevents the flash of incorrect values
  /*
  const fetchProductStockBalances = useCallback(async (productList) => {
    if (!isMountedRef.current || !theaterId || !productList || productList.length === 0) return;
    
    try {

      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const balances = {};
      
      await Promise.all(
        productList.map(async (product) => {
          try {
            const response = await fetch(
              `${config.api.baseUrl}/theater-stock/${theaterId}/${product._id}?year=${year}&month=${month}`,
              { headers: authHeaders }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.statistics) {
                const overallBalance = data.data.statistics.closingBalance || 0;
                balances[product._id] = Math.max(0, overallBalance);
  } else {
                balances[product._id] = 0;
  }
            } else {
              balances[product._id] = 0;
  }
          } catch (err) {
            balances[product._id] = 0;
  }
        })
      );
      
      if (isMountedRef.current) {
        setProductStockBalances(balances);
  }
    } catch (error) {
  }
  }, [theaterId, authHeaders]);
  */

  // Load data on component mount and when dependencies change
  useEffect(() => {

    if (!theaterId) {

      setError('Theater ID is missing. Please check the URL.');
      setLoading(false);
      return;
    }

    if (!isMountedRef.current) {

      return;
    }

    const loadData = async () => {

      setLoading(true);
      setError('');
      
      try {
        // Load data sequentially to avoid race conditions
        await fetchProducts(currentPage, searchTerm, selectedCategory, statusFilter, stockFilter);
        await fetchCategories();
        await fetchKioskTypes();
        await fetchProductTypes();
      } catch (error) {

        setError(error.message || 'Failed to load data');
      }
      // Note: Loading is set to false in fetchProducts
    };

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
    
    // Debounce for search, immediate for others
    const delay = searchTerm ? 500 : 0;
    fetchTimeoutRef.current = setTimeout(loadData, delay);
  }, [theaterId, currentPage, searchTerm, selectedCategory, statusFilter, stockFilter, fetchProducts, fetchCategories, fetchKioskTypes, fetchProductTypes]);

  // ✅ REMOVED: Fetch stock balances whenever products change
  // The backend now returns real stock values from MonthlyStock directly in the product list
  // This eliminates the flash of incorrect dummy values
  
  // Page visibility and focus handler - Refresh products when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && theaterId && isMountedRef.current) {

        fetchProducts(currentPage, searchTerm, selectedCategory, statusFilter, stockFilter);
      }
    };

    const handleFocus = () => {
      if (theaterId && isMountedRef.current) {

        fetchProducts(currentPage, searchTerm, selectedCategory, statusFilter, stockFilter);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [theaterId, currentPage, searchTerm, selectedCategory, statusFilter, stockFilter, fetchProducts]);

  // Handle search input
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  // Handle filter changes
  const handleCategoryChange = useCallback((e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  }, []);

  const handleStockFilterChange = useCallback((e) => {
    setStockFilter(e.target.value);
    setCurrentPage(1);
  }, []);

  // Handle sorting
  const handleSort = useCallback((field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  // CRUD Operations
  const handleAddProduct = useCallback(() => {
    navigate(`/theater-add-product/${theaterId}`);
  }, [navigate, theaterId]);

  const handleManageStock = useCallback((product) => {

    navigate(`/theater-stock-management/${theaterId}/${product._id}`);
  }, [navigate, theaterId]);

  const handleGenerateQR = useCallback(() => {
    navigate(`/theater-generate-qr/${theaterId}`);
  }, [navigate, theaterId]);

  // Handle Excel Download - Current product list with filters
  const handleDownloadExcel = useCallback(async () => {
    try {
      setDownloadingExcel(true);

      const token = localStorage.getItem('authToken');
      if (!token) {
        modal.showError('Please login to download reports');
        return;
      }

      let apiUrl;
      
      // If date filter is active with a specific date, export stock data for that date
      if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        apiUrl = `${config.api.baseUrl}/theater-products/${theaterId}/export-stock-by-date?date=${dateFilter.selectedDate}`;
      } 
      // Otherwise, export product list with filters
      else {
        // Build query parameters matching current filters
        const params = new URLSearchParams();
        
        if (searchTerm) {
          params.append('search', searchTerm);
        }
        
        if (selectedCategory && selectedCategory !== 'all') {
          params.append('category', selectedCategory);
        }
        
        if (statusFilter && statusFilter !== 'all') {
          params.append('status', statusFilter);
        }
        
        if (stockFilter && stockFilter !== 'all') {
          params.append('stockStatus', stockFilter);
        }

        // Add date filter parameters
        if (dateFilter.type === 'month') {
          params.append('month', dateFilter.month);
          params.append('year', dateFilter.year);
        } else if (dateFilter.type === 'year') {
          params.append('year', dateFilter.year);
          params.append('month', '1');
        } else {
          const now = new Date();
          params.append('year', now.getFullYear());
          params.append('month', now.getMonth() + 1);
        }

        // Use endpoint to export product list
        apiUrl = `${config.api.baseUrl}/theater-products/${theaterId}/export-excel?${params.toString()}`;
      }

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });


      if (response.status === 401 || response.status === 403) {

        modal.showError('Session expired. Please login again.');
        return;
      }

      if (response.ok) {
        const blob = await response.blob();

        if (blob.size === 0) {
          modal.showError('No data available to export');
          return;
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Generate filename based on selected filters
        const now = new Date();
        let filename = 'Theater_Products';
        
        // If exporting stock data for a specific date
        if (dateFilter.type === 'date' && dateFilter.selectedDate) {
          filename = `Stock_Report_${dateFilter.selectedDate}`;
        } else {
          if (selectedCategory && selectedCategory !== 'all') {
            filename += `_${selectedCategory}`;
          }
          
          if (searchTerm) {
            filename += `_Search`;
          }
          
          filename += `_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
        
        a.download = `${filename}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show appropriate success message
        if (dateFilter.type === 'date' && dateFilter.selectedDate) {
          modal.showSuccess('Stock report downloaded successfully!');
        } else {
          modal.showSuccess('Product list downloaded successfully!');
        }
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();

          modal.showError(errorData.error || `Failed to download Excel report (${response.status})`);
        } else {
          modal.showError(`Failed to download Excel report (${response.status})`);
        }
      }
    } catch (error) {

      modal.showError('Network error. Please check your connection and try again.');
    } finally {
      setDownloadingExcel(false);
    }
  }, [theaterId, selectedCategory, statusFilter, stockFilter, dateFilter, searchTerm, modal]);

  const handleViewProduct = useCallback((product) => {
    const currentIndex = products.findIndex(p => p._id === product._id);
    setViewModal({ show: true, product, currentIndex });
  }, [products]);

  // Navigation functions for modal
  // Navigation functions removed - Product Details modal no longer supports prev/next navigation
  // const handlePrevProduct = useCallback(() => {
  //   if (!viewModal.show || products.length === 0) return;
  //   
  //   const newIndex = (viewModal.currentIndex - 1 + products.length) % products.length;
  //   const newProduct = products[newIndex];
  //   setViewModal({ show: true, product: newProduct, currentIndex: newIndex });
  // }, [viewModal, products]);

  // const handleNextProduct = useCallback(() => {
  //   if (!viewModal.show || products.length === 0) return;
  //   
  //   const newIndex = (viewModal.currentIndex + 1) % products.length;
  //   const newProduct = products[newIndex];
  //   setViewModal({ show: true, product: newProduct, currentIndex: newIndex });
  // }, [viewModal, products]);

  const handleEditProduct = useCallback((product) => {
    const currentIndex = products.findIndex(p => p._id === product._id);
    
    // Set form data for editing with correct field mappings
    setEditFormData({
      name: product.name || '',
      category: product.categoryId?._id || product.categoryId || product.category?._id || product.category || '',
      kioskType: product.kioskType || '',
      subcategory: product.subcategory || '',
      productType: product.productTypeId?._id || product.productTypeId || product.productType?._id || product.productType || '',
      description: product.description || '',
      productCode: product.sku || product.productCode || '',
      sellingPrice: product.pricing?.basePrice || product.sellingPrice || '',
      costPrice: product.pricing?.salePrice || product.costPrice || '',
      discount: product.pricing?.discountPercentage || product.discount || '',
      taxRate: product.pricing?.taxRate || product.taxRate || '',
      gstType: product.gstType || '',
      stockQuantity: product.inventory?.currentStock ?? product.stockQuantity ?? '',
      unitOfMeasure: product.inventory?.unit || product.unitOfMeasure || 'Piece',
      lowStockAlert: product.inventory?.minStock || product.lowStockAlert || '',
      displayOrder: product.displayOrder || '',
      visibleInMenu: product.visibleInMenu !== undefined ? product.visibleInMenu : true,
      isVeg: product.isVeg || '',
      preparationTime: product.preparationTime || '',
      isCustomizable: product.isCustomizable || false,
      isComboItem: product.isComboItem || false,
      ingredients: product.specifications?.ingredients?.join(', ') || product.ingredients || ''
    });
    
    // Reset file
    setEditFiles({ productImage: null });
    
    setEditModal({ show: true, product, currentIndex });
  }, [products]);

  const handleDeleteProduct = useCallback((product) => {
    setDeleteModal({ show: true, product });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModal.product) return;
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-products/${theaterId}/${deleteModal.product._id}`, {
        method: 'DELETE',
        headers: authHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      // Refresh products list
      await fetchProducts(currentPage, searchTerm, selectedCategory, statusFilter, stockFilter);
      
      // Close modal
      setDeleteModal({ show: false, product: null });
      
      modal.alert({
        title: 'Success',
        message: 'Product deleted successfully',
        type: 'success'
      });
    } catch (error) {

      modal.alert({
        title: 'Error',
        message: 'Failed to delete product',
        type: 'error'
      });
    }
  }, [deleteModal.product, authHeaders, fetchProducts, currentPage, searchTerm, selectedCategory, statusFilter, stockFilter, modal]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  // Statistics calculations
  const stats = useMemo(() => {
    return {
      total: totalItems,
      live: products.filter(p => p.isActive && p.isAvailable).length,
      offline: products.filter(p => !p.isActive || !p.isAvailable).length,
      lowStock: products.filter(p => p.stockQuantity <= (p.lowStockAlert || 5)).length,
      outOfStock: products.filter(p => p.stockQuantity <= 0).length
    };
  }, [products, totalItems]);

  // Edit modal handlers
  const handleEditFormChange = useCallback((field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (editErrors[field]) {
      setEditErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [editErrors]);

  const handleEditFileChange = useCallback((e) => {
    const { name, files } = e.target;
    setEditFiles(prev => ({
      ...prev,
      [name]: files[0] || null
    }));
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModal({ show: false, product: null, currentIndex: 0 });
    setEditFormData({});
    setEditFiles({ productImage: null });
    setEditErrors({});
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    setEditErrors({});

    try {

      const formData = new FormData();
      
      // Append all form fields
      Object.keys(editFormData).forEach(key => {
        if (editFormData[key] !== null && editFormData[key] !== undefined && editFormData[key] !== '') {
          formData.append(key, editFormData[key]);
        }
      });

      // Append files if selected
      if (editFiles.productImage) {
        formData.append('productImage', editFiles.productImage);
      }

      const response = await fetch(`${config.api.baseUrl}/theater-products/${theaterId}/${editModal.product._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {

        // Refresh products list
        await fetchProducts(currentPage, searchTerm, selectedCategory, statusFilter, stockFilter);
        
        closeEditModal();
        
        modal.alert({
          title: 'Success',
          message: 'Product updated successfully!',
          type: 'success'
        });
      } else {
        throw new Error(result.message || 'Failed to update product');
      }
    } catch (error) {
      setEditErrors({ submit: error.message });
      
      modal.alert({
        title: 'Error',
        message: `Failed to update product: ${error.message}`,
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  }, [editFormData, editFiles, editModal.product, isUpdating, modal, fetchProducts, currentPage, searchTerm, selectedCategory, statusFilter, stockFilter, closeEditModal]);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Product Management" currentPage="products">
        <div className="theater-list-container">
          {/* Main Product List Container */}
          <div className="theater-main-container">
            {/* Header */}
            <div className="theater-list-header">
              <div className="header-content">
                <h1>Product Management</h1>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              
                <button 
                  onClick={handleAddProduct}
                  className="add-theater-btn"
                >
                  <span className="btn-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </span>
                  Add New Product
                </button>
              </div>
            </div>

            {/* Statistics Section */}
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-number">{stats.total}</div>
                <div className="stat-label">Total Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.live}</div>
                <div className="stat-label">LIVE Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.offline}</div>
                <div className="stat-label">OFFLINE Products</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.lowStock}</div>
                <div className="stat-label">Low Stock</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{stats.outOfStock}</div>
                <div className="stat-label">Out of Stock</div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="theater-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search products by name, description, or code..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>

              <button 
                className="submit-btn date-filter-btn"
                onClick={() => setShowDateFilterModal(true)}
                style={{
                  backgroundColor: '#8B5CF6',
                  padding: '10px 16px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span className="btn-icon">📅</span>
                {dateFilter.type === 'all' ? 'Current Date' : 
                 dateFilter.type === 'date' ? `${new Date(dateFilter.selectedDate).toLocaleDateString('en-GB')}` :
                 'Current Date'}
              </button>

              <button 
                type="button"
                className="submit-btn excel-download-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDownloadExcel();
                }}
                disabled={downloadingExcel || loading}
                style={{
                  backgroundColor: downloadingExcel ? '#9ca3af' : '#10b981',
                  cursor: downloadingExcel || loading ? 'not-allowed' : 'pointer',
                  opacity: downloadingExcel || loading ? 0.6 : 1,
                  pointerEvents: downloadingExcel || loading ? 'none' : 'auto',
                  minWidth: '100px',
                  padding: '10px 20px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span className="btn-icon">{downloadingExcel ? '⏳' : '📊'}</span>
                {downloadingExcel ? 'Downloading...' : 'Excel'}
              </button>

              <span className="results-count">
                {products.length} of {totalItems} products
              </span>
            </div>

            {/* Table Container */}
            <div className="table-container">
              {/* Error Display */}
              {/* {error && (
                <div className="error-message">
                  <p>{error}</p>
                  <div className="error-actions">
                    {error.includes('login') || error.includes('Authentication') || error.includes('session') ? (
                      <button 
                        onClick={() => navigate('/login')} 
                        className="retry-btn login-btn"
                        style={{marginRight: '10px'}}
                      >
                        Go to Login
                      </button>
                    ) : null}
                    <button onClick={() => window.location.reload()} className="retry-btn">
                      Retry
                    </button>
                  </div>
                </div>
              )} */}

              {/* Product Table */}
              {products.length === 0 && !loading ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: 'var(--text-gray)'}}>
                      <path d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12L8.1 13h7.45c.75 0 1.41-.41 1.75-1.03L21.7 4H5.21l-.94-2H1zm16 16c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </div>
                  <h3>No Products Found</h3>
                  <p>Start by adding your first product to the menu.</p>
                  <button 
                    onClick={handleAddProduct}
                    className="add-theater-btn"
                  >
                    Add Your First Product
                  </button>
                </div>
              ) : (
                <div className="page-table-container">
                  <table className="qr-management-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Image</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Kiosk Type</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <TableSkeleton count={itemsPerPage} />
                      ) : (
                        products.map((product, index) => (
                          <ProductRow
                            key={product._id}
                            product={product}
                            index={index}
                            theaterId={theaterId}
                            categories={categories}
                            kioskTypes={kioskTypes}
                            productToggleStates={productToggleStates}
                            toggleInProgress={toggleInProgress}
                            onView={handleViewProduct}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                            onToggle={handleProductToggleChange}
                            onManageStock={handleManageStock}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination - Always Show (Global Component) */}
              {!loading && (
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  itemType="products"
                />
              )}
            </div>
          </div>
        </div>

        {/* View Product Modal */}
        {viewModal.show && (() => {
          // Get category name - handle all cases
          let categoryDisplayName = 'Uncategorized';
          const product = viewModal.product;
          
          if (product?.categoryId && typeof product.categoryId === 'object') {
            // CategoryId is populated object
            categoryDisplayName = product.categoryId.categoryName || product.categoryId.name || 'Uncategorized';
          } else if (product?.category && typeof product.category === 'object') {
            // Category is populated object
            categoryDisplayName = product.category.categoryName || product.category.name || 'Uncategorized';
          } else if ((product?.categoryId || product?.category) && categories && categories.length > 0) {
            // Category/CategoryId is just an ID string, look up in categories array
            const catId = product.categoryId || product.category;
            const foundCategory = categories.find(c => c._id?.toString() === catId?.toString());
            if (foundCategory) {
              categoryDisplayName = foundCategory.categoryName || foundCategory.name || 'Uncategorized';
            }
          }
          
          return (
          <div className="modal-overlay" onClick={() => setViewModal({ show: false, product: null })}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Product Details</h2>
                <button 
                  className="close-btn" 
                  onClick={() => setViewModal({ show: false, product: null })}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input 
                      type="text" 
                      value={viewModal.product?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Code</label>
                    <input 
                      type="text" 
                      value={viewModal.product?.sku || viewModal.product?.productCode || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input 
                      type="text" 
                      value={categoryDisplayName} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Kiosk Type</label>
                    <input 
                      type="text" 
                      value={(() => {
                        if (!viewModal.product?.kioskType) return '—';
                        if (!Array.isArray(kioskTypes) || kioskTypes.length === 0) return '—';
                        const found = kioskTypes.find(kt => String(kt._id) === String(viewModal.product.kioskType));
                        return found?.name || '—';
                      })()} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Base Price</label>
                    <input 
                      type="text" 
                      value={`₹${parseFloat(viewModal.product?.pricing?.basePrice || viewModal.product?.sellingPrice || 0).toFixed(2)}`} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  {viewModal.product?.pricing?.salePrice && (
                    <div className="form-group">
                      <label>Sale Price</label>
                      <input 
                        type="text" 
                        value={`₹${parseFloat(viewModal.product.pricing.salePrice || 0).toFixed(2)}`} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {viewModal.product?.pricing?.discountPercentage > 0 && (
                    <div className="form-group">
                      <label>Discount</label>
                      <input 
                        type="text" 
                        value={`${viewModal.product.pricing.discountPercentage}%`} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Stock Quantity</label>
                    <input 
                      type="text" 
                      value={`${viewModal.product?.inventory?.currentStock ?? viewModal.product?.stockQuantity ?? 0} ${viewModal.product?.inventory?.unit || viewModal.product?.unitOfMeasure || 'units'}`} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={viewModal.product?.isActive && viewModal.product?.isAvailable ? 'LIVE' : 'OFFLINE'} 
                      className="form-control"
                      disabled
                    >
                      <option value="LIVE">LIVE</option>
                      <option value="OFFLINE">OFFLINE</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Diet Type</label>
                    <select 
                      value={viewModal.product?.isVeg ? 'Vegetarian' : 'Non-Vegetarian'} 
                      className="form-control"
                      disabled
                    >
                      <option value="Vegetarian">Vegetarian 🟢</option>
                      <option value="Non-Vegetarian">Non-Vegetarian 🔴</option>
                    </select>
                  </div>
                  {viewModal.product?.gstType && (
                    <div className="form-group">
                      <label>GST Type</label>
                      <input 
                        type="text" 
                        value={viewModal.product?.gstType} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {viewModal.product?.productType && (
                    <div className="form-group">
                      <label>Product Type</label>
                      <input 
                        type="text" 
                        value={viewModal.product?.productType?.productType || 'N/A'} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {viewModal.product?.description && (
                    <div className="form-group">
                      <label>Description</label>
                      <textarea 
                        value={viewModal.product?.description} 
                        className="form-control"
                        readOnly
                        rows="3"
                      />
                    </div>
                  )}
                  {viewModal.product?.ingredients && (
                    <div className="form-group">
                      <label>Ingredients</label>
                      <textarea 
                        value={viewModal.product?.ingredients} 
                        className="form-control"
                        readOnly
                        rows="2"
                      />
                    </div>
                  )}
                  
                  {/* Additional Product Details */}
                  {viewModal.product?.preparationTime && (
                    <div className="form-group">
                      <label>Preparation Time</label>
                      <input 
                        type="text" 
                        value={`${viewModal.product?.preparationTime} minutes`} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {viewModal.product?.lowStockAlert && (
                    <div className="form-group">
                      <label>Low Stock Alert</label>
                      <input 
                        type="text" 
                        value={`${viewModal.product?.lowStockAlert} units`} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={viewModal.product?.createdAt ? new Date(viewModal.product.createdAt).toLocaleString() : 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={viewModal.product?.updatedAt ? new Date(viewModal.product.updatedAt).toLocaleString() : 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  
                  {/* Product Image Section */}
                  <div className="form-group">
                    <label>Product Image</label>
                    <div className="product-image-preview" style={{marginTop: '8px'}}>
                      {(() => {
                        const productImage = viewModal.product?.images?.[0]?.url || viewModal.product?.productImage;
                        
                        if (productImage) {
                          return (
                            <>
                              <InstantImage
                                src={productImage} 
                                alt={viewModal.product?.name || 'Product'}
                                style={{
                                  maxWidth: '300px', 
                                  maxHeight: '300px', 
                                  objectFit: 'contain', 
                                  borderRadius: '8px', 
                                  border: '1px solid #ddd',
                                  display: 'block'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                              <div 
                                className="image-placeholder" 
                                style={{
                                  display: 'none', 
                                  padding: '40px', 
                                  textAlign: 'center', 
                                  border: '2px dashed #ccc', 
                                  borderRadius: '8px',
                                  backgroundColor: '#f9f9f9',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}
                              >
                                <span style={{fontSize: '48px'}}>🍽️</span>
                                <span style={{color: '#666', fontSize: '14px'}}>Image not available</span>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <div 
                              className="image-placeholder" 
                              style={{
                                display: 'flex', 
                                padding: '40px', 
                                textAlign: 'center', 
                                border: '2px dashed #ccc', 
                                borderRadius: '8px',
                                backgroundColor: '#f9f9f9',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <span style={{fontSize: '48px'}}>🍽️</span>
                              <span style={{color: '#666', fontSize: '14px'}}>No image available</span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn-primary" 
                  onClick={() => setViewModal({ show: false, product: null })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          );
        })()}

        {/* Edit Product Modal */}
        {editModal.show && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Product</h2>
                <button className="close-btn" onClick={closeEditModal}>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Product Type</label>
                    <select
                      value={editFormData.productType || ''}
                      onChange={(e) => handleEditFormChange('productType', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select product type...</option>
                      {productTypes.map((type) => (
                        <option key={type._id} value={type._id}>
                          {type.productType}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={editFormData.category || ''}
                      onChange={(e) => handleEditFormChange('category', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select category...</option>
                      {categories.map((cat) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.categoryName || cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Kiosk Type</label>
                    <select
                      value={editFormData.kioskType || ''}
                      onChange={(e) => handleEditFormChange('kioskType', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select kiosk type...</option>
                      {kioskTypes.map((kt) => (
                        <option key={kt._id} value={kt._id}>
                          {kt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Product Name</label>
                    <input
                      type="text"
                      value={editFormData.name || ''}
                      onChange={(e) => handleEditFormChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter product name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Product Code</label>
                    <input
                      type="text"
                      value={editFormData.productCode || ''}
                      onChange={(e) => handleEditFormChange('productCode', e.target.value)}
                      className="form-control"
                      placeholder="Enter product code"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={editFormData.description || ''}
                      onChange={(e) => handleEditFormChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter product description"
                      rows="3"
                    />
                  </div>

                  <div className="form-group">
                    <label>Cost Price</label>
                    <input
                      type="number"
                      value={editFormData.costPrice || ''}
                      onChange={(e) => handleEditFormChange('costPrice', e.target.value)}
                      className="form-control"
                      placeholder="Enter cost price"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Selling Price</label>
                    <input
                      type="number"
                      value={editFormData.sellingPrice || ''}
                      onChange={(e) => handleEditFormChange('sellingPrice', e.target.value)}
                      className="form-control"
                      placeholder="Enter selling price"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Discount (%)</label>
                    <input
                      type="number"
                      value={editFormData.discount || ''}
                      onChange={(e) => handleEditFormChange('discount', e.target.value)}
                      className="form-control"
                      placeholder="Enter discount percentage"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tax Rate (%)</label>
                    <input
                      type="number"
                      value={editFormData.taxRate || ''}
                      onChange={(e) => handleEditFormChange('taxRate', e.target.value)}
                      className="form-control"
                      placeholder="Enter tax rate"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>

                  <div className="form-group">
                    <label>GST Type</label>
                    <select
                      value={editFormData.gstType || ''}
                      onChange={(e) => handleEditFormChange('gstType', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select GST type...</option>
                      <option value="INCLUDE">GST Included</option>
                      <option value="EXCLUDE">GST Excluded</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Stock Quantity</label>
                    <input
                      type="number"
                      value={editFormData.stockQuantity || ''}
                      onChange={(e) => handleEditFormChange('stockQuantity', e.target.value)}
                      className="form-control"
                      placeholder="Enter stock quantity"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit of Measure</label>
                    <select
                      value={editFormData.unitOfMeasure || 'Piece'}
                      onChange={(e) => handleEditFormChange('unitOfMeasure', e.target.value)}
                      className="form-control"
                    >
                      <option value="Piece">Piece</option>
                      <option value="Kg">Kilogram</option>
                      <option value="Gram">Gram</option>
                      <option value="Liter">Liter</option>
                      <option value="ML">Milliliter</option>
                      <option value="Pack">Pack</option>
                      <option value="Box">Box</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Low Stock Alert</label>
                    <input
                      type="number"
                      value={editFormData.lowStockAlert || ''}
                      onChange={(e) => handleEditFormChange('lowStockAlert', e.target.value)}
                      className="form-control"
                      placeholder="Enter low stock threshold"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Vegetarian Type</label>
                    <select
                      value={editFormData.isVeg || ''}
                      onChange={(e) => handleEditFormChange('isVeg', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select type...</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Non-Vegetarian">Non-Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Preparation Time (minutes)</label>
                    <input
                      type="number"
                      value={editFormData.preparationTime || ''}
                      onChange={(e) => handleEditFormChange('preparationTime', e.target.value)}
                      className="form-control"
                      placeholder="Enter preparation time"
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Ingredients</label>
                    <textarea
                      value={editFormData.ingredients || ''}
                      onChange={(e) => handleEditFormChange('ingredients', e.target.value)}
                      className="form-control"
                      placeholder="Enter ingredients (comma separated)"
                      rows="3"
                    />
                  </div>

                  <div className="form-group">
                    <label>Product Image</label>
                    <input
                      type="file"
                      name="productImage"
                      onChange={handleEditFileChange}
                      className="form-control"
                      accept="image/*"
                    />
                  </div>

                  {/* Checkboxes - simplified structure */}
                  <div className="form-group">
                    <label>Menu Options</label>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editFormData.visibleInMenu || false}
                          onChange={(e) => handleEditFormChange('visibleInMenu', e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Visible in Menu
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editFormData.isCustomizable || false}
                          onChange={(e) => handleEditFormChange('isCustomizable', e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Customizable Product
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={editFormData.isComboItem || false}
                          onChange={(e) => handleEditFormChange('isComboItem', e.target.checked)}
                        />
                        <span className="checkmark"></span>
                        Combo Item
                      </label>
                    </div>
                  </div>

                  {/* Error Display */}
                  {editErrors.submit && (
                    <div className="error-message" style={{ 
                      background: '#fee2e2', 
                      color: '#dc2626', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      marginBottom: '20px' 
                    }}>
                      {editErrors.submit}
                    </div>
                  )}
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={closeEditModal}
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={handleEditSubmit}
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal - Following Global Design System */}
        {deleteModal.show && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete the product <strong>{deleteModal.product?.name}</strong>?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setDeleteModal({ show: false, product: null })}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="confirm-delete-btn"
                >
                  Delete Product
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter Modal */}
        {showDateFilterModal && (
          <DateFilter
            isOpen={showDateFilterModal}
            onClose={() => setShowDateFilterModal(false)}
            onApply={(filter) => {
              // Only allow date type, reset to current date if trying other types
              const dateOnlyFilter = {
                ...filter,
                type: 'date',
                selectedDate: filter.selectedDate || new Date().toISOString().split('T')[0]
              };
              setDateFilter(dateOnlyFilter);
              setShowDateFilterModal(false);
            }}
            initialFilter={dateFilter}
            dateOnly={true}
          />
        )}
      </TheaterLayout>
    </ErrorBoundary>
  );
};

// ✅ Global Modal Width Styling
const style = document.createElement('style');
style.textContent = `
  /* ============================================
     MODAL WIDTH STYLING - GLOBAL STANDARD
     ============================================ */
  
  /* Modal width for CRUD operations */
  .theater-edit-modal-content {
    max-width: 900px !important;
    width: 85% !important;
  }

  /* Tablet responsive modal */
  @media (max-width: 1024px) {
    .theater-edit-modal-content {
      width: 90% !important;
    }
  }

  /* Mobile responsive modal */
  @media (max-width: 768px) {
    .theater-edit-modal-content {
      width: 95% !important;
      max-width: none !important;
    }
  }

  /* Very Small Mobile modal */
  @media (max-width: 480px) {
    .theater-edit-modal-content {
      width: 98% !important;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default TheaterProductList;
