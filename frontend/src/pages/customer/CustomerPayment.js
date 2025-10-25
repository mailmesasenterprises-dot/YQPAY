import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import config from '../../config/index';
import '../../styles/customer/CustomerPayment.css';

const CustomerPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [orderSummary, setOrderSummary] = useState({
    subtotal: 0,
    tax: 0,
    total: 0
  });
  const [theaterInfo, setTheaterInfo] = useState({
    theaterName: '',
    seat: '',
    qrName: ''
  });

  const phoneNumber = location.state?.phoneNumber || '';
  const verified = location.state?.verified || false;

  useEffect(() => {
    // Redirect if not verified
    if (!phoneNumber || !verified) {
      console.log('❌ Not verified, redirecting to phone entry');
      navigate('/customer/phone-entry');
      return;
    }

    // Get cart items from localStorage or context
    loadCartData();
    
    // Check if we have theater info and cart items
    const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || 'null');
    if (!checkoutData || !checkoutData.theaterId) {
      console.warn('⚠️ No checkout data found, will need theater info when placing order');
      // Don't redirect - allow user to proceed but show warning
      const urlParams = new URLSearchParams(window.location.search);
      const theaterIdFromUrl = urlParams.get('theaterid');
      if (theaterIdFromUrl) {
        console.log('✅ Found theater ID in URL:', theaterIdFromUrl);
        // Store minimal checkout data
        localStorage.setItem('checkoutData', JSON.stringify({
          theaterId: theaterIdFromUrl,
          cartItems: JSON.parse(localStorage.getItem('cart') || '[]'),
          totals: { subtotal: 0, tax: 0, total: 0 }
        }));
        loadCartData(); // Reload with new data
      }
    }
  }, [phoneNumber, verified, navigate]);

  const loadCartData = () => {
    try {
      console.log('📦 Loading cart data...');
      // Try to get checkout data first (from new flow)
      const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || 'null');
      console.log('Checkout data:', checkoutData);
      
      if (checkoutData && checkoutData.cartItems) {
        console.log('✅ Using checkout flow data');
        // Use data from checkout flow
        setCartItems(checkoutData.cartItems);
        setOrderSummary({
          subtotal: checkoutData.totals.subtotal,
          tax: checkoutData.totals.tax,
          total: checkoutData.totals.total
        });
        // Set theater info
        setTheaterInfo({
          theaterName: checkoutData.theaterName || '',
          seat: checkoutData.seat || '',
          qrName: checkoutData.qrName || ''
        });
      } else {
        console.log('⚠️ Using fallback cart data');
        // Fallback to cart data (old flow)
        const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
        setCartItems(savedCart);
        
        // Calculate order summary
        const subtotal = savedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.05; // 5% tax
        const total = subtotal + tax;
        
        setOrderSummary({
          subtotal: subtotal,
          tax: tax,
          total: total
        });
      }
      console.log('✅ Cart data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading cart data:', err);
      setError('Error loading order details');
    }
  };

  const paymentMethods = [
    {
      id: 'upi',
      name: 'UPI Payment',
      icon: 'fas fa-mobile-alt',
      description: 'Pay using PhonePe, GPay, Paytm, etc.',
      popular: true
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: 'fas fa-credit-card',
      description: 'Visa, Mastercard, RuPay, etc.'
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      icon: 'fas fa-university',
      description: 'All major banks supported'
    }
  ];

  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
    setError('');
  };

  const handlePayNow = async () => {
    console.log('🔥 Pay Now clicked!');
    console.log('Selected payment method:', selectedPaymentMethod);
    console.log('Cart items:', cartItems);
    
    if (!selectedPaymentMethod) {
      console.error('❌ No payment method selected');
      setError('Please select a payment method');
      return;
    }

    if (cartItems.length === 0) {
      console.error('❌ Cart is empty');
      setError('Your cart is empty');
      return;
    }

    console.log('✅ Starting payment process...');
    setLoading(true);
    setError('');

    try {
      // Get checkout data for theater info
      const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || '{}');
      console.log('📦 Checkout data:', checkoutData);
      
      let theaterId = checkoutData.theaterId;
      console.log('🎭 Theater ID from checkout:', theaterId);
      
      // If no theater ID, try to get from URL or cart
      if (!theaterId) {
        console.warn('⚠️ No theater ID in checkout data, trying URL params...');
        const urlParams = new URLSearchParams(window.location.search);
        theaterId = urlParams.get('theaterid');
        console.log('🎭 Theater ID from URL:', theaterId);
        
        if (!theaterId) {
          // Try to get from stored cart data
          const cart = JSON.parse(localStorage.getItem('cart') || '[]');
          if (cart.length > 0 && cart[0].theaterId) {
            theaterId = cart[0].theaterId;
            console.log('🎭 Theater ID from cart:', theaterId);
          }
        }
      }
      
      if (!theaterId) {
        console.error('❌ No theater ID found anywhere');
        setError('Unable to process order. Please scan QR code and add items to cart first.');
        setLoading(false);
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          window.location.href = '/customer/home';
        }, 3000);
        return;
      }

      console.log('✅ Using theater ID:', theaterId);

      // Prepare order items for backend
      const orderItems = cartItems.map(item => ({
        productId: item._id, // Product ID from cart
        quantity: item.quantity
      }));

      // Create order in backend
      const orderPayload = {
        theaterId: theaterId,
        customerName: phoneNumber, // Using phone as customer identifier
        customerInfo: {
          name: 'Customer',
          phone: phoneNumber
        },
        tableNumber: checkoutData.seat || checkoutData.qrName || 'Online Order',
        items: orderItems,
        paymentMethod: selectedPaymentMethod
      };

      console.log('📝 Creating order with payload:', orderPayload);

      console.log('🌐 Backend URL:', config.api.baseUrl);

      // Call backend API to create order
      const response = await fetch(`${config.api.baseUrl}/orders/theater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const backendOrder = await response.json();
      console.log('Order created successfully:', backendOrder);
      
      // Save theater info before clearing (for success page navigation)
      const theaterInfo = {
        theaterId: checkoutData.theaterId,
        theaterName: checkoutData.theaterName,
        qrName: checkoutData.qrName,
        seat: checkoutData.seat
      };
      
      // Create order object for success page
      const orderData = {
        orderId: backendOrder.orderNumber || `ORD${Date.now()}`,
        phoneNumber,
        items: cartItems,
        summary: orderSummary,
        paymentMethod: selectedPaymentMethod,
        timestamp: new Date().toISOString(),
        backendOrderId: backendOrder._id,
        theaterInfo: theaterInfo // Include theater info for navigation
      };

      // Clear cart and checkout data
      localStorage.removeItem('cart');
      localStorage.removeItem('checkoutData');
      localStorage.removeItem('yqpay_cart'); // Also clear the cart context storage
      clearCart(); // Clear cart context
      
      // Navigate to success page
      navigate('/customer/order-success', { 
        state: { 
          order: orderData,
          fromPayment: true 
        }
      });
    } catch (err) {
      console.error('Order creation error:', err);
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/customer/otp-verification', { state: { phoneNumber } });
  };

  const formatPrice = (price) => {
    return `₹${price.toFixed(2)}`;
  };

  const formatPhoneNumber = (phone) => {
    if (phone.startsWith('+91')) {
      const number = phone.slice(3);
      return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
    }
    return phone;
  };

  return (
    <div className="payment-page">
      <div className="payment-header">
        <button 
          className="back-button"
          onClick={handleBack}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="payment-title">Payment</h1>
      </div>

      <div className="payment-content">
        {/* Order Summary Section */}
        <div className="order-summary-section">
          <h3 className="section-title">Order Summary</h3>
          
          {/* Theater Details */}
          {theaterInfo.theaterName && (
            <div className="theater-details-box">
              <div className="theater-detail-item">
                <span className="detail-label">Theater:</span>
                <span className="detail-value">{theaterInfo.theaterName}</span>
              </div>
              {theaterInfo.qrName && (
                <div className="theater-detail-item">
                  <span className="detail-label">Screen:</span>
                  <span className="detail-value">{theaterInfo.qrName}</span>
                </div>
              )}
              {theaterInfo.seat && (
                <div className="theater-detail-item">
                  <span className="detail-label">Seat:</span>
                  <span className="detail-value">{theaterInfo.seat}</span>
                </div>
              )}
            </div>
          )}

          <div className="summary-row total-row">
            <span className="summary-label">Total Amount</span>
            <span className="summary-value">{formatPrice(orderSummary.total)}</span>
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="payment-methods-section">
          <h3 className="section-title">Choose Payment Method</h3>
          
          <div className="payment-methods">
            {paymentMethods.map((method) => (
              <div 
                key={method.id}
                className={`payment-method ${selectedPaymentMethod === method.id ? 'selected' : ''}`}
                onClick={() => handlePaymentMethodSelect(method.id)}
              >
                <div className="payment-icon">
                  {method.id === 'upi' && '📱'}
                  {method.id === 'card' && '💳'}
                  {method.id === 'netbanking' && '🏦'}
                  {method.id === 'wallet' && '👛'}
                  {method.id === 'cash' && '💵'}
                </div>
                <div className="payment-info">
                  <div className="payment-name">{method.name}</div>
                  <div className="payment-description">{method.description}</div>
                </div>
                <div className="payment-radio"></div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Pay Now Button */}
        <button 
          className="pay-now-button"
          onClick={handlePayNow}
          disabled={loading || !selectedPaymentMethod || cartItems.length === 0}
        >
          {loading ? 'Processing Payment...' : `Pay ${formatPrice(orderSummary.total)}`}
        </button>
        
        <div className="security-badge">
          Your payment information is secure and encrypted
        </div>
      </div>
    </div>
  );
};

export default CustomerPayment;