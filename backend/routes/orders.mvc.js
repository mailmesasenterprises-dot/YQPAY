const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const OrderController = require('../controllers/OrderController');
const { authenticateToken, optionalAuth, requireTheaterAccess } = require('../middleware/auth');
const { orderValidator, validate } = require('../validators/orderValidator');

/**
 * Order Routes (MVC Pattern)
 */

// GET /api/orders/theater/:theaterId
router.get('/theater/:theaterId',
  optionalAuth,
  orderValidator.getByTheater,
  validate,
  BaseController.asyncHandler(OrderController.getByTheater)
);

// GET /api/orders/theater/:theaterId/:orderId
router.get('/theater/:theaterId/:orderId',
  optionalAuth,
  BaseController.asyncHandler(OrderController.getById)
);

// POST /api/orders/theater
router.post('/theater',
  optionalAuth,
  orderValidator.create,
  validate,
  BaseController.asyncHandler(OrderController.create)
);

// PUT /api/orders/theater/:theaterId/:orderId/status
router.put('/theater/:theaterId/:orderId/status',
  authenticateToken,
  requireTheaterAccess,
  orderValidator.updateStatus,
  validate,
  BaseController.asyncHandler(OrderController.updateStatus)
);

module.exports = router;

