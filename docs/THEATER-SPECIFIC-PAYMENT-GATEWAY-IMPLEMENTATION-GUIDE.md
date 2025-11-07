# 🏦 Theater-Specific Payment Gateway Implementation Guide

## 📋 Executive Summary

This document provides a comprehensive plan to implement **separate payment gateway credentials for each theater** in the YQPAY system. Currently, the system supports payment methods (Cash, Card, UPI) but lacks integrated payment gateway functionality. This guide will help you add support for popular Indian payment gateways (Razorpay, PhonePe, Paytm) with theater-specific credentials.

---

## 🎯 Current State Analysis

### What You Have Now:
1. ✅ **Theater Model** - Has basic payment settings in global Settings model
2. ✅ **Order Model** - Supports payment methods (cash, card, upi)
3. ✅ **Payment UI** - Customer payment page with method selection
4. ✅ **Settings Model** - Has `razorpayEnabled` and `razorpayKeyId` fields (global)
5. ❌ **No Gateway Integration** - No actual payment processing code
6. ❌ **No Theater-Specific Credentials** - Settings are global, not per-theater

### What You Need:
1. 🔧 Theater-specific payment gateway credentials storage
2. 🔧 Payment gateway SDK integration (Razorpay/PhonePe/Paytm)
3. 🔧 Payment processing endpoints
4. 🔧 Payment verification and webhook handling
5. 🔧 Admin UI to configure theater payment settings
6. 🔧 Theater dashboard to view payment configurations

---

## 🏗️ Architecture Design

### Database Schema Changes

#### 1. Theater Model Enhancement (`backend/models/Theater.js`)

Add a new `paymentGateway` field to store theater-specific credentials:

```javascript
paymentGateway: {
  // Primary Gateway Configuration
  provider: {
    type: String,
    enum: ['razorpay', 'phonepe', 'paytm', 'stripe', 'none'],
    default: 'none'
  },
  isEnabled: {
    type: Boolean,
    default: false
  },
  
  // Razorpay Configuration
  razorpay: {
    enabled: { type: Boolean, default: false },
    keyId: { type: String, default: '' },
    keySecret: { type: String, default: '' }, // ⚠️ ENCRYPTED in production
    webhookSecret: { type: String, default: '' },
    accountId: { type: String, default: '' }, // For route/linked accounts
    testMode: { type: Boolean, default: true }
  },
  
  // PhonePe Configuration
  phonepe: {
    enabled: { type: Boolean, default: false },
    merchantId: { type: String, default: '' },
    saltKey: { type: String, default: '' }, // ⚠️ ENCRYPTED
    saltIndex: { type: String, default: '' },
    testMode: { type: Boolean, default: true }
  },
  
  // Paytm Configuration
  paytm: {
    enabled: { type: Boolean, default: false },
    merchantId: { type: String, default: '' },
    merchantKey: { type: String, default: '' }, // ⚠️ ENCRYPTED
    websiteName: { type: String, default: 'DEFAULT' },
    industryType: { type: String, default: 'Retail' },
    testMode: { type: Boolean, default: true }
  },
  
  // Payment Methods Accepted
  acceptedMethods: {
    cash: { type: Boolean, default: true },
    card: { type: Boolean, default: true },
    upi: { type: Boolean, default: true },
    netbanking: { type: Boolean, default: true },
    wallet: { type: Boolean, default: true }
  },
  
  // Settlement Configuration
  settlement: {
    autoSettle: { type: Boolean, default: true },
    settlementPeriod: { type: String, default: 'T+1' } // T+0, T+1, T+3, etc.
  },
  
  // Metadata
  configuredAt: Date,
  configuredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdated: Date
}
```

#### 2. Payment Transaction Model (NEW - `backend/models/PaymentTransaction.js`)

Create a new model to track all payment transactions:

