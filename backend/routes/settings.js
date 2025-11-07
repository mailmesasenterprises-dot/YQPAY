const express = require('express');
const Settings = require('../models/Settings');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/settings/general
 * Get general settings (public settings)
 */
router.get('/general', [optionalAuth], async (req, res) => {
  try {
    let theaterId = req.query.theaterId;
    
    // If authenticated, use user's theater ID if no specific theater requested
    if (!theaterId && req.user?.theaterId) {
      theaterId = req.user.theaterId;
    }

    let settings = {};

    // ✅ FIX: Try to load from the actual settings collection first
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    
    try {
      // Query the actual settings collection for general config
      const settingsDoc = await db.collection('settings').findOne({ type: 'general' });
      
      if (settingsDoc && settingsDoc.generalConfig) {
        // Map the database fields to frontend expected format
        const generalConfig = settingsDoc.generalConfig;
        settings = {
          applicationName: generalConfig.applicationName || 'Theater Canteen System',
          browserTabTitle: generalConfig.browserTabTitle || 'YQPayNow - Theater Canteen',
          logoUrl: generalConfig.logoUrl || '',
          qrCodeUrl: generalConfig.qrCodeUrl || '',
          environment: generalConfig.environment || 'development',
          defaultCurrency: generalConfig.defaultCurrency || 'INR',
          timezone: generalConfig.timezone || 'Asia/Kolkata',
          dateFormat: generalConfig.dateFormat || 'DD/MM/YYYY',
          timeFormat: generalConfig.timeFormat || '12hour',
          languageRegion: generalConfig.languageRegion || 'en-IN',
          // Additional fields
          currency: generalConfig.currency || generalConfig.defaultCurrency || 'INR',
          currencySymbol: generalConfig.currencySymbol || '₹',
          primaryColor: generalConfig.primaryColor || '#8B5CF6',
          secondaryColor: generalConfig.secondaryColor || '#6366F1',
          taxRate: generalConfig.taxRate || 18,
          serviceChargeRate: generalConfig.serviceChargeRate || 0
        };
      } else {
        // Return default global settings if nothing found
        settings = {
          applicationName: 'Theater Canteen System',
          browserTabTitle: 'YQPayNow - Theater Canteen',
          logoUrl: '',
          qrCodeUrl: '',
          environment: 'development',
          defaultCurrency: 'INR',
          timezone: 'Asia/Kolkata',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12hour',
          languageRegion: 'en-IN',
          currency: 'INR',
          currencySymbol: '₹',
          primaryColor: '#8B5CF6',
          secondaryColor: '#6366F1',
          taxRate: 18,
          serviceChargeRate: 0
        };
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      // Fallback to defaults on error
      settings = {
        applicationName: 'Theater Canteen System',
        browserTabTitle: 'YQPayNow - Theater Canteen',
        logoUrl: '',
        qrCodeUrl: '',
        environment: 'development',
        defaultCurrency: 'INR',
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12hour',
        languageRegion: 'en-IN',
        currency: 'INR',
        currencySymbol: '₹',
        primaryColor: '#8B5CF6',
        secondaryColor: '#6366F1',
        taxRate: 18,
        serviceChargeRate: 0
      };
    }

    // Return settings in the format frontend expects
    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get general settings error:', error);
    res.status(500).json({
      error: 'Failed to fetch settings',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/settings/general
 * Update general settings
 */
router.post('/general', [optionalAuth], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // ✅ FIX: Define all allowed settings fields
    const allowedSettings = [
      'applicationName', 'browserTabTitle', 'logoUrl', 'qrCodeUrl',
      'environment', 'defaultCurrency', 'timezone', 'dateFormat',
      'timeFormat', 'languageRegion', 'currency', 'currencySymbol',
      'primaryColor', 'secondaryColor', 'taxRate', 'serviceChargeRate',
      'siteName', 'siteDescription', 'orderTimeout', 'maintenanceMode',
      'allowRegistration', 'requireEmailVerification', 'requirePhoneVerification',
      'maxOrdersPerDay', 'minOrderAmount', 'deliveryCharge', 'freeDeliveryThreshold',
      'frontendUrl'
    ];

    // Filter incoming settings to only allowed fields
    const updatedConfig = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedSettings.includes(key)) {
        updatedConfig[key] = value;
      }
    }
    // Update or create the settings document
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          'generalConfig': {
            ...updatedConfig
          },
          lastUpdated: new Date(),
          version: { $inc: 1 }
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: updatedConfig
    });

  } catch (error) {
    console.error('Update general settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings',
      message: error.message
    });
  }
});

/**
 * GET /api/settings/firebase
 * Get Firebase settings (restricted)
 */
