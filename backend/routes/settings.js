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

/**
 * GET /api/settings/mail
 * Get Mail settings (restricted)
 */
router.get('/mail', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const settingsDoc = await db.collection('settings').findOne({ type: 'mail' });

    if (settingsDoc && settingsDoc.mailConfig) {
      const mailConfig = settingsDoc.mailConfig;
      res.json({
        success: true,
        data: mailConfig
      });
    } else {
      // Return default configuration
      res.json({
        success: true,
        data: {
          host: '',
          port: '587',
          username: '',
          password: '',
          fromName: '',
          fromEmail: '',
          encryption: 'SSL',
          testEmail: ''
        }
      });
    }

  } catch (error) {
    console.error('❌ Get Mail settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Mail settings',
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/settings/mail
 * Create or Update Mail configuration
 */
router.post('/mail', [authenticateToken], async (req, res) => {
  try {
    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption
      // Note: testEmail is not saved, it's only used for testing
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get existing configuration to merge
    const existingDoc = await db.collection('settings').findOne({ type: 'mail' });
    const existingMailConfig = existingDoc?.mailConfig || {};

    // Merge with existing configuration, only updating provided fields
    // Exclude testEmail from being saved
    const mailConfig = {
      ...existingMailConfig,
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(username !== undefined && { username }),
      ...(password !== undefined && { password }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(encryption !== undefined && { encryption: encryption || 'SSL' })
    };

    // Update or create the Mail settings document
    await db.collection('settings').findOneAndUpdate(
      { type: 'mail' },
      {
        $set: {
          mailConfig: mailConfig,
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
      message: 'Mail configuration saved successfully',
      data: mailConfig
    });

  } catch (error) {
    console.error('❌ Error saving Mail configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save Mail configuration',
      error: error.message
    });
  }
});

/**
 * PUT /api/settings/mail
 * Update Mail configuration
 */
router.put('/mail', [authenticateToken], async (req, res) => {
  try {
    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption
      // Note: testEmail is not saved, it's only used for testing
    } = req.body;

    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    // Get existing configuration
    const existingDoc = await db.collection('settings').findOne({ type: 'mail' });
    
    if (!existingDoc || !existingDoc.mailConfig) {
      return res.status(404).json({
        success: false,
        message: 'Mail configuration not found. Use POST to create.'
      });
    }

    const existingMailConfig = existingDoc.mailConfig;

    // Merge with existing configuration
    // Exclude testEmail from being saved
    const mailConfig = {
      ...existingMailConfig,
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port }),
      ...(username !== undefined && { username }),
      ...(password !== undefined && { password }),
      ...(fromName !== undefined && { fromName }),
      ...(fromEmail !== undefined && { fromEmail }),
      ...(encryption !== undefined && { encryption: encryption || 'SSL' })
    };

    // Update the Mail settings document
    await db.collection('settings').findOneAndUpdate(
      { type: 'mail' },
      {
        $set: {
          mailConfig: mailConfig,
          lastUpdated: new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    res.json({
      success: true,
      message: 'Mail configuration updated successfully',
      data: mailConfig
    });

  } catch (error) {
    console.error('❌ Error updating Mail configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Mail configuration',
      error: error.message
    });
  }
});

/**
 * DELETE /api/settings/mail
 * Delete Mail configuration
 */
router.delete('/mail', [authenticateToken], async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection.db;

    const result = await db.collection('settings').findOneAndDelete({ type: 'mail' });

    if (!result.value) {
      return res.status(404).json({
        success: false,
        message: 'Mail configuration not found'
      });
    }

    res.json({
      success: true,
      message: 'Mail configuration deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting Mail configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete Mail configuration',
      error: error.message
    });
  }
});

/**
 * POST /api/settings/test-mail
 * Test Mail connection and send test email
 */