```javascript
const paymentTransactionSchema = new mongoose.Schema({
  theaterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theater',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  // Payment Gateway Details
  gateway: {
    provider: {
      type: String,
      enum: ['razorpay', 'phonepe', 'paytm', 'stripe', 'cash', 'manual'],
      required: true
    },
    transactionId: String, // Gateway's transaction ID
    orderId: String, // Gateway's order ID
    paymentId: String, // Gateway's payment ID
    signature: String // For verification
  },
  
  // Amount Details
  amount: {
    value: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  
  // Payment Status
  status: {
    type: String,
    enum: ['initiated', 'pending', 'processing', 'success', 'failed', 'cancelled', 'refunded'],
    default: 'initiated',
    index: true
  },
  
  // Payment Method
  method: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cash'],
    required: true
  },
  
  // Customer Details
  customer: {
    name: String,
    email: String,
    phone: String
  },
  
  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  completedAt: Date,
  failedAt: Date,
  
  // Error Details
  error: {
    code: String,
    message: String,
    description: String
  },
  
  // Refund Details
  refund: {
    amount: Number,
    status: String,
    refundId: String,
    initiatedAt: Date,
    completedAt: Date
  },
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  
  // Webhook Data
  webhookData: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Indexes
paymentTransactionSchema.index({ 'gateway.transactionId': 1 });
paymentTransactionSchema.index({ 'gateway.orderId': 1 });
paymentTransactionSchema.index({ status: 1, createdAt: -1 });
paymentTransactionSchema.index({ theaterId: 1, status: 1 });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
```

---

## 🔧 Backend Implementation

### Step 1: Install Payment Gateway SDKs

```bash
cd backend
npm install razorpay
npm install phonepe-payment-sdk
npm install paytmchecksum
npm install crypto
```

### Step 2: Create Payment Service (`backend/services/paymentService.js`)

This service will handle all payment gateway operations:

```javascript
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentTransaction = require('../models/PaymentTransaction');

class PaymentService {
  /**
   * Initialize Razorpay instance for specific theater
   */
  getRazorpayInstance(theaterConfig) {
    if (!theaterConfig.razorpay.enabled) {
      throw new Error('Razorpay is not enabled for this theater');
    }
    
    return new Razorpay({
      key_id: theaterConfig.razorpay.keyId,
      key_secret: this.decrypt(theaterConfig.razorpay.keySecret)
    });
  }
  
  /**
   * Create Razorpay Order
   */
  async createRazorpayOrder(theater, order, options = {}) {
    try {
      const razorpay = this.getRazorpayInstance(theater.paymentGateway);
      
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.pricing.total * 100), // Amount in paise
        currency: order.pricing.currency || 'INR',
        receipt: order.orderNumber,
        notes: {
          theaterId: theater._id.toString(),
          orderId: order._id.toString(),
          theaterName: theater.name
        }
      });
      
      // Save transaction record
      const transaction = new PaymentTransaction({
        theaterId: theater._id,
        orderId: order._id,
        gateway: {
          provider: 'razorpay',
          orderId: razorpayOrder.id
        },
        amount: {
          value: order.pricing.total,
          currency: order.pricing.currency || 'INR'
        },
        status: 'initiated',
        method: options.method || 'card',
        customer: {
          name: order.customerInfo?.name,
          email: order.customerInfo?.email,
          phone: order.customerInfo?.phone
        }
      });
      
      await transaction.save();
      
      return {
        success: true,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: theater.paymentGateway.razorpay.keyId,
        transaction: transaction
      };
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify Razorpay Payment Signature
   */
  verifyRazorpaySignature(orderId, paymentId, signature, keySecret) {
    const text = `${orderId}|${paymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', this.decrypt(keySecret))
      .update(text)
      .digest('hex');
    
    return generated_signature === signature;
  }
  
  /**
   * Update Payment Transaction Status
   */
  async updateTransactionStatus(transactionId, status, data = {}) {
    const transaction = await PaymentTransaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    transaction.status = status;
    
    if (status === 'success') {
      transaction.completedAt = new Date();
      transaction.gateway.paymentId = data.paymentId;
      transaction.gateway.signature = data.signature;
    } else if (status === 'failed') {
      transaction.failedAt = new Date();
      transaction.error = data.error;
    }
    
    if (data.metadata) {
      transaction.metadata = data.metadata;
    }
    
    await transaction.save();
    return transaction;
  }
  
  /**
   * Encrypt sensitive data (use in production)
   */
  encrypt(text) {
    // Implement proper encryption (AES-256)
    // For now, return as-is (⚠️ INSECURE - only for development)
    return text;
  }
  
  /**
   * Decrypt sensitive data
   */
  decrypt(text) {
    // Implement proper decryption
    // For now, return as-is (⚠️ INSECURE - only for development)
    return text;
  }
  
  /**
   * PhonePe Payment Integration (to be implemented)
   */
  async createPhonePeOrder(theater, order, options = {}) {
    // TODO: Implement PhonePe integration
    throw new Error('PhonePe integration not implemented yet');
  }
  
  /**
   * Paytm Payment Integration (to be implemented)
   */
  async createPaytmOrder(theater, order, options = {}) {
    // TODO: Implement Paytm integration
    throw new Error('Paytm integration not implemented yet');
  }
}