router.get('/firebase', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get Firebase configuration from settings collection
    const settingsDoc = await db.collection('settings').findOne({ type: 'firebase' });
    const config = settingsDoc?.firebaseConfig || {};

    res.json({
      success: true,
      data: { config }
    });

  } catch (error) {
    console.error('❌ Get Firebase settings error:', error);
    res.status(500).json({
      error: 'Failed to fetch Firebase settings',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/gcs
 * Get Google Cloud Storage settings (restricted)
 */
router.get('/gcs', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const settingsDoc = await db.collection('settings').findOne({ type: 'gcs' });
    const config = settingsDoc?.gcsConfig || {};
    res.json({
      success: true,
      data: { config }
    });

  } catch (error) {
    console.error('❌ Get GCS settings error:', error);
    res.status(500).json({
      error: 'Failed to fetch GCS settings',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/mongodb
 * Get MongoDB settings (restricted)
 */
router.get('/mongodb', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const settingsDoc = await db.collection('settings').findOne({ type: 'mongodb' });
    const config = settingsDoc?.mongodbConfig || {};
    res.json({
      success: true,
      data: { config }
    });

  } catch (error) {
    console.error('❌ Get MongoDB settings error:', error);
    res.status(500).json({
      error: 'Failed to fetch MongoDB settings',
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/settings/sms
 * Get SMS settings (restricted)
 */
router.get('/sms', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get SMS configuration from database
    const settingsDoc = await db.collection('settings').findOne({ type: 'sms' });


    if (settingsDoc && settingsDoc.smsConfig) {
      const smsConfig = settingsDoc.smsConfig;
      const responseData = {
        success: true,
        data: smsConfig
      };

      res.json(responseData);
    } else {
      // Return default configuration
      res.json({
        success: true,
        data: {
          provider: 'msg91',
          msg91ApiKey: '',
          msg91SenderId: '',
          msg91TemplateId: '',
          msg91TemplateVariable: 'OTP',
          otpLength: 6,
          otpExpiry: 300,
          maxRetries: 3,
          enabled: false
        }
      });
    }
  } catch (error) {
    console.error('❌ Error loading SMS configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load SMS configuration',
      error: error.message
    });
  }
});

/**
 * OPTIONS /api/settings/image/logo
 * Handle preflight CORS requests for favicon
 */
router.options('/image/logo', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400' // 24 hours
  });
  res.status(204).send();
});

/**
 * GET /api/settings/image/logo
 * Serve logo image with CORS headers (proxies GCS URL)
 * Public endpoint for favicon usage
 * 
 * Note: We proxy instead of redirect because favicons need proper CORS headers
 * and GCS signed URLs don't include CORS headers by default
 */
router.get('/image/logo', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;
    const axios = require('axios');
    
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
        res.status(404).send('Logo not found or unavailable');
      }
    } else {
      // Return 404 for no logo
      res.status(404).send('Logo not configured');
    }
  } catch (error) {
    console.error('❌ Error serving logo:', error);
    res.status(500).send('Error loading logo');
  }
});

/**
 * POST /api/settings/sms
 * Save SMS configuration
 */
