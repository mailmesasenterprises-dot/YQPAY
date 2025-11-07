# 🔀 Payment Split Architecture - Commission Handling

## 📋 Business Requirements

### Commission Structure:
1. **Kiosk Orders**: 0% commission (100% to theater)
2. **POS Orders**: 0% commission (100% to theater)
3. **Online Orders (QR Code)**: X% commission to super admin, remaining to theater

---

## 🎯 Solution: ONE Payment Gateway with Route/Split

You **DO NOT** need 2 separate payment gateway accounts.

You need **1 Master Account** with **Payment Splitting** feature.

---

## 🏦 Razorpay Route Architecture

### Setup Structure:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPER ADMIN                                   │
│           Razorpay Master Account (rzp_live_xxxxx)               │
│  - Receives ALL payments first                                   │
│  - Holds commission automatically                                │
│  - Routes remaining amount to theaters                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
              ┌───────────────┴───────────────┐
              ↓                               ↓
┌──────────────────────────┐    ┌──────────────────────────┐
│    THEATER A             │    │    THEATER B             │
│  Linked Account          │    │  Linked Account          │
│  (acc_xxxxxxxxxxxxx)     │    │  (acc_yyyyyyyyyyyyy)     │
│  - Receives 90%          │    │  - Receives 85%          │
└──────────────────────────┘    └──────────────────────────┘
```

---

## 💳 Payment Flow by Order Type

### 1. KIOSK Order (No Commission)
```
Customer Pays ₹1000 at Kiosk
      ↓
Payment Method: Cash/Card (Direct)
      ↓
No Gateway Involved (or theater's direct gateway)
      ↓
100% to Theater (₹1000)
```

### 2. POS Order (No Commission)
```
Staff takes order, customer pays
      ↓
Payment Method: Cash/Card (Direct)
      ↓
No Gateway Involved (or theater's direct gateway)
      ↓
100% to Theater (₹1000)
```

### 3. ONLINE Order via QR Code (With Commission)
```
Customer Scans QR → Orders → Pays Online
      ↓
Payment Gateway: Razorpay Master Account
      ↓
Amount: ₹1000
      ↓
Razorpay Route Automatically Splits:
├─→ Super Admin Commission: ₹100 (10%)
└─→ Theater Linked Account: ₹900 (90%)
```

---

## 🔧 Database Schema Updates

### Theater Model Enhancement

```javascript
paymentGateway: {
  // Theater's Own Gateway (for Kiosk/POS - optional)
  provider: {
    type: String,
    enum: ['razorpay', 'phonepe', 'paytm', 'none'],
    default: 'none'
  },
  
  // Theater's Direct Gateway Credentials (Kiosk/POS)
  razorpay: {
    enabled: Boolean,
    keyId: String,
    keySecret: String,
    testMode: Boolean
  },
  
  // 🔥 NEW: Linked Account for Online Orders (Commission Split)
  linkedAccount: {
    enabled: { type: Boolean, default: false },
    accountId: String,  // Razorpay Account ID: acc_xxxxxxxxxxxxx
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended'],
      default: 'pending'
    },
    activatedAt: Date,
    
    // Commission Settings
    commission: {
      type: { 
        type: String, 
        enum: ['percentage', 'fixed'], 
        default: 'percentage' 
      },
      value: { type: Number, default: 10 }, // 10% or fixed amount
      appliesTo: [{ 
        type: String, 
        enum: ['online', 'kiosk', 'pos'] 
      }]
    }
  },
  
  // Accepted Methods per Channel
  acceptedMethods: {
    kiosk: {
      cash: Boolean,
      card: Boolean,
      upi: Boolean
    },
    pos: {
      cash: Boolean,
      card: Boolean,
      upi: Boolean
    },
    online: {
      card: Boolean,
      upi: Boolean,
      netbanking: Boolean,
      wallet: Boolean
    }
  }
}
```

### Order Model Enhancement

```javascript
orderType: {
  type: String,
  enum: ['kiosk', 'pos', 'online', 'qr'],
  required: true,
  index: true
},

// Commission Details (for online orders)
commission: {
  applicable: { type: Boolean, default: false },
  type: { type: String, enum: ['percentage', 'fixed'] },
  value: Number,
  amount: Number, // Calculated commission amount
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  status: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  }
},

// Payment Details
payment: {
  method: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet', 'bank_transfer'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },
  
  // Split Payment Details (for online orders)
  split: {
    enabled: { type: Boolean, default: false },
    masterAccountAmount: Number,  // Commission to super admin
    linkedAccountAmount: Number,  // Amount to theater
    transferId: String,           // Razorpay transfer ID
    transferStatus: String        // pending, processed, failed
  },
  
  transactionId: String,
  paidAt: Date
}
```

---

## 💻 Implementation Code

### 1. Super Admin Settings (Global Commission Config)

```javascript
// backend/models/Settings.js or GlobalSettings.js