module.exports = new PaymentService();
```

### Step 3: Create Payment Routes (`backend/routes/payments.js`)

```javascript
const express = require('express');
const router = express.Router();
const Theater = require('../models/Theater');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentService = require('../services/paymentService');
const { authMiddleware, theaterAuthMiddleware } = require('../middleware/auth');

/**
 * GET /api/payments/config/:theaterId
 * Get payment gateway configuration for a theater (public keys only)
 */
router.get('/config/:theaterId', async (req, res) => {
  try {
    const theater = await Theater.findById(req.params.theaterId);
    
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    
    // Return only public information
    const config = {
      provider: theater.paymentGateway?.provider || 'none',
      isEnabled: theater.paymentGateway?.isEnabled || false,
      acceptedMethods: theater.paymentGateway?.acceptedMethods || {
        cash: true,
        card: false,
        upi: false,
        netbanking: false,
        wallet: false
      },
      razorpay: theater.paymentGateway?.razorpay?.enabled ? {
        keyId: theater.paymentGateway.razorpay.keyId,
        testMode: theater.paymentGateway.razorpay.testMode
      } : null
    };
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/payments/create-order
 * Create payment gateway order
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }
    
    // Get order details
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Get theater configuration
    const theater = await Theater.findById(order.theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    
    if (!theater.paymentGateway?.isEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment gateway not configured for this theater' 
      });
    }
    
    // Create payment order based on gateway provider
    let paymentOrder;
    const provider = theater.paymentGateway.provider;
    
    switch (provider) {
      case 'razorpay':
        paymentOrder = await paymentService.createRazorpayOrder(
          theater, 
          order, 
          { method: paymentMethod }
        );
        break;
      
      case 'phonepe':
        paymentOrder = await paymentService.createPhonePeOrder(
          theater, 
          order, 
          { method: paymentMethod }
        );
        break;
      
      case 'paytm':
        paymentOrder = await paymentService.createPaytmOrder(
          theater, 
          order, 
          { method: paymentMethod }
        );
        break;
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: `Unsupported payment gateway: ${provider}` 
        });
    }
    
    res.json({
      success: true,
      paymentOrder: paymentOrder,
      provider: provider
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
 * POST /api/payments/verify
 * Verify payment signature and update order
 */
router.post('/verify', async (req, res) => {
  try {
    const { 
      orderId, 
      paymentId, 
      signature, 
      razorpayOrderId,
      transactionId 
    } = req.body;
    
    // Get transaction
    const transaction = await PaymentTransaction.findOne({
      _id: transactionId,
      'gateway.orderId': razorpayOrderId
    });
    
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }
    
    // Get theater
    const theater = await Theater.findById(transaction.theaterId);
    if (!theater) {
      return res.status(404).json({ success: false, message: 'Theater not found' });
    }
    
    // Verify signature
    const isValid = paymentService.verifyRazorpaySignature(
      razorpayOrderId,
      paymentId,
      signature,
      theater.paymentGateway.razorpay.keySecret
    );
    
    if (!isValid) {
      // Update transaction as failed
      await paymentService.updateTransactionStatus(transaction._id, 'failed', {
        error: {
          code: 'SIGNATURE_VERIFICATION_FAILED',
          message: 'Payment signature verification failed'
        }
      });
      
      return res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
    
    // Update transaction as success
    await paymentService.updateTransactionStatus(transaction._id, 'success', {
      paymentId,
      signature
    });
    
    // Update order payment status
    const order = await Order.findById(transaction.orderId);
    if (order) {
      order.payment.status = 'paid';
      order.payment.transactionId = paymentId;
      order.payment.paidAt = new Date();
      await order.save();
    }
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: order
    });
    
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Payment verification failed' 
    });
  }
});

