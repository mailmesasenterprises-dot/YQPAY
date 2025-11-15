const express = require('express');
const router = express.Router();
const multer = require('multer');
const BaseController = require('../controllers/BaseController');
const UploadController = require('../controllers/UploadController');
const { authenticateToken } = require('../middleware/auth');

// Configure multer
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'image' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else if (file.fieldname === 'document' && (
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

/**
 * Upload Routes (MVC Pattern)
 */

// POST /api/upload/image
router.post('/image',
  upload.single('image'),
  BaseController.asyncHandler(UploadController.uploadImage)
);

// POST /api/upload/theater-document
router.post('/theater-document',
  authenticateToken,
  upload.single('document'),
  BaseController.asyncHandler(UploadController.uploadTheaterDocument)
);

// POST /api/upload/product-image
// Special endpoint for product images with structured folder
router.post('/product-image',
  authenticateToken,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return BaseController.error(res, 'No image file provided', 400, {
          code: 'NO_FILE'
        });
      }

      // Get theaterId and productName from body for folder structure
      const theaterId = req.body.theaterId || 'general';
      const productName = req.body.productName || 'product';
      const folder = `products/${theaterId}/${productName.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const { uploadFile } = require('../utils/gcsUploadUtil');
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

      return BaseController.success(res, fileInfo, 'Product image uploaded successfully');
    } catch (error) {
      console.error('Upload product image error:', error);
      return BaseController.error(res, 'Failed to upload product image', 500, {
        message: error.message
      });
    }
  }
);

module.exports = router;

