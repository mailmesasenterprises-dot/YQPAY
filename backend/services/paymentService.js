const BaseService = require('./BaseService');
const Theater = require('../models/Theater');
const Order = require('../models/Order');
const PaymentTransaction = require('../models/PaymentTransaction');
const paymentServiceUtil = require('../services/PaymentService');
const mongoose = require('mongoose');
const TheaterOrders = require('../models/TheaterOrders');

/**
 * Payment Service
 * Handles all payment-related business logic
 */
class PaymentService extends BaseService {
  constructor() {
    super(PaymentTransaction);
  }

  /**
   * Get payment gateway configuration
   */
  async getPaymentConfig(theaterId, channel) {
    const theater = await Theater.findById(theaterId).maxTimeMS(20000);
    if (!theater) {
      throw new Error('Theater not found');
    }

    const gatewayConfig = channel === 'kiosk'
      ? theater.paymentGateway?.kiosk
      : theater.paymentGateway?.online;

    if (!gatewayConfig) {
      return {
        provider: 'none',
        isEnabled: false,
        acceptedMethods: {
          cash: true,
          card: false,
          upi: false
        },
        channel: channel
      };
    }

    // Return public config only
    const publicConfig = {
      provider: gatewayConfig.provider || 'none',
      isEnabled: gatewayConfig.enabled || false,
      acceptedMethods: gatewayConfig.acceptedMethods || {
        cash: true,
        card: false,
        upi: false,
        netbanking: false,
        wallet: false
      },
      channel: channel
    };

    // Add public keys only
    if (gatewayConfig.provider === 'razorpay' && gatewayConfig.razorpay?.enabled) {
      publicConfig.razorpay = {
        keyId: gatewayConfig.razorpay.keyId,
        testMode: gatewayConfig.razorpay.testMode || false
      };
    } else if (gatewayConfig.provider === 'phonepe' && gatewayConfig.phonepe?.enabled) {
      publicConfig.phonepe = {
        merchantId: gatewayConfig.phonepe.merchantId,
        testMode: gatewayConfig.phonepe.testMode || false
      };
    } else if (gatewayConfig.provider === 'paytm' && gatewayConfig.paytm?.enabled) {
      publicConfig.paytm = {
        merchantId: gatewayConfig.paytm.merchantId,
        testMode: gatewayConfig.paytm.testMode || false
      };
    }

    return publicConfig;
  }

  /**
   * Create payment order
   */
  async createPaymentOrder(orderId, paymentMethod) {
    if (!orderId) {
      throw new Error('Order ID is required');
    }

    // Try to find order in regular Order collection first
    let order = await Order.findById(orderId).maxTimeMS(20000);
    let isTheaterOrdersArray = false;
    let theaterOrdersDoc = null;
    let theaterId = null;

    // If not found, search in TheaterOrders collection
    if (!order) {
      theaterOrdersDoc = await TheaterOrders.findOne({
        'orderList._id': new mongoose.Types.ObjectId(orderId)
      }).maxTimeMS(20000);

      if (theaterOrdersDoc) {
        order = theaterOrdersDoc.orderList.find(o => o._id.toString() === orderId);
        isTheaterOrdersArray = true;
        theaterId = theaterOrdersDoc.theater;
      }
    } else {
      theaterId = order.theaterId;
    }

    if (!order) {
      throw new Error('Order not found');
    }

    const theater = await Theater.findById(theaterId).maxTimeMS(20000);
    if (!theater) {
      throw new Error('Theater not found');
    }

    const orderTypeOrSource = order.source || order.orderType || 'counter';
    const channel = paymentServiceUtil.determineChannel(orderTypeOrSource);

    // Use payment service to create order
    const result = await paymentServiceUtil.createPaymentOrder(
      theater,
      order,
      paymentMethod,
      channel
    );

    return result;
  }

  /**
   * Verify payment
   */
  async verifyPayment(verificationData) {
    return paymentServiceUtil.verifyPayment(verificationData);
  }

  /**
   * Get payment transactions
   */
  async getTransactions(theaterId, queryParams) {
    const { page = 1, limit = 50, status, startDate, endDate } = queryParams;
    const filter = { theaterId: new mongoose.Types.ObjectId(theaterId) };

    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(20000),
      PaymentTransaction.countDocuments(filter).maxTimeMS(15000)
    ]);

    return {
      data: transactions,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new PaymentService();
