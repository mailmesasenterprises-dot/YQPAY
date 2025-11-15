const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const SettingsController = require('../controllers/SettingsController');
const { authenticateToken } = require('../middleware/auth');

/**
 * SMS Routes (MVC Pattern)
 */

// POST /api/sms/send-test-otp
// Send test OTP via SMS
router.post('/send-test-otp',
  authenticateToken,
  BaseController.asyncHandler(SettingsController.sendTestOtp)
);

module.exports = router;

