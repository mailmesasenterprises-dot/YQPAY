import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import OfflineStatusBadge from '../../components/OfflineStatusBadge';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import { getImageSrc } from '../../utils/globalImageCache'; // 🚀 Instant image loading
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import config from '../../config';
import '../../styles/ViewCart.css';

const ViewCart = () => {
  const { theaterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Offline queue support
  const { addOrder, connectionStatus, pendingCount, lastSyncTime } = useOfflineQueue();

  // Determine which page to highlight in sidebar based on where we came from
  // Check location.state.source first, then URL parameter, then default to 'order-interface'
  const urlParams = new URLSearchParams(location.search);
  const source = location.state?.source || urlParams.get('source') || 'order-interface';
  const currentPage = source;


  // Get cart data from React Router state or sessionStorage fallback
  const getCartData = () => {

    // First try React Router state
    if (location.state && location.state.items) {

      return location.state;
    }
    
    // Fallback to sessionStorage
    const storedData = sessionStorage.getItem('cartData');

    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);

        return parsed;
      } catch (e) {
  }
    }
    

    return {};
  };
  
  const [cartData, setCartData] = useState(getCartData());
  const [orderNotes, setOrderNotes] = useState(cartData?.notes || '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [customerName, setCustomerName] = useState(cartData?.customerName || '');
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  
  // Extract qrName and seat from URL parameters or cart data (reuse urlParams from above)
  const qrName = urlParams.get('qrname') || cartData?.qrName || null;
  const seat = urlParams.get('seat') || cartData?.seat || null;
  
  // Determine order type based on source (kiosk vs online channel)
  const getOrderType = () => {
    if (source === 'order-interface' || source === 'offline-pos') {
      return 'pos'; // Uses kiosk channel
    } else if (source === 'online-pos') {
      return 'online'; // Uses online channel
    }
    return 'pos'; // Default to kiosk for theater orders
  };
  
  // Determine channel for payment gateway
  const getChannel = () => {
    return getOrderType() === 'pos' ? 'kiosk' : 'online';
  };
  

  // Modal state for order confirmation
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  
  // Debug log cart data on component load

  // Refresh cart data on component mount
  useEffect(() => {
    const refreshedData = getCartData();
    if (refreshedData && refreshedData.items && refreshedData.items.length > 0) {
      setCartData(refreshedData);
      setOrderNotes(refreshedData.notes || '');
  }
  }, [location.pathname, theaterId]);

  // Fetch payment gateway configuration
  useEffect(() => {
    const fetchGatewayConfig = async () => {
      try {
        setGatewayLoading(true);
        const channel = getChannel();
        const response = await fetch(`${config.api.baseUrl}/payments/config/${theaterId}/${channel}`);
        const data = await response.json();
        
        if (data.success) {
          console.log(`✅ Gateway config loaded for ${channel}:`, data.config);
          setGatewayConfig(data.config);
        } else {
          console.warn('⚠️ No gateway config available');
          setGatewayConfig(null);
        }
      } catch (error) {
        console.error('❌ Error fetching gateway config:', error);
        setGatewayConfig(null);
      } finally {
        setGatewayLoading(false);
      }
    };
    
    if (theaterId) {
      fetchGatewayConfig();
    }
  }, [theaterId]);


  // Calculate totals with dynamic GST and product discounts
  const { subtotal, tax, total, totalDiscount } = useMemo(() => {
    let calculatedSubtotal = 0;
    let calculatedTax = 0;
    let calculatedDiscount = 0;
    
    (cartData.items || []).forEach(item => {
      // Use originalPrice if available, otherwise sellingPrice
      // sellingPrice from OfflinePOS is already discounted
      const originalPrice = parseFloat(item.originalPrice || item.sellingPrice) || 0;
      const sellingPrice = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const gstType = item.gstType || 'EXCLUDE';
      const discountPercentage = parseFloat(item.discountPercentage || item.pricing?.discountPercentage) || 0;
      
      // Calculate discount based on original vs selling price
      const discountAmount = (originalPrice - sellingPrice) * qty;
      calculatedDiscount += discountAmount;
      
      // Use the already-discounted selling price for calculations
      const lineTotal = sellingPrice * qty;
      
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
    
    // Navigate back to appropriate page based on source
    const redirectPath = source === 'online-pos' 
      ? `/online-pos/${theaterId}`
      : `/theater-order/${theaterId}`;
    
    navigate(redirectPath, { 
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

  // ============================================
  // PAYMENT GATEWAY INTEGRATION FUNCTIONS
  // ============================================

  /**
   * Razorpay Payment Integration
   */
  const initiateRazorpayPayment = async (paymentOrder, orderId, orderNumber, authToken) => {
    return new Promise((resolve, reject) => {
      if (!window.Razorpay) {
        reject(new Error('Razorpay SDK not loaded. Please refresh the page.'));
        return;
      }

      const options = {
        key: gatewayConfig.razorpay?.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || 'INR',
        name: 'YQ PAY NOW',
        description: `Order #${orderNumber}`,
        order_id: paymentOrder.id,
        handler: async function(response) {
          try {
            console.log('✅ Razorpay payment success:', response);
            
            // Verify payment
            const verifyResponse = await fetch(`${config.api.baseUrl}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                orderId: orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                razorpayOrderId: response.razorpay_order_id,
                transactionId: paymentOrder.transactionId
              })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
              console.log('✅ Payment verified successfully');
              resolve(verifyData);
            } else {
              reject(new Error('Payment verification failed'));
            }
          } catch (error) {
            console.error('❌ Payment verification error:', error);
            reject(error);
          }
        },
        modal: {
          ondismiss: function() {
            reject(new Error('Payment cancelled by user'));
          }
        },
        theme: {
          color: '#6B0E9B'
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
    });
  };

  /**
   * Paytm Payment Integration
   */
  const initiatePaytmPayment = async (paymentOrder, orderId, orderNumber, authToken) => {
    return new Promise((resolve, reject) => {
      // Display Paytm payment information
      const paytmInfo = `
🔷 Paytm Payment Details 🔷

Order Number: ${orderNumber}
Amount: ₹${(paymentOrder.amount / 100).toFixed(2)}

Transaction ID: ${paymentOrder.txnToken}
Merchant Order ID: ${paymentOrder.orderId}

Test Mode: ${gatewayConfig.paytm?.testMode ? 'YES' : 'NO'}

Instructions:
1. Use Paytm app to scan QR code (if available)
2. Or enter transaction ID in Paytm app
3. Complete payment using UPI/Card/Wallet

Status: Processing...
      `.trim();

      const confirmed = window.confirm(paytmInfo + '\n\nClick OK after completing payment, or Cancel to abort.');
      
      if (confirmed) {
        // In production, you would verify payment status here
        // For now, we'll simulate success
        setTimeout(async () => {
          try {
            // Verify payment with backend
            const verifyResponse = await fetch(`${config.api.baseUrl}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                orderId: orderId,
                transactionId: paymentOrder.transactionId,
                paytmOrderId: paymentOrder.orderId
              })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
              console.log('✅ Paytm payment verified');
              resolve(verifyData);
            } else {
              reject(new Error('Payment verification failed'));
            }
          } catch (error) {
            console.error('❌ Paytm verification error:', error);
            reject(error);
          }
        }, 1000);
      } else {
        reject(new Error('Payment cancelled by user'));
      }
    });
  };

  /**
   * PhonePe Payment Integration
   */
  const initiatePhonePePayment = async (paymentOrder, orderId, orderNumber, authToken) => {
    return new Promise((resolve, reject) => {
      // Display PhonePe payment information
      const phonePeInfo = `
📱 PhonePe Payment Details 📱

Order Number: ${orderNumber}
Amount: ₹${(paymentOrder.amount / 100).toFixed(2)}

Merchant Transaction ID: ${paymentOrder.merchantTransactionId}
Test Mode: ${gatewayConfig.phonepe?.testMode ? 'YES' : 'NO'}

Instructions:
1. Open PhonePe app
2. Scan QR code or use UPI ID
3. Complete payment

Status: Processing...
      `.trim();

      const confirmed = window.confirm(phonePeInfo + '\n\nClick OK after completing payment, or Cancel to abort.');
      
      if (confirmed) {
        setTimeout(async () => {
          try {
            // Verify payment with backend
            const verifyResponse = await fetch(`${config.api.baseUrl}/payments/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                orderId: orderId,
                transactionId: paymentOrder.transactionId,
                merchantTransactionId: paymentOrder.merchantTransactionId
              })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
              console.log('✅ PhonePe payment verified');
              resolve(verifyData);
            } else {
              reject(new Error('Payment verification failed'));
            }
          } catch (error) {
            console.error('❌ PhonePe verification error:', error);
            reject(error);
          }
        }, 1000);
      } else {
        reject(new Error('Payment cancelled by user'));
      }
    });
  };

  // ============================================
  // ORDER CONFIRMATION HANDLER
  // ============================================

  const handleConfirmOrder = async () => {
    try {
      setIsLoading(true);

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

      // Check if offline - queue the order instead
      if (connectionStatus === 'offline') {
        try {
          const offlineOrderData = {
            theaterId: theaterId,
            items: cartData.items.map(item => ({
              product: item._id,
              name: item.name,
              quantity: item.quantity,
              price: item.sellingPrice,
              originalPrice: item.originalPrice || item.sellingPrice,
              discountPercentage: item.discountPercentage || 0,
              taxRate: item.taxRate || 0,
              gstType: item.gstType || 'EXCLUDE'
            })),
            customerName: customerName.trim(),
            notes: orderNotes.trim(),
            paymentMethod: paymentMethod,
            qrName: qrName,
            seat: seat,
            subtotal: subtotal,
            tax: tax,
            totalDiscount: totalDiscount,
            total: total,
            orderType: 'OFFLINE_POS',
            status: 'PENDING',
            createdAt: new Date().toISOString()
          };

          // Add to offline queue
          const queuedOrder = addOrder(offlineOrderData);
          
          // Clear cart data from sessionStorage
          sessionStorage.removeItem('cartData');
          
          // Show success message
          alert(`✅ Order Queued Offline!\n\nOrder will be synced when connection is restored.\n\nQueue ID: ${queuedOrder.queueId}\n\nCustomer: ${customerName}\nTotal: ₹${total.toFixed(2)}`);
          
          // Navigate back to appropriate page based on source
          const redirectPath = source === 'online-pos' 
            ? `/online-pos/${theaterId}`
            : source === 'offline-pos'
            ? `/offline-pos/${theaterId}`
            : `/theater-order/${theaterId}`;
          
          navigate(redirectPath, { 
            state: { 
              orderSuccess: true,
              offlineQueue: true,
              clearCart: true 
            } 
          });
          
          return;
        } catch (error) {
          console.error('Error queuing offline order:', error);
          alert('Failed to queue offline order: ' + error.message);
          setIsLoading(false);
          return;
        }
      }

      // Online mode - proceed with normal API call
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
        orderType: getOrderType(), // ✅ Add order type for channel detection
        qrName: qrName,  // ✅ Include QR Name
        seat: seat       // ✅ Include Seat
      };


      // Get authentication token with auto-login fallback
      let authToken = getAuthToken();
      if (!authToken) {

        authToken = await autoLogin();
        if (!authToken) {
          alert('Authentication required. Please login.');
          setIsLoading(false);
          navigate('/theater-login');
          return;
        }
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

      if (!response.ok) {
        const errorMessage = result.error || result.message || 'Failed to create order';
        const errorDetails = result.details ? '\n\nDetails: ' + JSON.stringify(result.details, null, 2) : '';
        alert(`Order Failed: ${errorMessage}${errorDetails}`);
        setIsLoading(false);
        return;
      }
      
      if (response.ok && result.success) {
        const orderId = result.order._id;
        const orderNumber = result.order.orderNumber;

        // ✅ If non-cash payment and gateway enabled, initiate payment
        if (paymentMethod !== 'cash' && gatewayConfig?.isEnabled) {
          try {
            console.log(`💳 Initiating ${paymentMethod} payment for order ${orderId}`);
            
            // Create payment order
            const paymentResponse = await fetch(`${config.api.baseUrl}/payments/create-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({ 
                orderId: orderId,
                paymentMethod: paymentMethod
              })
            });
            
            const paymentData = await paymentResponse.json();
            
            if (!paymentData.success) {
              throw new Error(paymentData.message || 'Failed to initialize payment');
            }
            
            console.log(`✅ Payment order created:`, paymentData);
            
            // Show payment UI based on provider
            const provider = paymentData.provider;
            
            if (provider === 'razorpay') {
              await initiateRazorpayPayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else if (provider === 'paytm') {
              await initiatePaytmPayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else if (provider === 'phonepe') {
              await initiatePhonePePayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else {
              throw new Error(`Unsupported payment provider: ${provider}`);
            }
            
            // Payment success - clear cart and show success
            sessionStorage.removeItem('cartData');
            setOrderDetails(result.order);
            setShowSuccessModal(true);
            
            const redirectPath = source === 'online-pos' 
              ? `/online-pos/${theaterId}`
              : `/theater-order/${theaterId}`;
            
            navigate(redirectPath, { 
              state: { 
                orderSuccess: true, 
                orderNumber: orderNumber,
                clearCart: true 
              } 
            });
            
          } catch (paymentError) {
            console.error('❌ Payment error:', paymentError);
            alert(`Payment Failed: ${paymentError.message}\n\nPlease try again or use cash payment.`);
            setIsLoading(false);
            return;
          }
        } else {
          // ✅ Cash payment - show success directly
          sessionStorage.removeItem('cartData');
          setOrderDetails(result.order);
          setShowSuccessModal(true);
          
          const redirectPath = source === 'online-pos' 
            ? `/online-pos/${theaterId}`
            : `/theater-order/${theaterId}`;
          
          navigate(redirectPath, { 
            state: { 
              orderSuccess: true, 
              orderNumber: orderNumber,
              clearCart: true 
            } 
          });
        }
        
      } else {

        const errorMessage = result.error || result.message || 'Failed to create order';
        const errorDetails = result.details ? '\n\nDetails: ' + JSON.stringify(result.details, null, 2) : '';
        alert(`Order Failed: ${errorMessage}${errorDetails}`);
      }
      
    } catch (error) {

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
      <TheaterLayout pageTitle="View Cart" currentPage={currentPage}>
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
    <TheaterLayout pageTitle="View Cart" currentPage={currentPage}>
      {/* Inline CSS for Status Header */}
      <style jsx>{`
        .view-cart-status-header {
          background: linear-gradient(135deg, #6B0E9B 0%, #8B2FB8 100%);
          padding: 16px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        .view-cart-title-main {
          color: white;
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }
        .view-cart-status-inline {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .view-cart-status-item {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .view-cart-status-label {
          color: rgba(255,255,255,0.8);
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .view-cart-status-value {
          color: white;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .view-cart-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .view-cart-status-badge.online {
          background: rgba(16, 185, 129, 0.2);
          color: #10B981;
          border: 2px solid #10B981;
        }
        .view-cart-status-badge.offline {
          background: rgba(239, 68, 68, 0.2);
          color: #EF4444;
          border: 2px solid #EF4444;
        }
        .view-cart-status-icon {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .view-cart-status-icon.online {
          background: #10B981;
        }
        .view-cart-status-icon.offline {
          background: #EF4444;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      {/* Status Header */}
      <div className="view-cart-status-header">
        <h1 className="view-cart-title-main">View Cart</h1>
        <div className="view-cart-status-inline">
          <div className="view-cart-status-item">
            <span className="view-cart-status-label">Connection</span>
            <div className={`view-cart-status-badge ${connectionStatus}`}>
              <span className={`view-cart-status-icon ${connectionStatus}`}></span>
              {connectionStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <div className="view-cart-status-item">
            <span className="view-cart-status-label">Pending Orders</span>
            <div className="view-cart-status-value">
              🔄 {pendingCount || 0}
            </div>
          </div>
          <div className="view-cart-status-item">
            <span className="view-cart-status-label">Last Sync</span>
            <div className="view-cart-status-value">
              {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </div>
      </div>
      
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
              {cartData.items.map((item, index) => {
                // Get the correct image URL WITH INSTANT CACHE CHECK
                let imageUrl = null;
                if (item.images && Array.isArray(item.images) && item.images.length > 0) {
                  const firstImage = item.images[0];
                  imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
                } else if (item.productImage) {
                  imageUrl = item.productImage;
                } else if (item.image) {
                  imageUrl = item.image;
                }
                
                // 🚀 INSTANT: Get cached base64 or original URL
                const displayImageUrl = imageUrl ? getImageSrc(imageUrl) : null;
                
                return (
                <div key={item._id || index} className="cart-item">
                  <div className="item-image">
                    {displayImageUrl ? (
                      <img 
                        src={displayImageUrl} 
                        alt={item.name}
                        loading="eager"
                        decoding="async"
                        style={{imageRendering: 'auto'}}
                        onError={(e) => {

                          e.target.style.display = 'none';
                          const placeholder = e.target.parentElement.querySelector('.placeholder-image');
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className="placeholder-image" style={{ display: imageUrl ? 'none' : 'flex' }}>🍽️</div>
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
                );
              })}
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
                {gatewayLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    Loading payment options...
                  </div>
                ) : (
                  <div className="payment-options">
                    <label className="payment-option">
                      <input
                        type="radio"
                        name="payment"
                        value="cash"
                        checked={paymentMethod === 'cash'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      />
                      <span>Cash Payment ✅</span>
                    </label>
                    <label className={`payment-option ${!gatewayConfig?.isEnabled ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={!gatewayConfig?.isEnabled}
                      />
                      <span>
                        Card Payment 
                        {gatewayConfig?.isEnabled ? ' ✅' : ' ❌ (Not Available)'}
                      </span>
                    </label>
                    <label className={`payment-option ${!gatewayConfig?.isEnabled ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        value="upi"
                        checked={paymentMethod === 'upi'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={!gatewayConfig?.isEnabled}
                      />
                      <span>
                        UPI Payment 
                        {gatewayConfig?.isEnabled ? ' ✅' : ' ❌ (Not Available)'}
                      </span>
                    </label>
                    {gatewayConfig?.isEnabled && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#10B981', 
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '6px'
                      }}>
                        💳 Using {gatewayConfig.provider.toUpperCase()} gateway ({getChannel()} channel)
                      </div>
                    )}
                  </div>
                )}
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
                  {isLoading 
                    ? 'Processing Order...' 
                    : connectionStatus === 'offline' 
                    ? '📶 Queue Order (Offline)' 
                    : 'Confirm Order'}
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