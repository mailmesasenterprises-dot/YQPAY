import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../../config';
import { getCachedData, setCachedData } from '../../utils/cacheUtils';
import CachedImage from '../../components/CachedImage'; // Global image caching
import InstantImage from '../../components/InstantImage'; // 🚀 INSTANT image loading
import { cacheProductImages } from '../../utils/globalImageCache'; // 🎨 Batch product image caching
import '../../styles/pages/theater/SimpleProductList.css';

const SimpleProductList = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [kioskTypes, setKioskTypes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theaterName, setTheaterName] = useState('');
  const [theaterLogo, setTheaterLogo] = useState('');
  const [bannerImage, setBannerImage] = useState('');

  // Set browser title
  useEffect(() => {
    document.title = 'Menu - YQPayNow';
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem(`kioskCart_${theaterId}`);
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        localStorage.removeItem(`kioskCart_${theaterId}`);
      }
    }
  }, [theaterId]);

  // Fetch theater name, kiosk types, and products
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setError('No authentication token found');
          setLoading(false);
          return;
        }

        // Try to load from cache first for instant display
        const cacheKey = `kioskData_${theaterId}`;
        const cached = getCachedData(cacheKey);
        if (cached) {
          setTheaterName(cached.theaterName);
          setTheaterLogo(cached.theaterLogo);
          setBannerImage(cached.bannerImage);
          setKioskTypes(cached.kioskTypes);
          setProducts(cached.products);
          setLoading(false);
          document.title = `Menu - ${cached.theaterName}`;
          
          // Fetch fresh data in background to update cache
          fetchFreshData(token, theaterId, cacheKey);
          return;
        }

        // No valid cache, fetch fresh data
        await fetchFreshData(token, theaterId, cacheKey);
        
      } catch (err) {
        setError(`Failed to load: ${err.message}`);
        setLoading(false);
      }
    };

    const fetchFreshData = async (token, theaterId, cacheKey) => {
      // Set timeout for the entire fetch operation
      const timeoutId = setTimeout(() => {
        setError('Request timeout - please refresh');
        setLoading(false);
      }, 10000); // 10 seconds timeout

      // Fetch all data in parallel for faster loading
      const [theaterResponse, bannerResponse, kioskTypesResponse, productsResponse] = await Promise.all([
        fetch(`${config.api.baseUrl}/theater-dashboard/${theaterId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }).catch(() => null),
        fetch(`${config.api.baseUrl}/theater-banners/${theaterId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }).catch(() => null),
        fetch(`${config.api.baseUrl}/theater-kiosk-types/${theaterId}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        }).catch(() => null),
        fetch(config.helpers.getApiUrl(`/theater-products/${theaterId}`), {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      ]);

      clearTimeout(timeoutId);

      let theaterNameValue = 'Menu';
      let theaterLogoValue = '';
      let bannerImageValue = '';
      let kioskTypesValue = [];
      let productsValue = [];

      // Process theater info
      if (theaterResponse && theaterResponse.ok) {
        const theaterData = await theaterResponse.json();
        if (theaterData.success && theaterData.theater) {
          theaterNameValue = theaterData.theater.name || 'Menu';
          theaterLogoValue = theaterData.theater.logo || '';
        }
      }

      // Process banner image (simplified)
      if (bannerResponse && bannerResponse.ok) {
        const bannerData = await bannerResponse.json();
        if (bannerData.success && bannerData.data && bannerData.data.banners && bannerData.data.banners.length > 0) {
          const activeBanner = bannerData.data.banners.find(b => b.isActive);
          bannerImageValue = activeBanner?.imageUrl || bannerData.data.banners[0]?.imageUrl || '';
        }
      }

      // Process kiosk types
      if (kioskTypesResponse && kioskTypesResponse.ok) {
        const kioskTypesData = await kioskTypesResponse.json();
        if (kioskTypesData.success && kioskTypesData.data && kioskTypesData.data.kioskTypes) {
          kioskTypesValue = kioskTypesData.data.kioskTypes.filter(kt => kt.isActive);
        }
      }

      // Process products
      if (!productsResponse.ok) {
        throw new Error(`HTTP ${productsResponse.status}: ${productsResponse.statusText}`);
      }

      const data = await productsResponse.json();
      
      if (data.success && data.data && data.data.products) {
        // Filter only active products
        productsValue = data.data.products.filter(p => p.isActive);
      } else {
        setError('No products found');
      }

      // Update state
      setTheaterName(theaterNameValue);
      setTheaterLogo(theaterLogoValue);
      setBannerImage(bannerImageValue);
      setKioskTypes(kioskTypesValue);
      setProducts(productsValue);
      setLoading(false);
      document.title = `Menu - ${theaterNameValue}`;

      // Cache the data using utility
      setCachedData(cacheKey, {
        theaterName: theaterNameValue,
        theaterLogo: theaterLogoValue,
        bannerImage: bannerImageValue,
        kioskTypes: kioskTypesValue,
        products: productsValue
      });
      
      // 🎨 AUTO-CACHE ALL PRODUCT IMAGES (LIKE OFFLINE POS)
      if (productsValue.length > 0) {
        console.log(`🎨 [SimpleProductList] Auto-caching ${productsValue.length} product images...`);
        cacheProductImages(productsValue).catch(err => {
          console.error('Error caching product images:', err);
        });
      }
    };

    fetchData();
  }, [theaterId]);

  // Filter products by selected category
  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.kioskType === selectedCategory);

  // Filter to show only products with available stock
  const availableProducts = filteredProducts.filter(product => {
    const currentStock = product.inventory?.currentStock ?? product.stockQuantity ?? 0;
    const isAvailable = currentStock > 0 && product.isActive !== false && product.isAvailable !== false;
    return isAvailable;
  });

  // Add to cart
  const addToCart = (product) => {
    const existingItem = cart.find(item => item._id === product._id);
    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map(item => 
        item._id === product._id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [...cart, { ...product, quantity: 1 }];
    }
    setCart(updatedCart);
    localStorage.setItem(`kioskCart_${theaterId}`, JSON.stringify(updatedCart));
  };

  // Get cart total
  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const basePrice = item.sellingPrice || item.price || 0;
      return sum + (basePrice * item.quantity);
    }, 0);
  };

  // Get cart items count
  const getCartCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  // View cart
  const viewCart = () => {
    navigate(`/kiosk-cart/${theaterId}`, { state: { cart, theaterName } });
  };

  if (loading) {
    return (
      <div className="kiosk-screen">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kiosk-screen">
        <div className="error-container">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-screen-modern">
      {/* Left Sidebar - Categories */}
      <div className="category-sidebar">
        {/* Theater Logo */}
        <div className="sidebar-logo">
          {theaterLogo ? (
            <CachedImage src={theaterLogo} alt={theaterName} />
          ) : (
            <h1 className="sidebar-logo-text">{theaterName || 'Menu'}</h1>
          )}
        </div>

        {/* Scrollable Category List Wrapper with Arrows */}
        <div className="category-list-wrapper">
          {/* Scroll Up Arrow */}
          <div 
            className="scroll-arrow-kebab scroll-arrow-up"
            onClick={() => {
              const wrapper = document.querySelector('.category-list-wrapper');
              if (wrapper) wrapper.scrollBy({ top: -200, behavior: 'smooth' });
            }}
          ></div>

          {/* Category List */}
          <div className="category-list">
            {/* All Items Category */}
            <div 
              className={`category-item ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              <div className="category-item-image">
                <span className="category-item-icon">🍽️</span>
              </div>
              <div className="category-item-name">All Items</div>
            </div>

            {/* Dynamic Categories from Kiosk Types */}
            {Array.isArray(kioskTypes) && kioskTypes.map((type) => {
              const iconUrl = type.imageUrl || type.icon;
              return (
                <div
                  key={type._id}
                  className={`category-item ${selectedCategory === type._id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(type._id)}
                >
                  <div className="category-item-image">
                    {iconUrl ? (
                      <CachedImage src={iconUrl} alt={type.name} />
                    ) : (
                      <span className="category-item-icon">📦</span>
                    )}
                  </div>
                  <div className="category-item-name">{type.name}</div>
                </div>
              );
            })}
          </div>

          {/* Scroll Down Arrow */}
          <div 
            className="scroll-arrow-kebab scroll-arrow-down"
            onClick={() => {
              const wrapper = document.querySelector('.category-list-wrapper');
              if (wrapper) wrapper.scrollBy({ top: 200, behavior: 'smooth' });
            }}
          ></div>
        </div>

        {/* Cart Button - Shows when cart has items */}
        {cart.length > 0 && (
          <div className="sidebar-cart-button" onClick={viewCart}>
            <div className="cart-icon-wrapper">
              <span className="cart-icon">🛒</span>
              <span className="cart-badge">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            <span className="cart-button-text">View Cart</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Hero Banner */}
        <div className="hero-banner">
          {bannerImage ? (
            <InstantImage
              src={bannerImage} 
              alt="Menu Banner"
              onError={(e) => {
                console.error('Banner image failed to load:', bannerImage);
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="hero-banner-placeholder">🍽️</div>';
              }}
              onLoad={() => {
                console.log('Banner image loaded successfully:', bannerImage);
              }}
            />
          ) : (
            <div className="hero-banner-placeholder">
              <span style={{ fontSize: '80px' }}>🍽️</span>
            </div>
          )}
        </div>

        {/* Product Content */}
        <div className="product-content">
          <div className="product-header">
            <h1 className="product-title">
              {selectedCategory === 'all' ? 'All Items' : kioskTypes.find(t => t._id === selectedCategory)?.name || 'Menu'}
            </h1>
                      </div>

          {/* Products Grid */}
          {availableProducts.length === 0 ? (
            <div className="no-products-box">
              <p>No products available in this category</p>
            </div>
          ) : (
            <div className="products-grid-kebab">
              {availableProducts.map((product) => {
                // Handle nested pricing structure - ensure numbers
                const basePrice = Number(
                  product.pricing?.basePrice || 
                  product.pricing?.salePrice || 
                  product.basePrice || 
                  product.salePrice ||
                  product.price || 
                  0
                );
                
                const discountPercent = Number(product.pricing?.discountPercentage || product.discountPercentage || 0);
                
                let finalPrice = basePrice;
                
                if (discountPercent > 0) {
                  finalPrice = basePrice * (1 - discountPercent / 100);
                } else if (product.pricing?.salePrice && Number(product.pricing.salePrice) < basePrice) {
                  finalPrice = Number(product.pricing.salePrice);
                }
                
                const cartItem = cart.find(item => item._id === product._id);
                const quantity = cartItem ? cartItem.quantity : 0;
                
                return (
                  <div 
                    key={product._id} 
                    className="product-card-kebab"
                  >
                    <div className="product-card-image" onClick={() => addToCart(product)}>
                      {product.images && product.images.length > 0 ? (
                        <InstantImage
                          src={product.images[0].url || product.images[0]} 
                          alt={product.name}
                        />
                      ) : (
                        <div className="product-card-placeholder">🍽️</div>
                      )}
                    </div>
                    <div className="product-card-info">
                      <h3 className="product-card-name">{product.name}</h3>
                      {(product.quantity || product.size) && (
                        <p className="product-card-size">{product.quantity || product.size}</p>
                      )}
                      <div className="product-card-footer">
                        <div className="product-price-section">
                          <p className="product-card-price">
                            ₹{Number(finalPrice || 0).toFixed(2)}
                          </p>
                        </div>
                        {quantity > 0 ? (
                          <div className="product-quantity-controls">
                            <button 
                              className="product-qty-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const index = cart.findIndex(item => item._id === product._id);
                                let updatedCart;
                                if (quantity === 1) {
                                  updatedCart = cart.filter((_, i) => i !== index);
                                } else {
                                  updatedCart = cart.map((cartItem, i) => 
                                    i === index ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem
                                  );
                                }
                                setCart(updatedCart);
                                localStorage.setItem(`kioskCart_${theaterId}`, JSON.stringify(updatedCart));
                              }}
                            >
                              −
                            </button>
                            <span className="product-qty-number">{quantity}</span>
                            <button 
                              className="product-qty-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const index = cart.findIndex(item => item._id === product._id);
                                const updatedCart = cart.map((cartItem, i) => 
                                  i === index ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
                                );
                                setCart(updatedCart);
                                localStorage.setItem(`kioskCart_${theaterId}`, JSON.stringify(updatedCart));
                              }}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button 
                            className="product-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleProductList;