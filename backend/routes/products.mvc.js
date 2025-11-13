const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const ProductController = require('../controllers/ProductController');
const { authenticateToken, optionalAuth, requireTheaterAccess } = require('../middleware/auth');
const multer = require('multer');
const { productValidator, validate } = require('../validators/productValidator');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Product Routes (MVC Pattern)
 */

// GET /api/theater-products/:theaterId
router.get('/:theaterId',
  optionalAuth,
  productValidator.getByTheater,
  validate,
  BaseController.asyncHandler(ProductController.getByTheater)
);

// GET /api/theater-products/:theaterId/:productId
router.get('/:theaterId/:productId',
  optionalAuth,
  BaseController.asyncHandler(ProductController.getById)
);

// POST /api/theater-products/:theaterId
router.post('/:theaterId',
  authenticateToken,
  requireTheaterAccess,
  upload.single('image'),
  productValidator.create,
  validate,
  BaseController.asyncHandler(ProductController.create)
);

// PUT /api/theater-products/:theaterId/:productId
router.put('/:theaterId/:productId',
  authenticateToken,
  requireTheaterAccess,
  upload.single('image'),
  BaseController.asyncHandler(ProductController.update)
);

// DELETE /api/theater-products/:theaterId/:productId
router.delete('/:theaterId/:productId',
  authenticateToken,
  requireTheaterAccess,
  BaseController.asyncHandler(ProductController.delete)
);

module.exports = router;

