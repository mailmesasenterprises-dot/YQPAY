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
      console.log('🔵 [PageAccessController] Create request received');
      console.log('🔵 [PageAccessController] Request body:', JSON.stringify(req.body, null, 2));
      console.log('🔵 [PageAccessController] Request user:', req.user);
      
      const { theaterId, ...pageData } = req.body;
      
      if (!theaterId) {
        console.error('❌ [PageAccessController] Theater ID is missing');
        return BaseController.error(res, 'Theater ID is required', 400);
      }
      
      console.log('✅ [PageAccessController] Theater ID:', theaterId);
      console.log('✅ [PageAccessController] Page data:', pageData);
      
      const result = await pageAccessService.createPageAccess(theaterId, pageData);
      
      console.log('✅ [PageAccessController] Page access created successfully');

      return res.status(201).json({
        success: true,
        message: 'Page access created successfully',
        data: result
      });
    } catch (error) {
      console.error('❌ [PageAccessController] Create page access error:', error);
      console.error('❌ [PageAccessController] Error stack:', error.stack);
      console.error('❌ [PageAccessController] Error message:', error.message);
      return BaseController.error(res, 'Failed to create page access', 500, {
        message: error.message,
        details: error.stack
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

