# 🚀 Payment Gateway Implementation - Quick Reference

## 📊 Current vs Future State

### CURRENT STATE ❌
```
Customer Orders → Your System → Manual Payment Processing
- Only cash payments tracked
- No online payment integration
- All theaters share same payment settings
- Manual reconciliation required
```

### FUTURE STATE ✅
```
Customer Orders → Your System → Payment Gateway → Bank Account
- Razorpay/PhonePe/Paytm integration
- Each theater has own gateway credentials
- Automatic payment verification
- Real-time transaction tracking
- Instant settlements
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CUSTOMER                              │
│  (Scans QR → Orders → Selects Payment Method)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND                              │
│  1. Create Order                                             │
│  2. Fetch Theater's Payment Gateway Config                   │
│  3. Create Gateway Order (Razorpay/PhonePe/Paytm)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               PAYMENT GATEWAY (Razorpay)                     │
│  1. Show payment page                                        │
│  2. Customer pays                                            │
│  3. Gateway processes payment                                │
│  4. Send response back                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                YOUR BACKEND (Verification)                   │
│  1. Verify payment signature                                 │
│  2. Update order status to "paid"                            │
│  3. Save transaction record                                  │
│  4. Notify theater                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  THEATER DASHBOARD                           │
│  - View all transactions                                     │
│  - Track settlements                                         │
│  - Download reports                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Files to Create/Modify

### NEW FILES (7 files)
```
backend/
├── models/
│   └── PaymentTransaction.js         ⭐ NEW - Track all payments
├── services/
│   └── paymentService.js             ⭐ NEW - Payment gateway logic
└── routes/
    └── payments.js                    ⭐ NEW - Payment API endpoints

frontend/src/pages/theater/
└── TheaterPaymentSettings.js         ⭐ NEW - Admin payment config UI

docs/
├── THEATER-SPECIFIC-PAYMENT-GATEWAY-IMPLEMENTATION-GUIDE.md  ⭐ NEW
└── PAYMENT-GATEWAY-QUICK-REFERENCE.md                        ⭐ NEW (this file)
```

### MODIFIED FILES (4 files)
```
backend/
├── models/
│   └── Theater.js                    🔧 ADD paymentGateway field
├── server.js                         🔧 ADD payment routes
└── package.json                      🔧 ADD razorpay SDK

frontend/src/
└── pages/customer/
    └── CustomerPayment.js            🔧 ADD Razorpay integration
```

---

## 🎯 Implementation Checklist

### PHASE 1: Database Setup ✅
- [ ] Update `Theater.js` model with `paymentGateway` field
- [ ] Create `PaymentTransaction.js` model
- [ ] Test database schema updates

### PHASE 2: Backend Core ✅
- [ ] Install NPM packages: `npm install razorpay crypto`
- [ ] Create `paymentService.js`
- [ ] Create `payments.js` routes
- [ ] Add routes to `server.js`
- [ ] Test API endpoints with Postman

### PHASE 3: Frontend Customer Flow ✅
- [ ] Update `CustomerPayment.js`
- [ ] Load Razorpay checkout script
- [ ] Implement payment creation
- [ ] Implement payment verification
- [ ] Test payment flow

### PHASE 4: Frontend Theater Admin ✅
- [ ] Create `TheaterPaymentSettings.js`
- [ ] Add navigation menu item
- [ ] Test saving credentials
- [ ] Test loading credentials

### PHASE 5: Testing ✅
- [ ] Get Razorpay test credentials
- [ ] Test full payment flow
- [ ] Test payment failure scenarios
- [ ] Test webhook delivery

### PHASE 6: Production Ready ✅
- [ ] Implement encryption for secrets
- [ ] Add webhook signature verification
- [ ] Add error logging
- [ ] Add transaction reports
- [ ] Deploy to production

---

## 💳 Razorpay Test Credentials

### Test API Keys (Free - No KYC Required)
```
Key ID: rzp_test_xxxxxxxxxxxxx (You'll get this after signup)
Key Secret: xxxxxxxxxxxxxxxxxxx (Keep this secret!)
```

### Test Card Details
```
Card Number: 4111 1111 1111 1111
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
OTP: 123456
```

### Test UPI ID
```
UPI ID: success@razorpay
```

---

## 🔑 Key Code Snippets

### 1. Theater Model - Payment Gateway Field
```javascript
paymentGateway: {
  provider: { type: String, enum: ['razorpay', 'phonepe', 'paytm', 'none'], default: 'none' },
  isEnabled: { type: Boolean, default: false },
  razorpay: {
    enabled: Boolean,
    keyId: String,
    keySecret: String,  // ⚠️ Encrypt in production
    testMode: { type: Boolean, default: true }
  },
  acceptedMethods: {
    cash: { type: Boolean, default: true },
    card: { type: Boolean, default: true },
    upi: { type: Boolean, default: true }
  }
}
```

### 2. Create Razorpay Order
```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: theater.paymentGateway.razorpay.keyId,
  key_secret: theater.paymentGateway.razorpay.keySecret
});

