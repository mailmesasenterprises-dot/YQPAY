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
   * POST /api/settings/general
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
   * GET /api/settings/firebase
   * Get Firebase settings (restricted)
   */
  static async getFirebase(req, res) {
    try {
      const config = await settingsService.getFirebaseSettings();
      return BaseController.success(res, { config });
    } catch (error) {
      console.error('❌ Get Firebase settings error:', error);
      return BaseController.error(res, 'Failed to fetch Firebase settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/firebase
   * Save Firebase configuration
   */
  static async updateFirebase(req, res) {
    try {
      const config = await settingsService.updateFirebaseSettings(req.body);
      return BaseController.success(res, config, 'Firebase configuration saved successfully');
    } catch (error) {
      console.error('❌ Error saving Firebase configuration:', error);
      return BaseController.error(res, 'Failed to save Firebase configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/test-firebase
   * Test Firebase connection
   */
  static async testFirebase(req, res) {
    try {
      const result = await settingsService.testFirebaseConnection(req.body);
      return BaseController.success(res, result.details, result.message);
    } catch (error) {
      console.error('❌ Error testing Firebase connection:', error);
      return BaseController.error(res, error.message || 'Failed to test Firebase connection', error.statusCode || 500, {
        details: error.details
      });
    }
  }

  /**
   * GET /api/settings/gcs
   * Get Google Cloud Storage settings (restricted)
   */
  static async getGcs(req, res) {
    try {
      const config = await settingsService.getGcsSettings();
      return BaseController.success(res, { config });
    } catch (error) {
      console.error('❌ Get GCS settings error:', error);
      return BaseController.error(res, 'Failed to fetch GCS settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/test-gcs
   * Test Google Cloud Storage connection by uploading a test file
   */
  static async testGcs(req, res) {
    try {
      console.log('🧪 [SettingsController] Testing GCS connection...');
      
      const { projectId, bucketName, credentials, folder } = req.body;
      const testFolder = folder || 'test-uploads';
      
      // First, save/update the GCS configuration if credentials are provided
      if (credentials || projectId || bucketName) {
        console.log('   Saving GCS configuration before test...');
        await settingsService.updateGcsSettings(req.body);
      }
      
      // Initialize GCS
      const { resetGCSClient, initializeGCS, uploadFile } = require('../utils/gcsUploadUtil');
      resetGCSClient();
      const client = await initializeGCS();
      
      if (!client) {
        return BaseController.error(res, 'GCS client not initialized. Please check your configuration.', 400, {
          message: 'GCS credentials incomplete or invalid'
        });
      }
      
      console.log('   ✅ GCS client initialized');
      console.log('   Testing upload to folder:', testFolder);
      
      // Create a test file (simple text file)
      const testContent = `GCS Connection Test File
Created: ${new Date().toISOString()}
This file was created to test GCS connectivity.
If you can see this file in your bucket, GCS is working correctly!`;
      
      const testFileName = `test-connection-${Date.now()}.txt`;
      const testBuffer = Buffer.from(testContent, 'utf-8');
      
      // Upload test file
      try {
        console.log('   📤 Uploading test file...');
        const testFileUrl = await uploadFile(testBuffer, testFileName, testFolder, 'text/plain');
        console.log('   ✅ Test file uploaded successfully!');
        console.log('   URL:', testFileUrl);
        
        return BaseController.success(res, {
          testFileUrl,
          folder: testFolder,
          fileName: testFileName,
          message: `GCS connection test successful! Test file uploaded to ${testFolder}/${testFileName}`
        }, 'GCS connection test successful!');
        
      } catch (uploadError) {
        console.error('   ❌ Test upload failed:', uploadError.message);
        return BaseController.error(res, 'GCS upload test failed', 500, {
          message: uploadError.message,
          details: {
            error: uploadError.message,
            folder: testFolder,
            fileName: testFileName
          }
        });
      }
      
    } catch (error) {
      console.error('❌ [SettingsController] GCS test error:', error);
      return BaseController.error(res, 'Failed to test GCS connection', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/gcs
   * Save Google Cloud Storage configuration
   */
  static async updateGcs(req, res) {
    try {
      console.log('💾 [SettingsController] Updating GCS configuration...');
      console.log('   Received data:', {
        projectId: req.body.projectId || undefined,
        bucketName: req.body.bucketName || undefined,
        region: req.body.region || undefined,
        hasCredentials: !!req.body.credentials,
        credentialsType: typeof req.body.credentials,
        credentialsIsObject: req.body.credentials && typeof req.body.credentials === 'object',
        credentialsKeys: req.body.credentials && typeof req.body.credentials === 'object' ? Object.keys(req.body.credentials) : [],
        hasClientEmail: req.body.credentials && (!!req.body.credentials.clientEmail || !!req.body.credentials.client_email),
        hasPrivateKey: req.body.credentials && (!!req.body.credentials.privateKey || !!req.body.credentials.private_key),
        keyFilename: req.body.keyFilename || undefined
      });
      
      // Validate that we have at least projectId, bucketName, and credentials
      if (!req.body.credentials || typeof req.body.credentials !== 'object' || 
          (!req.body.credentials.clientEmail && !req.body.credentials.client_email) ||
          (!req.body.credentials.privateKey && !req.body.credentials.private_key)) {
        console.warn('⚠️  [SettingsController] Warning: Incomplete credentials in request');
        console.warn('   This may cause GCS to use mock mode');
      }
      
      const config = await settingsService.updateGcsSettings(req.body);
      
      // Force GCS client re-initialization after config update
      try {
        const { resetGCSClient, initializeGCS } = require('../utils/gcsUploadUtil');
        // Reset the client to force re-initialization
        resetGCSClient();
        // Try to initialize with new config
        await initializeGCS();
        console.log('✅ [SettingsController] GCS client re-initialized after config update');
      } catch (reinitError) {
        console.warn('⚠️  [SettingsController] Could not re-initialize GCS client:', reinitError.message);
        console.warn('   Client will re-initialize on next file upload');
        // Don't fail the request if re-init fails, config is still saved
      }
      
      return BaseController.success(res, config, 'GCS configuration saved successfully');
    } catch (error) {
      console.error('❌ Error saving GCS configuration:', error);
      return BaseController.error(res, 'Failed to save GCS configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/settings/mongodb
   * Get MongoDB settings (restricted)
   */
  static async getMongodb(req, res) {
    try {
      const config = await settingsService.getMongodbSettings();
      return BaseController.success(res, { config });
    } catch (error) {
      console.error('❌ Get MongoDB settings error:', error);
      return BaseController.error(res, 'Failed to fetch MongoDB settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/mongodb
   * Save MongoDB configuration
   */
  static async updateMongodb(req, res) {
    try {
      const config = await settingsService.updateMongodbSettings(req.body);
      return BaseController.success(res, config, 'MongoDB configuration saved successfully');
    } catch (error) {
      console.error('❌ Error saving MongoDB configuration:', error);
      return BaseController.error(res, 'Failed to save MongoDB configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/settings/sms
   * Get SMS settings (restricted)
   */
  static async getSms(req, res) {
    try {
      const config = await settingsService.getSmsSettings();
      return BaseController.success(res, config);
    } catch (error) {
      console.error('❌ Error loading SMS configuration:', error);
      return BaseController.error(res, 'Failed to load SMS configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/sms
   * Save SMS configuration
   */
  static async updateSms(req, res) {
    try {
      const config = await settingsService.updateSmsSettings(req.body);
      return BaseController.success(res, config, 'SMS configuration saved successfully');
    } catch (error) {
      console.error('❌ Error saving SMS configuration:', error);
      return BaseController.error(res, 'Failed to save SMS configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * GET /api/settings/mail
   * Get Mail settings (restricted)
   */
  static async getMail(req, res) {
    try {
      const config = await settingsService.getMailSettings();
      return BaseController.success(res, config);
    } catch (error) {
      console.error('❌ Get Mail settings error:', error);
      return BaseController.error(res, 'Failed to fetch Mail settings', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/mail
   * Create or Update Mail configuration
   */
  static async createMail(req, res) {
    try {
      const config = await settingsService.createMailSettings(req.body);
      return BaseController.success(res, config, 'Mail configuration saved successfully');
    } catch (error) {
      console.error('❌ Error saving Mail configuration:', error);
      return BaseController.error(res, 'Failed to save Mail configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * PUT /api/settings/mail
   * Update Mail configuration
   */
  static async updateMail(req, res) {
    try {
      const config = await settingsService.updateMailSettings(req.body);
      return BaseController.success(res, config, 'Mail configuration updated successfully');
    } catch (error) {
      console.error('❌ Error updating Mail configuration:', error);
      if (error.statusCode === 404) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to update Mail configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * DELETE /api/settings/mail
   * Delete Mail configuration
   */
  static async deleteMail(req, res) {
    try {
      await settingsService.deleteMailSettings();
      return BaseController.success(res, null, 'Mail configuration deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting Mail configuration:', error);
      if (error.statusCode === 404) {
        return BaseController.error(res, error.message, 404);
      }
      return BaseController.error(res, 'Failed to delete Mail configuration', 500, {
        message: error.message
      });
    }
  }

  /**
   * POST /api/settings/test-mail
   * Test Mail connection and send test email
   */
  static async testMail(req, res) {
    try {
      // Log raw request data
      console.log('📧 Test Mail request received');
      console.log('   Method:', req.method);
      console.log('   URL:', req.url);
      console.log('   Content-Type:', req.headers['content-type']);
      console.log('   Body type:', typeof req.body);
      console.log('   Body keys:', req.body ? Object.keys(req.body) : 'null/undefined');
      console.log('   Body length:', req.body ? Object.keys(req.body).length : 0);
      
      // Log request body for debugging (excluding password)
      const requestBody = req.body ? { ...req.body } : {};
      const sanitizedBody = { ...requestBody };
      if (sanitizedBody.password) {
        sanitizedBody.password = '***';
      }
      console.log('   Body (sanitized):', JSON.stringify(sanitizedBody, null, 2));

      // Check if body is empty or undefined
      if (!req.body || Object.keys(req.body).length === 0) {
        console.error('❌ Request body is empty or undefined!');
        console.error('   Raw body:', req.body);
        console.error('   Body parser might not be working correctly');
        return BaseController.error(res, 'Request body is empty. Please provide mail configuration data.', 400, {
          details: {
            hint: 'The request body should contain: host, port, username, password, fromName, fromEmail, encryption, and optionally testEmail.',
            receivedFields: req.body ? Object.keys(req.body) : [],
            contentType: req.headers['content-type']
          }
        });
      }

      // Validate that required fields are present (basic check)
      const requiredFields = ['host', 'port', 'username', 'password', 'fromName', 'fromEmail'];
      const missingBasic = requiredFields.filter(field => !req.body.hasOwnProperty(field));
      
      if (missingBasic.length > 0) {
        console.error('❌ Missing basic required fields:', missingBasic);
        return BaseController.error(res, `Missing required fields in request: ${missingBasic.join(', ')}`, 400, {
          details: {
            missingFields: missingBasic,
            receivedFields: Object.keys(req.body),
            hint: 'Please ensure all required fields (host, port, username, password, fromName, fromEmail) are included in the request.'
          }
        });
      }

      const result = await settingsService.testMailConnection(req.body);
      return BaseController.success(res, result.details, result.message);
    } catch (error) {
      console.error('❌ Error testing Mail connection:');
      console.error('   Message:', error.message);
      console.error('   Status Code:', error.statusCode || 500);
      if (error.details) {
        console.error('   Details:', JSON.stringify(error.details, null, 2));
      }
      if (error.stack && process.env.NODE_ENV === 'development') {
        console.error('   Stack:', error.stack);
      }
      return BaseController.error(res, error.message || 'Failed to test Mail connection', error.statusCode || 500, {
        details: error.details
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
      
      // Always set CORS headers first (even for errors)
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      
      // Get logo URL from settings using helper method
      const settingsService = require('../services/SettingsService');
      const settingsDoc = await settingsService._getOrCreateSystemSettingsDoc(db);
      
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
          
          // Set additional headers for successful response
          res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          });
          
          // Send the image buffer
          res.send(Buffer.from(imageResponse.data));
        } catch (proxyError) {
          console.error('❌ Error fetching logo from URL:', proxyError.message);
          // Return 404 with CORS headers
          return res.status(404).send('Logo not found or unavailable');
        }
      } else {
        // Return 404 with CORS headers for no logo configured
        return res.status(404).send('Logo not configured');
      }
    } catch (error) {
      console.error('❌ Error serving logo:', error);
      // Set CORS headers for error response
      res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.status(500).send('Error loading logo');
    }
  }

  /**
   * OPTIONS /api/settings/image/logo
   * Handle preflight CORS requests for favicon
   */
  static async optionsLogoImage(req, res) {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400' // 24 hours
    });
    res.status(204).send();
  }

  /**
   * POST /api/sms/send-test-otp
   * Send test OTP via SMS
   */
  static async sendTestOtp(req, res) {
    try {
      const { phoneNumber, otp } = req.body;

      // Validate required fields
      if (!phoneNumber) {
        return BaseController.error(res, 'Phone number is required', 400);
      }

      if (!otp) {
        return BaseController.error(res, 'OTP is required', 400);
      }

      // Get SMS settings
      const smsConfig = await settingsService.getSmsSettings();

      // Check if SMS is enabled
      if (!smsConfig.enabled) {
        return BaseController.error(res, 'SMS service is not enabled. Please enable it in SMS settings.', 400);
      }

      // Send OTP via SMS service
      const result = await settingsService.sendTestOtp(phoneNumber, otp, smsConfig);

      if (result.success) {
        return BaseController.success(res, { otp: otp }, result.message || 'Test OTP sent successfully');
      } else {
        return BaseController.error(res, result.message || 'Failed to send test OTP', 500, {
          details: result.details
        });
      }
    } catch (error) {
      console.error('❌ Error sending test OTP:', error);
      return BaseController.error(res, error.message || 'Failed to send test OTP', 500, {
        details: error.details
      });
    }
  }
}

module.exports = SettingsController;
