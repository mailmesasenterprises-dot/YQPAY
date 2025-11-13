const BaseController = require('./BaseController');
const qrCodeNameService = require('../services/QRCodeNameService');

/**
 * QR Code Name Controller
 */
class QRCodeNameController extends BaseController {
  /**
   * GET /api/qrcodenames
   */
  static async getAll(req, res) {
    try {
      const { theaterId } = req.query;
      if (!theaterId) {
        return BaseController.error(res, 'Theater ID is required', 400);
      }

      const result = await qrCodeNameService.getQRCodeNames(theaterId, req.query);
      return BaseController.success(res, result);
    } catch (error) {
      console.error('Get QR code names error:', error);
      return BaseController.error(res, 'Failed to fetch QR code names', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/qrcodenames
   */
  static async create(req, res) {
    try {
      const { theaterId, qrName, seatClass, description } = req.body;
      const result = await qrCodeNameService.createQRCodeName(theaterId, {
        qrName,
        seatClass,
        description
      });

      return res.status(201).json({
        success: true,
        message: 'QR name created successfully',
        data: result
      });
    } catch (error) {
      console.error('Create QR code name error:', error);
      if (error.message === 'QR name already exists in this theater') {
        return BaseController.error(res, error.message, 400);
      }
      return BaseController.error(res, 'Failed to create QR name', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/qrcodenames/:id OR /api/qrcodenames/:theaterId/:qrNameId
   */
  static async update(req, res) {
    try {
      console.log('🔵 [QRCodeNameController] Update request params:', req.params);
      console.log('🔵 [QRCodeNameController] Update request body:', req.body);
      
      // Support both /:id and /:theaterId/:qrNameId patterns
      let theaterId, qrNameId;
      
      if (req.params.qrNameId) {
        // Pattern: /:theaterId/:qrNameId
        theaterId = req.params.theaterId;
        qrNameId = req.params.qrNameId;
      } else {
        // Pattern: /:id - theaterId should be in body
        qrNameId = req.params.id;
        theaterId = req.body.theaterId;
        
        if (!theaterId) {
          return BaseController.error(res, 'Theater ID is required in request body', 400);
        }
      }
      
      console.log('✅ [QRCodeNameController] Using theaterId:', theaterId, 'qrNameId:', qrNameId);
      
      const updated = await qrCodeNameService.updateQRCodeName(theaterId, qrNameId, req.body);
      return BaseController.success(res, updated, 'QR code name updated successfully');
    } catch (error) {
      console.error('❌ [QRCodeNameController] Update QR code name error:', error);
      if (error.message.includes('not found')) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to update QR code name', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/qrcodenames/:id OR /api/qrcodenames/:theaterId/:qrNameId
   */
  static async delete(req, res) {
    try {
      console.log('🔵 [QRCodeNameController] Delete request params:', req.params);
      console.log('🔵 [QRCodeNameController] Delete request query:', req.query);
      
      // Support both /:id and /:theaterId/:qrNameId patterns
      let theaterId, qrNameId;
      
      if (req.params.qrNameId) {
        // Pattern: /:theaterId/:qrNameId
        theaterId = req.params.theaterId;
        qrNameId = req.params.qrNameId;
      } else {
        // Pattern: /:id - theaterId should be in query
        qrNameId = req.params.id;
        theaterId = req.query.theaterId;
        
        if (!theaterId) {
          return BaseController.error(res, 'Theater ID is required in query string', 400);
        }
      }
      
      console.log('✅ [QRCodeNameController] Using theaterId:', theaterId, 'qrNameId:', qrNameId);
      
      await qrCodeNameService.deleteQRCodeName(theaterId, qrNameId);
      return BaseController.success(res, null, 'QR code name deleted successfully');
    } catch (error) {
      console.error('❌ [QRCodeNameController] Delete QR code name error:', error);
      if (error.message.includes('not found')) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to delete QR code name', 500, {
        message: error.message
      });
    }
  }
}

module.exports = QRCodeNameController;

