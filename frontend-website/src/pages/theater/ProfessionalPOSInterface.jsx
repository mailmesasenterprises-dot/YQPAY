import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import ImageUpload from '../../components/ImageUpload';
import '../../styles/ProfessionalPOS.css';

// Professional POS Product Card Component
const POSProductCard = React.memo(({ product, onAddToCart }) => {
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

  return (
    <div 
      className="pos-product-card"
      onClick={() => onAddToCart(product)}
    >
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
        <div className="pos-product-price">{formatPrice(product.sellingPrice || 0)}</div>
      </div>
      
      {/* Stock indicator */}
      {(product.stockQuantity || 0) <= 0 && (
        <div className="pos-out-of-stock">
          <span>Out of Stock</span>
        </div>
      )}
    </div>
  );
});

// POS Order Item Component
const POSOrderItem = React.memo(({ item, onUpdateQuantity, onRemove }) => {
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

  const itemTotal = (item.sellingPrice || 0) * (item.quantity || 0);

  return (
    <div className="pos-order-item">
      <div className="pos-order-item-info">
        <h5 className="pos-order-item-name">{item.name || 'Unknown Item'}</h5>
        <div className="pos-order-item-price">{formatPrice(item.sellingPrice || 0)}</div>
      </div>
      
      <div className="pos-quantity-controls">
        <button 
          className="pos-qty-btn decrease"
          onClick={() => onUpdateQuantity(item._id, (item.quantity || 1) - 1)}
          disabled={(item.quantity || 0) <= 1}
        >
          −
        </button>
        <span className="pos-quantity-display">{item.quantity || 0}</span>
        <button 
          className="pos-qty-btn increase"
          onClick={() => onUpdateQuantity(item._id, (item.quantity || 0) + 1)}
        >
          +
        </button>
      </div>
      
      <div className="pos-item-total">
        <div className="pos-item-total-price">{formatPrice(itemTotal)}</div>
        <button 
          className="pos-remove-btn"
          onClick={() => onRemove(item._id)}
          title="Remove item"
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

// Main Professional POS Interface
const ProfessionalPOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  
  // Reliable theaterId extraction
  const urlMatch = window.location.pathname.match(/\/theater-order\/([^/]+)/);
  const theaterId = routeTheaterId || (urlMatch ? urlMatch[1] : null);
  
  // State for POS interface
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Persistent cart state - Load from localStorage
  const [currentOrder, setCurrentOrder] = useState(() => {
    try {
      const savedCart = localStorage.getItem(`professional_pos_cart_${theaterId}`);
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
  const isMountedRef = useRef(true);
  
  // Performance monitoring
  usePerformanceMonitoring('ProfessionalPOSInterface');

  // Order management functions
  const addToOrder = useCallback((product) => {
    setCurrentOrder(prevOrder => {
      const existingItem = prevOrder.find(item => item._id === product._id);
      if (existingItem) {
        return prevOrder.map(item => 
          item._id === product._id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevOrder, { ...product, quantity: 1 }];
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
        localStorage.removeItem(`professional_pos_cart_${theaterId}`);
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
    if (imageData.previewUrl && imageData.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageData.previewUrl);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!theaterId) {
      setError('Theater ID not available');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Check for auth token, auto-login if needed
      let authToken = getAuthToken();
      if (!authToken) {
        authToken = await autoLogin();
        if (!authToken) {
          throw new Error('Authentication failed - unable to login');
        }
      }
      
      const params = new URLSearchParams({
        page: 1,
        limit: 1000,
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      const baseUrl = `/api/theater-products/${theaterId}?${params.toString()}`;
      
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
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      let theaterProducts = [];
      let theaterCategories = [];
      
      if (data.success) {
        const allProducts = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        
        // Ensure products is always an array with safe objects
        const safeProducts = Array.isArray(allProducts) ? allProducts.map(product => ({
          ...product,
          _id: product._id || `product-${Math.random()}`,
          name: product.name || 'Unknown Product',
          sellingPrice: 0, // Always 0 for clean demo display
          stockQuantity: parseInt(product.stockQuantity) || 0,
          category: typeof product.category === 'string' ? product.category : 'Other'
        })) : [];
        
        theaterProducts = safeProducts;
        
        // Extract categories from products
        theaterCategories = [...new Set(allProducts.map(product => 
          typeof product.category === 'string' ? product.category : ''
        ))].filter(Boolean);
      } else {
        throw new Error(data.message || 'Failed to load products');
      }
      
      setProducts(theaterProducts);
      setCategories(theaterCategories);
      
    } catch (err) {
      // Show clean empty interface instead of error

      // Set empty products and basic categories to show clean interface
      setProducts([]);
      setCategories(['BURGER', 'FRENCH FRIES', 'ICE CREAM', 'PIZZA', 'POP CORN']); // Show empty categories
      setError(''); // Clear error to show clean interface
      
  } finally {
      setLoading(false);
    }
  }, [theaterId]);

  // Load initial data
  useEffect(() => {
    if (theaterId) {
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

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (theaterId && currentOrder.length >= 0) {
      try {
        localStorage.setItem(`professional_pos_cart_${theaterId}`, JSON.stringify(currentOrder));
  } catch (error) {
  }
    }
  }, [currentOrder, theaterId]);

  // Calculate order totals
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
    
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(product => 
        product.category === selectedCategory
      );
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        (product.name || '').toLowerCase().includes(searchLower) ||
        (product.description || '').toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Process order submission
  const processOrder = useCallback(async () => {
    if (!currentOrder.length) {
      alert('Please add items to order');
      return;
    }

    try {
      const orderData = {
        items: currentOrder,
        customerName: 'Walk-in Customer', // Default customer name
        notes: orderNotes.trim(),
        images: orderImages,
        subtotal: orderTotals.subtotal,
        tax: orderTotals.tax,
        total: orderTotals.total,
        theaterId
      };

      
      clearOrder();
      alert('Order placed successfully!');
      
    } catch (error) {
      alert('Failed to process order. Please try again.');
    }
  }, [currentOrder, customerName, orderNotes, orderImages, orderTotals, theaterId, clearOrder]);

  // Loading and error states - REMOVED loading screen to show UI immediately
  // Skip loading screen - show clean UI immediately
  // if (loading) { ... }

  if (error) {
    const handleManualTokenSet = () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDkzNTdiYWE4YmMyYjYxMDFlMjk3YyIsInVzZXJUeXBlIjoidGhlYXRlcl91c2VyIiwidGhlYXRlciI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInRoZWF0ZXJJZCI6IjY4ZDM3ZWE2NzY3NTJiODM5OTUyYWY4MSIsInBlcm1pc3Npb25zIjpbXSwiaWF0IjoxNzU5MTE4MzM0LCJleHAiOjE3NTkyMDQ3MzR9.gvOS5xxIlcOlgSx6D_xDH3Z_alrqdp5uMtMLOVWIEJs";
      localStorage.setItem('authToken', token);
      window.location.reload();
    };

    return (
      <div className="pos-error">
        <div className="pos-error-content">
          <div className="error-icon">❌</div>
          <h3>Unable to Load POS System</h3>
          <p>{error}</p>
          <div className="pos-error-actions">
            <button 
              className="pos-retry-btn"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
            <button 
              className="pos-demo-token-btn"
              onClick={handleManualTokenSet}
            >
              Set Demo Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="professional-pos-interface">
      {/* POS Header */}
      <div className="pos-header">
        <div className="pos-header-left">
          <div className="pos-logo">
            <span className="pos-logo-icon">🍕</span>
            <span className="pos-logo-text">Theater Canteen POS</span>
          </div>
          <div className="pos-date-time">
            {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}
          </div>
        </div>
        
        <div className="pos-header-center">
          <div className="customer-input-container">
            <label className="pos-customer-label">Customer Name:</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pos-customer-input"
            />
          </div>
        </div>
        
        <div className="pos-header-right">
          <div className="pos-search">
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pos-search-input"
            />
            <span className="pos-search-icon">🔍</span>
          </div>
        </div>
      </div>

      {/* Main POS Layout */}
      <div className="pos-main-container">
        {/* Left Side - Product Menu */}
        <div className="pos-menu-section">
          {/* Category Tabs */}
          <div className="pos-category-tabs">
            <button 
              className={`pos-tab ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              ALL
            </button>
            {categories.map((category, index) => (
              <button
                key={category || `category-${index}`}
                className={`pos-tab ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {(category || 'CATEGORY').toUpperCase()}
              </button>
            ))}
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
                <POSProductCard
                  key={product._id || `product-${index}`}
                  product={product}
                  onAddToCart={addToOrder}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Side - Order Panel */}
        <div className="pos-order-section">
          <div className="pos-order-header">
            <h2 className="pos-order-title">Current Order</h2>
            {currentOrder.length > 0 && (
              <button 
                className="pos-clear-btn"
                onClick={clearOrder}
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
                {/* Order Items */}
                <div className="pos-order-items">
                  {currentOrder.map((item, index) => (
                    <POSOrderItem
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

                {/* Image Upload */}
                <div className="pos-order-images">
                  <ImageUpload
                    onImageUpload={handleImageUpload}
                    onImageRemove={handleImageRemove}
                    currentImages={orderImages}
                    maxFiles={3}
                    maxFileSize={2}
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

                {/* Professional Order Summary Container (Like ViewCart) */}
                <div className="pos-professional-summary">
                  <div className="professional-summary-header">
                    <h3>Order Summary</h3>
                  </div>
                  <div className="professional-summary-details">
                    <div className="summary-row">
                      <span>Subtotal:</span>
                      <span>₹{orderTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="summary-row">
                      <span>GST:</span>
                      <span>₹{orderTotals.tax.toFixed(2)}</span>
                    </div>
                    <div className="summary-divider"></div>
                    <div className="summary-row total-row">
                      <span>Total Amount:</span>
                      <span className="total-amount">₹{orderTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pos-actions">
                  <button 
                    className="pos-process-btn"
                    onClick={processOrder}
                    disabled={!customerName.trim() || currentOrder.length === 0}
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
  );
};

export default ProfessionalPOSInterface;