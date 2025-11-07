# 🏦 Dual Payment Gateway Architecture Report

## 📋 Executive Summary

**Requirement:** Each theater needs **2 separate payment gateway configurations**:
1. **API 1**: For Kiosk/POS orders (offline counter orders)
2. **API 2**: For Online orders (QR code/mobile orders)

**Status:** ✅ **100% POSSIBLE AND RECOMMENDED**

---

## ✅ **YES, THIS IS POSSIBLE!**

This is actually a **SMART business strategy** because:

1. ✅ **Separate settlement accounts** - Different money flows for different channels
2. ✅ **Better accounting** - Easy to track online vs offline revenue
3. ✅ **Risk management** - If one gateway fails, other still works
4. ✅ **Gateway optimization** - Use best gateway for each channel
5. ✅ **Flexible commission** - Can charge commission on online only
6. ✅ **Better reporting** - Separate analytics per channel

---

## 🏗️ Architecture Design

### Database Schema

```javascript
Theater Model (backend/models/Theater.js):

paymentGateway: {
  // ============================================
  // API 1: KIOSK/POS PAYMENT GATEWAY
  // ============================================
  kiosk: {
    enabled: { type: Boolean, default: false },
    provider: {
      type: String,
      enum: ['razorpay', 'phonepe', 'paytm', 'stripe', 'none'],
      default: 'none'
    },
    
    // Razorpay Configuration for Kiosk/POS
    razorpay: {
      enabled: { type: Boolean, default: false },
      keyId: { type: String, default: '' },
      keySecret: { type: String, default: '' },  // Encrypted
      webhookSecret: { type: String, default: '' },
      testMode: { type: Boolean, default: true }
    },
    
    // PhonePe Configuration for Kiosk/POS
    phonepe: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      saltKey: { type: String, default: '' },  // Encrypted
      saltIndex: { type: String, default: '' },
      testMode: { type: Boolean, default: true }
    },
    
    // Paytm Configuration for Kiosk/POS
    paytm: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      merchantKey: { type: String, default: '' },  // Encrypted
      websiteName: { type: String, default: 'DEFAULT' },
      industryType: { type: String, default: 'Retail' },
      testMode: { type: Boolean, default: true }
    },
    
    // Accepted payment methods for Kiosk/POS
    acceptedMethods: {
      cash: { type: Boolean, default: true },
      card: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
      netbanking: { type: Boolean, default: false },
      wallet: { type: Boolean, default: false }
    },
    
    configuredAt: Date,
    configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // ============================================
  // API 2: ONLINE PAYMENT GATEWAY
  // ============================================
  online: {
    enabled: { type: Boolean, default: false },
    provider: {
      type: String,
      enum: ['razorpay', 'phonepe', 'paytm', 'stripe', 'none'],
      default: 'none'
    },
    
    // Razorpay Configuration for Online
    razorpay: {
      enabled: { type: Boolean, default: false },
      keyId: { type: String, default: '' },
      keySecret: { type: String, default: '' },  // Encrypted
      webhookSecret: { type: String, default: '' },
      testMode: { type: Boolean, default: true }
    },
    
    // PhonePe Configuration for Online
    phonepe: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      saltKey: { type: String, default: '' },  // Encrypted
      saltIndex: { type: String, default: '' },
      testMode: { type: Boolean, default: true }
    },
    
    // Paytm Configuration for Online
    paytm: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String, default: '' },
      merchantKey: { type: String, default: '' },  // Encrypted
      websiteName: { type: String, default: 'DEFAULT' },
      industryType: { type: String, default: 'Retail' },
      testMode: { type: Boolean, default: true }
    },
    
    // Accepted payment methods for Online
    acceptedMethods: {
      cash: { type: Boolean, default: false },  // Usually no cash online
      card: { type: Boolean, default: true },
      upi: { type: Boolean, default: true },
      netbanking: { type: Boolean, default: true },
      wallet: { type: Boolean, default: true }
    },
    
    configuredAt: Date,
    configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // Global Settings
  defaultProvider: {
    type: String,
    enum: ['razorpay', 'phonepe', 'paytm', 'stripe'],
    default: 'razorpay'
  },
  
  lastUpdated: Date
}
```

---

## 💻 Payment Service Logic

