const BaseService = require('./BaseService');
const Order = require('../models/Order');
const TheaterOrders = require('../models/TheaterOrders');
const MonthlyStock = require('../models/MonthlyStock');
const { calculateOrderTotals } = require('../utils/orderCalculation');
const mongoose = require('mongoose');

/**
 * Order Service
 * Handles all order-related business logic
 */
class OrderService extends BaseService {
  constructor() {
    super(Order);
  }

  /**
   * Get orders for a theater with pagination
   */
  async getOrdersByTheater(theaterId, queryParams) {
    const {
      page = 1,
      limit = 50,
      status,
      startDate,
      endDate,
      search
    } = queryParams;

    // Build filter
    const filter = { theater: new mongoose.Types.ObjectId(theaterId) };
    if (status) filter['orderList.status'] = status;
    if (startDate || endDate) {
      filter['orderList.createdAt'] = {};
      if (startDate) filter['orderList.createdAt'].$gte = new Date(startDate);
      if (endDate) filter['orderList.createdAt'].$lte = new Date(endDate);
    }

    // Get theater orders document
    const theaterOrders = await TheaterOrders.findOne(filter)
      .lean()
      .maxTimeMS(20000);

    if (!theaterOrders || !theaterOrders.orderList) {
      return {
        data: [],
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          totalItems: 0,
          pages: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        }
      };
    }

    // Filter orders
    let orders = theaterOrders.orderList;
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    if (startDate || endDate) {
      orders = orders.filter(o => {
        const orderDate = new Date(o.createdAt);
        if (startDate && orderDate < new Date(startDate)) return false;
        if (endDate && orderDate > new Date(endDate)) return false;
        return true;
      });
    }
    if (search) {
      const searchLower = search.toLowerCase();
      orders = orders.filter(o =>
        (o.orderNumber || '').toLowerCase().includes(searchLower) ||
        (o.customerInfo?.name || '').toLowerCase().includes(searchLower)
      );
    }

    // Sort by createdAt descending
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Paginate
    const skip = (page - 1) * limit;
    const paginated = orders.slice(skip, skip + limit);
    const total = orders.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginated,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        totalItems: total,
        pages: totalPages,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(theaterId, orderId) {
    const theaterOrders = await TheaterOrders.findOne({
      theater: new mongoose.Types.ObjectId(theaterId)
    })
    .lean()
    .maxTimeMS(20000);

    if (!theaterOrders || !theaterOrders.orderList) {
      return null;
    }

    return theaterOrders.orderList.find(
      o => String(o._id) === orderId
    ) || null;
  }

  /**
   * Create order
   */
  async createOrder(theaterId, orderData) {
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const orderDate = new Date();

    // Validate products and calculate totals
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterObjectId
    });

    if (!productContainer || !productContainer.productList) {
      throw new Error('No products found for this theater');
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of orderData.items) {
      const product = productContainer.productList.find(
        p => String(p._id) === item.productId
      );

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const itemPrice = product.pricing?.sellingPrice || product.pricing?.basePrice || 0;
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: itemPrice,
        total: itemTotal,
        image: product.image || product.imageUrl
      });
    }

    // Calculate totals
    const totals = calculateOrderTotals({
      items: orderItems,
      subtotal,
      tax: orderData.tax || 0,
      discount: orderData.discount || 0,
      deliveryCharge: orderData.deliveryCharge || 0
    });

    // Create order
    const newOrder = {
      _id: new mongoose.Types.ObjectId(),
      orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      items: orderItems,
      customerInfo: orderData.customerInfo || { name: 'Walk-in Customer' },
      tableNumber: orderData.tableNumber || null,
      seat: orderData.seat || null,
      qrName: orderData.qrName || null,
      source: orderData.source || 'pos',
      specialInstructions: orderData.specialInstructions || '',
      pricing: totals.pricing,
      payment: {
        method: orderData.paymentMethod || 'cash',
        status: orderData.paymentStatus || 'pending',
        transactionId: orderData.transactionId || null
      },
      status: 'pending',
      createdAt: orderDate,
      updatedAt: orderDate
    };

    // Record stock usage
    for (const item of orderData.items) {
      await this.recordStockUsage(theaterId, item.productId, item.quantity, orderDate);
    }

    // Add to theater orders
    await db.collection('theaterorders').findOneAndUpdate(
      { theater: theaterObjectId },
      {
        $push: { orderList: newOrder },
        $setOnInsert: { theater: theaterObjectId, createdAt: orderDate },
        $set: { updatedAt: orderDate }
      },
      { upsert: true }
    );

    return newOrder;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(theaterId, orderId, status) {
    const db = mongoose.connection.db;
    const theaterObjectId = new mongoose.Types.ObjectId(theaterId);
    const orderObjectId = new mongoose.Types.ObjectId(orderId);

    const result = await db.collection('theaterorders').findOneAndUpdate(
      {
        theater: theaterObjectId,
        'orderList._id': orderObjectId
      },
      {
        $set: {
          'orderList.$.status': status,
          'orderList.$.updatedAt': new Date(),
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('Order not found');
    }

    const updatedOrder = result.value.orderList.find(
      o => String(o._id) === orderId
    );

    return updatedOrder;
  }

  /**
   * Record stock usage (FIFO logic)
   */
  async recordStockUsage(theaterId, productId, quantity, orderDate) {
    try {
      const entryDate = new Date(orderDate);
      const year = entryDate.getFullYear();
      const monthNumber = entryDate.getMonth() + 1;
      const now = new Date();

      const allMonthlyDocs = await MonthlyStock.find({
        theaterId,
        productId
      })
      .sort({ year: 1, monthNumber: 1 })
      .maxTimeMS(20000);

      let remainingToDeduct = quantity;

      for (const monthlyDoc of allMonthlyDocs) {
        if (remainingToDeduct <= 0) break;

        for (let i = 0; i < monthlyDoc.stockDetails.length; i++) {
          if (remainingToDeduct <= 0) break;

          const entry = monthlyDoc.stockDetails[i];
          
          if (entry.type === 'ADDED' && (!entry.expireDate || new Date(entry.expireDate) > now)) {
            const availableStock = Math.max(0,
              entry.invordStock - (entry.sales || 0) - (entry.expiredStock || 0) - (entry.damageStock || 0)
            );

            if (availableStock > 0) {
              const deductAmount = Math.min(remainingToDeduct, availableStock);
              entry.sales = (entry.sales || 0) + deductAmount;
              
              if (!entry.usageHistory) {
                entry.usageHistory = [];
              }
              entry.usageHistory.push({
                year,
                month: monthNumber,
                quantity: deductAmount,
                orderDate: entryDate
              });

              remainingToDeduct -= deductAmount;
              monthlyDoc.markModified('stockDetails');
            }
          }
        }

        if (monthlyDoc.isModified()) {
          await monthlyDoc.save();
        }
      }
    } catch (error) {
      console.error('Stock usage recording error:', error);
      // Don't throw - allow order to complete even if stock recording fails
    }
  }
}

module.exports = new OrderService();

