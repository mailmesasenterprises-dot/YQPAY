import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import InstantImage from '../../components/InstantImage';
import config from '../../config';
import './../../styles/customer/CustomerHome.css'; // Use home page styles for product cards
import './../../styles/customer/CustomerCart.css'; // Keep for header/container
import './../../styles/customer/CustomerFavorites.css';
import './../../styles/customer/CustomerPhoneEntry.css';
import './../../styles/customer/CustomerOTPVerification.css';
import { ultraFetch, useUltraFetch } from '../../utils/ultraFetch';


const CustomerFavorites = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theaterId = searchParams.get('theaterid');
  const theaterName = searchParams.get('theaterName');
  
  const { addItem, updateQuantity, removeItem, getItemQuantity } = useCart();
  
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginStep, setLoginStep] = useState('phone'); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);
  const countryCode = '+91';

  // Load favorites from localStorage
  useEffect(() => {
    // Check if user is logged in
    const savedPhone = localStorage.getItem('customerPhone');
    
    if (savedPhone) {
      // User is logged in
      setIsLoggedIn(true);
      setPhoneNumber(savedPhone);
      loadFavorites();
    } else {
      // User is not logged in - show login form
      setShowLoginForm(true);
      setLoading(false);
    }
  }, [theaterId]);
  
  const loadFavorites = () => {
    const saved = localStorage.getItem('customerFavorites');
    const favoriteIds = saved ? JSON.parse(saved) : [];
    console.log('Loaded favorites from localStorage:', favoriteIds);
    setFavoriteProducts(favoriteIds);
    
    if (favoriteIds.length > 0 && theaterId) {
      fetchFavoriteProducts(favoriteIds);
    } else {
      setLoading(false);
    }
  };

  // Fetch favorite product details
  const fetchFavoriteProducts = async (favoriteIds) => {
    try {
      setLoading(true);
      console.log('Fetching products for theater:', theaterId);
      console.log('Looking for favorite IDs:', favoriteIds);
      
      // Use the same endpoint as CustomerHome
      const data = await ultraFetch(`${config.api.baseUrl}/theater-products/${theaterId}`, {}, { cacheTTL: 60000 });
      
      console.log('Products response:', data);
      
      if (data.success && data.data && data.data.products) {
        // Filter products that are in favorites and map them properly
        const allProducts = data.data.products;
        console.log('All products from API:', allProducts.map(p => ({ id: p._id, name: p.name })));
        
        const favoriteProductsList = allProducts
          .filter(p => favoriteIds.includes(p._id))
          .map(p => {
            // Map products same as CustomerHome does
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
            
            return {
              _id: p._id,
              name: p.name || p.productName,
              price: p.pricing?.basePrice || p.price || p.sellingPrice || 0,
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
              isAvailable: p.isActive === true
            };
          });
        
        console.log('Filtered favorite products:', favoriteProductsList);
        setProducts(favoriteProductsList);
      } else {
        console.error('Invalid response format:', data);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching favorite products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Login handlers
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only allow digits
    if (value.length <= 10) {
      setPhoneNumber(value);
      setLoginError('');
    }
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[0-9]\d{9}$/; // 10-digit number format
    return phoneRegex.test(phone);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber) {
      setLoginError('Please enter your phone number');
      return;
    }

    const isValid = validatePhoneNumber(phoneNumber);
    if (!isValid) {
      setLoginError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const fullPhone = countryCode + phoneNumber;
      const apiUrl = `${config.api.baseUrl}/sms/send-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          purpose: 'favorites_access'
        })
      });

      const result = await response.json();

      if (result.success) {
        setLoginStep('otp');
        setResendTimer(30);
        setCanResend(false);
        
        const timer = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) {
              setCanResend(true);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        setTimeout(() => {
          if (otpInputRefs.current[0]) {
            otpInputRefs.current[0].focus();
          }
        }, 100);
      } else {
        setLoginError(result.error || 'Failed to send OTP. Please try again.');
      }
      
    } catch (err) {
      setLoginError('Failed to send OTP. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setLoginError('');

    if (value && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (value && newOtp.every(digit => digit !== '')) {
      setTimeout(() => handleOtpVerify(newOtp), 500);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    
    const lastIndex = Math.min(pastedData.length - 1, 3);
    otpInputRefs.current[lastIndex]?.focus();

    if (pastedData.length === 4) {
      setTimeout(() => handleOtpVerify(newOtp), 500);
    }
  };

  const handleOtpVerify = async (otpToVerify = otp) => {
    const otpString = otpToVerify.join('');
    
    if (otpString.length !== 4) {
      setLoginError('Please enter complete 4-digit OTP');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const fullPhone = countryCode + phoneNumber;
      const apiUrl = `${config.api.baseUrl}/sms/verify-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          otp: otpString,
          purpose: 'favorites_access'
        })
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('customerPhone', fullPhone);
        setIsLoggedIn(true);
        setShowLoginForm(false);
        loadFavorites();
      } else {
        setLoginError(result.error || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
      
    } catch (err) {
      setLoginError('Failed to verify OTP. Please try again.');
      setOtp(['', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    setLoginLoading(true);
    setLoginError('');
    
    try {
      const fullPhone = countryCode + phoneNumber;
      const apiUrl = `${config.api.baseUrl}/sms/send-otp`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phoneNumber: fullPhone,
          purpose: 'favorites_access'
        })
      });

      const result = await response.json();

      if (result.success) {
        setResendTimer(30);
        setCanResend(false);
        
        const timer = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) {
              setCanResend(true);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setLoginError(result.error || 'Failed to resend OTP.');
      }
    } catch (err) {
      setLoginError('Failed to resend OTP. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle back navigation
  const handleBackToPhone = () => {
    setLoginStep('phone');
    setOtp(['', '', '', '']);
    setLoginError('');
  };

  const handleBack = () => {
    // Navigate back with theater parameters
    if (theaterId) {
      const params = new URLSearchParams();
      params.set('theaterid', theaterId);
      if (theaterName) params.set('theaterName', theaterName);
      
      // Get saved values from localStorage
      const savedQr = localStorage.getItem('customerQrName');
      const savedScreen = localStorage.getItem('customerScreenName');
      const savedSeat = localStorage.getItem('customerSeat');
      
      if (savedQr) params.set('qr', savedQr);
      if (savedScreen) params.set('screen', savedScreen);
      if (savedSeat) params.set('seat', savedSeat);
      
      navigate(`/customer/home?${params.toString()}`);
    } else {
      navigate(-1);
    }
  };

  // Remove from favorites
  const handleRemoveFavorite = (productId) => {
    const newFavorites = favoriteProducts.filter(id => id !== productId);
    setFavoriteProducts(newFavorites);
    setProducts(products.filter(p => p._id !== productId));
    localStorage.setItem('customerFavorites', JSON.stringify(newFavorites));
  };

  // Add to cart
  const handleAddToCart = (product) => {
    const cartItem = {
      productId: product._id,
      name: product.name,
      price: product.pricing?.basePrice || 0,
      quantity: 1,
      image: product.image,
      category: product.category,
      discountPercentage: product.pricing?.discountPercentage || 0,
      taxRate: product.pricing?.taxRate || 0,
      gstType: product.pricing?.gstType || 'INCLUDE'
    };
    
    addItem(cartItem);
  };

  // Increase quantity
  const handleIncreaseQuantity = (product) => {
    const currentQuantity = getItemQuantity(product._id);
    updateQuantity(product._id, currentQuantity + 1);
  };

  // Decrease quantity
  const handleDecreaseQuantity = (product) => {
    const currentQuantity = getItemQuantity(product._id);
    if (currentQuantity > 1) {
      updateQuantity(product._id, currentQuantity - 1);
    } else {
      removeItem(product._id);
    }
  };

  return (
    <div className="cart-page">
      {/* Show Login Form if not logged in */}
      {showLoginForm ? (
        <div className="phone-entry-page">
          {loginStep === 'phone' ? (
            // Phone Number Entry
            <>
              <div className="phone-entry-header">
                <button 
                  className="back-button"
                  onClick={handleBack}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h1 className="phone-entry-title">Phone Verification</h1>
              </div>

              <div className="phone-entry-content">
                <div className="phone-entry-card">
                  <h2>Enter Your Mobile Number</h2>
                  <p>We'll send you a 4-digit verification code to access your favourites</p>

                  <div className="phone-input-container">
                    <div className="country-code-display">
                      <span>🇮🇳</span>
                      <span>{countryCode}</span>
                    </div>
                    
                    <div className="phone-input-wrapper">
                      <input
                        id="phone-input"
                        type="tel"
                        value={phoneNumber}
                        onChange={handlePhoneChange}
                        placeholder="Enter 10-digit number"
                        className="phone-input"
                        maxLength="10"
                        autoComplete="tel"
                        autoFocus
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="error-message">
                      {loginError}
                    </div>
                  )}

                  <button 
                    className="continue-button"
                    onClick={handlePhoneSubmit}
                    disabled={loginLoading || phoneNumber.length !== 10}
                  >
                    {loginLoading ? 'Sending OTP...' : 'Continue'}
                  </button>

                  <p className="security-text">
                    Your phone number is safe and secure with us
                  </p>
                </div>
              </div>
            </>
          ) : (
            // OTP Verification
            <>
              <div className="otp-header">
                <button 
                  className="back-button"
                  onClick={handleBackToPhone}
                  type="button"
                >
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <h1 className="otp-title">Verify OTP</h1>
              </div>

              <div className="otp-content">
                <div className="otp-card">
                  <h2>Enter Verification Code</h2>
                  <p>
                    We've sent a 4-digit code to
                    <br />
                    <span className="phone-number-display">{countryCode} {phoneNumber}</span>
                  </p>

                  <div className="otp-input-container">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => otpInputRefs.current[index] = el}
                        type="tel"
                        inputMode="numeric"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={handleOtpPaste}
                        className="otp-input"
                      />
                    ))}
                  </div>

                  {loginError && (
                    <div className="error-message">
                      {loginError}
                    </div>
                  )}

                  <button 
                    className="verify-button"
                    onClick={() => handleOtpVerify()}
                    disabled={loginLoading || otp.some(d => !d)}
                  >
                    {loginLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>

                  <div className="resend-section">
                    {canResend ? (
                      <button 
                        className="resend-link"
                        onClick={handleResendOtp}
                        disabled={loginLoading}
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <p className="resend-timer">
                        Resend OTP in {resendTimer}s
                      </p>
                    )}
                  </div>

                  <button 
                    className="change-number-button"
                    onClick={handleBackToPhone}
                  >
                    Change Phone Number
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        // Logged in - Show Favourites with Cart Layout
        <>
          {/* Header */}
          <div className="cart-header">
            <button className="back-button" onClick={() => navigate(-1)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className="cart-title">My Favourites</h1>
            <div className="cart-header-spacer" style={{ width: '48px' }}></div>
          </div>

          {/* Theater Info */}
          {theaterName && (
            <div className="cart-info-section">
              <div className="cart-info-item">
                <span className="info-icon">🎭</span>
                <span className="info-text">{theaterName}</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && products.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-cart-icon">❤️</div>
              <h2 className="empty-cart-title">No Favourites Yet</h2>
              <p className="empty-cart-text">Start adding products to your favourites!</p>
              <button 
                className="continue-shopping-btn"
                onClick={() => navigate(`/customer/home?theaterid=${theaterId}${theaterName ? `&theaterName=${encodeURIComponent(theaterName)}` : ''}`)}
              >
                <span>Browse Products</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ) : loading ? (
            <div className="favorites-loading" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div className="spinner"></div>
              <p style={{ marginTop: '20px', color: '#666' }}>Loading favorites...</p>
            </div>
          ) : (
            // Favourites Items List (EXACT MIRROR of CustomerHome Product Cards)
            <>
              <div className="cart-items-header" style={{ padding: '16px 20px', borderBottom: '1px solid #eee' }}>
                <h2 className="items-count">{products.length} {products.length === 1 ? 'Favourite' : 'Favourites'}</h2>
              </div>

              <section className="products-section">
                <div className="products-list">
                  {products.map(product => {
                    const productQty = getItemQuantity(product._id);
                    const isProductAvailable = product.isAvailable !== false && product.isActive !== false;
                    
                    // Get image URL
                    const imgUrl = product.image || (product.images && product.images.length > 0 ? product.images[0] : null);
                    
                    // Calculate prices
                    const basePrice = parseFloat(product.pricing?.basePrice || 0);
                    const discountPercentage = parseFloat(product.pricing?.discountPercentage || 0);
                    const hasDiscount = discountPercentage > 0;

                    return (
                      <div 
                        key={product._id} 
                        className={`product-card single-product-card ${!isProductAvailable ? 'out-of-stock' : ''}`}
                        style={{ cursor: 'default' }}
                      >
                        {/* Image Container */}
                        <div className="product-image-container">
                          {imgUrl ? (
                            <InstantImage
                              src={imgUrl && typeof imgUrl === 'string' 
                                ? (imgUrl.startsWith('http') ? imgUrl : `${config.api.baseUrl}${imgUrl}`) 
                                : null
                              }
                              alt={product.name}
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
                          {hasDiscount && isProductAvailable && (
                            <div className="product-discount-badge">
                              {discountPercentage}% OFF
                            </div>
                          )}
                          
                          {/* Favorite Heart Icon - Always filled red since it's in favorites */}
                          <button
                            className="favorite-heart-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFavorite(product._id);
                            }}
                            aria-label="Toggle favorite"
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="#e74c3c"
                              stroke="#e74c3c"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                          </button>
                        </div>
                        
                        {/* Product Details */}
                        <div className="product-details">
                          <h3 className="product-name">{product.name}</h3>
                          <>
                            <p className="product-quantity">{product.quantity || 'Regular'}</p>
                            {hasDiscount ? (
                              <div className="product-price-container">
                                <span className="product-discounted-price">
                                  ₹{(basePrice * (1 - discountPercentage / 100)).toFixed(2)}
                                </span>
                                <span className="product-original-price">
                                  ₹{basePrice.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <p className="product-regular-price">
                                ₹{basePrice.toFixed(2)}
                              </p>
                            )}
                          </>
                        </div>

                        {/* Actions Section - Only for single products */}
                        {product && (
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
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerFavorites;