```javascript
// backend/services/paymentService.js

class PaymentService {
  /**
   * Create payment order based on channel (kiosk or online)
   */
  async createPaymentOrder(theater, order, channel = 'online') {
    try {
      // Determine which gateway configuration to use
      const gatewayConfig = channel === 'kiosk' 
        ? theater.paymentGateway.kiosk 
        : theater.paymentGateway.online;
      
      if (!gatewayConfig || !gatewayConfig.enabled) {
        throw new Error(`${channel} payment gateway not configured for this theater`);
      }
      
      const provider = gatewayConfig.provider;
      
      // Create order based on provider
      switch (provider) {
        case 'razorpay':
          return await this.createRazorpayOrder(theater, order, gatewayConfig, channel);
        
        case 'phonepe':
          return await this.createPhonePeOrder(theater, order, gatewayConfig, channel);
        
        case 'paytm':
          return await this.createPaytmOrder(theater, order, gatewayConfig, channel);
        
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error creating ${channel} payment order:`, error);
      throw error;
    }
  }
  
  /**
   * Create Razorpay order for specific channel
   */
  async createRazorpayOrder(theater, order, gatewayConfig, channel) {
    const razorpayCredentials = gatewayConfig.razorpay;
    
    if (!razorpayCredentials || !razorpayCredentials.enabled) {
      throw new Error('Razorpay is not enabled for this channel');
    }
    
    const razorpay = new Razorpay({
      key_id: razorpayCredentials.keyId,
      key_secret: this.decrypt(razorpayCredentials.keySecret)
    });
    
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.pricing.total * 100), // in paise
      currency: order.pricing.currency || 'INR',
      receipt: order.orderNumber,
      notes: {
        theaterId: theater._id.toString(),
        orderId: order._id.toString(),
        theaterName: theater.name,
        channel: channel,  // 'kiosk' or 'online'
        orderType: order.orderType
      }
    });
    
    // Save transaction record
    const transaction = new PaymentTransaction({
      theaterId: theater._id,
      orderId: order._id,
      gateway: {
        provider: 'razorpay',
        orderId: razorpayOrder.id,
        channel: channel  // Track which gateway was used
      },
      amount: {
        value: order.pricing.total,
        currency: order.pricing.currency || 'INR'
      },
      status: 'initiated',
      method: order.payment?.method || 'card',
      customer: {
        name: order.customerInfo?.name,
        phone: order.customerInfo?.phone
      },
      metadata: {
        channel: channel,
        gatewayUsed: 'razorpay'
      }
    });
    
    await transaction.save();
    
    return {
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayCredentials.keyId,
      transaction: transaction,
      channel: channel
    };
  }
  
  /**
   * Get gateway configuration for specific channel
   */
  getGatewayConfig(theater, channel) {
    if (channel === 'kiosk' || channel === 'pos') {
      return theater.paymentGateway?.kiosk;
    } else if (channel === 'online' || channel === 'qr') {
      return theater.paymentGateway?.online;
    }
    
    throw new Error('Invalid channel specified');
  }
  
  /**
   * Verify which gateway to use based on order type
   */
  determineChannel(orderType) {
    if (orderType === 'kiosk' || orderType === 'pos') {
      return 'kiosk';
    } else if (orderType === 'online' || orderType === 'qr') {
      return 'online';
    }
    
    return 'online'; // default
  }
}

module.exports = new PaymentService();
```

---

## 🔌 API Routes Implementation

```javascript
// backend/routes/payments.js

/**
 * POST /api/payments/create-order
 * Create payment order using appropriate gateway based on order type
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
    
    // Determine channel based on order type
    const channel = paymentService.determineChannel(order.orderType);
    
    console.log(`Creating payment order for channel: ${channel}, orderType: ${order.orderType}`);
    
    // Get gateway configuration for this channel
    const gatewayConfig = paymentService.getGatewayConfig(theater, channel);
    
    if (!gatewayConfig || !gatewayConfig.enabled) {
      return res.status(400).json({
        success: false,
        message: `Payment gateway not configured for ${channel} orders`
      });
    }
    
    // Create payment order using channel-specific gateway
    const paymentOrder = await paymentService.createPaymentOrder(
      theater,
      order,
      channel
    );
    
    res.json({
      success: true,
      paymentOrder: paymentOrder,
      provider: gatewayConfig.provider,
      channel: channel,
      orderType: order.orderType
    });
    
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
});

/**
 * GET /api/payments/config/:theaterId/:channel
 * Get payment gateway configuration for specific channel
 */
