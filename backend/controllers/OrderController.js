const BaseController = require('./BaseController');
const orderService = require('../services/OrderService');
const { sendOrderNotification } = require('../services/notificationService');

/**
 * Order Controller
 * Handles HTTP requests and responses for order endpoints
 */
class OrderController extends BaseController {
  /**
   * GET /api/orders/theater/:theaterId
   * Get orders for a theater
   */
  static async getByTheater(req, res) {
    try {
      if (!BaseController.checkDatabaseConnection()) {
        return res.status(503).json(
          BaseController.getDatabaseErrorResponse(req)
        );
      }

      const result = await orderService.getOrdersByTheater(
        req.params.theaterId,
        req.query
      );

      return BaseController.paginated(res, result.data, result.pagination);
    } catch (error) {
      console.error('Get orders error:', error);
      return BaseController.error(res, 'Failed to fetch orders', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/orders/theater/:theaterId/:orderId
   * Get a specific order
   */
  static async getById(req, res) {
    try {
      const order = await orderService.getOrderById(
        req.params.theaterId,
        req.params.orderId
      );

      if (!order) {
        return BaseController.error(res, 'Order not found', 404, {
          code: 'ORDER_NOT_FOUND'
        });
      }

      return BaseController.success(res, order);
    } catch (error) {
      console.error('Get order error:', error);
      if (error.name === 'CastError') {
        return BaseController.error(res, 'Invalid order ID', 400, {
          code: 'INVALID_ID'
        });
      }
      return BaseController.error(res, 'Failed to fetch order', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/orders/theater
   * Create a new order
   */
  static async create(req, res) {
    try {
      const order = await orderService.createOrder(
        req.body.theaterId,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: order
      });
    } catch (error) {
      console.error('Create order error:', error);
      if (error.message.includes('not found')) {
        return BaseController.error(res, error.message, 400, {
          code: 'PRODUCT_NOT_FOUND'
        });
      }
      return BaseController.error(res, 'Failed to create order', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/orders/theater/:theaterId/:orderId/status
   * Update order status
   */
  static async updateStatus(req, res) {
    try {
      const { theaterId, orderId } = req.params;
      const { status } = req.body;

      if (!status) {
        return BaseController.error(res, 'Status is required', 400);
      }

      const updatedOrder = await orderService.updateOrderStatus(
        theaterId,
        orderId,
        status
      );

      // Check authorization
      if (req.user && req.user.role !== 'super_admin' && 
          req.user.theaterId?.toString() !== theaterId) {
        return BaseController.error(res, 'Access denied', 403, {
          code: 'ACCESS_DENIED'
        });
      }

      // Send notification for specific status changes
      if (status === 'preparing' || status === 'completed' || status === 'ready') {
        await sendOrderNotification(updatedOrder, status).catch(err =>
          console.warn('Notification failed:', err.message)
        );
      }

      return BaseController.success(res, {
        orderId: updatedOrder._id,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt
      }, 'Order status updated successfully');
    } catch (error) {
      console.error('Update order status error:', error);
      if (error.message === 'Order not found') {
        return BaseController.error(res, 'Order not found', 404, {
          code: 'ORDER_NOT_FOUND'
        });
      }
      return BaseController.error(res, 'Failed to update order status', 500, {
        message: error.message
      });
    }
  }
}

module.exports = OrderController;

