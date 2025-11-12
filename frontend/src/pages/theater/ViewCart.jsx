import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import OfflineStatusBadge from '../../components/OfflineStatusBadge';
import { getAuthToken, autoLogin } from '../../utils/authHelper';
import { getImageSrc } from '../../utils/globalImageCache'; // 🚀 Instant image loading
import { calculateOrderTotals } from '../../utils/orderCalculation'; // 📊 Centralized calculation
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { loadRazorpayScript } from '../../utils/razorpayLoader'; // 💳 Razorpay script loader
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/ViewCart.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



const ViewCart = () => {
  const { theaterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Offline queue support
  const { addOrder, connectionStatus, pendingCount, lastSyncTime } = useOfflineQueue();

  // Determine which page to highlight in sidebar based on where we came from
  // Check location.state.source first, then URL parameter, then default to 'pos'
  const urlParams = new URLSearchParams(location.search);
  const source = location.state?.source || urlParams.get('source') || 'pos';
  const currentPage = source === 'pos' ? 'online-pos' : source; // Map 'pos' to 'online-pos' for sidebar highlight


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
  const [customerName, setCustomerName] = useState(cartData?.customerName || 'POS Customer');
  const [gatewayConfig, setGatewayConfig] = useState(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  
  // Extract qrName and seat from URL parameters or cart data (reuse urlParams from above)
  const qrName = urlParams.get('qrname') || cartData?.qrName || null;
  const seat = urlParams.get('seat') || cartData?.seat || null;
  
  // Determine order type based on source (kiosk vs online channel)
  const getOrderType = () => {
    if (source === 'offline-pos') {
      return 'pos'; // Uses kiosk channel
    } else if (source === 'pos' || source === 'online-pos') {
      return 'online'; // Uses online channel
    }
    return 'online'; // Default to online for pos
  };
  
  // Determine channel for payment gateway
  const getChannel = () => {
    return getOrderType() === 'pos' ? 'kiosk' : 'online';
  };
  
  // Helper function to get redirect path based on source
  const getRedirectPath = () => {
    if (source === 'pos' || source === 'online-pos') {
      return `/pos/${theaterId}`;
    } else if (source === 'offline-pos') {
      return `/offline-pos/${theaterId}`;
    } else {
      return `/pos/${theaterId}`; // Default to pos since theater-order route is removed
    }
  };
  

  // Modal state for order confirmation
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  
  // Theater info for receipts
  const [theaterInfo, setTheaterInfo] = useState(null);
  
  // Debug log cart data on component load

  // Refresh cart data on component mount
  useEffect(() => {
    const refreshedData = getCartData();
    if (refreshedData && refreshedData.items && refreshedData.items.length > 0) {
      setCartData(refreshedData);
      setOrderNotes(refreshedData.notes || '');
  }
  }, [location.pathname, theaterId]);

  // Fetch theater information for receipts
  useEffect(() => {
    const fetchTheaterInfo = async () => {
      if (!theaterId) return;
      
      try {
        const token = getAuthToken();
        const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setTheaterInfo(data.data);
          }
        }
      } catch (error) {
        console.error('Error fetching theater info:', error);
      }
    };
    
    fetchTheaterInfo();
  }, [theaterId]);

  // Fetch payment gateway configuration and load Razorpay script
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
          
          // Load Razorpay script if gateway is enabled and provider is razorpay
          if (data.config.isEnabled && data.config.provider === 'razorpay') {
            console.log('💳 Loading Razorpay SDK...');
            const loaded = await loadRazorpayScript();
            setRazorpayLoaded(loaded);
            if (!loaded) {
              console.error('❌ Failed to load Razorpay SDK');
            }
          }
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


  // Calculate totals using centralized utility
  const { subtotal, tax, total, totalDiscount } = useMemo(() => {
    return calculateOrderTotals(cartData.items || []);
  }, [cartData.items]);

  // Handle modal close and navigation
  const handleModalClose = () => {
    setShowSuccessModal(false);
    setOrderDetails(null);
    
    // Navigate back to appropriate page based on source
    const redirectPath = getRedirectPath();
    
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
  // AUTO-PRINT RECEIPT FUNCTION
  // ============================================
  
  /**
   * Generate and automatically print receipt for POS orders
   */
  const autoPrintReceipt = useCallback((order) => {
    try {
      if (!order) {
        console.error('❌ No order data for printing');
        return;
      }

      console.log('🖨️ Auto-printing receipt for order:', order.orderNumber);

      // Format theater address
      const formatTheaterAddress = () => {
        if (!theaterInfo?.address) return 'N/A';
        const addr = theaterInfo.address;
        const parts = [];
        if (addr.street) parts.push(addr.street);
        if (addr.city) parts.push(addr.city);
        if (addr.state) parts.push(addr.state);
        if (addr.zip) parts.push(addr.zip);
        return parts.join(', ');
      };

      // Format date/time
      const formatDateTime = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleString('en-IN', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      // Generate receipt HTML with auto-print script
      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Receipt - ${order.orderNumber}</title>
          <style>
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              margin: 0 auto;
              padding: 5mm;
              font-size: 12px;
              background: white;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .business-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .business-info {
              font-size: 10px;
              line-height: 1.4;
            }
            .bill-details {
              margin: 10px 0;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
            }
            .bill-row {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
              font-size: 11px;
            }
            .items-header {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              font-weight: bold;
              border-bottom: 1px solid #000;
              padding: 5px 0;
              font-size: 10px;
            }
            .item-row {
              display: grid;
              grid-template-columns: 2fr 1fr 1fr 1fr;
              padding: 5px 0;
              border-bottom: 1px dashed #ddd;
              font-size: 10px;
            }
            .item-name { word-wrap: break-word; }
            .item-qty, .item-rate, .item-total { text-align: right; }
            .totals-section {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #000;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-size: 11px;
            }
            .grand-total {
              font-weight: bold;
              font-size: 13px;
              border-top: 2px solid #000;
              padding-top: 5px;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <!-- Business Header -->
          <div class="receipt-header">
            <div class="business-name">${theaterInfo?.name || 'Theater Name'}</div>
            <div class="business-info">
              ${theaterInfo?.address ? formatTheaterAddress() : 'Address'}<br>
              ${theaterInfo?.phone ? 'Phone: ' + theaterInfo.phone : ''}<br>
              ${theaterInfo?.email ? 'Email: ' + theaterInfo.email : ''}<br>
              ${theaterInfo?.gstNumber ? 'GST: ' + theaterInfo.gstNumber : ''}
            </div>
          </div>

          <!-- Bill Details -->
          <div class="bill-details">
            <div class="bill-row">
              <span><strong>Invoice ID:</strong></span>
              <span>${order.orderNumber || 'N/A'}</span>
            </div>
            <div class="bill-row">
              <span><strong>Date:</strong></span>
              <span>${formatDateTime(order.createdAt || new Date())}</span>
            </div>
            <div class="bill-row">
              <span><strong>Customer:</strong></span>
              <span>${order.customerName || 'POS Customer'}</span>
            </div>
            ${qrName ? `
            <div class="bill-row">
              <span><strong>Screen:</strong></span>
              <span>${qrName}</span>
            </div>
            ` : ''}
            ${seat ? `
            <div class="bill-row">
              <span><strong>Seat:</strong></span>
              <span>${seat}</span>
            </div>
            ` : ''}
            <div class="bill-row">
              <span><strong>Payment:</strong></span>
              <span>${(order.paymentMethod || 'cash').toUpperCase()}</span>
            </div>
          </div>

          <!-- Items Header -->
          <div class="items-header">
            <div class="item-name">Item</div>
            <div class="item-qty">Qty</div>
            <div class="item-rate">Rate</div>
            <div class="item-total">Total</div>
          </div>

          <!-- Items List -->
          ${(order.products || order.items || cartData.items || []).map(item => {
            const qty = item.quantity || 1;
            const rate = item.unitPrice || item.sellingPrice || item.price || 0;
            const total = item.totalPrice || (qty * rate);
            return `
            <div class="item-row">
              <div class="item-name">${item.productName || item.name || 'Item'}</div>
              <div class="item-qty">${qty}</div>
              <div class="item-rate">₹${rate.toFixed(2)}</div>
              <div class="item-total">₹${total.toFixed(2)}</div>
            </div>
            `;
          }).join('')}

          <!-- Totals Section -->
          <div class="totals-section">
            ${subtotal ? `
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ` : ''}
            
            ${tax ? `
            <div class="total-row">
              <span>GST/Tax:</span>
              <span>₹${tax.toFixed(2)}</span>
            </div>
            ` : ''}
            
            ${totalDiscount > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-₹${totalDiscount.toFixed(2)}</span>
            </div>
            ` : ''}
            
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${(order.total || order.totalAmount || total || 0).toFixed(2)}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Thank you for your order!</p>
                                    <p>By YQPayNow</p>

            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
            ${orderNotes ? `<p style="margin-top: 10px; font-style: italic;">Notes: ${orderNotes}</p>` : ''}
          </div>
          <script>
            // Immediate auto-print - multiple triggers for reliability
            (function() {
              var printTriggered = false;
              
              function triggerPrint() {
                if (printTriggered) return;
                printTriggered = true;
                
                try {
                  // Focus window immediately
                  window.focus();
                  
                  // Multiple attempts to ensure print dialog opens
                  setTimeout(function() {
                    window.print();
                  }, 50);
                  
                  // Backup trigger
                  setTimeout(function() {
                    window.focus();
                    window.print();
                  }, 100);
                  
                  // Close window after print dialog is dismissed
                  window.addEventListener('afterprint', function() {
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  }, { once: true });
                  
                } catch (error) {
                  console.error('Print error:', error);
                }
              }
              
              // Trigger immediately if document is ready
              if (document.readyState === 'complete' || document.readyState === 'interactive') {
                triggerPrint();
              }
              
              // Also listen for load event
              window.addEventListener('load', function() {
                triggerPrint();
              }, { once: true });
              
              // DOMContentLoaded as backup
              document.addEventListener('DOMContentLoaded', function() {
                triggerPrint();
              }, { once: true });
              
              // Final fallback - trigger after short delay
              setTimeout(triggerPrint, 200);
            })();
          </script>
        </body>
        </html>
      `;

      // Open in new window for printing - optimized for immediate print
      console.log('🖨️ Opening print window...');
      
      // Try to open window without size restrictions for better print behavior
      const printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        console.error('❌ Failed to open print window. Popup might be blocked.');
        alert('⚠️ Please allow popups to print receipts automatically.\n\nAlternatively, you can manually print this page.');
        
        // Fallback: try using current window
        const currentWindow = window;
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = receiptHTML.replace(/<script[\s\S]*?<\/script>/gi, '');
        setTimeout(() => {
          currentWindow.focus();
          currentWindow.print();
          // Restore content after a delay
          setTimeout(() => {
            document.body.innerHTML = originalContent;
          }, 1000);
        }, 300);
        return;
      }

      // Write content to new window immediately
      printWindow.document.open();
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Focus the print window to ensure print dialog appears
      printWindow.focus();
      
      console.log('✅ Receipt loaded in print window, print dialog opening automatically...');
      
    } catch (error) {
      console.error('❌ Auto-print error:', error);
      alert('Failed to print receipt: ' + error.message);
    }
  }, [theaterInfo, cartData.items, subtotal, tax, total, totalDiscount, orderNotes, qrName, seat]);

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

      // Map payment method to Razorpay method
      const razorpayMethod = paymentMethod === 'card' ? 'card' : 
                            paymentMethod === 'upi' ? 'upi' : 
                            paymentMethod === 'netbanking' ? 'netbanking' : null;
      
      // Configure payment method options based on selected method
      const paymentConfig = {};
      if (razorpayMethod === 'card') {
        // For card payments, enable all card types
        paymentConfig.method = 'card';
        paymentConfig.card = {
          name: true,
          email: false
        };
      } else if (razorpayMethod === 'upi') {
        // For UPI payments
        paymentConfig.method = 'upi';
      } else if (razorpayMethod === 'netbanking') {
        paymentConfig.method = 'netbanking';
      }
      
      const options = {
        key: gatewayConfig.razorpay?.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || 'INR',
        name: 'YQ PAY NOW',
        description: `Order #${orderNumber}`,
        order_id: paymentOrder.orderId, // Fixed: use orderId instead of id
        ...paymentConfig, // Apply payment method configuration
        config: {
          display: {
            blocks: {
              banks: {
                name: razorpayMethod === 'card' ? 'Pay using Cards' : 
                      razorpayMethod === 'upi' ? 'Pay using UPI' :
                      razorpayMethod === 'netbanking' ? 'Pay using Netbanking' : 'Pay Now',
                instruments: [
                  {
                    method: razorpayMethod
                  }
                ]
              }
            },
            sequence: ['block.banks'],
            preferences: {
              show_default_blocks: false
            }
          }
        },
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
        },
        prefill: {
          name: customerName || 'Customer',
          contact: '',
          email: ''
        }
      };
      
      console.log('💳 Opening Razorpay checkout with options:', {
        key: options.key?.substring(0, 10) + '...',
        amount: options.amount,
        method: options.method,
        order_id: options.order_id
      });
      
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
      console.log('🔄 Starting order confirmation...');
      console.log('📦 Cart Data:', cartData);
      console.log('👤 Customer Name:', customerName);
      console.log('💳 Payment Method:', paymentMethod);

      // Validate customer name
      if (!customerName || !customerName.trim()) {
        console.error('❌ Customer name validation failed');
        alert('Please enter customer name');
        setIsLoading(false);
        return;
      }

      // Validate payment method
      if (!paymentMethod) {
        console.error('❌ Payment method validation failed');
        alert('Please select a payment method');
        setIsLoading(false);
        return;
      }

      // ✅ CRITICAL: Check if online payment is selected but gateway is not configured
      const isCardPayment = paymentMethod === 'card';
      const isUpiPayment = paymentMethod === 'upi';
      const isNetbankingPayment = paymentMethod === 'netbanking';
      const isOnlinePayment = isCardPayment || isUpiPayment || isNetbankingPayment;
      
      if (isOnlinePayment && (!gatewayConfig || !gatewayConfig.isEnabled)) {
        console.error('❌ Gateway not configured for online payment');
        alert('⚠️ Payment Gateway Not Available\n\nOnline payments are not configured for this theater.\nPlease select Cash payment or contact theater admin.');
        setIsLoading(false);
        return;
      }
      
      // Additional validation: Check if selected method is actually accepted
      if (isCardPayment && !gatewayConfig?.acceptedMethods?.card) {
        console.error('❌ Card payment not accepted');
        alert('⚠️ Card Payment Not Available\n\nCard payments are not enabled for this theater.\nPlease select another payment method.');
        setIsLoading(false);
        return;
      }
      
      if (isUpiPayment && !gatewayConfig?.acceptedMethods?.upi) {
        console.error('❌ UPI payment not accepted');
        alert('⚠️ UPI Payment Not Available\n\nUPI payments are not enabled for this theater.\nPlease select another payment method.');
        setIsLoading(false);
        return;
      }

      console.log('✅ All validations passed');

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
          const redirectPath = getRedirectPath();
          
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

      console.log('📤 Sending order data:', orderData);

      // Get authentication token with auto-login fallback
      let authToken = getAuthToken();
      if (!authToken) {
        console.log('🔐 No auth token, attempting auto-login...');
        authToken = await autoLogin();
        if (!authToken) {
          console.error('❌ Auto-login failed');
          alert('Authentication required. Please login.');
          setIsLoading(false);
          navigate('/theater-login');
          return;
        }
        console.log('✅ Auto-login successful');
      }
      

      // Submit order to backend API
      console.log('🚀 Submitting order to backend...');
      const response = await fetch(`${config.api.baseUrl}/orders/theater`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();
      console.log('📥 Backend response:', result);

      if (!response.ok) {
        const errorMessage = result.error || result.message || 'Failed to create order';
        const errorDetails = result.details ? '\n\nDetails: ' + JSON.stringify(result.details, null, 2) : '';
        console.error('❌ Order creation failed:', errorMessage, errorDetails);
        alert(`Order Failed: ${errorMessage}${errorDetails}`);
        setIsLoading(false);
        return;
      }
      
      if (response.ok && result.success) {
        console.log('✅ Order created successfully!');
        const orderId = result.order._id;
        const orderNumber = result.order.orderNumber;
        console.log('📋 Order ID:', orderId);
        console.log('🎫 Order Number:', orderNumber);

        // ✅ If non-cash payment and gateway enabled, initiate payment
        const isCardPayment = paymentMethod === 'card' && gatewayConfig?.acceptedMethods?.card;
        const isUpiPayment = paymentMethod === 'upi' && gatewayConfig?.acceptedMethods?.upi;
        
        if ((isCardPayment || isUpiPayment) && gatewayConfig?.isEnabled) {
          if (!razorpayLoaded) {
            alert('Payment gateway is loading. Please wait a moment and try again.');
            setIsLoading(false);
            return;
          }
          
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
            
            // Initiate payment and wait for completion
            let paymentResult = null;
            if (provider === 'razorpay') {
              paymentResult = await initiateRazorpayPayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else if (provider === 'paytm') {
              paymentResult = await initiatePaytmPayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else if (provider === 'phonepe') {
              paymentResult = await initiatePhonePePayment(paymentData.paymentOrder, orderId, orderNumber, authToken);
            } else {
              throw new Error(`Unsupported payment provider: ${provider}`);
            }
            
            // ✅ Only proceed if payment was successfully verified
            if (!paymentResult || !paymentResult.success) {
              throw new Error('Payment verification failed. Please try again.');
            }
            
            console.log('✅ Payment completed and verified successfully');
            
            // Payment success - clear cart and show success
            sessionStorage.removeItem('cartData');
            setOrderDetails(result.order);
            setShowSuccessModal(true);
            
            // 🖨️ AUTO-PRINT: Print receipt automatically for POS orders
            autoPrintReceipt(result.order);
            
            const redirectPath = getRedirectPath();
            
            // Small delay to show success modal before redirect
            setTimeout(() => {
              navigate(redirectPath, { 
                state: { 
                  orderSuccess: true, 
                  orderNumber: orderNumber,
                  clearCart: true 
                } 
              });
            }, 1500);
            
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
          
          // 🖨️ AUTO-PRINT: Print receipt automatically for POS orders
          autoPrintReceipt(result.order);
          
          const redirectPath = getRedirectPath();
          
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
    // Navigate back to the page where user came from (respects source)
    const redirectPath = getRedirectPath();
    
    navigate(redirectPath, { 
      state: { 
        cartItems: cartData.items,
        customerName: customerName,
        source: source // Pass source along to maintain context
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
            onClick={() => navigate(getRedirectPath())}
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
            placeholder="POS"
            disabled
            readOnly
            style={{ 
              backgroundColor: '#f3f4f6', 
              cursor: 'not-allowed',
              color: '#6b7280'
            }}
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
                    <label className={`payment-option ${(!gatewayConfig?.isEnabled || !gatewayConfig?.acceptedMethods?.card) ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        value="card"
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={!gatewayConfig?.isEnabled || !gatewayConfig?.acceptedMethods?.card}
                      />
                      <span>
                        Card Payment 
                        {(gatewayConfig?.isEnabled && gatewayConfig?.acceptedMethods?.card) ? ' ✅' : ' ❌ (Not Available)'}
                      </span>
                    </label>
                    <label className={`payment-option ${(!gatewayConfig?.isEnabled || !gatewayConfig?.acceptedMethods?.upi) ? 'disabled' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        value="upi"
                        checked={paymentMethod === 'upi'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        disabled={!gatewayConfig?.isEnabled || !gatewayConfig?.acceptedMethods?.upi}
                      />
                      <span>
                        UPI Payment 
                        {(gatewayConfig?.isEnabled && gatewayConfig?.acceptedMethods?.upi) ? ' ✅' : ' ❌ (Not Available)'}
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
                    {!gatewayConfig?.isEnabled && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#EF4444', 
                        marginTop: '8px',
                        padding: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '6px',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                      }}>
                        ⚠️ Online payments not available - Payment gateway not configured for this theater. Only cash payments accepted.
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
                  <p style={{ marginTop: '15px', fontSize: '13px', color: '#10B981' }}>
                    🖨️ Receipt is printing automatically...
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="modal-secondary-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    autoPrintReceipt(orderDetails);
                  }}
                  style={{
                    background: '#6B7280',
                    color: 'white',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginRight: '10px'
                  }}
                >
                  🖨️ Print Again
                </button>
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