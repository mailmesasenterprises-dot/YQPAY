const BaseController = require('./BaseController');
const settingsService = require('../services/SettingsService');

/**
 * Settings Controller
 */
class SettingsController extends BaseController {
  /**
   * GET /api/settings/general
   */
  static async getGeneral(req, res) {
    try {
      const theaterId = req.query.theaterId || req.user?.theaterId;
      const settings = await settingsService.getGeneralSettings(theaterId);
      return BaseController.success(res, settings);
    } catch (error) {
      console.error('Get general settings error:', error);
      return BaseController.error(res, 'Failed to fetch general settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/settings/general
   */
  static async updateGeneral(req, res) {
    try {
      const updated = await settingsService.updateGeneralSettings(req.body);
      return BaseController.success(res, updated, 'General settings updated successfully');
    } catch (error) {
      console.error('Update general settings error:', error);
      return BaseController.error(res, 'Failed to update general settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/settings/theater/:theaterId
   */
  static async getTheaterSettings(req, res) {
    try {
      const settings = await settingsService.getTheaterSettings(req.params.theaterId);
      if (!settings) {
        return BaseController.error(res, 'Theater settings not found', 404);
      }
      return BaseController.success(res, settings);
    } catch (error) {
      console.error('Get theater settings error:', error);
      return BaseController.error(res, 'Failed to fetch theater settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/settings/theater/:theaterId
   */
  static async updateTheaterSettings(req, res) {
    try {
      const updated = await settingsService.updateTheaterSettings(
        req.params.theaterId,
        req.body
      );
      return BaseController.success(res, updated, 'Theater settings updated successfully');
    } catch (error) {
      console.error('Update theater settings error:', error);
      return BaseController.error(res, 'Failed to update theater settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/settings/image/logo
   * Serve logo image with CORS headers (proxies GCS URL)
   * Public endpoint for favicon usage
   */
  static async getLogoImage(req, res) {
    try {
      const mongoose = require('mongoose');
      const axios = require('axios');
      const db = mongoose.connection.db;
      
      // Get logo URL from settings
      const settingsDoc = await db.collection('settings').findOne({ type: 'general' });
      
      if (settingsDoc && settingsDoc.generalConfig && settingsDoc.generalConfig.logoUrl) {
        const logoUrl = settingsDoc.generalConfig.logoUrl;

        try {
          // Fetch image from GCS (or other URL)
          const imageResponse = await axios.get(logoUrl, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
            maxRedirects: 5
          });
          
          // Get content type from response
          const contentType = imageResponse.headers['content-type'] || 'image/png';
          
          // Set CORS and cache headers for favicon
          res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*', // Allow all origins for favicon
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cross-Origin-Resource-Policy': 'cross-origin' // Important for favicon
          });
          
          // Send the image buffer
          res.send(Buffer.from(imageResponse.data));
        } catch (proxyError) {
          console.error('❌ Error fetching logo from URL:', proxyError.message);
          // Return 404 instead of error
          return res.status(404).send('Logo not found or unavailable');
        }
      } else {
        // Return 404 for no logo
        return res.status(404).send('Logo not configured');
      }
    } catch (error) {
      console.error('❌ Error serving logo:', error);
      return res.status(500).send('Error loading logo');
    }
  }
}

module.exports = SettingsController;

