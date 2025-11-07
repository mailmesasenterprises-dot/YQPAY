const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentTransaction = require('../models/PaymentTransaction');

class PaymentService {
  /**
   * Determine which channel (kiosk or online) based on order type
   */
  determineChannel(orderType) {
    if (orderType === 'kiosk' || orderType === 'pos') {
      return 'kiosk';
    } else if (orderType === 'online' || orderType === 'qr') {
      return 'online';
    }
    return 'online'; // default
  }
  
  /**
   * Get gateway configuration for specific channel
   */
  getGatewayConfig(theater, channel) {
    if (!theater.paymentGateway) {
      throw new Error('Payment gateway not configured for this theater');
    }
    
    if (channel === 'kiosk' || channel === 'pos') {
      return theater.paymentGateway.kiosk;
    } else if (channel === 'online' || channel === 'qr') {
      return theater.paymentGateway.online;
    }
    
    throw new Error('Invalid channel specified');
  }
  
  /**
   * Create payment order based on channel (kiosk or online)
   */
  async createPaymentOrder(theater, order, channel = 'online') {
    try {
      console.log(`🔄 Creating payment order for channel: ${channel}, orderType: ${order.orderType}`);
      
      // Get channel-specific gateway configuration
      const gatewayConfig = this.getGatewayConfig(theater, channel);
      
      if (!gatewayConfig || !gatewayConfig.enabled) {
        throw new Error(`${channel} payment gateway not configured for this theater`);
      }
      
      const provider = gatewayConfig.provider;
      
      console.log(`💳 Using provider: ${provider} for ${channel} channel`);
      
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
      console.error(`❌ Error creating ${channel} payment order:`, error);
      throw error;
    }
  }
  
  /**
   * Create Razorpay order for specific channel
   */
  async createRazorpayOrder(theater, order, gatewayConfig, channel) {
    try {
      const razorpayCredentials = gatewayConfig.razorpay;
      
      if (!razorpayCredentials || !razorpayCredentials.enabled) {
        throw new Error('Razorpay is not enabled for this channel');
      }
      
      if (!razorpayCredentials.keyId || !razorpayCredentials.keySecret) {
        throw new Error('Razorpay credentials are incomplete');
      }
      
      console.log(`🔑 Using Razorpay Key ID: ${razorpayCredentials.keyId} for ${channel}`);
      
      // Initialize Razorpay with channel-specific credentials
      const razorpay = new Razorpay({
        key_id: razorpayCredentials.keyId,
        key_secret: razorpayCredentials.keySecret
      });
      
      // Create Razorpay order
      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(order.pricing.total * 100), // Amount in paise
        currency: order.pricing.currency || 'INR',
        receipt: order.orderNumber || `ORD-${order._id}`,
        notes: {
          theaterId: theater._id.toString(),
          orderId: order._id.toString(),
          theaterName: theater.name,
          channel: channel,
          orderType: order.orderType
        }
      });
      
      console.log(`✅ Razorpay order created: ${razorpayOrder.id} for ${channel} channel`);
      
      // Save transaction record
      const transaction = new PaymentTransaction({
        theaterId: theater._id,
        orderId: order._id,
        gateway: {
          provider: 'razorpay',
          channel: channel,
          orderId: razorpayOrder.id
        },
        amount: {
          value: order.pricing.total,
          currency: order.pricing.currency || 'INR'
        },
        status: 'initiated',
        method: order.payment?.method || 'card',
        customer: {
          name: order.customerInfo?.name,
          phone: order.customerInfo?.phone,
          email: order.customerInfo?.email
        },
        metadata: {
          orderType: order.orderType,
          gatewayUsed: 'razorpay',
          channel: channel,
          notes: {
            testMode: razorpayCredentials.testMode
          }
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
        channel: channel,
        provider: 'razorpay'
      };
    } catch (error) {
      console.error('❌ Razorpay order creation failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify Razorpay Payment Signature
   */
  verifyRazorpaySignature(orderId, paymentId, signature, keySecret) {
    try {
      const text = `${orderId}|${paymentId}`;
      const generated_signature = crypto
        .createHmac('sha256', keySecret)
        .update(text)
        .digest('hex');
      
      return generated_signature === signature;
    } catch (error) {
      console.error('❌ Signature verification error:', error);
      return false;
    }
  }
  
  /**
   * Update Payment Transaction Status
   */
  async updateTransactionStatus(transactionId, status, data = {}) {
    try {
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
        transaction.metadata = { ...transaction.metadata, ...data.metadata };
      }
      
      await transaction.save();
      return transaction;
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      throw error;
    }
  }
  
  /**
   * PhonePe Payment Integration (Placeholder)
   */
  async createPhonePeOrder(theater, order, gatewayConfig, channel) {
    // TODO: Implement PhonePe integration
    console.log('⚠️ PhonePe integration not yet implemented');
    throw new Error('PhonePe integration coming soon');
  }
  
  /**
   * Paytm Payment Integration (Placeholder)
   */
  async createPaytmOrder(theater, order, gatewayConfig, channel) {
    // TODO: Implement Paytm integration
    console.log('⚠️ Paytm integration not yet implemented');
    throw new Error('Paytm integration coming soon');
  }
  
  /**
   * Get payment statistics by channel
   */
  async getChannelStatistics(theaterId, channel, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const transactions = await PaymentTransaction.find({
        theaterId: theaterId,
        'gateway.channel': channel,
        createdAt: { $gte: startDate }
      });
      
      const total = transactions.length;
      const successful = transactions.filter(t => t.status === 'success').length;
      const failed = transactions.filter(t => t.status === 'failed').length;
      const totalAmount = transactions
        .filter(t => t.status === 'success')
        .reduce((sum, t) => sum + t.amount.value, 0);
      
      return {
        channel,
        period: `${days} days`,
        total,
        successful,
        failed,
        pending: total - successful - failed,
        successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
        totalAmount,
        averageAmount: successful > 0 ? (totalAmount / successful).toFixed(2) : 0
      };
    } catch (error) {
      console.error('❌ Error getting channel statistics:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