router.post('/test-mail', [authenticateToken], async (req, res) => {
  try {
    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption,
      testEmail
    } = req.body;

    // Validate required fields
    if (!host || !port || !username || !fromName || !fromEmail) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Mail configuration fields',
        details: {
          host: !host ? 'required' : 'ok',
          port: !port ? 'required' : 'ok',
          username: !username ? 'required' : 'ok',
          fromName: !fromName ? 'required' : 'ok',
          fromEmail: !fromEmail ? 'required' : 'ok'
        }
      });
    }

    // Validate password is provided (required for authentication)
    if (!password || password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Mail password is required for authentication',
        details: {
          error: 'Password field is empty',
          hint: 'Please provide your SMTP password/API key'
        }
      });
    }

    // Validate test email if provided
    if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test email address format'
      });
    }

    // Try to import nodemailer (install if not available: npm install nodemailer)
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: 'Nodemailer is not installed. Please install it: npm install nodemailer',
        error: 'nodemailer module not found'
      });
    }

    // Create transporter
    const portNum = parseInt(port);
    const isSSL = encryption === 'SSL';
    
    // Port 465 typically uses SSL (secure connection)
    // Port 587 typically uses TLS (STARTTLS)
    // Auto-correct if there's a mismatch to prevent connection errors
    let useSecure = isSSL;
    let encryptionCorrected = false;
    let actualEncryption = encryption;
    
    if (portNum === 465 && !isSSL) {
      // Port 465 should use SSL
      useSecure = true;
      encryptionCorrected = true;
      actualEncryption = 'SSL';
    } else if (portNum === 587 && isSSL) {
      // Port 587 should use TLS, not SSL - auto-correct
      useSecure = false;
      encryptionCorrected = true;
      actualEncryption = 'TLS';
    }
    
    const transporter = nodemailer.createTransport({
      host: host,
      port: portNum,
      secure: useSecure, // true for SSL (port 465), false for TLS/STARTTLS (port 587)
      auth: {
        user: username.trim(),
        pass: password.trim()
      },
      tls: {
        rejectUnauthorized: false // For development/testing
      }
    });

    // Test connection
    try {
      await transporter.verify();
    } catch (verifyError) {
      // Check if it's an authentication error
      const errorMessage = verifyError.message || '';
      const isAuthError = errorMessage.includes('Authentication failed') || 
                         errorMessage.includes('Invalid login') ||
                         errorMessage.includes('535') ||
                         errorMessage.includes('authentication') ||
                         errorMessage.toLowerCase().includes('auth');
      
      let userMessage = 'Failed to connect to mail server';
      let helpfulHint = '';
      
      if (isAuthError) {
        userMessage = 'Authentication failed - Invalid username or password';
        helpfulHint = 'Please verify your SMTP username and password are correct. For Brevo, use your full SMTP login (e.g., username@smtp-brevo.com) and your SMTP key as password.';
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        userMessage = 'Failed to connect to mail server - Check host and port';
        helpfulHint = 'Please verify the SMTP host address and port number are correct.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Connection timeout - Server may be unreachable';
        helpfulHint = 'The mail server did not respond. Please check your network connection and firewall settings.';
      }
      
      return res.status(400).json({
        success: false,
        message: userMessage,
        error: verifyError.message,
        details: {
          host: host,
          port: port,
          username: username, // Include username for debugging (not password for security)
          encryption: actualEncryption,
          originalEncryption: encryptionCorrected ? encryption : undefined,
          status: isAuthError ? 'authentication_failed' : 'connection_failed',
          errorType: isAuthError ? 'authentication' : 'connection',
          ...(encryptionCorrected && { note: `Encryption was auto-corrected from ${encryption} to ${actualEncryption} based on port ${port}.` }),
          ...(helpfulHint && { hint: helpfulHint })
        }
      });
    }

    // If test email is provided, send a test email
    if (testEmail) {
      try {
        const mailOptions = {
          from: `"${fromName}" <${fromEmail}>`,
          to: testEmail,
          subject: 'Test Email from YQPayNow Settings',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #8B5CF6;">Test Email</h2>
              <p>This is a test email sent from your YQPayNow Mail configuration.</p>
              <p><strong>Configuration Details:</strong></p>
              <ul>
                <li>Host: ${host}</li>
                <li>Port: ${port}</li>
                <li>Encryption: ${actualEncryption || 'SSL'}</li>
                <li>From: ${fromName} &lt;${fromEmail}&gt;</li>
              </ul>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you received this email, your mail configuration is working correctly!
              </p>
            </div>
          `,
          text: `Test Email\n\nThis is a test email sent from your YQPayNow Mail configuration.\n\nConfiguration Details:\n- Host: ${host}\n- Port: ${port}\n- Encryption: ${actualEncryption || 'SSL'}\n- From: ${fromName} <${fromEmail}>\n\nIf you received this email, your mail configuration is working correctly!`
        };

        const info = await transporter.sendMail(mailOptions);
        
        return res.json({
          success: true,
          message: `Mail connection successful! Test email sent to ${testEmail}${encryptionCorrected ? ' (Note: Encryption was auto-corrected based on port)' : ''}`,
          details: {
            host: host,
            port: port,
            encryption: actualEncryption,
            originalEncryption: encryptionCorrected ? encryption : undefined,
            fromName: fromName,
            fromEmail: fromEmail,
            testEmail: testEmail,
            messageId: info.messageId,
            status: 'connected_and_sent',
            ...(encryptionCorrected && { warning: `Port ${port} typically uses ${actualEncryption}, not ${encryption}. Auto-corrected for connection.` })
          }
        });
      } catch (sendError) {
        return res.status(400).json({
          success: false,
          message: 'Connection successful but failed to send test email',
          error: sendError.message,
          details: {
            host: host,
            port: port,
            encryption: encryption || 'SSL',
            status: 'connected_but_send_failed'
          }
        });
      }
    }

    // If no test email, just return connection success
    res.json({
      success: true,
      message: `Mail connection successful!${encryptionCorrected ? ' (Note: Encryption was auto-corrected based on port)' : ''}`,
      details: {
        host: host,
        port: port,
        encryption: actualEncryption,
        originalEncryption: encryptionCorrected ? encryption : undefined,
        fromName: fromName,
        fromEmail: fromEmail,
        status: 'connected',
        ...(encryptionCorrected && { warning: `Port ${port} typically uses ${actualEncryption}, not ${encryption}. Auto-corrected for connection.` })
      }
    });

  } catch (error) {
    console.error('❌ Error testing Mail connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Mail connection',
      error: error.message
    });
  }
});

module.exports = router;
