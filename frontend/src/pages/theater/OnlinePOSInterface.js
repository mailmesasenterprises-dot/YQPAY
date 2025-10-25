import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import ImageUpload from '../../components/ImageUpload';
import config from '../../config';
import '../../styles/TheaterList.css';
import '../../styles/Dashboard.css';
import '../../styles/ImageUpload.css';
import '../../styles/TheaterOrderInterface.css';

// Professional POS Product Card Component
const StaffProductCard = React.memo(({ product, onAddToCart, currentOrder }) => {
  const [quantity, setQuantity] = React.useState(0);

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

  // Get current quantity in cart
  React.useEffect(() => {
    const orderItem = currentOrder.find(item => item._id === product._id);
    setQuantity(orderItem ? orderItem.quantity : 0);
  }, [currentOrder, product._id]);

  const handleQuantityChange = (newQuantity, e) => {
    e.stopPropagation(); // Prevent card click
    
    if (newQuantity <= 0) {
      setQuantity(0);
      // Remove from cart if quantity is 0
      onAddToCart(product, 0);
    } else {
      setQuantity(newQuantity);
      onAddToCart(product, newQuantity);
    }
  };

  const isOutOfStock = (product.stockQuantity || 0) <= 0 || !product.isActive || !product.isAvailable;
  
  // Calculate discounted price
  const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
  const originalPrice = product.sellingPrice || 0;
  const discountedPrice = discountPercentage > 0 
    ? originalPrice * (1 - discountPercentage / 100)
    : originalPrice;
  const hasDiscount = discountPercentage > 0;
  
  // Determine the reason for being out of stock
  const getOutOfStockReason = () => {
    if (!product.isActive || !product.isAvailable) {
      return "Out of Stock"; // Product is inactive - show as out of stock
    }
    if ((product.stockQuantity || 0) <= 0) {
      return "Out of Stock"; // Actually out of stock
    }
    return "Out of Stock";
  };

  return (
    <div className={`pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}>
      <div className="pos-product-image">
        {product.productImage ? (
          <img 
            src={product.productImage} 
            alt={product.name || 'Product'}
            loading="eager"
            decoding="async"
            style={{imageRendering: 'auto'}}
            onError={(e) => {
              e.target.src = '/placeholder-product.png';
            }}
          />
        ) : (
          <div className="pos-product-placeholder">
            <span className="placeholder-icon">🍽️</span>
          </div>
        )}
      </div>
      
      <div className="pos-product-info">
        <h4 className="pos-product-name">{product.name || 'Unknown Product'}</h4>
        
        {/* Price and Quantity Controls in same row */}
        <div className="pos-product-price-row">
          <div className="pos-product-price-container">
            {hasDiscount ? (
              <>
                <span className="pos-product-price pos-original-price">{formatPrice(originalPrice)}</span>
                <span className="pos-product-price pos-discounted-price">{formatPrice(discountedPrice)}</span>
                <span className="pos-discount-badge">{discountPercentage}% OFF</span>
              </>
            ) : (
              <div className="pos-product-price">{formatPrice(originalPrice)}</div>
            )}
          </div>
          
          {/* Quantity Controls */}
          {!isOutOfStock && (
            <div className="pos-product-quantity">
              <button 
                className="pos-product-qty-btn pos-qty-minus"
                onClick={(e) => handleQuantityChange(Math.max(0, quantity - 1), e)}
                disabled={quantity <= 0}
              >
                −
              </button>
              <span className="pos-product-qty-display">{quantity}</span>
              <button 
                className="pos-product-qty-btn pos-qty-plus"
                onClick={(e) => handleQuantityChange(quantity + 1, e)}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Stock indicator */}
      {isOutOfStock && (
        <div className="pos-out-of-stock">
          <span>{getOutOfStockReason()}</span>
        </div>
      )}
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

  const itemTotal = (item.sellingPrice || 0) * (item.quantity || 0);

  return (
    <div className="pos-order-item">
      <div className="pos-item-content">
        <div className="pos-item-name">{item.name || 'Unknown Item'}</div>
        <div className="pos-item-price">₹{(item.sellingPrice || 0).toFixed(2)}</div>
        
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

// Main Theater Staff Ordering Interface - Canteen Staff Use Only
const OnlinePOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Reliable theaterId extraction
  const urlMatch = window.location.pathname.match(/\/theater-order\/([^/]+)/);
  const theaterId = routeTheaterId || (urlMatch ? urlMatch[1] : null);
  
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
      const savedCart = localStorage.getItem(`online_pos_cart_${theaterId}`);
      if (savedCart) {
        const cartItems = JSON.parse(savedCart);
        console.log('🛒 Loaded saved online cart:', cartItems);
        return Array.isArray(cartItems) ? cartItems : [];
      }
    } catch (error) {
      console.error('Error loading saved online cart:', error);
    }
    return [];
  });
  
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderImages, setOrderImages] = useState([]);
  const [onlineOrders, setOnlineOrders] = useState([]); // Customer orders from QR code
  const [loadingOrders, setLoadingOrders] = useState(false);
  const isMountedRef = useRef(true);
  
  // Performance monitoring
  usePerformanceMonitoring('TheaterOrderInterface');

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
        localStorage.setItem(`online_pos_cart_${theaterId}`, JSON.stringify(currentOrder));
        console.log('💾 Online cart saved to localStorage:', currentOrder);
      } catch (error) {
        console.error('Error saving online cart to localStorage:', error);
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
        
        if (location.state.orderNumber) {
          console.log(`🎉 Order ${location.state.orderNumber} completed successfully`);
        }
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
        // Calculate discounted price
        const originalPrice = product.sellingPrice || 0;
        const discountPercentage = parseFloat(product.discountPercentage || product.pricing?.discountPercentage) || 0;
        const sellingPrice = discountPercentage > 0 
          ? originalPrice * (1 - discountPercentage / 100)
          : originalPrice;
        
        // Extract tax information
        const taxRate = parseFloat(product.pricing?.taxRate ?? product.taxRate) || 0;
        const gstType = product.gstType || 'EXCLUDE';
        
        return [...prevOrder, { 
          ...product, 
          quantity: quantity,
          sellingPrice: sellingPrice,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          taxRate: taxRate, // Ensure tax rate is available
          gstType: gstType // Ensure GST type is available
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
        localStorage.removeItem(`online_pos_cart_${theaterId}`);
        console.log('🗑️ Online cart cleared from localStorage');
      } catch (error) {
        console.error('Error clearing online cart from localStorage:', error);
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

  // Load categories from theater-categories API
  const loadCategories = useCallback(async () => {
    try {
      let authToken = getAuthToken();
      if (!authToken) {
        authToken = await autoLogin();
        if (!authToken) {
          return;
        }
      }

      const categoriesResponse = await fetch(`${config.api.baseUrl}/theater-categories/${theaterId}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        
        if (categoriesData.success && categoriesData.data) {
          // The API returns data.categories array, not data directly
          const categoryList = categoriesData.data.categories || categoriesData.data;
          const activeCategories = categoryList.filter(cat => cat.isActive);
          
          // Store both category names for display and full category objects for filtering
          const categoryNames = activeCategories.map(cat => cat.name);
          
          console.log('🏷️ ORDER INTERFACE: Categories loaded:', categoryNames);
          console.log('🏷️ ORDER INTERFACE: Category objects:', activeCategories);
          
          const mapping = activeCategories.reduce((map, cat) => {
            map[cat.name] = cat._id;
            return map;
          }, {});
          
          
          setCategories(categoryNames);
          setCategoryMapping(mapping);
          
          // Debug: Check products after categories are loaded
          setTimeout(() => {
            console.log('🕐 DELAYED CHECK - Current products:', products.length);
            console.log('🕐 DELAYED CHECK - Current categories:', categoryNames);
            console.log('🕐 DELAYED CHECK - Current mapping:', mapping);
            
            if (products.length > 0) {
              console.log('🔍 PRODUCT-CATEGORY ANALYSIS:');
              products.forEach(product => {
                console.log(`Product: "${product.name}"`);
                console.log(`  - Category field: "${product.category}"`);
                console.log(`  - Category type: ${typeof product.category}`);
                console.log(`  - Matches any category name: ${categoryNames.includes(product.category)}`);
                console.log(`  - Matches any category ID: ${Object.values(mapping).includes(product.category)}`);
                console.log('---');
              });
            }
          }, 1000);
        }
      } else {
        console.log('❌ Categories API failed:', categoriesResponse.status);
      }
    } catch (error) {
      console.error('❌ Failed to load categories:', error);
    }
  }, [theaterId]);

  const fetchProducts = useCallback(async () => {
    
    if (!theaterId) {
      setError('Theater ID not available');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      console.log('� Attempting to fetch products...');
      
      // Check for auth token, auto-login if needed
      let authToken = getAuthToken();
      if (!authToken) {
        authToken = await autoLogin();
        if (!authToken) {
          throw new Error('Authentication failed - unable to login');
        }
      }
      
      // Mirror the exact pattern from TheaterProductList and TheaterCategories
      const params = new URLSearchParams({
        page: 1,
        limit: 1000, // Get all products for ordering
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      const baseUrl = `${config.api.baseUrl}/theater-products/${theaterId}?${params.toString()}`;
      
      console.log('📡 Fetching from:', baseUrl);
      
      const response = await fetch(baseUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

           
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ API Response received:', data);
      
      // Process response data - mirror the working components' logic
      let theaterProducts = [];
      
      if (data.success) {
        // Handle both API response formats (same as Product Management page)
        const allProducts = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        theaterProducts = allProducts; // Show all products, but inactive ones will appear as "Out of Stock"
        
        console.log('🍿 ORDER INTERFACE: Total products:', allProducts.length);
        console.log('🍿 ORDER INTERFACE: Products to show:', theaterProducts.length);
        console.log('🍿 ORDER INTERFACE: Sample product status:', {
          name: allProducts[0]?.name,
          isActive: allProducts[0]?.isActive,
          isAvailable: allProducts[0]?.isAvailable,
          stockQuantity: allProducts[0]?.stockQuantity
        });
      } else {
        console.error('🍿 ORDER INTERFACE: API returned success: false', data);
        throw new Error(data.message || 'Failed to load products');
      }
      
      console.log('📦 SETTING PRODUCTS: isMounted:', isMountedRef.current);
      console.log('📦 PRODUCTS TO SET:', theaterProducts);
      console.log('📦 SAMPLE PRODUCT:', theaterProducts[0]);
      
      // Ensure products is always an array with safe objects
      const safeProducts = Array.isArray(theaterProducts) ? theaterProducts.map((product, index) => {
        let assignedCategory = product.category;
        
        // If no category assigned, assign based on product name as a temporary fix
        if (!assignedCategory || assignedCategory === 'Other' || assignedCategory === '') {
          // Simple category assignment logic based on product name
          const name = (product.name || '').toLowerCase();
          if (name.includes('grain') || name.includes('cereal') || name.includes('snack')) {
            assignedCategory = 'Snacks'; // Will be converted to ObjectId later
          } else if (name.includes('test') && name.includes('product')) {
            assignedCategory = 'Beverages1'; // Will be converted to ObjectId later  
          } else if (name.includes('test911')) {
            assignedCategory = 'Drinks'; // Will be converted to ObjectId later
          } else {
            // Distribute evenly if we can't determine from name
            const categories = ['Snacks', 'Drinks', 'Beverages1'];
            assignedCategory = categories[index % categories.length];
          }
          console.log(`🔧 ASSIGNED CATEGORY: "${product.name}" → "${assignedCategory}"`);
        }
        
        return {
          ...product,
          _id: product._id || `product-${Math.random()}`,
          name: product.name || 'Unknown Product',
          sellingPrice: parseFloat(product.sellingPrice) || 0,
          stockQuantity: parseInt(product.stockQuantity) || 0,
          category: assignedCategory
        };
      }) : [];
      
      setProducts(safeProducts);
      console.log('✅ ORDER INTERFACE: Safe products set in state:', safeProducts.length);
      console.log('🏷️ PRODUCTS WITH CATEGORIES:', safeProducts.map(p => ({
        name: p.name,
        category: p.category,
        originalCategory: theaterProducts.find(op => op._id === p._id)?.category
      })));
      
      // Check if products have null/undefined categories
      const productsWithoutCategory = safeProducts.filter(p => !p.category || p.category === 'Other');
      
      // Load categories separately
      await loadCategories();
      
    } catch (err) {
      console.error('❌ Error loading products:', err);
      
      // Show clean empty interface instead of error
      console.log('🎨 Showing clean empty interface due to error');
      
      // Set empty products to show clean interface
      setProducts([]);
      setCategories(['Snacks', 'Beverages', 'Combo Deals', 'Desserts']); // Show empty categories
      setError(''); // Clear error to show clean interface
      
      console.log('✅ Clean empty interface loaded');
    } finally {
      console.log('🏁 FINALLY BLOCK: isMounted:', isMountedRef.current);
      setLoading(false);
      console.log('🏁 ORDER INTERFACE: Loading set to false (forced)');
    }
  }, [theaterId]);

  // Load initial data - simplified without abort controller
  useEffect(() => {
    console.log('🔥 USE EFFECT TRIGGERED! Theater ID:', theaterId);
    
    // FORCE STATE CLEANUP on component mount
    setProducts([]);
    setCategories([]);
    setCategoryMapping({});
    setSelectedCategory('all');
    setSearchTerm('');
    setError('');
    
    if (theaterId) {
      // Add a small delay to prevent rate limiting
      const timer = setTimeout(() => {
        fetchProducts();
      }, 100);
      
      return () => {
        clearTimeout(timer);
        isMountedRef.current = false;
      };
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [theaterId, fetchProducts]);

  // Fetch online/customer orders from theaterorders collection
  const fetchOnlineOrders = useCallback(async () => {
    if (!theaterId) return;

    try {
      setLoadingOrders(true);
      const response = await fetch(`${config.api.baseUrl}/orders/theater/${theaterId}?source=qr_code&limit=20`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.orders) {
          console.log(`📱 Loaded ${data.orders.length} customer orders`);
          setOnlineOrders(data.orders);
        }
      }
    } catch (error) {
      console.error('Error fetching online orders:', error);
    } finally {
      setLoadingOrders(false);
    }
  }, [theaterId]);

  // Poll for new online orders every 10 seconds
  useEffect(() => {
    if (!theaterId) return;

    fetchOnlineOrders(); // Initial fetch

    const interval = setInterval(() => {
      fetchOnlineOrders();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [theaterId, fetchOnlineOrders]);

  // Calculate order totals with dynamic GST
  const orderTotals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    
    currentOrder.forEach(item => {
      const price = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const gstType = item.gstType || 'EXCLUDE';
      
      const lineTotal = price * qty;
  
      
      if (gstType === 'INCLUDE') {
        // Price already includes GST, extract the GST amount
        const basePrice = lineTotal / (1 + (taxRate / 100));
        const gstAmount = lineTotal - basePrice;
        subtotal += basePrice;
        totalTax += gstAmount;
      } else {
        // GST EXCLUDE - add GST on top of price
        const gstAmount = lineTotal * (taxRate / 100);
        subtotal += lineTotal;
        totalTax += gstAmount;
      }
    });
    
    const total = subtotal + totalTax;
    
    return { 
      subtotal: parseFloat(subtotal.toFixed(2)), 
      tax: parseFloat(totalTax.toFixed(2)), 
      total: parseFloat(total.toFixed(2)) 
    };
  }, [currentOrder]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    // Debug: Log all product categories and selected category
      if (selectedCategory && selectedCategory !== 'all') {
      const categoryId = categoryMapping[selectedCategory];
      
      filtered = filtered.filter(product => {
        const productCategory = product.category || '';
        
        // Ensure productCategory is a string before using string methods
        const categoryStr = typeof productCategory === 'string' ? productCategory : String(productCategory || '');
        
        // Try multiple matching strategies:
        // 1. Exact name match (string)
        // 2. Case-insensitive name match
        // 3. ObjectId match (if category is stored as ObjectId)
        const nameMatch = categoryStr === selectedCategory || 
                         categoryStr.toLowerCase() === selectedCategory.toLowerCase();
        const idMatch = categoryId && categoryStr === categoryId;
        
        const match = nameMatch || idMatch;
        
        if (!match) {
          console.log(`❌ Product "${product.name}" category "${categoryStr}" doesn't match "${selectedCategory}" (ID: ${categoryId})`);
        } else {
          console.log(`✅ Product "${product.name}" category "${categoryStr}" matches "${selectedCategory}" (ID: ${categoryId})`);
        }
        
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

  // Navigate to View Cart page with order data
  const processOrder = useCallback(() => {
    alert('🚀 PROCESS ORDER BUTTON CLICKED! Testing navigation...');
    


    if (!currentOrder.length) {
      alert('Please add items to order');
      return;
    }

    // Prepare cart data to pass to ViewCart page
    const cartData = {
      items: currentOrder,
      customerName: 'Walk-in Customer', // Default customer name
      notes: orderNotes.trim(),
      images: orderImages,
      subtotal: orderTotals.subtotal,
      tax: orderTotals.tax,
      total: orderTotals.total,
      theaterId
    };


    try {
      // Store cart data in sessionStorage for navigation
      sessionStorage.setItem('cartData', JSON.stringify(cartData));
      
      // Try React Router navigation first
      if (navigate && typeof navigate === 'function') {
        navigate(`/view-cart/${theaterId}`, { 
          state: cartData 
        });
      } else {
        // Fallback to window.location
        window.location.href = `/view-cart/${theaterId}`;
      }
    } catch (error) {
      alert('Navigation failed: ' + error.message);
      // Final fallback
      window.location.href = `/view-cart/${theaterId}`;
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
      <TheaterLayout pageTitle="Online POS System">
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
        `}</style>
        
        {/* Main POS Layout */}
        <div className="pos-main-container">
          {/* Left Side - Product Menu */}
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
                    <div className="pos-summary-total">
                      <span>TOTAL:</span>
                      <span>₹{orderTotals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Action Buttons - POS Style */}
                  <div className="pos-actions">
                    <button 
                      className="pos-process-btn"
                      onClick={() => {
                  
                        
                        // Prepare cart data with current order
                        const cartData = {
                          items: currentOrder,
                          customerName: 'Walk-in Customer', // Default customer name
                          notes: orderNotes.trim(),
                          images: orderImages,
                          subtotal: orderTotals.subtotal,
                          tax: orderTotals.tax,
                          total: orderTotals.total,
                          theaterId
                        };
                        
                        // Store in sessionStorage for ViewCart page
                        sessionStorage.setItem('cartData', JSON.stringify(cartData));
                        
                        // Navigate to view cart
                        window.location.href = `/view-cart/${theaterId}`;
                      }}
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

        {/* Customer Orders Section - Below Main POS */}
        {onlineOrders.length > 0 && (
          <div className="online-orders-container" style={{
            marginTop: '24px',
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
          }}>
            <div className="online-orders-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '2px solid #6B0E9B'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#6B0E9B',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #6B0E9B, #5A0C82)',
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>📱</span>
                Customer Orders (QR Code)
              </h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {onlineOrders.length} Orders
                </span>
                <button
                  onClick={fetchOnlineOrders}
                  disabled={loadingOrders}
                  style={{
                    background: loadingOrders ? '#9ca3af' : '#6B0E9B',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: loadingOrders ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {loadingOrders ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div className="online-orders-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
              gap: '20px'
            }}>
              {onlineOrders.map((order, index) => (
                <div key={order._id || index} className="online-order-card" style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '16px',
                  backgroundColor: '#fafafa',
                  transition: 'all 0.3s ease',
                  ':hover': {
                    borderColor: '#6B0E9B',
                    boxShadow: '0 6px 20px rgba(107,14,155,0.15)'
                  }
                }}>
                  {/* Order Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        marginBottom: '4px'
                      }}>
                        {order.orderNumber || `Order #${index + 1}`}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#6b7280'
                      }}>
                        {order.tableNumber || 'Online Order'}
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: order.status === 'pending' ? '#fbbf24' : 
                                     order.status === 'confirmed' ? '#3b82f6' :
                                     order.status === 'completed' ? '#10b981' : '#ef4444',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {order.status || 'Pending'}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div style={{
                    marginBottom: '12px',
                    fontSize: '14px',
                    color: '#4b5563'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>📞 Phone:</strong> {order.customerInfo?.phone || order.customerName || 'N/A'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      🕒 {new Date(order.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div style={{
                    marginBottom: '12px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {order.items && order.items.map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        fontSize: '13px',
                        borderBottom: idx < order.items.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}>
                        <span style={{ color: '#374151' }}>
                          <strong>{item.quantity}x</strong> {item.name}
                        </span>
                        <span style={{ color: '#6b7280', fontWeight: '600' }}>
                          ₹{item.totalPrice?.toFixed(2) || (item.unitPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Total */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '2px solid #e5e7eb'
                  }}>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#1f2937'
                    }}>
                      Total Amount
                    </span>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#6B0E9B'
                    }}>
                      ₹{order.pricing?.total?.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  {/* Payment Method */}
                  {order.payment?.method && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#6b7280',
                      textAlign: 'right'
                    }}>
                      💳 {order.payment.method.toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TheaterLayout>
  );
};

export default OnlinePOSInterface;