router.post('/sms', [authenticateToken], async (req, res) => {
  try {
    const {
      provider,
      msg91ApiKey,
      msg91SenderId,
      msg91TemplateId,
      msg91TemplateVariable,
      otpLength,
      otpExpiry,
      maxRetries,
      enabled
    } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get existing configuration to merge
    const existingDoc = await db.collection('settings').findOne({ type: 'sms' });
    const existingSmsConfig = existingDoc?.smsConfig || {};

    // Merge with existing configuration, only updating provided fields
    const smsConfig = {
      ...existingSmsConfig, // Keep all existing fields
      provider: provider || existingSmsConfig.provider || 'msg91',
      // Update only the fields that were sent
      ...(msg91ApiKey !== undefined && { msg91ApiKey }),
      ...(msg91SenderId !== undefined && { msg91SenderId }),
      ...(msg91TemplateId !== undefined && { msg91TemplateId }),
      ...(msg91TemplateVariable !== undefined && { msg91TemplateVariable }),
      ...(otpLength !== undefined && { otpLength }),
      ...(otpExpiry !== undefined && { otpExpiry }),
      ...(maxRetries !== undefined && { maxRetries }),
      ...(enabled !== undefined && { enabled })
    };
    // Update or create the SMS settings document using direct MongoDB
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'sms' },
      {
        $set: {
          'smsConfig': smsConfig,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    res.json({
      success: true,
      message: 'SMS configuration saved successfully',
      data: smsConfig
    });

  } catch (error) {
    console.error('❌ Error saving SMS configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save SMS configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/settings/firebase
 * Save Firebase configuration
 */
router.post('/firebase', [authenticateToken], async (req, res) => {
  try {
    const {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId
    } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get existing configuration to merge
    const existingDoc = await db.collection('settings').findOne({ type: 'firebase' });
    const existingFirebaseConfig = existingDoc?.firebaseConfig || {};

    // Merge with existing configuration
    const firebaseConfig = {
      ...existingFirebaseConfig,
      ...(apiKey !== undefined && { apiKey }),
      ...(authDomain !== undefined && { authDomain }),
      ...(projectId !== undefined && { projectId }),
      ...(storageBucket !== undefined && { storageBucket }),
      ...(messagingSenderId !== undefined && { messagingSenderId }),
      ...(appId !== undefined && { appId }),
      ...(measurementId !== undefined && { measurementId })
    };
    // Update or create the Firebase settings document
    await db.collection('settings').findOneAndUpdate(
      { type: 'firebase' },
      {
        $set: {
          firebaseConfig: firebaseConfig,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    res.json({
      success: true,
      message: 'Firebase configuration saved successfully',
      data: firebaseConfig
    });

  } catch (error) {
    console.error('❌ Error saving Firebase configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save Firebase configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/settings/test-firebase
 * Test Firebase connection
 */
router.post('/test-firebase', [authenticateToken], async (req, res) => {
  try {
    const {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    } = req.body;
    // Validate required fields
    if (!apiKey || !projectId || !storageBucket) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Firebase configuration fields',
        details: {
          apiKey: !apiKey ? 'required' : 'ok',
          projectId: !projectId ? 'required' : 'ok',
          storageBucket: !storageBucket ? 'required' : 'ok'
        }
      });
    }

    // Test 1: Validate API Key format
    if (!apiKey.startsWith('AIza')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid API key format',
        details: 'Firebase API keys should start with "AIza"'
      });
    }

    // Test 2: Try to verify the API key by making a request to Firebase Auth REST API
    const fetch = require('node-fetch');
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    
    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'test' })
      });

      const data = await response.json();
      
      // If we get an error about invalid token, that means the API key is valid
      if (data.error) {
        const errorCode = data.error.message;
        if (errorCode.includes('INVALID_ID_TOKEN') || errorCode.includes('INVALID_ARGUMENT')) {
          return res.json({
            success: true,
            message: 'Firebase connection successful!',
            details: {
              apiKey: 'valid',
              projectId: projectId,
              authDomain: authDomain,
              storageBucket: storageBucket,
              status: 'connected'
            }
          });
        } else if (errorCode.includes('API_KEY_INVALID')) {
          return res.status(400).json({
            success: false,
            message: 'Firebase API key is invalid',
            details: 'Please verify your API key in Firebase Console'
          });
        }
      }
      
      // Unexpected response but API is reachable
      return res.json({
        success: true,
        message: 'Firebase connection successful!',
        details: {
          apiKey: 'valid',
          projectId: projectId,
          status: 'connected'
        }
      });
      
    } catch (fetchError) {
      console.error('❌ Firebase API connection error:', fetchError.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to Firebase',
        details: 'Please check your internet connection and Firebase configuration',
        error: fetchError.message
      });
    }

  } catch (error) {
    console.error('❌ Error testing Firebase connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Firebase connection',
      error: error.message
    });
  }
});

/**
 * POST /api/settings/mongodb
 * Save MongoDB configuration
 */
router.post('/mongodb', [authenticateToken], async (req, res) => {
  try {
    const {
      connectionString,
      database,
      poolSize,
      socketTimeoutMS,
      connectTimeoutMS
    } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const existingDoc = await db.collection('settings').findOne({ type: 'mongodb' });
    const existingMongoConfig = existingDoc?.mongodbConfig || {};

    const mongodbConfig = {
      ...existingMongoConfig,
      ...(connectionString !== undefined && { connectionString }),
      ...(database !== undefined && { database }),
      ...(poolSize !== undefined && { poolSize }),
      ...(socketTimeoutMS !== undefined && { socketTimeoutMS }),
      ...(connectTimeoutMS !== undefined && { connectTimeoutMS })
    };

    await db.collection('settings').findOneAndUpdate(
      { type: 'mongodb' },
      {
        $set: {
          mongodbConfig: mongodbConfig,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    res.json({
      success: true,
      message: 'MongoDB configuration saved successfully',
      data: mongodbConfig
    });

  } catch (error) {
    console.error('❌ Error saving MongoDB configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save MongoDB configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/settings/gcs
 * Save Google Cloud Storage configuration
 */
router.post('/gcs', [authenticateToken], async (req, res) => {
  try {
    const {
      projectId,
      bucketName,
      credentials
    } = req.body;
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const existingDoc = await db.collection('settings').findOne({ type: 'gcs' });
    const existingGcsConfig = existingDoc?.gcsConfig || {};

    const gcsConfig = {
      ...existingGcsConfig,
      ...(projectId !== undefined && { projectId }),
      ...(bucketName !== undefined && { bucketName }),
      ...(credentials !== undefined && { credentials })
    };

    await db.collection('settings').findOneAndUpdate(
      { type: 'gcs' },
      {
        $set: {
          gcsConfig: gcsConfig,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );
    res.json({
      success: true,
      message: 'GCS configuration saved successfully',
      data: gcsConfig
    });

  } catch (error) {
    console.error('❌ Error saving GCS configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save GCS configuration',
      error: error.message
    });
  }
});

module.exports = router;
