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
import '../../styles/OnlinePOS.css'; // New CSS file for 3-column layout

// Professional POS Product Card Component with dual order support
const StaffProductCard = React.memo(({ product, onAddToCart, onAddToOnlineCart, currentOrder }) => {
  const [quantity, setQuantity] = React.useState(0);

  const formatPrice = (price) => {
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

  // Handle double click to add to online order
  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (!isOutOfStock) {
      onAddToOnlineCart(product, 1);
    }
  };

  const isOutOfStock = (product.stockQuantity || 0) <= 0 || !product.isActive || !product.isAvailable;
  
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
    <div 
      className={`pos-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to add to Online Order"
    >
      <div className="pos-product-image">
        {product.productImage ? (
          <img 
            src={product.productImage} 
            alt={product.name || 'Product'}
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
        <div className="pos-product-price">{formatPrice(product.sellingPrice || 0)}</div>
      </div>

      {/* Quantity Controls for Current Order */}
      {!isOutOfStock && (
        <div className="pos-product-quantity">
          <button 
            className="pos-product-qty-btn pos-qty-minus"
            onClick={(e) => handleQuantityChange(Math.max(0, quantity - 1), e)}
            disabled={quantity <= 0}
            title="Remove from Current Order"
          >
            −
          </button>
          <span className="pos-product-qty-display">{quantity}</span>
          <button 
            className="pos-product-qty-btn pos-qty-plus"
            onClick={(e) => handleQuantityChange(quantity + 1, e)}
            title="Add to Current Order"
          >
            +
          </button>
        </div>
      )}
      
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

// Online Order Item Component - Same as StaffOrderItem but for online orders
const OnlineOrderItem = React.memo(({ item, onUpdateQuantity, onRemove }) => {
  const formatPrice = (price) => {
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

OnlineOrderItem.displayName = 'OnlineOrderItem';

// Main Online POS Interface with 3 columns
const OnlinePOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Reliable theaterId extraction
  const urlMatch = window.location.pathname.match(/\/online-pos\/([^/]+)/);
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

  // State for POS interface
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Current Order (In-Store) State
  const [currentOrder, setCurrentOrder] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderImages, setOrderImages] = useState([]);
  
  // Online Order State (NEW)
  const [onlineOrder, setOnlineOrder] = useState([]);
  const [onlineCustomerName, setOnlineCustomerName] = useState('');
  const [onlineOrderNotes, setOnlineOrderNotes] = useState('');
  const [onlineOrderImages, setOnlineOrderImages] = useState([]);
  
  const isMountedRef = useRef(true);
  
  // Performance monitoring
  usePerformanceMonitoring('OnlinePOSInterface');

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

  // Current Order management functions
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
        return [...prevOrder, { ...product, quantity: quantity }];
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
  }, []);

  // Online Order management functions (NEW)
  const addToOnlineOrder = useCallback((product, quantity = 1) => {
    setOnlineOrder(prevOrder => {
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
        return [...prevOrder, { ...product, quantity: quantity }];
      }
    });
  }, []);

  const updateOnlineQuantity = useCallback((productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromOnlineOrder(productId);
      return;
    }
    setOnlineOrder(prevOrder => 
      prevOrder.map(item => 
        item._id === productId 
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }, []);

  const removeFromOnlineOrder = useCallback((productId) => {
    setOnlineOrder(prevOrder => 
      prevOrder.filter(item => item._id !== productId)
    );
  }, []);

  const clearOnlineOrder = useCallback(() => {
    setOnlineOrder([]);
    setOnlineCustomerName('');
    setOnlineOrderNotes('');
    setOnlineOrderImages([]);
  }, []);

  // Load products from API
  const fetchProducts = useCallback(async () => {
    if (!theaterId || !isMountedRef.current) return;
    

    try {
      let authToken = getAuthToken();

      if (!authToken) {
        authToken = await autoLogin();
        if (!authToken) {
          throw new Error('Authentication failed. Please login again.');
        }
      }
      
      const apiUrl = `/api/theater-products/${theaterId}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache', 
          'Expires': '0',
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });


      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status}`);
      }

      const data = await response.json();
      
      // Process response data
      let theaterProducts = [];
      
      if (data.success) {
        // Handle both API response formats
        const allProducts = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        theaterProducts = allProducts; // Show all products, but inactive ones will appear as "Out of Stock"
        

        // Extract categories from products
        const theaterCategories = [...new Set(allProducts.map(product => 
          typeof product.category === 'string' ? product.category : ''
        ))].filter(Boolean);
        
        setCategories(theaterCategories);
      } else {

        throw new Error(data.message || 'Failed to load products');
      }
      
      setProducts(theaterProducts);
  } catch (err) {

      // Fallback: Try to use sample products if API fails

      const fallbackProducts = [
        {
          _id: 'fallback1',
          name: 'COCA COLA',
          price: 200,
          cost: 210,
          category: 'BURGER',
          stock: 1023,
          isActive: true,
          image: '/path/to/coca-cola.jpg'
        },
        {
          _id: 'fallback2', 
          name: 'Test Pizza Supreme',
          price: 499,
          cost: 250,
          category: 'BURGER',
          stock: 150,
          isActive: true,
          image: '/path/to/pizza.jpg'
        }
      ];
      
      setProducts(fallbackProducts);
      setCategories(['BURGER']);
      setError(''); // Clear error since we have fallback products
    } finally {

      setLoading(false);
    }
  }, [theaterId]);

  // Load initial data
  useEffect(() => {

    setProducts([]);
    setCategories([]);
    setCategoryMapping({});
    setSelectedCategory('all');
    setSearchTerm('');
    setError('');
    
    if (theaterId) {

      // Force immediate product loading
      fetchProducts();
    } else {

      setLoading(false);
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [theaterId, fetchProducts]);

  // Calculate order totals for Current Order
  const orderTotals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    
    currentOrder.forEach(item => {
      const price = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 5; // Default 5% GST
      
      const lineTotal = price * qty;
      subtotal += lineTotal;
      totalTax += (lineTotal * taxRate) / 100;
    });
    
    return {
      subtotal: subtotal,
      tax: totalTax,
      total: subtotal + totalTax
    };
  }, [currentOrder]);

  // Calculate order totals for Online Order (NEW)
  const onlineOrderTotals = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    
    onlineOrder.forEach(item => {
      const price = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 5; // Default 5% GST
      
      const lineTotal = price * qty;
      subtotal += lineTotal;
      totalTax += (lineTotal * taxRate) / 100;
    });
    
    return {
      subtotal: subtotal,
      tax: totalTax,
      total: subtotal + totalTax
    };
  }, [onlineOrder]);

  // Filter products based on category and search
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => 
        product.category === selectedCategory
      );
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product =>
        (product.name || '').toLowerCase().includes(term) ||
        (product.category || '').toLowerCase().includes(term) ||
        (product.description || '').toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Loading and error states
  if (loading && products.length === 0) { // Only show loading if no products are loaded yet
    return (
      <TheaterLayout pageTitle="Online POS System">
        <div className="staff-loading-container">
          <div className="loading-spinner-large"></div>
          <div className="loading-text">Loading menu items...</div>
        </div>
      </TheaterLayout>
    );
  }

  if (error) {
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
      <div className="online-pos-content" style={{
        position: 'relative',
        zIndex: 1,
        backgroundColor: '#ffffff',
        minHeight: '100vh',
        overflow: 'hidden'
      }}>
        {/* CSS Reset and Isolation */}
        <style jsx>{`
          .online-pos-content * {
            box-sizing: border-box;
          }
          .online-pos-content .qr-stats,
          .online-pos-content .theater-stats,
          .online-pos-content .product-stats {
            display: none !important;
          }
          .online-pos-content {
            isolation: isolate;
          }
        `}</style>
        
        {/* Main 3-Column POS Layout */}
        <div className="online-pos-main-container">
          {/* Left Side - Product Menu (Column 1) */}
          <div className="online-pos-menu-section">
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
                    onAddToOnlineCart={addToOnlineOrder}
                    currentOrder={currentOrder}
                  />
                ))
              )}
            </div>
          </div>

          {/* Middle - Current Order Panel (Column 2) */}
          <div className="online-pos-order-section">
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
              {/* Customer Input */}
              <div className="customer-input-section" style={{
                padding: '15px',
                borderBottom: '1px solid #e5e5e5',
                marginBottom: '10px'
              }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Customer Name:
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Search Input */}
              <div className="search-input-section" style={{
                padding: '0 15px 15px',
                borderBottom: '1px solid #e5e5e5',
                marginBottom: '10px'
              }}>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {currentOrder.length === 0 ? (
                <div className="pos-empty-order">
                  <div className="empty-order-icon">🛒</div>
                  <h3>No Items</h3>
                  <p>Select items from the menu to add to order.</p>
                </div>
              ) : (
                <>
                  {/* Order Items */}
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

                  {/* Order Notes */}
                  <div className="pos-order-notes">
                    <textarea
                      placeholder="Add order notes..."
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="pos-notes-textarea"
                      rows="3"
                    />
                  </div>

                  {/* Order Summary */}
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

                  {/* Action Buttons */}
                  <div className="pos-actions">
                    <button 
                      className="pos-process-btn"
                      onClick={() => {
                        // Prepare cart data with current order
                        const cartData = {
                          items: currentOrder,
                          customerName: customerName.trim(),
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

          {/* Right Side - Online Order Panel (Column 3) */}
          <div className="online-pos-order-section">
            <div className="pos-order-header" style={{backgroundColor: '#059669', background: '#059669', color: 'white'}}>
              <h2 className="pos-order-title" style={{color: 'white', margin: 0}}>
                Online Order ({onlineOrder.length})
              </h2>
              {onlineOrder.length > 0 && (
                <button 
                  className="pos-clear-btn"
                  onClick={clearOnlineOrder}
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
              {/* Online Customer Input */}
              <div className="customer-input-section" style={{
                padding: '15px',
                borderBottom: '1px solid #e5e5e5',
                marginBottom: '10px'
              }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                  Online Customer Name:
                </label>
                <input
                  type="text"
                  placeholder="Enter online customer name"
                  value={onlineCustomerName}
                  onChange={(e) => setOnlineCustomerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              {onlineOrder.length === 0 ? (
                <div className="pos-empty-order">
                  <div className="empty-order-icon">🌐</div>
                  <h3>No Online Items</h3>
                  <p>Add items to online order by double-clicking products.</p>
                </div>
              ) : (
                <>
                  {/* Online Order Items */}
                  <div className="pos-order-items">
                    {onlineOrder.map((item, index) => (
                      <OnlineOrderItem
                        key={item._id || `online-order-item-${index}`}
                        item={item}
                        onUpdateQuantity={updateOnlineQuantity}
                        onRemove={removeFromOnlineOrder}
                      />
                    ))}
                  </div>

                  {/* Online Order Notes */}
                  <div className="pos-order-notes">
                    <textarea
                      placeholder="Add online order notes..."
                      value={onlineOrderNotes}
                      onChange={(e) => setOnlineOrderNotes(e.target.value)}
                      className="pos-notes-textarea"
                      rows="3"
                    />
                  </div>

                  {/* Online Order Summary */}
                  <div className="pos-order-summary">
                    <div className="pos-summary-line">
                      <span>Subtotal:</span>
                      <span>₹{onlineOrderTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="pos-summary-line">
                      <span>Tax (GST):</span>
                      <span>₹{onlineOrderTotals.tax.toFixed(2)}</span>
                    </div>
                    <div className="pos-summary-total">
                      <span>TOTAL:</span>
                      <span>₹{onlineOrderTotals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Online Action Buttons */}
                  <div className="pos-actions">
                    <button 
                      className="pos-process-btn"
                      onClick={() => {
                        // Prepare online order data
                        const onlineCartData = {
                          items: onlineOrder,
                          customerName: onlineCustomerName.trim(),
                          notes: onlineOrderNotes.trim(),
                          images: onlineOrderImages,
                          subtotal: onlineOrderTotals.subtotal,
                          tax: onlineOrderTotals.tax,
                          total: onlineOrderTotals.total,
                          theaterId,
                          orderType: 'online'
                        };
                        
                        // Store in sessionStorage for ViewCart page
                        sessionStorage.setItem('onlineCartData', JSON.stringify(onlineCartData));
                        
                        // Navigate to view cart
                        window.location.href = `/view-cart/${theaterId}`;
                      }}
                      disabled={onlineOrder.length === 0}
                      style={{
                        backgroundColor: onlineOrder.length === 0 ? '#9ca3af' : '#059669',
                        background: onlineOrder.length === 0 ? '#9ca3af' : '#059669',
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      PROCESS ONLINE ORDER
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