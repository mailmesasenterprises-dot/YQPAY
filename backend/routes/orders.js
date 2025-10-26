const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const TheaterOrders = require('../models/TheaterOrders');  // ✅ New array-based model
const Product = require('../models/Product');
const { authenticateToken, optionalAuth, requireTheaterAccess } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/orders/theater
 * Create a new order for a theater
 */
router.post('/theater', [
  optionalAuth,
  body('theaterId').isMongoId().withMessage('Valid theater ID is required'),
  body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
  body('items.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res) => {
  try {
    console.log('\n🎯 ===== ORDER CREATION REQUEST =====');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔍 Theater ID:', req.body.theaterId);
    console.log('🔍 Customer Name:', req.body.customerName);
    console.log('🔍 Payment Method:', req.body.paymentMethod);
    console.log('🔍 Items Count:', req.body.items?.length);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation Errors:', JSON.stringify(errors.array(), null, 2));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { theaterId, items, customerInfo, customerName, tableNumber, specialInstructions, orderNotes, paymentMethod, qrName, seat } = req.body;

    console.log('🔍 QR Name:', qrName);
    console.log('🔍 Seat:', seat);

    // Handle both customerInfo and customerName formats
    const finalCustomerInfo = customerInfo || {
      name: customerName || 'Walk-in Customer'
    };

    // Handle both specialInstructions and orderNotes
    const finalSpecialInstructions = specialInstructions || orderNotes || '';

    // Validate products and calculate pricing
    let subtotal = 0;
    const orderItems = [];

    // Fetch products from productlist collection (array structure)
    const db = mongoose.connection.db;
    const theaterIdObjectId = new mongoose.Types.ObjectId(theaterId);
    
    const productContainer = await db.collection('productlist').findOne({
      theater: theaterIdObjectId,
      productList: { $exists: true }
    });

    if (!productContainer || !productContainer.productList) {
      return res.status(400).json({
        error: 'No products found for this theater',
        code: 'NO_PRODUCTS'
      });
    }

    for (const item of items) {
      const productObjectId = new mongoose.Types.ObjectId(item.productId);
      
      // Find product in the productList array
      const product = productContainer.productList.find(p => 
        p._id.equals(productObjectId)
      );

      if (!product) {
        return res.status(400).json({
          error: `Invalid product: ${item.productId}`,
          code: 'INVALID_PRODUCT'
        });
      }

      // Check if product is active
      if (!product.isActive || !product.isAvailable) {
        return res.status(400).json({
          error: `Product "${product.name}" is not available`,
          code: 'PRODUCT_UNAVAILABLE'
        });
      }

      // Check stock (use array structure fields)
      const currentStock = product.inventory?.currentStock ?? 0;
      const trackStock = product.inventory?.trackStock ?? true;
      
      if (trackStock && currentStock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}`,
          code: 'INSUFFICIENT_STOCK'
        });
      }

      // Get price from array structure
      const unitPrice = product.pricing?.basePrice ?? product.sellingPrice ?? 0;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        productId: product._id,
        name: product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        variants: item.variants || []
      });

      // Update stock in the array
      if (trackStock) {
        const newStock = currentStock - item.quantity;
        
        await db.collection('productlist').updateOne(
          {
            theater: theaterIdObjectId,
            'productList._id': productObjectId
          },
          {
            $set: {
              'productList.$.inventory.currentStock': newStock,
              'productList.$.updatedAt': new Date()
            }
          }
        );
      }
    }

    // Calculate taxes and total
    const taxRate = 0.18; // 18% GST
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    console.log('💰 Order Totals:', { subtotal, taxAmount, total });
    console.log('📝 Creating order with data:', {
      theaterId,
      customerInfo: finalCustomerInfo,
      itemsCount: orderItems.length,
      payment: { method: paymentMethod || 'cash', status: 'pending' },
      source: req.user ? 'staff' : 'qr_code',
      staffUsername: req.user?.username || 'anonymous'
    });
    
    // 🔍 DEBUG: Check what's in req.user
    console.log('🔍 DEBUG req.user:', JSON.stringify(req.user, null, 2));

    // Generate order number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get today's orders count for this theater
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const theaterOrders = await TheaterOrders.findOne({ theater: theaterId });
    let todayOrdersCount = 0;
    
    if (theaterOrders) {
      todayOrdersCount = theaterOrders.orderList.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startOfDay && orderDate <= endOfDay;
      }).length;
    }
    
    const orderNumber = `ORD-${dateStr}-${(todayOrdersCount + 1).toString().padStart(4, '0')}`;
    console.log('📝 Generated orderNumber:', orderNumber);

    // Create staff info object
    let staffInfo = null;
    if (req.user) {
      staffInfo = {
        staffId: req.user.userId,
        username: req.user.username,
        role: req.user.role
      };
      console.log('👤 Staff Info Created:', staffInfo);
    } else {
      console.log('⚠️ No req.user found - order will have null staffInfo');
    }

    // Create order object for array
    const newOrder = {
      orderNumber,
      customerInfo: finalCustomerInfo,
      items: orderItems,
      pricing: {
        subtotal,
        taxAmount,
        total,
        currency: 'INR'
      },
      payment: {
        method: paymentMethod || 'cash',
        status: 'pending'
      },
      status: 'pending',  // ✅ Default status
      orderType: 'dine_in',
      staffInfo: staffInfo,  // ✅ Use the created staffInfo object
      source: req.user ? 'staff' : 'qr_code',
      tableNumber,
      specialInstructions: finalSpecialInstructions,
      qrName: qrName || null,  // ✅ Store QR Name
      seat: seat || null,      // ✅ Store Seat
      timestamps: {
        placedAt: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('💾 Saving order to array-based structure...');
    
    // Use findOneAndUpdate with $push to add order to array
    const updatedTheaterOrders = await TheaterOrders.findOneAndUpdate(
      { theater: theaterId },
      {
        $push: { orderList: newOrder },
        $inc: {
          'metadata.totalOrders': 1,
          'metadata.pendingOrders': 1,
          'metadata.totalRevenue': total
        },
        $set: {
          'metadata.lastOrderDate': new Date(),
          updatedAt: new Date()
        }
      },
      {
        upsert: true,  // Create if doesn't exist
        new: true,
        runValidators: true
      }
    );

    // Get the saved order (last item in array)
    const savedOrder = updatedTheaterOrders.orderList[updatedTheaterOrders.orderList.length - 1];
    
    console.log('✅ Order saved successfully! Order Number:', savedOrder.orderNumber);
    console.log('👤 Staff:', savedOrder.staffInfo?.username || 'anonymous');
    console.log('📊 Status:', savedOrder.status);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: savedOrder  // ✅ Changed from 'data' to 'order' to match frontend
    });

  } catch (error) {
    console.error('\n❌ ===== ORDER CREATION ERROR =====');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    if (error.errors) {
      console.error('Validation Errors:', JSON.stringify(error.errors, null, 2));
    }
    console.error('Full Error:', error);
    console.error('=====================================\n');
    
    res.status(500).json({
      error: 'Failed to create order',
      message: error.message,
      details: error.errors || {}
    });
  }
});

/**
 * GET /api/orders/theater/:theaterId
 * Get orders for a specific theater from theaterorders collection
 */
router.get('/theater/:theaterId', [
  optionalAuth
], async (req, res) => {
  try {
    const { theaterId } = req.params;
    const { status, limit = 50, source } = req.query;

    console.log('📥 Fetching orders for theater:', theaterId);
    console.log('Filters:', { status, limit, source });

    // Validate theater ID
    if (!mongoose.Types.ObjectId.isValid(theaterId)) {
      return res.status(400).json({
        error: 'Invalid theater ID'
      });
    }

    // Find theater orders
    const theaterOrders = await TheaterOrders.findOne({ theater: theaterId });

    if (!theaterOrders || !theaterOrders.orderList || theaterOrders.orderList.length === 0) {
      return res.status(200).json({
        success: true,
        orders: [],
        total: 0
      });
    }

    // Filter orders based on query parameters
    let orders = theaterOrders.orderList;

    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    // Filter by source if provided (e.g., 'qr_code' for customer orders)
    if (source) {
      orders = orders.filter(order => order.source === source);
    }

    // Sort by creation date (newest first)
    orders = orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply limit
    if (limit) {
      orders = orders.slice(0, parseInt(limit));
    }

    console.log(`✅ Found ${orders.length} orders for theater`);

    res.status(200).json({
      success: true,
      orders,
      total: orders.length,
      theaterId
    });

  } catch (error) {
    console.error('❌ Error fetching theater orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

/**
 * GET /api/orders/my-orders
 * Get orders for the current user
 */
router.get('/my-orders', [
  authenticateToken,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (req.user.role === 'theater_staff' || req.user.role === 'theater_admin') {
      query.theaterId = req.user.theaterId;
    } else if (req.user.role === 'customer') {
      query.customerId = req.user.userId;
    } else if (req.user.role === 'super_admin') {
      // Super admin can see all orders, no additional filter
    }

    const orders = await Order.find(query)
      .populate('items.productId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/orders/theater-nested
 * Get nested order data for a theater from TheaterOrders collection
 */
router.get('/theater-nested', [
  authenticateToken,
  query('theaterId').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().trim(),
  query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled']),
  query('date').optional().isISO8601(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020, max: 2030 })
], async (req, res) => {
  console.log('🎬 theater-nested endpoint HIT!', req.query);
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors in theater-nested:', errors.array());
      return res.status(400).json({
        error: 'Invalid request parameters',
        details: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const statusFilter = req.query.status;
    const dateFilter = req.query.date;
    const startDateFilter = req.query.startDate;
    const endDateFilter = req.query.endDate;
    const monthFilter = req.query.month;
    const yearFilter = req.query.year;

    let theaterId = req.query.theaterId;
    
    // If no theaterId provided, use user's theater
    if (!theaterId && req.user.theaterId) {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      return res.status(400).json({
        error: 'Theater ID is required',
        code: 'THEATER_ID_REQUIRED'
      });
    }

    // Enforce theater user restriction
    if (req.user && (req.user.role === 'theater_user' || req.user.userType === 'theater_user')) {
      if (req.user.theaterId && theaterId !== req.user.theaterId) {
        return res.status(403).json({
          error: 'Access denied: You can only view orders for your assigned theater',
          code: 'THEATER_ACCESS_DENIED'
        });
      }
      // Always use user's theaterId for theater users
      theaterId = req.user.theaterId;
    }

    console.log('🎬 Fetching theater orders for:', { theaterId, page, limit, search, statusFilter, dateFilter, monthFilter, yearFilter });

    // Find the theater orders document
    const theaterOrders = await TheaterOrders.findOne({ theater: theaterId })
      .populate('theater', 'name location')
      .lean();

    if (!theaterOrders || !theaterOrders.orderList || theaterOrders.orderList.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          current: page,
          limit,
          total: 0,
          pages: 0
        },
        summary: {
          totalOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          totalRevenue: 0
        }
      });
    }

    // Filter orders based on criteria
    let filteredOrders = theaterOrders.orderList;

    // Role-based filtering
    if (req.user) {
      // ✅ FIX: Prioritize userType over role for proper role detection
      const userType = req.user.userType || req.user.role;
      const isSuperAdmin = userType === 'super_admin' || userType === 'admin';
      const isTheaterAdmin = userType === 'theater_admin';
      const isTheaterUser = userType === 'theater_user';
      
      console.log('🔐 Role-based filtering:', {
        role: req.user.role,
        userType: req.user.userType,
        effectiveType: userType,
        isSuperAdmin,
        isTheaterAdmin,
        isTheaterUser,
        userId: req.user.userId
      });
      
      // Super Admin and Theater Admin see ALL orders
      if (isSuperAdmin || isTheaterAdmin) {
        console.log('✅ Admin access - showing all orders');
        // No filtering needed
      } 
      // Theater User (staff) only sees their own orders
      else if (isTheaterUser && req.user.userId) {
        console.log('👤 Staff access - filtering to own orders only');
        filteredOrders = filteredOrders.filter(order => 
          order.staffInfo && String(order.staffInfo.staffId) === String(req.user.userId)
        );
        console.log(`📊 Filtered from ${theaterOrders.orderList.length} to ${filteredOrders.length} orders`);
      }
    }

    // Apply date filtering
    if (dateFilter) {
      const targetDate = new Date(dateFilter);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startOfDay && orderDate <= endOfDay;
      });
    } else if (startDateFilter && endDateFilter) {
      // Date range filtering
      const startDate = new Date(startDateFilter);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(endDateFilter);
      endDate.setHours(23, 59, 59, 999);
      
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });
    } else if (monthFilter && yearFilter) {
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() + 1 === parseInt(monthFilter) && 
               orderDate.getFullYear() === parseInt(yearFilter);
      });
    }

    // Apply status filtering
    if (statusFilter) {
      filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    // Apply search filtering
    if (search) {
      const searchLower = search.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        (order.orderNumber && order.orderNumber.toLowerCase().includes(searchLower)) ||
        (order.customerName && order.customerName.toLowerCase().includes(searchLower)) ||
        (order.customerPhone && order.customerPhone.includes(search))
      );
    }

    // Calculate summary statistics
    const summary = {
      totalOrders: filteredOrders.length,
      confirmedOrders: filteredOrders.filter(order => order.status === 'confirmed').length,
      completedOrders: filteredOrders.filter(order => order.status === 'completed').length,
      totalRevenue: filteredOrders
        .filter(order => order.status === 'completed')
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    };

    // Sort orders by creation date (newest first)
    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const paginatedOrders = filteredOrders.slice(skip, skip + limit);
    const totalPages = Math.ceil(filteredOrders.length / limit);

    console.log('📊 Theater orders summary:', {
      total: filteredOrders.length,
      page,
      limit,
      returned: paginatedOrders.length,
      summary
    });

    res.json({
      success: true,
      data: paginatedOrders,
      pagination: {
        current: page,
        limit,
        total: filteredOrders.length,
        pages: totalPages
      },
      summary,
      theater: theaterOrders.theater
    });
  } catch (error) {
    console.error('❌ Get theater orders error:', error);
    res.status(500).json({
      error: 'Failed to fetch theater orders',
      message: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/orders/theater-stats
 * Get order statistics for a theater
 */
router.get('/theater-stats', [
  authenticateToken,
  query('theaterId').optional().isMongoId()
], async (req, res) => {
  try {
    let theaterId = req.query.theaterId;
    
    if (!theaterId && req.user.theaterId) {
      theaterId = req.user.theaterId;
    }

    if (!theaterId) {
      return res.status(400).json({
        error: 'Theater ID is required',
        code: 'THEATER_ID_REQUIRED'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      completedOrders,
      pendingOrders,
      todayRevenue,
      totalRevenue
    ] = await Promise.all([
      Order.countDocuments({ theaterId }),
      Order.countDocuments({ theaterId, createdAt: { $gte: today } }),
      Order.countDocuments({ theaterId, status: 'completed' }),
      Order.countDocuments({ theaterId, status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Order.aggregate([
        {
          $match: {
            theaterId: new require('mongoose').Types.ObjectId(theaterId),
            createdAt: { $gte: today },
            'payment.status': 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.total' }
          }
        }
      ]),
      Order.aggregate([
        {
          $match: {
            theaterId: new require('mongoose').Types.ObjectId(theaterId),
            'payment.status': 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$pricing.total' }
          }
        }
      ])
    ]);

    const stats = {
      orders: {
        total: totalOrders,
        today: todayOrders,
        completed: completedOrders,
        pending: pendingOrders
      },
      revenue: {
        today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        total: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        currency: 'INR'
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get theater stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch theater statistics',
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/orders/:orderId/status
 * Update order status
 */
router.put('/:orderId/status', [
  authenticateToken,
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled', 'completed'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        error: 'Order not found',
        code: 'ORDER_NOT_FOUND'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_admin' && req.user.theaterId !== order.theaterId.toString()) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    await order.updateStatus(req.body.status);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        orderId: order._id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      error: 'Failed to update order status',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/orders/excel/:theaterId
 * Export orders to Excel based on filters
 */
router.get('/excel/:theaterId',
  authenticateToken,
  async (req, res) => {
    try {
      const { theaterId } = req.params;
      const { date, month, year, startDate, endDate, status } = req.query;

      console.log(`📊 Generating Excel report for theater: ${theaterId}`);
      console.log(`   Filters:`, { date, month, year, startDate, endDate, status });

      // Get theater orders document - FIX: Use 'theater' field not 'theaterId'
      const theaterOrders = await TheaterOrders.findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
      
      console.log(`🔍 Theater Orders Found:`, theaterOrders ? `Yes (${theaterOrders.orderList?.length || 0} orders)` : 'No');
      
      if (!theaterOrders || !theaterOrders.orderList || theaterOrders.orderList.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No orders found for this theater'
        });
      }

      let filteredOrders = [...theaterOrders.orderList];
      console.log(`📝 Initial orders count: ${filteredOrders.length}`);

      // Apply date filters
      if (date) {
        // Single date filter
        const selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        console.log(`📅 Date filter: ${selectedDate.toISOString()} to ${nextDay.toISOString()}`);

        const beforeFilter = filteredOrders.length;
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          const matches = orderDate >= selectedDate && orderDate < nextDay;
          if (!matches) {
            console.log(`  ❌ Order ${order.orderNumber} excluded - Date: ${orderDate.toISOString()}`);
          }
          return matches;
        });
        console.log(`  Filtered from ${beforeFilter} to ${filteredOrders.length} orders by date`);
      } else if (startDate && endDate) {
        // Date range filter
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= start && orderDate <= end;
        });
      } else if (month && year) {
        // Month filter
        const selectedMonth = parseInt(month) - 1;
        const selectedYear = parseInt(year);

        filteredOrders = filteredOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate.getMonth() === selectedMonth && orderDate.getFullYear() === selectedYear;
        });
      }

      // Apply status filter
      if (status && status !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === status);
      }

      // ✅ APPLY ROLE-BASED FILTERING (same as UI)
      const userType = req.user.userType || req.user.role;
      const isSuperAdmin = userType === 'super_admin' || userType === 'admin';
      const isTheaterAdmin = userType === 'theater_admin';
      const isTheaterUser = userType === 'theater_user';
      
      console.log(`👤 User: ${req.user.username}, Type: ${userType}, Role: ${req.user.role}`);
      console.log(`📊 Before role filtering: ${filteredOrders.length} orders`);

      // Super Admin and Theater Admin see ALL orders
      if (isSuperAdmin || isTheaterAdmin) {
        console.log('✅ Admin access - showing all orders in Excel');
      } 
      // Theater User (staff) only sees their own orders
      else if (isTheaterUser && req.user.userId) {
        console.log(`👤 Staff access - filtering to own orders only (userId: ${req.user.userId})`);
        const beforeFilter = filteredOrders.length;
        filteredOrders = filteredOrders.filter(order => 
          order.staffInfo && String(order.staffInfo.staffId) === String(req.user.userId)
        );
        console.log(`   Filtered from ${beforeFilter} to ${filteredOrders.length} orders for staff member`);
      }

      console.log(`✅ Found ${filteredOrders.length} orders for Excel export`);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = req.user.username || 'System';
      workbook.created = new Date();

      // Add worksheet
      const worksheet = workbook.addWorksheet('Order History');

      // Style definitions
      const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      };

      const titleStyle = {
        font: { bold: true, size: 16, color: { argb: 'FF8B5CF6' } },
        alignment: { horizontal: 'center' }
      };

      // Add title
      worksheet.mergeCells('A1:J1');
      worksheet.getCell('A1').value = 'Order History Report';
      worksheet.getCell('A1').style = titleStyle;
      worksheet.getRow(1).height = 25;

      // Add metadata
      worksheet.getCell('A2').value = `Generated By: ${req.user.username}`;
      worksheet.getCell('A3').value = `Generated At: ${new Date().toLocaleString('en-IN')}`;
      
      let filterInfo = 'Filter: ';
      if (date) {
        filterInfo += `Date: ${new Date(date).toLocaleDateString('en-IN')}`;
      } else if (startDate && endDate) {
        filterInfo += `Date Range: ${new Date(startDate).toLocaleDateString('en-IN')} to ${new Date(endDate).toLocaleDateString('en-IN')}`;
      } else if (month && year) {
        filterInfo += `Month: ${new Date(year, month - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
      } else {
        filterInfo += 'All Records';
      }
      if (status && status !== 'all') {
        filterInfo += ` | Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`;
      }
      worksheet.getCell('A4').value = filterInfo;

      // Add headers (row 6) - WITH STAFF NAME ONLY
      const headers = ['S.No', 'Order No', 'Date', 'Time', 'Customer', 'Phone', 'Staff Name', 'Items', 'Quantity', 'Amount', 'Payment', 'Status'];
      worksheet.getRow(6).values = headers;
      worksheet.getRow(6).eachCell((cell) => {
        cell.style = headerStyle;
      });
      worksheet.getRow(6).height = 20;

      // Set column widths
      worksheet.columns = [
        { key: 'sno', width: 8 },
        { key: 'orderNo', width: 18 },
        { key: 'date', width: 15 },
        { key: 'time', width: 12 },
        { key: 'customer', width: 20 },
        { key: 'phone', width: 15 },
        { key: 'staffName', width: 20 },     // Staff Name column
        { key: 'items', width: 40 },
        { key: 'quantity', width: 10 },
        { key: 'amount', width: 15 },
        { key: 'payment', width: 12 },
        { key: 'status', width: 12 }
      ];

      // Add data rows
      let rowIndex = 7;
      let totalRevenue = 0;
      let totalOrders = filteredOrders.length;

      filteredOrders.forEach((order, index) => {
        const orderDate = new Date(order.createdAt);
        const items = order.products?.map(i => `${i.productName || i.name} (${i.quantity})`).join(', ') || 
                     order.items?.map(i => `${i.name} (${i.quantity})`).join(', ') || 'N/A';
        const totalQty = order.products?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 
                        order.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
        const amount = order.pricing?.total || order.totalAmount || 0;
        totalRevenue += amount;

        // Extract staff username - CORRECTED to use the right field
        const staffName = order.staffInfo?.username || 'N/A';

        const row = worksheet.getRow(rowIndex);
        row.values = [
          index + 1,
          order.orderNumber || order._id?.toString().slice(-8) || 'N/A',
          orderDate.toLocaleDateString('en-IN'),
          orderDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          order.customerName || order.customerInfo?.name || 'Guest',
          order.customerPhone || order.customerInfo?.phone || 'N/A',
          staffName,      // Staff Name only
          items,
          totalQty,
          amount,
          order.payment?.method || order.paymentMethod || 'N/A',
          order.status || 'pending'
        ];

        // Style data rows
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
          };
          
          // Items column (col 8) left-aligned, others centered
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 8 ? 'left' : 'center' };
          
          // Format currency (Amount column is now column 10)
          if (colNumber === 10) {
            cell.numFmt = '₹#,##0.00';
          }
          
          // Status color coding (Status column is now column 12)
          if (colNumber === 12) {
            const status = order.status || 'pending';
            if (status === 'completed') {
              cell.font = { color: { argb: 'FF059669' }, bold: true };
            } else if (status === 'confirmed') {
              cell.font = { color: { argb: 'FF3B82F6' }, bold: true };
            } else if (status === 'cancelled') {
              cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            } else if (status === 'pending') {
              cell.font = { color: { argb: 'FFF59E0B' }, bold: true };
            }
          }
        });

        rowIndex++;
      });

      // Add summary rows
      rowIndex++;
      const summaryRow = worksheet.getRow(rowIndex);
      summaryRow.values = ['', '', '', '', '', '', '', 'TOTAL:', totalOrders, totalRevenue, '', ''];
      summaryRow.getCell(8).font = { bold: true, size: 12 };
      summaryRow.getCell(9).font = { bold: true, size: 12 };
      summaryRow.getCell(10).font = { bold: true, size: 12 };
      summaryRow.getCell(10).numFmt = '₹#,##0.00';
      summaryRow.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
      summaryRow.height = 25;

      // Set response headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Order_History_${Date.now()}.xlsx"`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();

      console.log(`✅ Excel file generated successfully with ${totalOrders} orders`);

    } catch (error) {
      console.error('❌ Excel export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate Excel report',
        message: error.message
      });
    }
  }
);

module.exports = router;