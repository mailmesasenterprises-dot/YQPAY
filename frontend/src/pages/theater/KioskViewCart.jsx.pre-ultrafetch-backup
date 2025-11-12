import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../../config';
import CachedImage from '../../components/CachedImage'; // Global image caching
import { calculateOrderTotals } from '../../utils/orderCalculation'; // 📊 Centralized calculation
import '../../styles/pages/theater/KioskCart.css';

const KioskViewCart = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState('Kiosk Customer');
  const [paymentMethod, setPaymentMethod] = useState('upi'); // Default to UPI for kiosk
  const [orderNotes, setOrderNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem(`kioskCart_${theaterId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [theaterId]);

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity === 0) {
      removeItem(productId);
      return;
    }
    const updatedCart = cart.map(item =>
      item._id === productId ? { ...item, quantity: newQuantity } : item
    );
    setCart(updatedCart);
    localStorage.setItem(`kioskCart_${theaterId}`, JSON.stringify(updatedCart));
  };

  const removeItem = (productId) => {
    const updatedCart = cart.filter(item => item._id !== productId);
    setCart(updatedCart);
    localStorage.setItem(`kioskCart_${theaterId}`, JSON.stringify(updatedCart));
  };

  const clearCart = () => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
      localStorage.removeItem(`kioskCart_${theaterId}`);
    }
  };

  const getItemPrice = (item) => {
    const basePrice = Number(item.pricing?.basePrice || item.pricing?.salePrice || item.basePrice || 0);
    const discountPercent = Number(item.pricing?.discountPercentage || 0);
    if (discountPercent > 0) {
      return basePrice * (1 - discountPercent / 100);
    }
    return basePrice;
  };

  // Calculate order totals using centralized utility
  const getOrderTotals = () => {
    // Map cart items to match the expected format for the utility
    const orderItems = cart.map(item => ({
      ...item,
      sellingPrice: Number(item.pricing?.basePrice || item.pricing?.salePrice || item.basePrice || 0),
      quantity: item.quantity,
      taxRate: parseFloat(item.taxRate || item.pricing?.taxRate) || 5,
      gstType: item.gstType || item.pricing?.gstType || 'EXCLUDE',
      discountPercentage: Number(item.pricing?.discountPercentage || item.discountPercentage) || 0,
      pricing: item.pricing
    }));
    
    return calculateOrderTotals(orderItems);
  };

  const orderTotals = getOrderTotals();
  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    setShowCheckoutModal(true);
  };

  const handleConfirmOrder = async () => {
    try {
      setIsProcessing(true);

      // Prepare order data for API
      const orderData = {
        theaterId: theaterId,
        customerName: customerName.trim() || 'Kiosk Customer',
        items: cart.map(item => ({
          productId: item._id,
          quantity: item.quantity,
          specialInstructions: item.notes || ''
        })),
        orderNotes: orderNotes.trim(),
        paymentMethod: paymentMethod,
        source: 'kiosk', // ✅ Explicit source to identify kiosk orders
        qrName: 'Kiosk Order', // Identifier for kiosk orders
        seat: 'Kiosk'          // Identifier for kiosk location
      };

      console.log('🛒 [KIOSK] Sending order data:', orderData);
      console.log('🛒 [KIOSK] Cart items with quantities:', cart.map(item => ({ name: item.name, quantity: item.quantity })));
      console.log('🛒 [KIOSK] Order items being sent:', orderData.items);

      // Get authentication token
      const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      if (!authToken) {
        alert('Authentication required. Please contact staff.');
        setIsProcessing(false);
        return;
      }

      // Submit order to backend API
      const response = await fetch(`${config.api.baseUrl}/orders/theater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      console.log('Order creation response:', result);

      if (!response.ok) {
        console.error('Order creation failed:', result);
        throw new Error(result.message || 'Failed to create order');
      }
      
      if (response.ok && result.success) {
        console.log('Order created successfully:', result.order);
        
        // Clear cart
        setCart([]);
        localStorage.removeItem(`kioskCart_${theaterId}`);
        
        // Show success message
        alert(`Order #${result.order.orderNumber} placed successfully!\nTotal: ₹${orderTotals.total.toFixed(2)}`);
        
        // Close modal
        setShowCheckoutModal(false);
        
        // Navigate back to products page
        navigate(`/kiosk-products/${theaterId}`);
      } else {
        throw new Error(result.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Order creation error:', error);
      alert(`Failed to place order: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="kiosk-cart-screen">
      <div className="kiosk-cart-header">
        <button className="back-to-menu-btn" onClick={() => navigate(`/kiosk-products/${theaterId}`)}>
           Back to Menu
        </button>
        <h1 className="cart-title">Your Cart</h1>
        {cart.length > 0 && (
          <button className="clear-cart-btn" onClick={clearCart}>Clear Cart</button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="empty-cart-message">
          <div className="empty-cart-icon"></div>
          <h2>Your cart is empty</h2>
          <p>Add some delicious items to get started!</p>
          <button className="continue-shopping-btn" onClick={() => navigate(`/kiosk-products/${theaterId}`)}>
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items-section">
            <h2 className="section-title">Items ({getTotalItems()})</h2>
            <div className="cart-items-list">
              {cart.map((item) => {
                const itemPrice = getItemPrice(item);
                const itemTotal = itemPrice * item.quantity;
                return (
                  <div key={item._id} className="cart-item">
                    <div className="item-image">
                      {item.images && item.images.length > 0 ? (
                        <CachedImage src={item.images[0].url || item.images[0]} alt={item.name} />
                      ) : (
                        <div className="item-placeholder"></div>
                      )}
                    </div>
                    <div className="item-details">
                      <h3 className="item-name">{item.name}</h3>
                      <p className="item-price">₹{itemPrice.toFixed(2)}</p>
                    </div>
                    <div className="item-actions">
                      <div className="quantity-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item._id, item.quantity - 1)}>−</button>
                        <span className="qty-number">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item._id, item.quantity + 1)}>+</button>
                      </div>
                      <p className="item-total">₹{itemTotal.toFixed(2)}</p>
                      <button className="remove-btn" onClick={() => removeItem(item._id)} title="Remove item">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cart-summary-section">
            <div className="cart-summary-card">
              <h2 className="summary-title">Order Summary</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <span>₹{orderTotals.subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Tax (GST)</span>
                <span>₹{orderTotals.tax.toFixed(2)}</span>
              </div>
              {orderTotals.totalDiscount > 0 && (
                <div className="summary-row discount-row">
                  <span>Discount</span>
                  <span className="discount-amount">-₹{orderTotals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="summary-divider"></div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>₹{orderTotals.total.toFixed(2)}</span>
              </div>
              <button className="checkout-btn" onClick={handleCheckout}>
                Proceed to Checkout
              </button>
              <button className="continue-btn" onClick={() => navigate(`/kiosk-products/${theaterId}`)}>
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="checkout-modal-overlay" onClick={() => !isProcessing && setShowCheckoutModal(false)}>
          <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complete Your Order</h2>
              <button 
                className="modal-close-btn" 
                onClick={() => !isProcessing && setShowCheckoutModal(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Customer Name */}
              <div className="form-group">
                <label>Customer Name (Optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isProcessing}
                />
              </div>

              {/* Payment Method */}
              <div className="form-group">
                <label>Payment Method</label>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      disabled={isProcessing}
                    />
                    <span>📱 UPI</span>
                  </label>
                </div>
              </div>

              {/* Order Notes */}
              <div className="form-group">
                <label>Special Instructions (Optional)</label>
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Any special requests?"
                  rows="3"
                  disabled={isProcessing}
                />
              </div>

              {/* Order Summary */}
              <div className="modal-order-summary">
                <h3>Order Summary</h3>
                <div className="summary-row">
                  <span>Items ({getTotalItems()})</span>
                  <span>₹{orderTotals.subtotal.toFixed(2)}</span>
                </div>
                <div className="summary-row">
                  <span>Tax (GST)</span>
                  <span>₹{orderTotals.tax.toFixed(2)}</span>
                </div>
                {orderTotals.totalDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>Discount</span>
                    <span className="discount-amount">-₹{orderTotals.totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="summary-divider"></div>
                <div className="summary-row summary-total">
                  <span>Total Amount</span>
                  <span>₹{orderTotals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="cancel-btn" 
                onClick={() => setShowCheckoutModal(false)}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button 
                className="confirm-order-btn" 
                onClick={handleConfirmOrder}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskViewCart;
