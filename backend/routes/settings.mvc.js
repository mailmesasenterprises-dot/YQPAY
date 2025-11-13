const express = require('express');
const router = express.Router();
const BaseController = require('../controllers/BaseController');
const SettingsController = require('../controllers/SettingsController');
const { authenticateToken, optionalAuth, requireRole } = require('../middleware/auth');
const { settingsValidator, validate } = require('../validators/settingsValidator');

/**
 * Settings Routes (MVC Pattern)
 */

// GET /api/settings/general
router.get('/general',
  optionalAuth,
  BaseController.asyncHandler(SettingsController.getGeneral)
);

// PUT /api/settings/general
router.put('/general',
  authenticateToken,
  requireRole(['super_admin']),
  settingsValidator.updateGeneral,
  validate,
  BaseController.asyncHandler(SettingsController.updateGeneral)
);

// GET /api/settings/theater/:theaterId
router.get('/theater/:theaterId',
  authenticateToken,
  BaseController.asyncHandler(SettingsController.getTheaterSettings)
);

// PUT /api/settings/theater/:theaterId
router.put('/theater/:theaterId',
  authenticateToken,
  BaseController.asyncHandler(SettingsController.updateTheaterSettings)
);

// GET /api/settings/image/logo
// Serve logo image with CORS headers (proxies GCS URL)
// Public endpoint for favicon usage
router.get('/image/logo',
  optionalAuth,
  BaseController.asyncHandler(SettingsController.getLogoImage)
);

module.exports = router;

