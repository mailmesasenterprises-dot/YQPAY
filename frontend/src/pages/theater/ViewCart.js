import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import config from '../../config';
import '../../styles/ViewCart.css';

const ViewCart = () => {
  const { theaterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  console.log('🛒 ViewCart loaded with:', { 
    theaterId, 
    locationState: location.state,
    pathname: location.pathname 
  });

  // Extract qrName and seat from URL parameters or cart data
  const urlParams = new URLSearchParams(location.search);
  const qrName = urlParams.get('qrname') || cartData?.qrName || null;
  const seat = urlParams.get('seat') || cartData?.seat || null;
  
  console.log('🔍 Extracted values:', { qrName, seat });
  
  // Get cart data from React Router state or sessionStorage fallback
  const getCartData = () => {
    console.log('🔍 Looking for cart data...');
    
    // First try React Router state
    if (location.state && location.state.items) {
      console.log('✅ Found cart data in location.state:', location.state);
      return location.state;
    }
    
    // Fallback to sessionStorage
    const storedData = sessionStorage.getItem('cartData');
    console.log('📦 Checking sessionStorage:', storedData);
    
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        console.log('✅ Found cart data in sessionStorage:', parsed);
        return parsed;
      } catch (e) {
        console.error('❌ Error parsing stored cart data:', e);
      }
    }
    
    console.log('❌ No cart data found');
    return {};
  };
  
  const [cartData, setCartData] = useState(getCartData());
  const [orderNotes, setOrderNotes] = useState(cartData?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [customerName, setCustomerName] = useState(cartData?.customerName || '');
  
  // Modal state for order confirmation
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  
  // Debug log cart data on component load
  console.log('🛒 ViewCart component loaded with cartData:', cartData);
  
  // Refresh cart data on component mount
  useEffect(() => {
    const refreshedData = getCartData();
    if (refreshedData && refreshedData.items && refreshedData.items.length > 0) {
      setCartData(refreshedData);
      setOrderNotes(refreshedData.notes || '');
      console.log('🔄 Refreshed cart data:', refreshedData);
    }
  }, [location.pathname, theaterId]);

  // Calculate totals with dynamic GST and product discounts
  const { subtotal, tax, total, totalDiscount } = useMemo(() => {
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;
    
    (cartData.items || []).forEach(item => {
      const originalPrice = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const gstType = item.gstType || 'EXCLUDE';
      const discountPercentage = parseFloat(item.discountPercentage || item.pricing?.discountPercentage) || 0;
      
      // Apply product discount to get final price
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;
      
      const discountAmount = (originalPrice - discountedPrice) * qty;
      calculatedDiscount += discountAmount;
      
      const lineTotal = discountedPrice * qty;
      
      if (gstType === 'INCLUDE') {
        // Price already includes GST, extract the GST amount
        const basePrice = lineTotal / (1 + (taxRate / 100));
        const gstAmount = lineTotal - basePrice;
        calculatedSubtotal += basePrice;
        calculatedTax += gstAmount;
      } else {
        // GST EXCLUDE - add GST on top of price
        const gstAmount = lineTotal * (taxRate / 100);
        calculatedSubtotal += lineTotal;
        calculatedTax += gstAmount;
      }
    });
    
    const calculatedTotal = calculatedSubtotal + calculatedTax;
    
    return {
      subtotal: parseFloat(calculatedSubtotal.toFixed(2)),
      tax: parseFloat(calculatedTax.toFixed(2)),
      total: parseFloat(calculatedTotal.toFixed(2)),
      totalDiscount: parseFloat(calculatedDiscount.toFixed(2))
    };
  }, [cartData.items]);

  // Handle modal close and navigation
  const handleModalClose = () => {
    setShowSuccessModal(false);
    setOrderDetails(null);
    
    // Navigate back to order interface with success state
    navigate(`/theater-order/${theaterId}`, { 
      state: { 
        orderSuccess: true, 
        orderNumber: orderDetails?.orderNumber,
        clearCart: true 
      } 
    });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const handleConfirmOrder = async () => {
    try {
      setIsLoading(true);
      console.log('🚀 Confirming order with data:', cartData);
      
      // Validate customer name
      if (!customerName || !customerName.trim()) {
        alert('Please enter customer name');
        setIsLoading(false);
        return;
      }

      // Validate payment method
      if (!paymentMethod) {
        alert('Please select a payment method');
        setIsLoading(false);
        return;
      }

      console.log('📦 Submitting order with:', {
        customerName: customerName.trim(),
        items: cartData.items,
        paymentMethod: paymentMethod,
        orderNotes: orderNotes
      });

      console.log('🔍 Detailed cart items:', cartData.items.map(item => ({
        id: item._id,
        name: item.name,
        price: item.sellingPrice,
        quantity: item.quantity
      })));

      // Prepare order data for API
      const orderData = {
        theaterId: theaterId, // Required by backend validation
        customerName: customerName.trim(),
        items: cartData.items.map(item => ({
          productId: item._id,
          quantity: item.quantity,
          specialInstructions: item.notes || ''
        })),
        orderNotes: orderNotes.trim(),
        paymentMethod: paymentMethod,
        qrName: qrName,  // ✅ Include QR Name
        seat: seat       // ✅ Include Seat
      };

      console.log('📦 Order data being sent:', orderData);

      // Get authentication token with auto-login fallback
      let authToken = getAuthToken();
      if (!authToken) {
        console.log('🔑 No token found, attempting auto-login...');
        authToken = await autoLogin();
        if (!authToken) {
          alert('Authentication required. Please login.');
          setIsLoading(false);
          navigate('/theater-login');
          return;
        }
      }
      
      console.log('🔐 Using auth token for API call');

      // Submit order to backend API
      console.log('🌐 Making API call to /api/orders/theater');
      const response = await fetch(`${config.api.baseUrl}/orders/theater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();
      console.log('📡 API Response Status:', response.status);
      console.log('📡 API Response:', result);
      
      if (!response.ok) {
        console.error('❌ API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          details: result.details
        });
      }
      
      if (response.ok && result.success) {
        console.log('✅ Order created successfully:', result.order);
        
        // Clear cart data from sessionStorage
        sessionStorage.removeItem('cartData');
        
        // Store order details and show success modal
        setOrderDetails(result.order);
        setShowSuccessModal(true);
        
        // Navigate back to order interface with success state
        navigate(`/theater-order/${theaterId}`, { 
          state: { 
            orderSuccess: true, 
            orderNumber: result.order.orderNumber,
            clearCart: true 
          } 
        });
        
      } else {
        console.error('❌ Order creation failed:', result);
        const errorMessage = result.error || result.message || 'Failed to create order';
        const errorDetails = result.details ? '\n\nDetails: ' + JSON.stringify(result.details, null, 2) : '';
        alert(`Order Failed: ${errorMessage}${errorDetails}`);
      }
      
    } catch (error) {
      console.error('❌ Network error confirming order:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = () => {
    // Navigate back to order interface with current cart data
    navigate(`/theater-order/${theaterId}`, { 
      state: { 
        cartItems: cartData.items,
        customerName: customerName 
      } 
    });
  };

  if (!cartData.items || cartData.items.length === 0) {
    return (
      <TheaterLayout pageTitle="View Cart" currentPage="order-interface">
        <div className="empty-cart">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Add some items to your cart to proceed</p>
          <button 
            className="back-to-menu-btn"
            onClick={() => navigate(`/theater-order/${theaterId}`)}
          >
            Back to Menu
          </button>
        </div>
      </TheaterLayout>
    );
  }

  return (
    <TheaterLayout pageTitle="View Cart" currentPage="order-interface">
      {/* Header */}
      <div className="view-cart-header">
        <h1 className="cart-title">Review Your Order</h1>
        <div className="customer-info">
          <label className="customer-label">Customer Name:</label>
          <input 
            type="text"
            className="customer-name-input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter customer name"
            required
          />
        </div>
      </div>

        <div className="cart-content">
          {/* Left Section - Order Items */}
          <div className="cart-items-section">
            <div className="items-header">
              <h2>Order Items ({cartData.items.length})</h2>
              <button className="edit-order-btn" onClick={handleEditOrder}>
                Edit Order
              </button>
            </div>
            
            <div className="cart-items-list">
              {cartData.items.map((item, index) => (
                <div key={item._id || index} className="cart-item">
                  <div className="item-image">
                    {item.productImage ? (
                      <img 
                        src={item.productImage} 
                        alt={item.name}
                        loading="eager"
                        decoding="async"
                        style={{imageRendering: 'auto'}}
                      />
                    ) : (
                      <div className="placeholder-image">🍽️</div>
                    )}
                  </div>
                  
                  <div className="item-details">
                    <h3 className="item-name">{item.name}</h3>
                    <div className="item-price">
                      {formatPrice(item.sellingPrice)} each
                    </div>
                  </div>
                  
                  <div className="item-quantity">
                    <span className="quantity-label">Qty:</span>
                    <span className="quantity-value">{item.quantity}</span>
                  </div>
                  
                  <div className="item-total">
                    {formatPrice(item.sellingPrice * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Notes */}
            <div className="order-notes-section">
              <h3>Order Notes</h3>
              <textarea
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Add any special instructions for your order..."
                className="order-notes-textarea"
                rows="3"
              />
            </div>
          </div>

          {/* Right Section - Order Summary */}
          <div className="order-summary-section">
            <div className="summary-card">
              <h2 className="summary-title">Order Summary</h2>
              
              <div className="summary-details">
                <div className="summary-row">
                  <span>Subtotal:</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Tax (GST):</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="summary-row discount-row">
                    <span>Discount:</span>
                    <span className="discount-amount">-{formatPrice(totalDiscount)}</span>
                  </div>
                )}
                <div className="summary-divider"></div>
                <div className="summary-row total-row">
                  <span>Total Amount:</span>
                  <span className="total-amount">{formatPrice(total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="payment-section">
                <h3>Payment Method</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>Cash Payment</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="payment"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>Card Payment</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    <span>UPI Payment</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="cart-actions">
                <button 
                  className="continue-shopping-btn"
                  onClick={handleEditOrder}
                >
                  Continue Shopping
                </button>
                <button 
                  className="confirm-order-btn"
                  onClick={handleConfirmOrder}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing Order...' : 'Confirm Order'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Success Modal */}
        {showSuccessModal && orderDetails && (
          <div className="modal-overlay" onClick={handleModalClose}>
            <div className="success-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>✅ Order Confirmed Successfully!</h2>
              </div>
              <div className="modal-content">
                <div className="order-info">
                  <p><strong>Order Number:</strong> {orderDetails.orderNumber}</p>
                  <p><strong>Customer:</strong> {orderDetails.customerName}</p>
                  <p><strong>Total:</strong> ₹{orderDetails.total}</p>
                  <p><strong>Payment:</strong> {orderDetails.paymentMethod.toUpperCase()}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button className="modal-ok-btn" onClick={handleModalClose}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

    </TheaterLayout>
  );
};

export default ViewCart;