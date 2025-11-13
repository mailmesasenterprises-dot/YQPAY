const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const PaymentController = require('../controllers/PaymentController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Payment Routes (MVC Pattern)
 */

// GET /api/payments/config/:theaterId/:channel
router.get('/config/:theaterId/:channel',
  BaseController.asyncHandler(PaymentController.getConfig)
);

// POST /api/payments/create-order
router.post('/create-order',
  BaseController.asyncHandler(PaymentController.createOrder)
);

// POST /api/payments/verify
router.post('/verify',
  BaseController.asyncHandler(PaymentController.verify)
);

// GET /api/payments/transactions/:theaterId
router.get('/transactions/:theaterId',
  authenticateToken,
  BaseController.asyncHandler(PaymentController.getTransactions)
);

// Note: Webhook routes should be handled separately as they need raw body parsing
// Keep webhook routes in old payments.js for now or create separate webhook handler

module.exports = router;

