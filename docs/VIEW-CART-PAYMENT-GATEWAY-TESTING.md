# View Cart Payment Gateway Testing Guide 🛒💳

## Overview
The View Cart page integrates with your dual payment gateway system (Kiosk/POS vs Online). This guide shows how to test payment gateway integration.

---

## Current Configuration (from Database)

**Theater:** YQ PAY NOW (ID: `68f8837a541316c6ad54b79f`)

### Kiosk Channel:
- ✅ **Paytm ENABLED**
  - Merchant ID: `DIY12386817555501617`
  - Merchant Key: `bKMfNxPPf_QdZppa`
  - Test Mode: `true`

### Online Channel:
- ❌ All gateways disabled

---

## Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. ViewCart Page (Frontend)                                     │
│    - User selects payment method: Cash/Card/UPI                 │
│    - Clicks "Confirm Order"                                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. POST /api/orders/theater (Backend)                           │
│    - Creates order in database                                  │
│    - Sets orderType (determines channel)                        │
│    - Returns orderId                                            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. POST /api/payments/create-order (Backend)                    │
│    - Determines channel (kiosk or online)                       │
│    - Gets theater payment gateway config for that channel       │
│    - Creates payment order with provider (Razorpay/PhonePe/Paytm)│
│    - Returns payment order details                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Frontend Payment Processing                                  │
│    - Shows payment UI (Razorpay/PhonePe/Paytm)                  │
│    - User completes payment                                     │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. POST /api/payments/verify (Backend)                          │
│    - Verifies payment signature                                 │
│    - Updates order status                                       │
│    - Creates PaymentTransaction record                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Channel Detection Logic

The payment gateway channel is determined by `orderType`:

| Order Type | Channel | Gateway Used |
|------------|---------|--------------|
| `kiosk` | kiosk | theater.paymentGateway.kiosk |
| `pos` | kiosk | theater.paymentGateway.kiosk |
| `online` | online | theater.paymentGateway.online |
| `qr` | online | theater.paymentGateway.online |

**Current Issue:** ViewCart doesn't set `orderType`, so it defaults to **'online'** channel.

---

## Testing Steps

### Test 1: Check Current Payment Flow (Cash Payment)

1. Navigate to View Cart: `http://localhost:3000/view-cart/68f8837a541316c6ad54b79f`
2. Enter customer name
3. Select **"Cash Payment"**
4. Click **"Confirm Order"**
5. ✅ Should create order successfully (no gateway needed)

---

### Test 2: Check Payment Gateway Config API

Run this command to verify the gateway config endpoint:

```bash
# Check Kiosk Channel Config
curl http://localhost:8080/api/payments/config/68f8837a541316c6ad54b79f/kiosk

# Check Online Channel Config
curl http://localhost:8080/api/payments/config/68f8837a541316c6ad54b79f/online
```

**Expected Response (Kiosk):**
```json
{
  "success": true,
  "config": {
    "provider": "paytm",
    "isEnabled": true,
    "channel": "kiosk",
    "paytm": {
      "merchantId": "DIY12386817555501617",
      "testMode": true
    }
  }
}
```

---

### Test 3: Enable Card/UPI Payment with Gateway

**Current Problem:** When you select **Card Payment** or **UPI Payment** in ViewCart:

1. Order is created in database
2. But payment gateway is NOT triggered
3. Order is marked as "paid" without actual payment

**Why?** ViewCart needs to be updated to:
- Call `/api/payments/create-order` after order creation
- Show payment UI (Paytm/Razorpay/PhonePe)
- Verify payment before confirming order

---

## Required Frontend Changes

### Step 1: Set Order Type Based on Source

In `ViewCart.js`, we need to determine if this is a Kiosk or Online order:

```javascript
// Determine order type based on source
const getOrderType = () => {
  if (source === 'order-interface' || source === 'offline-pos') {
    return 'pos'; // Uses kiosk channel
  } else if (source === 'online-pos') {
    return 'online'; // Uses online channel
  }
  return 'pos'; // Default to kiosk for theater orders
};
```

### Step 2: Fetch Gateway Config on Page Load

```javascript
const [gatewayConfig, setGatewayConfig] = useState(null);

useEffect(() => {
  const fetchGatewayConfig = async () => {
    try {
      const channel = getOrderType() === 'pos' ? 'kiosk' : 'online';
      const response = await axios.get(
        `${config.API_URL}/api/payments/config/${theaterId}/${channel}`
      );
      if (response.data.success) {
        setGatewayConfig(response.data.config);
      }
    } catch (error) {
      console.error('Error fetching gateway config:', error);
    }
  };
  
  fetchGatewayConfig();
}, [theaterId]);
```

### Step 3: Update Payment Options Based on Gateway

