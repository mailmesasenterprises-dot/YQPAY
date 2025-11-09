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

// Professional POS Product Card Component - Exactly same as TheaterOrderInterface
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
  
  const getOutOfStockReason = () => {
    if (!product.isActive || !product.isAvailable) {
      return "Out of Stock";
    }
    if ((product.stockQuantity || 0) <= 0) {
      return "Out of Stock";
    }
    return "";
  };

  return (
    <div 
      className={`staff-product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
      onDoubleClick={handleDoubleClick}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px',
        background: isOutOfStock ? '#f5f5f5' : 'white',
        position: 'relative',
        cursor: isOutOfStock ? 'not-allowed' : 'pointer'
      }}
    >
      <div className="product-image" style={{
        width: '100%',
        height: '120px',
        background: '#f0f0f0',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '8px'
      }}>
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '6px'
            }}
          />
        ) : (
          <span style={{color: '#999', fontSize: '14px'}}>No Image</span>
        )}
      </div>

      <div className="product-info">
        <h4 style={{margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600'}}>
          {product.name}
        </h4>
        <div style={{fontSize: '16px', fontWeight: 'bold', color: '#6B0E9B', marginBottom: '8px'}}>
          {formatPrice(product.price)}
        </div>
        
        {isOutOfStock ? (
          <div style={{
            background: '#ff4444',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {getOutOfStockReason()}
          </div>
        ) : (
          <div className="quantity-controls" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <button
              onClick={(e) => handleQuantityChange(quantity - 1, e)}
              disabled={quantity <= 0}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '2px solid #6B0E9B',
                background: 'white',
                color: '#6B0E9B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              −
            </button>
            <span style={{
              minWidth: '30px',
              textAlign: 'center',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              {quantity}
            </span>
            <button
              onClick={(e) => handleQuantityChange(quantity + 1, e)}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                border: '2px solid #6B0E9B',
                background: '#6B0E9B',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// Main Online POS Interface with 3 columns - Mirror TheaterOrderInterface exactly
const OnlinePOSInterface = () => {
  const { theaterId: routeTheaterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Reliable theaterId extraction - same as TheaterOrderInterface
  const urlMatch = window.location.pathname.match(/\/online-pos\/([^/]+)/);
  const theaterId = routeTheaterId || (urlMatch ? urlMatch[1] : null);
  
  // State for ordering interface - same as TheaterOrderInterface
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryMapping, setCategoryMapping] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Current Order State (In-Store)
  const [currentOrder, setCurrentOrder] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Online Order State (NEW)
  const [onlineOrder, setOnlineOrder] = useState([]);
  const [onlineCustomerName, setOnlineCustomerName] = useState('');
  const [onlineOrderNotes, setOnlineOrderNotes] = useState('');
  
  const isMountedRef = useRef(true);
  
  // Performance monitoring
  usePerformanceMonitoring('OnlinePOSInterface');

  // Fetch products - same logic as TheaterOrderInterface
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
      
      const response = await fetch(`/api/theater-products/${theaterId}`, {
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
      
      let theaterProducts = [];
      
      if (data.success) {
        const allProducts = Array.isArray(data.data) ? data.data : (data.data?.products || []);
        theaterProducts = allProducts;
        
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
      setError(err.message || 'Failed to load menu');
      setProducts([]);
      setCategories([]);
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
      fetchProducts();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [theaterId, fetchProducts]);

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
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [products, selectedCategory, searchTerm]);

  // Add to current order
  const handleAddToCart = useCallback((product, quantity) => {
    setCurrentOrder(prevOrder => {
      const existingIndex = prevOrder.findIndex(item => item._id === product._id);
      
      if (quantity <= 0) {
        return prevOrder.filter(item => item._id !== product._id);
      }
      
      if (existingIndex >= 0) {
        const updatedOrder = [...prevOrder];
        updatedOrder[existingIndex] = { ...product, quantity };
        return updatedOrder;
      } else {
        return [...prevOrder, { ...product, quantity }];
      }
    });
  }, []);

  // Add to online order (NEW)
  const handleAddToOnlineCart = useCallback((product, quantity) => {
    setOnlineOrder(prevOrder => {
      const existingIndex = prevOrder.findIndex(item => item._id === product._id);
      
      if (quantity <= 0) {
        return prevOrder.filter(item => item._id !== product._id);
      }
      
      if (existingIndex >= 0) {
        const updatedOrder = [...prevOrder];
        updatedOrder[existingIndex] = { ...product, quantity: updatedOrder[existingIndex].quantity + quantity };
        return updatedOrder;
      } else {
        return [...prevOrder, { ...product, quantity }];
      }
    });
  }, []);

  // Loading and error states
  if (loading) {
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
    return (
      <TheaterLayout pageTitle="Online POS System">
        <ErrorBoundary>
          <div className="staff-error-container">
            <div className="error-icon">❌</div>
            <h3>Unable to Load Menu</h3>
            <p>{error}</p>
            <button 
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
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
          .online-pos-layout {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 0;
            height: 100vh;
            overflow: hidden;
          }
          .pos-menu-section {
            background: #f8f9fa;
            border-right: 1px solid #e0e0e0;
            overflow-y: auto;
          }
          .pos-order-section {
            background: #ffffff;
            border-right: 1px solid #e0e0e0;
            overflow-y: auto;
          }
          .pos-online-section {
            background: #f0fdf4;
            overflow-y: auto;
          }
          .pos-category-tabs {
            display: flex;
            background: #6B0E9B;
            padding: 10px;
            gap: 8px;
            flex-wrap: wrap;
          }
          .pos-tab {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
          }
          .pos-products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            padding: 16px;
          }
          .pos-no-products {
            grid-column: 1 / -1;
            text-align: center;
            padding: 40px;
            color: #666;
          }
          .pos-order-header {
            padding: 15px;
            color: white;
            font-weight: bold;
          }
          .pos-order-content {
            padding: 16px;
          }
          .pos-customer-input {
            margin-bottom: 16px;
          }
          .pos-customer-input label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
          }
          .pos-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          }
          .pos-order-items {
            max-height: 400px;
            overflow-y: auto;
          }
          .pos-empty-order {
            text-align: center;
            padding: 40px 20px;
            color: #666;
          }
          .empty-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .pos-order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            border: 1px solid #eee;
            border-radius: 6px;
            margin-bottom: 8px;
            background: white;
          }
          .item-details {
            flex: 1;
          }
          .item-name {
            font-weight: 500;
            margin-bottom: 4px;
          }
          .item-price {
            font-size: 12px;
            color: #666;
          }
          .item-total {
            font-weight: bold;
            color: #6B0E9B;
          }
        `}</style>
        
        {/* Main Online POS Layout - 3 Columns */}
        <div className="online-pos-layout">
          {/* Left Side - Product Menu (Same as Professional POS) */}
          <div className="pos-menu-section">
            {/* Category Tabs - POS Style */}
            <div className="pos-category-tabs">
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
                filteredProducts.map((product) => (
                  <StaffProductCard
                    key={product._id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onAddToOnlineCart={handleAddToOnlineCart}
                    currentOrder={currentOrder}
                  />
                ))
              )}
            </div>
          </div>

          {/* Center - Current Order (Same as Professional POS) */}
          <div className="pos-order-section">
            <div className="pos-order-header" style={{backgroundColor: '#6B0E9B'}}>
              Current Order ({currentOrder.length})
            </div>
            
            <div className="pos-order-content">
              <div className="pos-customer-input">
                <label>Customer Name:</label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div className="pos-customer-input">
                <label>Search Items:</label>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div className="pos-order-items">
                {currentOrder.length === 0 ? (
                  <div className="pos-empty-order">
                    <div className="empty-icon">🛒</div>
                    <h4>No Items</h4>
                    <p>Select items from the menu to add to order.</p>
                  </div>
                ) : (
                  currentOrder.map((item, index) => (
                    <div key={`${item._id}-${index}`} className="pos-order-item">
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        <div className="item-price">₹{item.price} x {item.quantity}</div>
                      </div>
                      <div className="item-total">₹{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right - Online Order (NEW) */}
          <div className="pos-online-section">
            <div className="pos-order-header" style={{backgroundColor: '#059669'}}>
              Online Order ({onlineOrder.length})
            </div>
            
            <div className="pos-order-content">
              <div className="pos-customer-input">
                <label>Online Customer Name:</label>
                <input
                  type="text"
                  placeholder="Enter online customer name"
                  value={onlineCustomerName}
                  onChange={(e) => setOnlineCustomerName(e.target.value)}
                  className="pos-input"
                />
              </div>

              <div className="pos-order-items">
                {onlineOrder.length === 0 ? (
                  <div className="pos-empty-order">
                    <div className="empty-icon">🌐</div>
                    <h4>No Online Items</h4>
                    <p>Add items to online order by double-clicking products.</p>
                  </div>
                ) : (
                  onlineOrder.map((item, index) => (
                    <div key={`online-${item._id}-${index}`} className="pos-order-item">
                      <div className="item-details">
                        <div className="item-name">{item.name}</div>
                        <div className="item-price">₹{item.price} x {item.quantity}</div>
                      </div>
                      <div className="item-total">₹{(item.price * item.quantity).toFixed(2)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TheaterLayout>
  );
};

export default OnlinePOSInterface;