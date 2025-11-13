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

module.exports = router;

