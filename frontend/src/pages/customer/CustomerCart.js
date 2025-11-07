import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { getImageSrc } from '../../utils/globalImageCache'; // 🚀 Instant image loading
import { calculateOrderTotals } from '../../utils/orderCalculation'; // 📊 Centralized calculation
import './../../styles/customer/CustomerCart.css';

const CustomerCart = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, getTotalItems, clearCart } = useCart();
  const [qrName, setQrName] = useState(null);
  const [seat, setSeat] = useState(null);
  const [theaterId, setTheaterId] = useState(null);
  const [theaterName, setTheaterName] = useState(null);
  const [category, setCategory] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qr = params.get('qrname');
    const seatNum = params.get('seat');
    const id = params.get('theaterid');
    const name = params.get('theatername');
    const cat = params.get('category');
    if (qr) setQrName(qr);
    if (seatNum) setSeat(seatNum);
    if (id) setTheaterId(id);
    if (name) setTheaterName(name);
    if (cat) setCategory(cat);
  }, [location.search]);

  // Calculate totals using centralized utility
  const { subtotal, tax, total, totalDiscount } = useMemo(() => {
    // Map cart items to match the expected format for the utility
    const orderItems = items.map(item => ({
      ...item,
      sellingPrice: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: item.quantity,
      taxRate: parseFloat(item.taxRate) || 0,
      gstType: item.gstType || item.pricing?.gstType || 'EXCLUDE',
      discountPercentage: parseFloat(item.discountPercentage || item.pricing?.discountPercentage) || 0,
      pricing: item.pricing
    }));
    
    return calculateOrderTotals(orderItems);
  }, [items]);

  // Determine GST types for display label
  const gstTypes = useMemo(() => {
    const types = items.map(item => item.gstType || item.pricing?.gstType || 'EXCLUDE');
    return [...new Set(types)]; // Unique types
  }, [items]);

  // Determine display label for GST based on mixed types
  const gstDisplayLabel = gstTypes.length > 1 
    ? "Tax (GST) - Mixed" 
    : gstTypes.includes('INCLUDE') 
      ? "Tax (GST) - Included" 
      : "Tax (GST) - Excluded";

  const handleCheckout = () => {
    // Navigate to phone entry to start checkout flow
    if (items.length === 0) {
      alert('Your cart is empty');
      return;
    }
    
    // Store cart data and navigation info for checkout flow
    localStorage.setItem('checkoutData', JSON.stringify({
      theaterId,
      theaterName,
      qrName,
      seat,
      cartItems: items,
      totals: { subtotal, tax, total, totalDiscount }
    }));
    
    navigate('/customer/phone-entry');
  };

  const handleBackToMenu = () => {
    const params = new URLSearchParams({
      ...(theaterId && { theaterid: theaterId }),
      ...(qrName && { qrname: qrName }),
      ...(seat && { seat: seat }),
      ...(category && { category: category })
    });
    navigate(`/customer/home?${params.toString()}`);
  };

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-header">
          <button className="back-button" onClick={handleBackToMenu}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="cart-title">Your Cart</h1>
          <div className="cart-header-spacer"></div>
        </div>

        {/* Theater & QR Info */}
        {(theaterName || qrName || seat) && (
          <div className="cart-info-section">
            {theaterName && (
              <div className="cart-info-item">
                <span className="info-icon">🎭</span>
                <span className="info-text">{theaterName}</span>
              </div>
            )}
            {qrName && (
              <div className="cart-info-item">
                <span className="info-icon">📱</span>
                <span className="info-text">{qrName}</span>
              </div>
            )}
            {seat && (
              <div className="cart-info-item">
                <span className="info-icon">💺</span>
                <span className="info-text">Seat {seat}</span>
              </div>
            )}
          </div>
        )}

        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h2 className="empty-cart-title">Your cart is empty</h2>
          <p className="empty-cart-text">Add some delicious items to get started</p>
          <button className="continue-shopping-btn" onClick={handleBackToMenu}>
            <span>Browse Menu</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      {/* Header */}
      <div className="cart-header">
        <button className="back-button" onClick={handleBackToMenu}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="cart-title">Your Cart</h1>
        <button className="clear-cart-button" onClick={clearCart}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Theater & QR Info */}
      {(qrName || seat) && (
        <div className="cart-info-section">
          {qrName && (
            <div className="cart-info-item">
              <span className="info-icon">📱</span>
              <span className="info-text">{qrName}</span>
            </div>
          )}
          {seat && (
            <div className="cart-info-item">
              <span className="info-icon">💺</span>
              <span className="info-text">Seat {seat}</span>
            </div>
          )}
        </div>
      )}

      {/* Cart Items */}
      <div className="cart-items-container">
        <div className="cart-items-header">
          <h2 className="items-count">{getTotalItems()} {getTotalItems() === 1 ? 'Item' : 'Items'}</h2>
        </div>

        <div className="cart-items-list">
          {items.map((item, index) => {
            const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
            const discountPercentage = parseFloat(item.discountPercentage || item.pricing?.discountPercentage) || 0;
            const discountedPrice = discountPercentage > 0 
              ? itemPrice * (1 - discountPercentage / 100)
              : itemPrice;
            const hasDiscount = discountPercentage > 0;
            
            return (
            <div key={item._id || index} className="cart-item">
              <div className="cart-item-image-container">
                <img 
                  src={getImageSrc(item.image || '/placeholder-product.png')} 
                  alt={item.name}
                  className="cart-item-image"
                  loading="eager"
                  onError={(e) => {
                    e.target.src = '/placeholder-product.png';
                  }}
                />
                {hasDiscount && (
                  <div className="discount-badge">{discountPercentage}% OFF</div>
                )}
              </div>
              
              <div className="cart-item-details">
                <h3 className="cart-item-name">{item.name}</h3>
                <div className="cart-item-price-container">
                  {hasDiscount ? (
                    <>
                      <p className="cart-item-price">₹{discountedPrice.toFixed(2)}</p>
                      <p className="cart-item-original-price">₹{itemPrice.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="cart-item-price">₹{itemPrice.toFixed(2)}</p>
                  )}
                </div>
              </div>

              <div className="cart-item-actions">
                <div className="quantity-controls">
                  <button 
                    className="quantity-btn minus-btn"
                    onClick={() => removeItem(item)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                  
                  <span className="quantity-display">{item.quantity}</span>
                  
                  <button 
                    className="quantity-btn plus-btn"
                    onClick={() => addItem(item)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
                
                <p className="cart-item-total">₹{(discountedPrice * item.quantity).toFixed(2)}</p>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Summary Section */}
      <div className="cart-summary">
        <div className="summary-divider"></div>
        
        <div className="summary-row">
          <span className="summary-label">Subtotal</span>
          <span className="summary-value">₹{subtotal.toFixed(2)}</span>
        </div>
        
        <div className="summary-row">
          <span className="summary-label">{gstDisplayLabel}</span>
          <span className="summary-value">₹{tax.toFixed(2)}</span>
        </div>
        
        {totalDiscount > 0 && (
          <div className="summary-row discount-row">
            <span className="summary-label">Discount</span>
            <span className="summary-value discount-value">-₹{totalDiscount.toFixed(2)}</span>
          </div>
        )}
        
        <div className="summary-divider"></div>
        
        <div className="summary-row summary-total">
          <span className="summary-label">Total</span>
          <span className="summary-value">₹{total.toFixed(2)}</span>
        </div>

        <button className="checkout-button" onClick={handleCheckout}>
          <span className="checkout-text">Proceed to Checkout</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CustomerCart;