const globalSettingsSchema = new mongoose.Schema({
  // Commission Settings
  commission: {
    enabled: { type: Boolean, default: true },
    
    // Different rates per order type
    rates: {
      online: { 
        type: Number, 
        default: 10,  // 10% for online orders
        min: 0,
        max: 100
      },
      kiosk: { 
        type: Number, 
        default: 0,   // 0% for kiosk orders
        min: 0,
        max: 100
      },
      pos: { 
        type: Number, 
        default: 0,   // 0% for POS orders
        min: 0,
        max: 100
      }
    },
    
    // Master Razorpay Account (Super Admin)
    masterAccount: {
      razorpayKeyId: String,
      razorpayKeySecret: String,  // Encrypted
      accountId: String
    }
  }
});
```

### 2. Payment Service - Split Logic

```javascript
// backend/services/paymentService.js

class PaymentService {
  /**
   * Create Razorpay Order with Route/Split
   */
  async createSplitPaymentOrder(theater, order, globalSettings) {
    try {
      const razorpay = new Razorpay({
        key_id: globalSettings.commission.masterAccount.razorpayKeyId,
        key_secret: this.decrypt(globalSettings.commission.masterAccount.razorpayKeySecret)
      });
      
      // Calculate commission based on order type
      const commissionRate = this.getCommissionRate(order.orderType, globalSettings);
      const totalAmount = order.pricing.total;
      const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
      const theaterAmount = totalAmount - commissionAmount;
      
      // Create order with transfers (split)
      const orderOptions = {
        amount: Math.round(totalAmount * 100), // in paise
        currency: 'INR',
        receipt: order.orderNumber,
        notes: {
          orderId: order._id.toString(),
          theaterId: theater._id.toString(),
          orderType: order.orderType,
          commissionRate: commissionRate
        }
      };
      
      // Add transfers only if commission is applicable and theater has linked account
      if (commissionRate > 0 && theater.paymentGateway?.linkedAccount?.enabled) {
        orderOptions.transfers = [
          {
            account: theater.paymentGateway.linkedAccount.accountId,
            amount: Math.round(theaterAmount * 100), // in paise
            currency: 'INR',
            notes: {
              type: 'theater_payment',
              theaterId: theater._id.toString(),
              orderType: order.orderType
            },
            linked_account_notes: [
              theater.name
            ],
            on_hold: false // Transfer immediately
          }
        ];
      }
      
      const razorpayOrder = await razorpay.orders.create(orderOptions);
      
      // Save transaction record
      const transaction = new PaymentTransaction({
        theaterId: theater._id,
        orderId: order._id,
        gateway: {
          provider: 'razorpay',
          orderId: razorpayOrder.id
        },
        amount: {
          value: totalAmount,
          currency: 'INR'
        },
        split: {
          enabled: commissionRate > 0,
          commissionAmount: commissionAmount,
          theaterAmount: theaterAmount,
          commissionRate: commissionRate
        },
        status: 'initiated',
        method: 'online',
        customer: {
          name: order.customerInfo?.name,
          phone: order.customerInfo?.phone
        }
      });
      
      await transaction.save();
      
      // Update order with commission details
      order.commission = {
        applicable: commissionRate > 0,
        type: 'percentage',
        value: commissionRate,
        amount: commissionAmount,
        status: 'pending'
      };
      
      order.payment.split = {
        enabled: commissionRate > 0,
        masterAccountAmount: commissionAmount,
        linkedAccountAmount: theaterAmount
      };
      
      await order.save();
      
      return {
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: globalSettings.commission.masterAccount.razorpayKeyId,
        transaction: transaction,
        split: {
          commissionAmount,
          theaterAmount,
          commissionRate
        }
      };
    } catch (error) {
      console.error('Failed to create split payment order:', error);
      throw error;
    }
  }
  
  /**
   * Get commission rate based on order type
   */
  getCommissionRate(orderType, globalSettings) {
    const rates = globalSettings.commission.rates;
    
    switch (orderType) {
      case 'online':
      case 'qr':
        return rates.online || 10; // 10% for online orders
      case 'kiosk':
        return rates.kiosk || 0;   // 0% for kiosk orders
      case 'pos':
        return rates.pos || 0;     // 0% for POS orders
      default:
        return 0;
    }
  }
  