const order = await razorpay.orders.create({
  amount: totalAmount * 100,  // Amount in paise
  currency: 'INR',
  receipt: orderNumber
});
```

### 3. Verify Payment Signature
```javascript
const crypto = require('crypto');

const generated_signature = crypto
  .createHmac('sha256', keySecret)
  .update(orderId + '|' + paymentId)
  .digest('hex');

const isValid = (generated_signature === signature);
```

### 4. Frontend - Open Razorpay Checkout
```javascript
const options = {
  key: 'rzp_test_xxxxx',
  amount: 50000,  // 500.00 INR
  currency: 'INR',
  name: 'Theater Name',
  description: 'Order #12345',
  order_id: 'order_xxxxxxxxxxxxx',
  handler: function (response) {
    // Payment successful
    console.log(response.razorpay_payment_id);
    console.log(response.razorpay_order_id);
    console.log(response.razorpay_signature);
  }
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

---

## 💰 Pricing Comparison (India)

| Gateway   | Transaction Fee | Setup Fee | Settlement Time | KYC Required |
|-----------|----------------|-----------|-----------------|--------------|
| Razorpay  | 2%             | ₹0        | T+0 to T+3     | Yes (Live)   |
| PhonePe   | 1.5-2%         | ₹0        | T+1            | Yes          |
| Paytm     | 1.99-2.49%     | ₹0        | T+1            | Yes          |

**Recommendation**: Start with **Razorpay** (easiest integration, best documentation)

---

## 📞 Getting Help

### Razorpay Support
- Dashboard: https://dashboard.razorpay.com
- Docs: https://razorpay.com/docs
- Support: support@razorpay.com
- Phone: +91-80-6890-1234

### Common Issues & Solutions

#### Issue 1: "Key ID or Key Secret is invalid"
**Solution**: Ensure you're using the correct environment (test vs live)

#### Issue 2: "Signature verification failed"
**Solution**: Check that orderId and paymentId are in correct order when generating signature

#### Issue 3: "Amount mismatch"
**Solution**: Razorpay expects amount in **paise** (multiply by 100)

---

## 🎓 Learning Resources

### Video Tutorials
1. Razorpay Integration: https://youtu.be/razorpay-nodejs-tutorial
2. Payment Gateway Basics: https://youtu.be/payment-gateway-explained

### Code Examples
1. Razorpay GitHub: https://github.com/razorpay/razorpay-node
2. MERN Stack Payment: https://github.com/search?q=mern+razorpay

---

## ⏱️ Time Estimation

| Phase                    | Time Required | Complexity |
|--------------------------|---------------|------------|
| Database Setup           | 1-2 hours     | Easy       |
| Backend Core             | 3-4 hours     | Medium     |
| Frontend Customer Flow   | 2-3 hours     | Medium     |
| Frontend Theater Admin   | 2-3 hours     | Easy       |
| Testing & Security       | 2-3 hours     | Medium     |
| **TOTAL**               | **10-15 hours**| **Medium** |

**👨‍💻 For 1 Developer**: 2-3 working days  
**👨‍💻 For 2 Developers**: 1-2 working days

---

## 🚦 Project Status

**Current Status**: 📝 **PLANNING COMPLETE - AWAITING APPROVAL**

**Next Steps**:
1. ✅ Review implementation guide
2. ✅ Get Razorpay test account
3. ✅ Approve implementation plan
4. 🚀 Start coding!

---

**📝 Last Updated**: November 5, 2025  
**📄 Main Guide**: See `THEATER-SPECIFIC-PAYMENT-GATEWAY-IMPLEMENTATION-GUIDE.md`
