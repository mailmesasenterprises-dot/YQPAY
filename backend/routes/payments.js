const express = require('express');
const router = express.Router();
const Theater = require('../models/Theater');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentService = require('../services/paymentService');

/**
 * GET /api/payments/config/:theaterId/:channel
 * Get payment gateway configuration for specific channel
 */
router.get('/config/:theaterId/:channel', async (req, res) => {
  try {
    const { theaterId, channel } = req.params;
    
    console.log(`📡 Fetching payment config for theater ${theaterId}, channel: ${channel}`);
    
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
          },
          channel: channel
        }
      });
    }
    
    // Return only public information (no secrets)
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
    } else if (gatewayConfig.provider === 'paytm' && gatewayConfig.paytm?.enabled) {
      publicConfig.paytm = {
        merchantId: gatewayConfig.paytm.merchantId,
        testMode: gatewayConfig.paytm.testMode
      };
    }
    
    console.log(`✅ Config fetched for ${channel}:`, publicConfig.provider);
    
    res.json({ success: true, config: publicConfig });
  } catch (error) {
    console.error('❌ Error fetching payment config:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /api/payments/create-order
 * Create payment order using appropriate gateway based on order type
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    
    console.log(`📡 Creating payment order for: ${orderId}, method: ${paymentMethod}`);
    
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }
    
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
    
    console.log(`🔄 Order type: ${order.orderType} → Channel: ${channel}`);
    
    // Get gateway configuration for this channel
    const gatewayConfig = paymentService.getGatewayConfig(theater, channel);
    
    if (!gatewayConfig || !gatewayConfig.enabled) {
      return res.status(400).json({
        success: false,
        message: `Payment gateway not configured for ${channel} orders`,
        channel: channel
      });
    }
    
    // Update order payment method if provided
    if (paymentMethod && order.payment) {
      order.payment.method = paymentMethod;
      await order.save();
    }
    
    // Create payment order using channel-specific gateway
    const paymentOrder = await paymentService.createPaymentOrder(
      theater,
      order,
      channel
    );
    
    console.log(`✅ Payment order created successfully for ${channel} channel`);
    
    res.json({
      success: true,
      paymentOrder: paymentOrder,
      provider: gatewayConfig.provider,
      channel: channel,
      orderType: order.orderType
    });
    
  } catch (error) {
    console.error('❌ Error creating payment order:', error);
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
    
    console.log(`🔍 Verifying payment for order: ${orderId}`);
    
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
    
    // Get channel-specific gateway config
    const channel = transaction.gateway.channel;
    const gatewayConfig = paymentService.getGatewayConfig(theater, channel);
    
    // Verify signature based on provider
    let isValid = false;
    
    if (gatewayConfig.provider === 'razorpay') {
      isValid = paymentService.verifyRazorpaySignature(
        razorpayOrderId,
        paymentId,
        signature,
        gatewayConfig.razorpay.keySecret
      );
    }
    
    if (!isValid) {
      // Update transaction as failed
      await paymentService.updateTransactionStatus(transaction._id, 'failed', {
        error: {
          code: 'SIGNATURE_VERIFICATION_FAILED',
          message: 'Payment signature verification failed'
        }
      });
      
      console.log(`❌ Payment verification failed for ${razorpayOrderId}`);
      
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
    
    console.log(`✅ Payment verified successfully for ${razorpayOrderId}`);
    
    res.json({
      success: true,
      message: 'Payment verified successfully',
      order: order,
      transaction: transaction
    });
    
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
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
    
    console.log('📡 Received Razorpay webhook:', payload.event);
    
    // TODO: Verify webhook signature
    // TODO: Process webhook events (payment.captured, payment.failed, etc.)
    
    // For now, just acknowledge receipt
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ success: false });
  }
});

/**
 * GET /api/payments/transactions/:theaterId
 * Get payment transactions for a theater
 */
router.get('/transactions/:theaterId', async (req, res) => {
  try {
    const { theaterId } = req.params;
    const { channel, limit = 100, status } = req.query;
    
    const query = { theaterId };
    
    if (channel) {
      query['gateway.channel'] = channel;
    }
    
    if (status) {
      query.status = status;
    }
    
    const transactions = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('orderId', 'orderNumber customerInfo pricing');
    
    res.json({ success: true, transactions, count: transactions.length });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /api/payments/statistics/:theaterId/:channel
 * Get payment statistics for a specific channel
 */
router.get('/statistics/:theaterId/:channel', async (req, res) => {
  try {
    const { theaterId, channel } = req.params;
    const { days = 30 } = req.query;
    
    const statistics = await paymentService.getChannelStatistics(
      theaterId,
      channel,
      parseInt(days)
    );
    
    res.json({ success: true, statistics });
  } catch (error) {
    console.error('❌ Error fetching statistics:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