router.get('/config/:theaterId/:channel', async (req, res) => {
  try {
    const { theaterId, channel } = req.params;
    
    const theater = await Theater.findById(theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    
    // Get configuration for specified channel
    const gatewayConfig = channel === 'kiosk' 
      ? theater.paymentGateway?.kiosk 
      : theater.paymentGateway?.online;
    
    if (!gatewayConfig) {
      return res.json({
        success: true,
        config: {
          provider: 'none',
          isEnabled: false,
          acceptedMethods: {
            cash: true,
            card: false,
            upi: false
          }
        }
      });
    }
    
    // Return only public information
    const publicConfig = {
      provider: gatewayConfig.provider || 'none',
      isEnabled: gatewayConfig.enabled || false,
      acceptedMethods: gatewayConfig.acceptedMethods || {},
      channel: channel
    };
    
    // Add public keys only (not secrets)
    if (gatewayConfig.provider === 'razorpay' && gatewayConfig.razorpay?.enabled) {
      publicConfig.razorpay = {
        keyId: gatewayConfig.razorpay.keyId,
        testMode: gatewayConfig.razorpay.testMode
      };
    } else if (gatewayConfig.provider === 'phonepe' && gatewayConfig.phonepe?.enabled) {
      publicConfig.phonepe = {
        merchantId: gatewayConfig.phonepe.merchantId,
        testMode: gatewayConfig.phonepe.testMode
      };
    }
    
    res.json({ success: true, config: publicConfig });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
```

---

## 💻 Super Admin UI Implementation

```javascript
// frontend/src/pages/admin/TheaterPaymentGatewaySettings.js

const TheaterPaymentGatewaySettings = () => {
  const [theaters, setTheaters] = useState([]);
  const [selectedTheater, setSelectedTheater] = useState(null);
  const [activeTab, setActiveTab] = useState('kiosk'); // 'kiosk' or 'online'
  const [saving, setSaving] = useState(false);
  
  // Kiosk/POS Gateway Settings
  const [kioskSettings, setKioskSettings] = useState({
    enabled: false,
    provider: 'razorpay',
    razorpay: { enabled: false, keyId: '', keySecret: '', testMode: true },
    phonepe: { enabled: false, merchantId: '', saltKey: '', saltIndex: '', testMode: true },
    acceptedMethods: { cash: true, card: true, upi: true }
  });
  
  // Online Gateway Settings
  const [onlineSettings, setOnlineSettings] = useState({
    enabled: false,
    provider: 'razorpay',
    razorpay: { enabled: false, keyId: '', keySecret: '', testMode: true },
    phonepe: { enabled: false, merchantId: '', saltKey: '', saltIndex: '', testMode: true },
    acceptedMethods: { cash: false, card: true, upi: true, netbanking: true, wallet: true }
  });
  
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/admin/theaters/${selectedTheater._id}/payment-gateway`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentGateway: {
            kiosk: kioskSettings,
            online: onlineSettings
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Payment gateway settings saved successfully!');
      } else {
        alert('Failed to save settings: ' + data.message);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="payment-gateway-settings">
      <h1>Payment Gateway Configuration</h1>
      
      {/* Theater Selection */}
      <div className="theater-selector">
        <label>Select Theater:</label>
        <select onChange={(e) => loadTheaterSettings(e.target.value)}>
          <option value="">-- Select Theater --</option>
          {theaters.map(theater => (
            <option key={theater._id} value={theater._id}>
              {theater.name}
            </option>
          ))}
        </select>
      </div>
      
      {selectedTheater && (
        <>
          {/* Channel Tabs */}
          <div className="channel-tabs">
            <button 
              className={activeTab === 'kiosk' ? 'active' : ''}
              onClick={() => setActiveTab('kiosk')}
            >
              🏪 Kiosk/POS Gateway (API 1)
            </button>
            <button 
              className={activeTab === 'online' ? 'active' : ''}
              onClick={() => setActiveTab('online')}
            >
              📱 Online Gateway (API 2)
            </button>
          </div>
          
          {/* Kiosk/POS Settings */}
          {activeTab === 'kiosk' && (
            <div className="gateway-config">
              <h2>Kiosk/POS Payment Gateway (API 1)</h2>
              <p>Configure payment gateway for counter/kiosk orders</p>
              
              <div className="form-group">
                <label>
                  <input 
                    type="checkbox"
                    checked={kioskSettings.enabled}
                    onChange={(e) => setKioskSettings({...kioskSettings, enabled: e.target.checked})}
                  />
                  Enable Kiosk/POS Payment Gateway
                </label>
              </div>
              
              <div className="form-group">
                <label>Payment Provider:</label>
                <select 
                  value={kioskSettings.provider}
                  onChange={(e) => setKioskSettings({...kioskSettings, provider: e.target.value})}
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="phonepe">PhonePe</option>
                  <option value="paytm">Paytm</option>
                </select>
              </div>
              
              {/* Razorpay Config */}
              {kioskSettings.provider === 'razorpay' && (
                <div className="provider-config">
                  <h3>Razorpay Configuration</h3>
                  
                  <div className="form-group">
                    <label>Key ID:</label>
                    <input 
                      type="text"
                      value={kioskSettings.razorpay.keyId}
                      onChange={(e) => setKioskSettings({
                        ...kioskSettings,
                        razorpay: {...kioskSettings.razorpay, keyId: e.target.value}
                      })}
                      placeholder="rzp_live_xxxxx or rzp_test_xxxxx"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Key Secret:</label>
                    <input 
                      type="password"
                      value={kioskSettings.razorpay.keySecret}
                      onChange={(e) => setKioskSettings({
                        ...kioskSettings,
                        razorpay: {...kioskSettings.razorpay, keySecret: e.target.value}
                      })}
                      placeholder="Enter Key Secret"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>
                      <input 
                        type="checkbox"
                        checked={kioskSettings.razorpay.testMode}
                        onChange={(e) => setKioskSettings({
                          ...kioskSettings,
                          razorpay: {...kioskSettings.razorpay, testMode: e.target.checked}
                        })}
                      />
                      Test Mode
                    </label>
                  </div>
                </div>
              )}
              
              {/* Accepted Methods */}
              <div className="accepted-methods">
                <h4>Accepted Payment Methods:</h4>
                <label>
                  <input type="checkbox" checked={kioskSettings.acceptedMethods.cash}
                    onChange={(e) => setKioskSettings({
                      ...kioskSettings,
                      acceptedMethods: {...kioskSettings.acceptedMethods, cash: e.target.checked}
                    })}
                  /> Cash
                </label>
                <label>
                  <input type="checkbox" checked={kioskSettings.acceptedMethods.card}
                    onChange={(e) => setKioskSettings({
                      ...kioskSettings,
                      acceptedMethods: {...kioskSettings.acceptedMethods, card: e.target.checked}
                    })}
                  /> Card
                </label>
                <label>
                  <input type="checkbox" checked={kioskSettings.acceptedMethods.upi}
                    onChange={(e) => setKioskSettings({
                      ...kioskSettings,
                      acceptedMethods: {...kioskSettings.acceptedMethods, upi: e.target.checked}
                    })}
                  /> UPI
                </label>
              </div>
            </div>
          )}
          
          {/* Online Settings */}
          {activeTab === 'online' && (
            <div className="gateway-config">
              <h2>Online Payment Gateway (API 2)</h2>
              <p>Configure payment gateway for QR code/online orders</p>
              
              {/* Similar structure as Kiosk but with onlineSettings */}
              {/* ... (same form fields but for online) ... */}
            </div>
          )}
          
          {/* Save Button */}
          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save Payment Gateway Settings'}
          </button>
        </>
      )}
    </div>
  );
};

export default TheaterPaymentGatewaySettings;
```

---

## 📊 Example Configuration

### Theater A (PVR Cinemas):
```javascript
{
  name: "PVR Cinemas",
  paymentGateway: {
    // API 1: Kiosk/POS
    kiosk: {
      enabled: true,
      provider: "razorpay",
      razorpay: {
        enabled: true,
        keyId: "rzp_live_KioskPVR_xxxxx",
        keySecret: "encrypted_secret_1",
        testMode: false
      },
      acceptedMethods: {
        cash: true,
        card: true,
        upi: true
      }
    },
    
    // API 2: Online
    online: {
      enabled: true,
      provider: "phonepe",
      phonepe: {
        enabled: true,
        merchantId: "PVRCINEMAONLINE",
        saltKey: "encrypted_salt_key",
        saltIndex: "1",
        testMode: false
      },
      acceptedMethods: {
        card: true,
        upi: true,
        netbanking: true,
        wallet: true
      }
    }
  }
}
```

### Theater B (INOX):
```javascript
{
  name: "INOX Theaters",
  paymentGateway: {
    // API 1: Kiosk/POS
    kiosk: {
      enabled: true,
      provider: "paytm",
      paytm: {
        enabled: true,
        merchantId: "INOXKIOSK12345",
        merchantKey: "encrypted_merchant_key",
        testMode: false
      }
    },
    
    // API 2: Online
    online: {
      enabled: true,
      provider: "razorpay",
      razorpay: {
        enabled: true,
        keyId: "rzp_live_INOXOnline_xxxxx",
        keySecret: "encrypted_secret_2",
        testMode: false
      }
    }
  }
}
```

---

## 🔄 Payment Flow

### KIOSK Order Flow:
```
1. Customer orders at kiosk counter
2. System detects orderType = "kiosk"
3. System loads theater.paymentGateway.kiosk configuration
4. Uses Kiosk API credentials (API 1)
5. Payment goes to Theater's Kiosk Bank Account
```

### ONLINE Order Flow:
```
1. Customer scans QR code on mobile
2. System detects orderType = "online"
3. System loads theater.paymentGateway.online configuration
4. Uses Online API credentials (API 2)
5. Payment goes to Theater's Online Bank Account
```

---

## ✅ Benefits of Dual Gateway Setup

### 1. **Separate Accounting**
- Kiosk revenue → Bank Account A
- Online revenue → Bank Account B
- Easy reconciliation and reporting

### 2. **Risk Management**
- If one gateway fails, other channel still works
- Reduce dependency on single provider

### 3. **Gateway Optimization**
- Use Razorpay for kiosk (lower fees)
- Use PhonePe for online (better UPI success rate)

### 4. **Commission Flexibility**
- Can charge commission on online only
- Kiosk remains commission-free

### 5. **Better Analytics**
- Separate transaction tracking per channel
- Channel-specific settlement reports

---

## 💰 Cost Comparison

### Theater Monthly Revenue: ₹1,00,000
- Kiosk Orders: ₹60,000 (60%)
- Online Orders: ₹40,000 (40%)

### Option 1: Single Gateway (Both channels)
```
Total Revenue: ₹1,00,000
Gateway Fee (2%): ₹2,000
Net Revenue: ₹98,000
```

### Option 2: Dual Gateway (Your Approach)
```
Kiosk via Razorpay (2%): ₹60,000 - ₹1,200 = ₹58,800
Online via PhonePe (1.5%): ₹40,000 - ₹600 = ₹39,400
Total Net Revenue: ₹98,200

Savings: ₹200/month
```

---

## 🚀 Implementation Timeline

### Phase 1: Database (Day 1 - 2 hours)
- ✅ Update Theater model with dual gateway structure
- ✅ Add migration script to update existing theaters
- ✅ Test database schema

### Phase 2: Backend (Day 1-2 - 4 hours)
- ✅ Update PaymentService with channel detection
- ✅ Update payment routes to handle both channels
- ✅ Add encryption for sensitive credentials
- ✅ Test API endpoints

### Phase 3: Super Admin UI (Day 2-3 - 4 hours)
- ✅ Create dual gateway configuration page
- ✅ Add theater selection dropdown
- ✅ Add channel tabs (Kiosk vs Online)
- ✅ Test saving both configurations

### Phase 4: Frontend Integration (Day 3 - 3 hours)
- ✅ Update customer payment page to fetch correct gateway
- ✅ Update kiosk payment page to use kiosk gateway
- ✅ Test payment flow for both channels

### Phase 5: Testing (Day 4 - 3 hours)
- ✅ Test kiosk orders with API 1
- ✅ Test online orders with API 2
- ✅ Test payment verification
- ✅ Test error scenarios

**Total Estimated Time:** 16-18 hours (4 working days)

---

## 🎯 Summary

| Question | Answer |
|----------|--------|
| Can theater have 2 separate gateways? | ✅ **YES** |
| One for Kiosk, one for Online? | ✅ **YES** |
| Different providers (Razorpay + PhonePe)? | ✅ **YES** |
| Super admin configures both? | ✅ **YES** |
| Money goes to different accounts? | ✅ **YES** |
| Is this recommended? | ✅ **YES, SMART APPROACH** |

---

## 📝 Next Steps

1. ✅ Review this report
2. ✅ Confirm you want this approach
3. ✅ I'll start implementing the dual gateway system
4. ✅ Create super admin configuration UI
5. ✅ Test with both channels

---

**💡 RECOMMENDATION:** This dual gateway approach is **EXCELLENT** for your business model. It provides maximum flexibility, better accounting, and risk management.

---

**📝 Created:** November 5, 2025  
**👤 Created By:** GitHub Copilot  
**🏷️ Status:** ✅ Ready to Implement - Awaiting Your Approval