  /**
   * Create Direct Payment Order (No Split - Kiosk/POS)
   */
  async createDirectPaymentOrder(theater, order) {
    // Use theater's own gateway credentials (no commission)
    const razorpay = new Razorpay({
      key_id: theater.paymentGateway.razorpay.keyId,
      key_secret: this.decrypt(theater.paymentGateway.razorpay.keySecret)
    });
    
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.pricing.total * 100),
      currency: 'INR',
      receipt: order.orderNumber,
      notes: {
        orderId: order._id.toString(),
        orderType: order.orderType,
        noCommission: true
      }
    });
    
    return {
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: theater.paymentGateway.razorpay.keyId,
      noSplit: true
    };
  }
}

module.exports = new PaymentService();
```

### 3. Updated Payment Routes

```javascript
// backend/routes/payments.js

/**
 * POST /api/payments/create-order
 * Create payment order (with or without split)
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    
    // Get order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Get theater
    const theater = await Theater.findById(order.theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    
    // Get global settings
    const globalSettings = await GlobalSettings.findOne();
    
    let paymentOrder;
    
    // Determine if commission applies based on order type
    const orderType = order.orderType || 'online';
    const commissionRate = paymentService.getCommissionRate(orderType, globalSettings);
    
    if (commissionRate > 0 && orderType === 'online') {
      // Online order with commission - use master account with split
      if (!globalSettings?.commission?.masterAccount?.razorpayKeyId) {
        return res.status(400).json({
          success: false,
          message: 'Master payment gateway not configured'
        });
      }
      
      paymentOrder = await paymentService.createSplitPaymentOrder(
        theater,
        order,
        globalSettings
      );
    } else {
      // Kiosk/POS order - no commission, use theater's direct gateway
      if (!theater.paymentGateway?.razorpay?.enabled) {
        return res.status(400).json({
          success: false,
          message: 'Payment gateway not configured for this theater'
        });
      }
      
      paymentOrder = await paymentService.createDirectPaymentOrder(
        theater,
        order
      );
    }
    
    res.json({
      success: true,
      paymentOrder: paymentOrder,
      provider: 'razorpay',
      orderType: orderType,
      commissionApplies: commissionRate > 0
    });
    
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
});
```

---

## 📊 Flow Comparison

### KIOSK/POS Orders (No Commission):
```
Customer → Theater Kiosk/Counter → Payment
                                      ↓
                    Theater's Own Gateway (Optional)
                                      ↓
                              100% to Theater
```

### ONLINE Orders (With Commission):
```
Customer → Scans QR → Orders → Online Payment
                                      ↓
                    Master Gateway (Super Admin)
                                      ↓
                    Razorpay Route Splits:
                    ├─→ 10% to Super Admin
                    └─→ 90% to Theater (Linked Account)
```

---

## 🔐 Account Linking Process

### Step 1: Super Admin Setup
1. Create ONE master Razorpay account
2. Enable "Razorpay Route" feature (contact Razorpay support)
3. Get Master Account credentials

### Step 2: Theater Onboarding
1. Theater creates their own Razorpay account
2. Theater completes KYC (for live mode)
3. Theater shares their Account ID with super admin
4. Super admin links theater account to master account

### Step 3: Testing
1. Use test mode initially
2. Test with test credentials
3. Verify commission splits correctly
4. Move to live mode after testing

---

## 💰 Razorpay Route Pricing

**Additional Cost:** No extra charges for Route feature!

**Standard Transaction Fee:** 2% per transaction

**Example:**
- Customer pays: ₹1000
- Gateway fee (2%): ₹20
- Remaining: ₹980
- Your commission (10%): ₹98
- Theater gets: ₹882

**Who pays gateway fee?**
- Deducted from total before split
- Both parties share the cost proportionally

---

## 🎯 Summary

### ✅ ONE Payment Gateway Account (Master)
- Super admin creates master Razorpay account
- All online payments go through this account
- Razorpay Route automatically splits payments

### ✅ Optional: Theater Direct Gateway (Kiosk/POS)
- Theaters can have their own gateway for kiosk/POS
- OR use cash/card terminals directly
- No commission involved

### ❌ NOT Needed: 2 Separate Gateway Accounts
- You don't need separate accounts for commission vs no-commission
- Razorpay Route handles everything with ONE account

---

## 📞 Next Steps

1. **Contact Razorpay** to enable Route feature
2. **Set up master account** (super admin)
3. **Onboard theaters** with linked accounts
4. **Configure commission rates** in global settings
5. **Test with test mode** before going live

---

## 🔗 Resources

- **Razorpay Route Docs**: https://razorpay.com/docs/route
- **Account Linking**: https://razorpay.com/docs/route/accounts
- **Split Payments**: https://razorpay.com/docs/route/transfers

---

**📝 Created:** November 5, 2025  
**👤 Created By:** GitHub Copilot  
**🏷️ Status:** Ready for Implementation
