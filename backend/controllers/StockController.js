const BaseController = require('./BaseController');
const stockService = require('../services/StockService');

/**
 * Stock Controller
 */
class StockController extends BaseController {
  /**
   * GET /api/theater-stock/:theaterId/:productId
   */
  static async getMonthlyStock(req, res) {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      const { theaterId, productId } = req.params;
      const { year, month } = req.query;

      const monthlyDoc = await stockService.getMonthlyStock(
        theaterId,
        productId,
        year,
        month
      );

      return BaseController.success(res, monthlyDoc);
    } catch (error) {
      console.error('Get monthly stock error:', error);
      return BaseController.error(res, 'Failed to fetch stock', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/theater-stock/:theaterId/:productId
   */
  static async addStockEntry(req, res) {
    try {
      const { theaterId, productId } = req.params;

      const monthlyDoc = await stockService.addStockEntry(
        theaterId,
        productId,
        req.body
      );

      return BaseController.success(res, monthlyDoc, 'Stock entry added successfully');
    } catch (error) {
      console.error('Add stock entry error:', error);
      return BaseController.error(res, 'Failed to add stock entry', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/theater-stock/:theaterId/:productId/:entryId
   */
  static async updateStockEntry(req, res) {
    try {
      const { theaterId, productId, entryId } = req.params;

      const monthlyDoc = await stockService.updateStockEntry(
        theaterId,
        productId,
        entryId,
        req.body
      );

      return BaseController.success(res, monthlyDoc, 'Stock entry updated successfully');
    } catch (error) {
      console.error('Update stock entry error:', error);
      if (error.message === 'Monthly document not found' || error.message === 'Stock entry not found') {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to update stock entry', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/theater-stock/:theaterId/:productId/:entryId
   */
  static async deleteStockEntry(req, res) {
    try {
      const { theaterId, productId, entryId } = req.params;

      const monthlyDoc = await stockService.deleteStockEntry(
        theaterId,
        productId,
        entryId
      );

      return BaseController.success(res, monthlyDoc, 'Stock entry deleted successfully');
    } catch (error) {
      console.error('Delete stock entry error:', error);
      if (error.message === 'Monthly document not found') {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to delete stock entry', 500, {
        message: error.message
      });
    }
  }
}

module.exports = StockController;

