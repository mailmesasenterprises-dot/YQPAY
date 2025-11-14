const BaseService = require('./BaseService');
const Theater = require('../models/Theater');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Role = require('../models/Role');
const PageAccessArray = require('../models/PageAccessArray');
const { optimizedFind, optimizedCount, optimizedAggregate } = require('../utils/queryOptimizer');

/**
 * Dashboard Service
 * Handles all dashboard-related business logic
 */
class DashboardService extends BaseService {
  constructor() {
    super(null); // No base model for dashboard
  }

  /**
   * Get super admin stats
   */
  async getSuperAdminStats() {
    // Check database connection first
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      console.error(`❌ [DashboardService] MongoDB not connected! State: ${states[mongoose.connection.readyState] || 'unknown'} (${mongoose.connection.readyState})`);
      throw new Error(`Database not connected. Current state: ${states[mongoose.connection.readyState] || 'unknown'}`);
    }
    
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Optional models
    let QRCode, QRCodeName, TheaterUser;
    try {
      QRCode = require('../models/SingleQRCode');
    } catch (e) {}
    try {
      QRCodeName = require('../models/QRCodeName');
    } catch (e) {}
    try {
      TheaterUser = require('../models/TheaterUserArray');
    } catch (e) {}

    // Parallel data fetching
    const [
      totalTheaters,
      activeTheaters,
      inactiveTheaters,
      newTheatersThisMonth,
      totalOrders,
      todayOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      todayRevenue,
      monthlyRevenue,
      yearlyRevenue,
      totalProducts,
      activeProducts,
      outOfStockProducts,
      totalRoles,
      totalPageAccess,
      totalQRCodes,
      totalQRCodeNames,
      totalTheaterUsers,
      activeTheaterUsers,
      recentTheaters,
      recentOrders,
      topTheatersByRevenue
    ] = await Promise.all([
      optimizedCount(Theater, {}, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Theater, { isActive: true }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Theater, { isActive: false }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Theater, { createdAt: { $gte: startOfMonth } }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Order, {}, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Order, { createdAt: { $gte: startOfToday } }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Order, { status: 'pending' }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Order, { status: 'completed' }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Order, { status: 'cancelled' }, { cache: true, cacheTTL: 30000 }),
      optimizedAggregate(Order, [
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ], { cache: true, cacheTTL: 60000 }),
      optimizedAggregate(Order, [
        { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ], { cache: true, cacheTTL: 60000 }),
      optimizedAggregate(Order, [
        { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ], { cache: true, cacheTTL: 60000 }),
      optimizedAggregate(Order, [
        { $match: { status: 'completed', createdAt: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ], { cache: true, cacheTTL: 60000 }),
      optimizedCount(Product, {}, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Product, { isActive: true }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Product, { stockQuantity: { $lte: 0 } }, { cache: true, cacheTTL: 30000 }),
      optimizedCount(Role, {}, { cache: true, cacheTTL: 60000 }),
      optimizedCount(PageAccessArray, {}, { cache: true, cacheTTL: 60000 }),
      QRCode ? optimizedCount(QRCode, {}, { cache: true, cacheTTL: 60000 }) : Promise.resolve(0),
      QRCodeName ? optimizedCount(QRCodeName, {}, { cache: true, cacheTTL: 60000 }) : Promise.resolve(0),
      TheaterUser ? optimizedCount(TheaterUser, {}, { cache: true, cacheTTL: 60000 }) : Promise.resolve(0),
      TheaterUser ? optimizedCount(TheaterUser, { isActive: true }, { cache: true, cacheTTL: 60000 }) : Promise.resolve(0),
      optimizedFind(Theater, {}, { select: 'name createdAt isActive', sort: { createdAt: -1 }, limit: 5, lean: true, cache: true, cacheTTL: 30000 }),
      optimizedFind(Order, {}, { select: 'orderNumber totalAmount status createdAt theaterId', sort: { createdAt: -1 }, limit: 10, lean: true, cache: true, cacheTTL: 30000 }),
      optimizedAggregate(Order, [
        { $match: { status: 'completed' } },
        { $group: { _id: '$theaterId', totalRevenue: { $sum: '$totalAmount' }, orderCount: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 }
      ], { cache: true, cacheTTL: 60000 })
    ]);

    // Calculate revenue values
    const revenue = {
      total: totalRevenue[0]?.total || 0,
      today: todayRevenue[0]?.total || 0,
      monthly: monthlyRevenue[0]?.total || 0,
      yearly: yearlyRevenue[0]?.total || 0
    };

    return {
      theaters: {
        total: totalTheaters,
        active: activeTheaters,
        inactive: inactiveTheaters,
        newThisMonth: newTheatersThisMonth
      },
      orders: {
        total: totalOrders,
        today: todayOrders,
        pending: pendingOrders,
        completed: completedOrders,
        cancelled: cancelledOrders
      },
      revenue,
      products: {
        total: totalProducts,
        active: activeProducts,
        outOfStock: outOfStockProducts
      },
      userManagement: {
        roles: totalRoles,
        pageAccess: totalPageAccess,
        qrCodes: totalQRCodes,
        qrCodeNames: totalQRCodeNames,
        theaterUsers: totalTheaterUsers,
        activeTheaterUsers: activeTheaterUsers
      },
      recentActivities: {
        recentTheaters,
        recentOrders,
        topTheatersByRevenue
      }
    };
  }

  /**
   * Get quick stats
   */
  async getQuickStats() {
    // Check database connection first
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      console.error(`❌ [DashboardService] MongoDB not connected! State: ${states[mongoose.connection.readyState] || 'unknown'} (${mongoose.connection.readyState})`);
      throw new Error(`Database not connected. Current state: ${states[mongoose.connection.readyState] || 'unknown'}`);
    }
    
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const [totalTheaters, activeTheaters, todayOrders, todayRevenue] = await Promise.all([
      Theater.countDocuments({}).maxTimeMS(15000),
      Theater.countDocuments({ isActive: true }).maxTimeMS(15000),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }).maxTimeMS(15000),
      Order.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).maxTimeMS(15000)
    ]);

    return {
      totalTheaters,
      activeTheaters,
      todayOrders,
      todayRevenue: todayRevenue[0]?.total || 0
    };
  }
}

module.exports = new DashboardService();

