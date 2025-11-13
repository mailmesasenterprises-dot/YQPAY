const BaseService = require('./BaseService');
const Theater = require('../models/Theater');
const TheaterOrders = require('../models/TheaterOrders');
const Order = require('../models/Order');
const mongoose = require('mongoose');

/**
 * Theater Dashboard Service
 * Handles all theater dashboard-related business logic
 */
class TheaterDashboardService extends BaseService {
  constructor() {
    super(null);
  }

  /**
   * Get theater dashboard data
   */
  async getTheaterDashboard(theaterId) {
    const theaterIdObjectId = new mongoose.Types.ObjectId(theaterId);
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      theater,
      theaterOrdersDoc,
      individualOrders,
      productContainer
    ] = await Promise.all([
      Theater.findById(theaterId).select('name email phone address isActive createdAt').maxTimeMS(20000),
      TheaterOrders.findOne({ theater: theaterIdObjectId }).maxTimeMS(20000),
      Order.find({ theaterId: theaterIdObjectId }).limit(100).sort({ createdAt: -1 }).maxTimeMS(20000),
      mongoose.connection.db.collection('productlist').findOne({
        theater: theaterIdObjectId,
        productList: { $exists: true }
      })
    ]);

    if (!theater) {
      throw new Error('Theater not found');
    }

    // Process orders
    let allOrders = [];
    if (theaterOrdersDoc && theaterOrdersDoc.orderList) {
      allOrders = theaterOrdersDoc.orderList;
    }
    
    if (individualOrders && individualOrders.length > 0) {
      const individualOrdersFormatted = individualOrders.map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerInfo: order.customerInfo || { name: 'Customer' },
        pricing: order.pricing || { total: 0 },
        status: order.status || 'pending',
        createdAt: order.createdAt || order.timestamps?.placedAt || new Date(),
        source: order.source || 'staff'
      }));
      allOrders = [...allOrders, ...individualOrdersFormatted];
    }

    // Calculate statistics
    const totalOrders = allOrders.length;
    const todayOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt || order.timestamps?.placedAt);
      return orderDate >= startOfToday;
    });

    const todayRevenue = todayOrders.reduce((sum, order) => {
      const total = order.pricing?.total || order.pricing?.totalAmount || 0;
      return sum + (total || 0);
    }, 0);

    const totalRevenue = allOrders
      .filter(order => order.status === 'completed' || order.status === 'served')
      .reduce((sum, order) => {
        const total = order.pricing?.total || order.pricing?.totalAmount || 0;
        return sum + (total || 0);
      }, 0);

    const monthlyOrders = allOrders.filter(order => {
      const orderDate = new Date(order.createdAt || order.timestamps?.placedAt);
      return orderDate >= startOfMonth;
    });

    const monthlyRevenue = monthlyOrders
      .filter(order => order.status === 'completed' || order.status === 'served')
      .reduce((sum, order) => {
        const total = order.pricing?.total || order.pricing?.totalAmount || 0;
        return sum + (total || 0);
      }, 0);

    const pendingOrders = allOrders.filter(order => 
      ['pending', 'confirmed', 'preparing'].includes(order.status)
    ).length;

    const completedOrders = allOrders.filter(order => 
      ['completed', 'served'].includes(order.status)
    ).length;

    const activeProducts = productContainer?.productList?.filter(p => p.isActive).length || 0;
    const totalProducts = productContainer?.productList?.length || 0;

    // Recent orders (last 10)
    const recentOrders = allOrders
      .sort((a, b) => new Date(b.createdAt || b.timestamps?.placedAt) - new Date(a.createdAt || a.timestamps?.placedAt))
      .slice(0, 10)
      .map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        customerName: order.customerInfo?.name || 'Customer',
        total: order.pricing?.total || order.pricing?.totalAmount || 0,
        status: order.status,
        createdAt: order.createdAt || order.timestamps?.placedAt
      }));

    return {
      theater: {
        _id: theater._id,
        name: theater.name,
        email: theater.email,
        phone: theater.phone,
        address: theater.address,
        isActive: theater.isActive,
        createdAt: theater.createdAt
      },
      stats: {
        totalOrders,
        todayOrders: todayOrders.length,
        pendingOrders,
        completedOrders,
        todayRevenue,
        totalRevenue,
        monthlyRevenue,
        activeProducts,
        totalProducts
      },
      recentOrders
    };
  }
}

module.exports = new TheaterDashboardService();

