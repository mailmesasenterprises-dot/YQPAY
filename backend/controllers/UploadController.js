const BaseController = require('./BaseController');
const { uploadFile } = require('../utils/gcsUploadUtil');

/**
 * Upload Controller
 */
class UploadController extends BaseController {
  /**
   * POST /api/upload/image
   */
  static async uploadImage(req, res) {
    try {
      if (!req.file) {
        return BaseController.error(res, 'No image file provided', 400, {
          code: 'NO_FILE'
        });
      }

      const folderType = req.body.folderType || 'general';
      const folderSubtype = req.body.folderSubtype || 'images';
      const folder = `${folderType}/${folderSubtype}`;

      const publicUrl = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        folder,
        req.file.mimetype
      );

      const fileInfo = {
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        publicUrl: publicUrl,
        uploadedAt: new Date()
      };

      return BaseController.success(res, fileInfo, 'Image uploaded successfully');
    } catch (error) {
      console.error('Upload image error:', error);
      return BaseController.error(res, 'Failed to upload image', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/upload/theater-document
   */
  static async uploadTheaterDocument(req, res) {
    try {
      if (!req.file) {
        return BaseController.error(res, 'No document file provided', 400, {
          code: 'NO_FILE'
        });
      }

      const folder = `theater-documents/${req.user?.theaterId || 'general'}`;
      const publicUrl = await uploadFile(
        req.file.buffer,
        req.file.originalname,
        folder,
        req.file.mimetype
      );

      const fileInfo = {
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        publicUrl: publicUrl,
        uploadedAt: new Date()
      };

      return BaseController.success(res, fileInfo, 'Document uploaded successfully');
    } catch (error) {
      console.error('Upload document error:', error);
      return BaseController.error(res, 'Failed to upload document', 500, {
        message: error.message
      });
    }
  }
}

module.exports = UploadController;

