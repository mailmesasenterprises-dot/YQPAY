const BaseController = require('./BaseController');
const paymentService = require('../services/PaymentService');

/**
 * Payment Controller
 */
class PaymentController extends BaseController {
  /**
   * GET /api/payments/config/:theaterId/:channel
   */
  static async getConfig(req, res) {
    try {
      const { theaterId, channel } = req.params;
      const config = await paymentService.getPaymentConfig(theaterId, channel);
      return BaseController.success(res, { config });
    } catch (error) {
      console.error('Get payment config error:', error);
      if (error.message === 'Theater not found') {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to fetch payment config', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/payments/create-order
   */
  static async createOrder(req, res) {
    try {
      const { orderId, paymentMethod } = req.body;
      const result = await paymentService.createPaymentOrder(orderId, paymentMethod);
      return BaseController.success(res, result);
    } catch (error) {
      console.error('Create payment order error:', error);
      if (error.message === 'Order ID is required' || error.message === 'Order not found' || error.message === 'Theater not found') {
        return BaseController.error(res, error.message, 400);
      }
      return BaseController.error(res, 'Failed to create payment order', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/payments/verify
   */
  static async verify(req, res) {
    try {
      const result = await paymentService.verifyPayment(req.body);
      return BaseController.success(res, result);
    } catch (error) {
      console.error('Verify payment error:', error);
      return BaseController.error(res, 'Failed to verify payment', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/payments/transactions/:theaterId
   */
  static async getTransactions(req, res) {
    try {
      const result = await paymentService.getTransactions(req.params.theaterId, req.query);
      return BaseController.paginated(res, result.data, result.pagination);
    } catch (error) {
      console.error('Get transactions error:', error);
      return BaseController.error(res, 'Failed to fetch transactions', 500, {
        message: error.message
      });
    }
  }
}

module.exports = PaymentController;