```javascript
// Only show Card/UPI if gateway is enabled
const isGatewayEnabled = gatewayConfig?.isEnabled;

<label className="payment-option">
  <input
    type="radio"
    name="payment"
    value="card"
    checked={paymentMethod === 'card'}
    onChange={(e) => setPaymentMethod(e.target.value)}
    disabled={!isGatewayEnabled}
  />
  <span>Card Payment {!isGatewayEnabled && '(Not Available)'}</span>
</label>

<label className="payment-option">
  <input
    type="radio"
    name="payment"
    value="upi"
    checked={paymentMethod === 'upi'}
    onChange={(e) => setPaymentMethod(e.target.value)}
    disabled={!isGatewayEnabled}
  />
  <span>UPI Payment {!isGatewayEnabled && '(Not Available)'}</span>
</label>
```

### Step 4: Integrate Payment Gateway on Confirm Order

```javascript
const handleConfirmOrder = async () => {
  try {
    setIsLoading(true);
    
    // ... validation code ...
    
    // Create order first
    const orderResponse = await axios.post(
      `${config.API_URL}/api/orders/theater`,
      {
        ...orderData,
        orderType: getOrderType() // Add order type
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (!orderResponse.data.success) {
      throw new Error(orderResponse.data.message);
    }
    
    const orderId = orderResponse.data.orderId;
    
    // If non-cash payment, initiate payment gateway
    if (paymentMethod !== 'cash' && gatewayConfig?.isEnabled) {
      // Create payment order
      const paymentResponse = await axios.post(
        `${config.API_URL}/api/payments/create-order`,
        {
          orderId: orderId,
          paymentMethod: paymentMethod
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      if (!paymentResponse.data.success) {
        throw new Error('Failed to initialize payment');
      }
      
      const { paymentOrder, provider } = paymentResponse.data;
      
      // Show payment UI based on provider
      if (provider === 'razorpay') {
        await initiateRazorpayPayment(paymentOrder, orderId);
      } else if (provider === 'paytm') {
        await initiatePaytmPayment(paymentOrder, orderId);
      } else if (provider === 'phonepe') {
        await initiatePhonePePayment(paymentOrder, orderId);
      }
    } else {
      // Cash payment - show success directly
      setOrderDetails({
        orderNumber: orderResponse.data.orderNumber,
        customerName: customerName,
        total: total.toFixed(2),
        paymentMethod: paymentMethod
      });
      setShowSuccessModal(true);
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Step 5: Add Payment Provider Integration

```javascript
// Razorpay Integration
const initiateRazorpayPayment = async (paymentOrder, orderId) => {
  return new Promise((resolve, reject) => {
    const options = {
      key: gatewayConfig.razorpay.keyId,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      name: 'YQ PAY NOW',
      description: 'Order Payment',
      order_id: paymentOrder.id,
      handler: async function(response) {
        try {
          // Verify payment
          const verifyResponse = await axios.post(
            `${config.API_URL}/api/payments/verify`,
            {
              orderId: orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              razorpayOrderId: response.razorpay_order_id,
              transactionId: paymentOrder.transactionId
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          
          if (verifyResponse.data.success) {
            // Show success modal
            setOrderDetails({
              orderNumber: paymentOrder.receipt,
              customerName: customerName,
              total: (paymentOrder.amount / 100).toFixed(2),
              paymentMethod: 'Razorpay'
            });
            setShowSuccessModal(true);
            resolve();
          } else {
            reject(new Error('Payment verification failed'));
          }
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: function() {
          reject(new Error('Payment cancelled by user'));
        }
      }
    };
    
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  });
};

// Paytm Integration (similar structure)
const initiatePaytmPayment = async (paymentOrder, orderId) => {
  // TODO: Implement Paytm payment flow
  console.log('Paytm payment:', paymentOrder);
};

// PhonePe Integration (similar structure)
const initiatePhonePePayment = async (paymentOrder, orderId) => {
  // TODO: Implement PhonePe payment flow
  console.log('PhonePe payment:', paymentOrder);
};
```

---

## Testing Checklist

- [ ] **Test 1:** Cash payment works (no gateway)
- [ ] **Test 2:** Gateway config API returns correct data
- [ ] **Test 3:** Card/UPI options disabled when gateway not configured
- [ ] **Test 4:** Card/UPI options enabled when Paytm configured for kiosk
- [ ] **Test 5:** Selecting Card payment initiates Paytm gateway
- [ ] **Test 6:** Payment success updates order status
- [ ] **Test 7:** Payment failure shows error message
- [ ] **Test 8:** Different channels (kiosk vs online) use different gateways

---

## Current Status

✅ **Backend:** Fully implemented with dual gateway support  
✅ **Database:** Paytm configured for Kiosk channel  
⏳ **Frontend:** ViewCart needs payment gateway integration  
⏳ **Testing:** Manual testing required after frontend updates

---

## Next Steps

1. **Update ViewCart.js** with payment gateway integration
2. **Add Razorpay/Paytm SDK** to frontend HTML
3. **Test with Paytm test credentials** for kiosk orders
4. **Enable online gateway** for online orders
5. **Test complete payment flow** end-to-end

---

## Quick Test Command

```bash
# Check if order was created with correct orderType
node d:\YQPAY\24\backend\check-payment-gateway.js
```

This will show the payment gateway configuration currently in the database.