/**
 * POST /api/payments/webhook/razorpay
 * Razorpay webhook handler
 */
router.post('/webhook/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const payload = req.body;
    
    // TODO: Verify webhook signature
    // TODO: Process webhook events (payment.captured, payment.failed, etc.)
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

/**
 * GET /api/payments/transactions/:theaterId
 * Get payment transactions for a theater (admin only)
 */
router.get('/transactions/:theaterId', theaterAuthMiddleware, async (req, res) => {
  try {
    const transactions = await PaymentTransaction.find({
      theaterId: req.params.theaterId
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('orderId', 'orderNumber customerInfo pricing');
    
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
```

### Step 4: Add Route to Server (`backend/server.js`)

```javascript
// Add this line with other routes
const paymentRoutes = require('./routes/payments');
app.use('/api/payments', paymentRoutes);
```

---

## 💻 Frontend Implementation

### Step 1: Update Customer Payment Page (`frontend/src/pages/customer/CustomerPayment.js`)

Add Razorpay integration:

```javascript
// Add at the top
import config from '../../config';

// Add state for Razorpay
const [paymentConfig, setPaymentConfig] = useState(null);

// Fetch payment configuration
useEffect(() => {
  const fetchPaymentConfig = async () => {
    try {
      const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || 'null');
      if (!checkoutData?.theaterId) return;
      
      const response = await fetch(
        `${config.api.baseUrl}/payments/config/${checkoutData.theaterId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setPaymentConfig(data.config);
      }
    } catch (error) {
      console.error('Error fetching payment config:', error);
    }
  };
  
  fetchPaymentConfig();
}, []);

// Load Razorpay script
useEffect(() => {
  if (paymentConfig?.provider === 'razorpay' && paymentConfig?.razorpay?.keyId) {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }
}, [paymentConfig]);

// Update handlePayNow function
const handlePayNow = async () => {
  if (!selectedPaymentMethod) {
    setError('Please select a payment method');
    return;
  }
  
  setLoading(true);
  setError('');
  
  try {
    const checkoutData = JSON.parse(localStorage.getItem('checkoutData') || 'null');
    
    // First, create the order in your system
    const orderResponse = await fetch(`${config.api.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theaterId: checkoutData.theaterId,
        items: cartItems,
        customerInfo: {
          phone: phoneNumber,
          name: checkoutData.customerName || 'Guest'
        },
        paymentMethod: selectedPaymentMethod,
        qrName: checkoutData.qrName,
        seat: checkoutData.seat
      })
    });
    
    const orderData = await orderResponse.json();
    
    if (!orderData.success) {
      throw new Error(orderData.message || 'Failed to create order');
    }
    
    // If payment gateway is enabled, initiate online payment
    if (paymentConfig?.isEnabled && 
        paymentConfig.provider === 'razorpay' &&
        selectedPaymentMethod !== 'cash') {
      
      // Create Razorpay order
      const paymentOrderResponse = await fetch(`${config.api.baseUrl}/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.order._id,
          paymentMethod: selectedPaymentMethod
        })
      });
      
      const paymentOrderData = await paymentOrderResponse.json();
      
      if (!paymentOrderData.success) {
        throw new Error('Failed to initialize payment');
      }
      
      // Open Razorpay checkout
      const options = {
        key: paymentOrderData.paymentOrder.keyId,
        amount: paymentOrderData.paymentOrder.amount,
        currency: paymentOrderData.paymentOrder.currency,
        name: checkoutData.theaterName || 'YQPAY',
        description: `Order ${orderData.order.orderNumber}`,
        order_id: paymentOrderData.paymentOrder.orderId,
        handler: async function (response) {
          // Payment successful - verify signature
          try {
            const verifyResponse = await fetch(`${config.api.baseUrl}/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: orderData.order._id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                razorpayOrderId: response.razorpay_order_id,
                transactionId: paymentOrderData.paymentOrder.transaction._id
              })
            });
            
            const verifyData = await verifyResponse.json();
            
            if (verifyData.success) {
              // Clear cart and redirect to success
              clearCart();
              localStorage.removeItem('checkoutData');
              navigate('/customer/order-confirmation', {
                state: {
                  order: verifyData.order,
                  paymentId: response.razorpay_payment_id
                }
              });
            } else {
              setError('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            setError('Payment verification failed');
          }
        },
        prefill: {
          contact: phoneNumber
        },
        theme: {
          color: '#6B0E9B'
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            setError('Payment cancelled');
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } else {
      // Cash payment or gateway not configured - direct success
      clearCart();
      localStorage.removeItem('checkoutData');
      navigate('/customer/order-confirmation', {
        state: { order: orderData.order }
      });
    }
    
  } catch (error) {
    console.error('Payment error:', error);
    setError(error.message || 'Payment failed');
  } finally {
    setLoading(false);
  }
};
```

### Step 2: Create Theater Payment Settings Page (`frontend/src/pages/theater/TheaterPaymentSettings.js`)

Create a new page for theater admins to configure their payment gateway:

```javascript
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import config from '../../config';
import '../../styles/TheaterList.css';

const TheaterPaymentSettings = () => {
  const { theaterId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theater, setTheater] = useState(null);
  const [settings, setSettings] = useState({
    provider: 'none',
    isEnabled: false,
    razorpay: {
      enabled: false,
      keyId: '',
      keySecret: '',
      webhookSecret: '',
      testMode: true
    },
    acceptedMethods: {
      cash: true,
      card: true,
      upi: true,
      netbanking: true,
      wallet: true
    }
  });
  
  useEffect(() => {
    fetchTheaterSettings();
  }, [theaterId]);
  
  const fetchTheaterSettings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.success) {
        setTheater(data.data);
        if (data.data.paymentGateway) {
          setSettings(data.data.paymentGateway);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentGateway: settings
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('Payment settings saved successfully!');
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
  
  if (loading) {
    return <TheaterLayout pageTitle="Payment Settings">Loading...</TheaterLayout>;
  }
  
  return (
    <TheaterLayout pageTitle="Payment Gateway Settings" currentPage="payment-settings">
      <div className="payment-settings-container">
        <h2>Payment Gateway Configuration</h2>
        
        {/* Provider Selection */}
        <div className="form-group">
          <label>Payment Gateway Provider</label>
          <select
            value={settings.provider}
            onChange={(e) => setSettings({...settings, provider: e.target.value})}
          >
            <option value="none">None (Cash Only)</option>
            <option value="razorpay">Razorpay</option>
            <option value="phonepe">PhonePe (Coming Soon)</option>
            <option value="paytm">Paytm (Coming Soon)</option>
          </select>
        </div>
        
        {/* Enable/Disable Toggle */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={settings.isEnabled}
              onChange={(e) => setSettings({...settings, isEnabled: e.target.checked})}
            />
            Enable Online Payments
          </label>
        </div>
        
        {/* Razorpay Configuration */}
        {settings.provider === 'razorpay' && (
          <div className="razorpay-config">
            <h3>Razorpay Configuration</h3>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.razorpay.enabled}
                  onChange={(e) => setSettings({
                    ...settings,
                    razorpay: {...settings.razorpay, enabled: e.target.checked}
                  })}
                />
                Enable Razorpay
              </label>
            </div>
            
            <div className="form-group">
              <label>Key ID</label>
              <input
                type="text"
                value={settings.razorpay.keyId}
                onChange={(e) => setSettings({
                  ...settings,
                  razorpay: {...settings.razorpay, keyId: e.target.value}
                })}
                placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
              />
            </div>
            
            <div className="form-group">
              <label>Key Secret</label>
              <input
                type="password"
                value={settings.razorpay.keySecret}
                onChange={(e) => setSettings({
                  ...settings,
                  razorpay: {...settings.razorpay, keySecret: e.target.value}
                })}
                placeholder="Enter your Razorpay Key Secret"
              />
            </div>
            
            <div className="form-group">
              <label>Webhook Secret</label>
              <input
                type="text"
                value={settings.razorpay.webhookSecret}
                onChange={(e) => setSettings({
                  ...settings,
                  razorpay: {...settings.razorpay, webhookSecret: e.target.value}
                })}
                placeholder="Optional: Webhook secret for verification"
              />
            </div>
            
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.razorpay.testMode}
                  onChange={(e) => setSettings({
                    ...settings,
                    razorpay: {...settings.razorpay, testMode: e.target.checked}
                  })}
                />
                Test Mode (Use test credentials)
              </label>
            </div>
          </div>
        )}
        
        {/* Accepted Payment Methods */}
        <div className="accepted-methods">
          <h3>Accepted Payment Methods</h3>
          
          <label>
            <input
              type="checkbox"
              checked={settings.acceptedMethods.cash}
              onChange={(e) => setSettings({
                ...settings,
                acceptedMethods: {...settings.acceptedMethods, cash: e.target.checked}
              })}
            />
            Cash
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={settings.acceptedMethods.card}
              onChange={(e) => setSettings({
                ...settings,
                acceptedMethods: {...settings.acceptedMethods, card: e.target.checked}
              })}
            />
            Credit/Debit Card
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={settings.acceptedMethods.upi}
              onChange={(e) => setSettings({
                ...settings,
                acceptedMethods: {...settings.acceptedMethods, upi: e.target.checked}
              })}
            />
            UPI
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={settings.acceptedMethods.netbanking}
              onChange={(e) => setSettings({
                ...settings,
                acceptedMethods: {...settings.acceptedMethods, netbanking: e.target.checked}
              })}
            />
            Net Banking
          </label>
          
          <label>
            <input
              type="checkbox"
              checked={settings.acceptedMethods.wallet}
              onChange={(e) => setSettings({
                ...settings,
                acceptedMethods: {...settings.acceptedMethods, wallet: e.target.checked}
              })}
            />
            Wallets (Paytm, PhonePe, etc.)
          </label>
        </div>
        
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="save-button"
        >
          {saving ? 'Saving...' : 'Save Payment Settings'}
        </button>
        
        <div className="help-section">
          <h4>How to Get Razorpay Credentials?</h4>
          <ol>
            <li>Visit <a href="https://razorpay.com" target="_blank">razorpay.com</a></li>
            <li>Sign up or log in to your account</li>
            <li>Go to Settings → API Keys</li>
            <li>Generate API keys (Test or Live mode)</li>
            <li>Copy the Key ID and Key Secret</li>
            <li>Paste them in the fields above</li>
          </ol>
          
          <p><strong>⚠️ Security Note:</strong> Never share your Key Secret with anyone. Keep it confidential.</p>
        </div>
      </div>
      
      <style jsx>{`
        .payment-settings-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        
        .form-group input[type="text"],
        .form-group input[type="password"],
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .razorpay-config,
        .accepted-methods {
          background: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        
        .save-button {
          background: #6B0E9B;
          color: white;
          padding: 12px 30px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
        }
        
        .save-button:hover {
          background: #5A0C82;
        }
        
        .save-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .help-section {
          margin-top: 40px;
          padding: 20px;
          background: #e8f4f8;
          border-radius: 8px;
        }
        
        .help-section h4 {
          margin-top: 0;
        }
        
        .help-section a {
          color: #6B0E9B;
          text-decoration: none;
          font-weight: 600;
        }
      `}</style>
    </TheaterLayout>
  );
};

export default TheaterPaymentSettings;
```

---

## 📝 Implementation Steps Summary

### Phase 1: Database Setup (1-2 hours)
1. ✅ Update Theater model with `paymentGateway` field
2. ✅ Create PaymentTransaction model
3. ✅ Run database migration/update

### Phase 2: Backend Core (3-4 hours)
1. ✅ Install payment gateway SDKs
2. ✅ Create PaymentService class
3. ✅ Create payment routes (config, create-order, verify, webhook)
4. ✅ Add routes to server.js
5. ✅ Test with Postman/Thunder Client

### Phase 3: Frontend Customer Flow (2-3 hours)
1. ✅ Update CustomerPayment.js with Razorpay integration
2. ✅ Load Razorpay script dynamically
3. ✅ Implement payment verification
4. ✅ Handle payment success/failure

### Phase 4: Frontend Theater Admin (2-3 hours)
1. ✅ Create TheaterPaymentSettings page
2. ✅ Add route to theater navigation
3. ✅ Test saving/loading payment credentials

### Phase 5: Testing & Security (2-3 hours)
1. ✅ Test with Razorpay test credentials
2. ✅ Implement encryption for sensitive data
3. ✅ Add webhook signature verification
4. ✅ Test payment flow end-to-end

### Phase 6: Additional Gateways (Optional - 4-6 hours each)
1. 🔄 PhonePe integration
2. 🔄 Paytm integration
3. 🔄 Stripe integration (international)

---

## 🔐 Security Best Practices

1. **Encrypt Sensitive Data**
   - Never store payment gateway secrets in plain text
   - Use AES-256 encryption for key storage
   - Store encryption key in environment variables

2. **Validate Webhook Signatures**
   - Always verify webhook signatures
   - Prevent replay attacks

3. **Use HTTPS Only**
   - Never transmit payment data over HTTP
   - Enforce SSL/TLS

4. **Environment Variables**
   - Store encryption keys in .env files
   - Never commit .env to Git

5. **PCI Compliance**
   - Never store card details on your server
   - Use gateway-provided card tokenization

---

## 💰 Cost Estimation

### Razorpay Pricing (India):
- **Transaction Fee**: 2% per successful payment
- **Setup Fee**: ₹0 (Free)
- **No monthly fees**
- **Instant settlements available**: T+0 (additional fee)

### PhonePe Pricing:
- **Transaction Fee**: 1.5-2% per payment
- **Merchant onboarding required**

### Paytm Pricing:
- **Transaction Fee**: 1.99-2.49% per payment
- **Merchant account required**

---

## 📊 Expected Benefits

1. ✅ **Increased Revenue**: Accept online payments 24/7
2. ✅ **Better Cash Flow**: Instant settlements to bank account
3. ✅ **Reduced Cash Handling**: Less dependency on cash
4. ✅ **Customer Convenience**: Multiple payment options
5. ✅ **Automated Reconciliation**: Easy tracking of payments
6. ✅ **Professional Image**: Modern payment experience

---

## 🎯 Next Steps - AWAITING YOUR APPROVAL

**Before I proceed with implementation, please confirm:**

1. ✅ **Do you approve this implementation plan?**
2. ✅ **Which payment gateway do you want to start with?** (Recommended: Razorpay)
3. ✅ **Do you have existing payment gateway accounts?** (If yes, provide test credentials)
4. ✅ **Timeline expectations?** (Estimated: 2-3 days for full implementation)
5. ✅ **Any specific requirements or modifications needed?**

---

## 📞 Support & Resources

### Razorpay Documentation:
- Website: https://razorpay.com
- API Docs: https://razorpay.com/docs/api
- Test Credentials: https://razorpay.com/docs/payments/payments/test-card-details

### PhonePe Documentation:
- Website: https://www.phonepe.com/business
- Merchant Onboarding: https://business.phonepe.com

### Paytm Documentation:
- Website: https://business.paytm.com
- API Docs: https://developer.paytm.com/docs

---

**📝 Document Version**: 1.0  
**📅 Created**: November 5, 2025  
**👤 Created By**: GitHub Copilot  
**🏷️ Status**: Awaiting Approval
