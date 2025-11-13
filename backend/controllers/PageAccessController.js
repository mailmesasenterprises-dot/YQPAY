const BaseController = require('./BaseController');
const pageAccessService = require('../services/PageAccessService');

/**
 * Page Access Controller
 */
class PageAccessController extends BaseController {
  /**
   * GET /api/page-access
   */
  static async getAll(req, res) {
    try {
      const { theaterId } = req.query;
      if (!theaterId) {
        return BaseController.error(res, 'Theater ID is required', 400);
      }

      const result = await pageAccessService.getPageAccess(theaterId);
      return BaseController.success(res, result);
    } catch (error) {
      console.error('Get page access error:', error);
      return BaseController.error(res, 'Failed to fetch page access', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/page-access
   */
  static async create(req, res) {
    try {
      const { theaterId, ...pageData } = req.body;
      const result = await pageAccessService.createPageAccess(theaterId, pageData);

      return res.status(201).json({
        success: true,
        message: 'Page access created successfully',
        data: result
      });
    } catch (error) {
      console.error('Create page access error:', error);
      return BaseController.error(res, 'Failed to create page access', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/page-access/:theaterId/:pageId
   */
  static async update(req, res) {
    try {
      const { theaterId, pageId } = req.params;
      const updated = await pageAccessService.updatePageAccess(theaterId, pageId, req.body);
      return BaseController.success(res, updated, 'Page access updated successfully');
    } catch (error) {
      console.error('Update page access error:', error);
      if (error.message.includes('not found')) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to update page access', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/page-access/:theaterId/:pageId
   */
  static async delete(req, res) {
    try {
      const { theaterId, pageId } = req.params;
      await pageAccessService.deletePageAccess(theaterId, pageId);
      return BaseController.success(res, null, 'Page access deleted successfully');
    } catch (error) {
      console.error('Delete page access error:', error);
      if (error.message.includes('not found')) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to delete page access', 500, {
        message: error.message
      });
    }
  }
}

module.exports = PageAccessController;

