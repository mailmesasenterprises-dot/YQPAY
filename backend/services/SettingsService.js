const BaseService = require('./BaseService');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');

/**
 * Settings Service
 * Handles all settings-related business logic
 */
class SettingsService extends BaseService {
  constructor() {
    super(Settings);
  }

  /**
   * Get general settings
   */
  async getGeneralSettings(theaterId = null) {
    const db = mongoose.connection.db;
    
    try {
      // Use system settings document helper
      const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);
      
      if (settingsDoc && settingsDoc.generalConfig) {
        const generalConfig = settingsDoc.generalConfig;
        return {
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
          currency: generalConfig.currency || generalConfig.defaultCurrency || 'INR',
          currencySymbol: generalConfig.currencySymbol || '₹',
          primaryColor: generalConfig.primaryColor || '#8B5CF6',
          secondaryColor: generalConfig.secondaryColor || '#6366F1',
          taxRate: generalConfig.taxRate || 18,
          serviceChargeRate: generalConfig.serviceChargeRate || 0
        };
      }
      
      // Return defaults
      return {
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
    } catch (error) {
      console.error('Get general settings error:', error);
      throw error;
    }
  }

  /**
   * Update general settings
   */
  async updateGeneralSettings(settingsData) {
    const db = mongoose.connection.db;
    
    // Define allowed settings fields
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
    for (const [key, value] of Object.entries(settingsData)) {
      if (allowedSettings.includes(key)) {
        updatedConfig[key] = value;
      }
    }

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    
    // Update the system settings document using its _id
    const result = await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          generalConfig: updatedConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result.value?.generalConfig || updatedConfig;
  }

  /**
   * Get theater-specific settings
   */
  async getTheaterSettings(theaterId) {
    if (!theaterId) {
      throw new Error('Theater ID is required');
    }

    const settings = await this.model.findOne({ theaterId }).lean().maxTimeMS(15000);
    return settings || null;
  }

  /**
   * Update theater settings
   */
  async updateTheaterSettings(theaterId, settingsData) {
    return this.model.findOneAndUpdate(
      { theaterId },
      { $set: { ...settingsData, updatedAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    ).maxTimeMS(15000);
  }

  /**
   * Get Firebase settings
   * Uses a special system settings document that stores all system configs
   */
  async getFirebaseSettings() {
    const db = mongoose.connection.db;
    const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);
    return settingsDoc?.firebaseConfig || {};
  }

  /**
   * Update Firebase settings
   */
  async updateFirebaseSettings(configData) {
    const db = mongoose.connection.db;
    const {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId
    } = configData;

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

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    
    await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          firebaseConfig: firebaseConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return firebaseConfig;
  }

  /**
   * Test Firebase connection
   */
  async testFirebaseConnection(configData) {
    const {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId
    } = configData;

    // Validate required fields
    if (!apiKey || !projectId || !storageBucket) {
      const error = new Error('Missing required Firebase configuration fields');
      error.statusCode = 400;
      error.details = {
        apiKey: !apiKey ? 'required' : 'ok',
        projectId: !projectId ? 'required' : 'ok',
        storageBucket: !storageBucket ? 'required' : 'ok'
      };
      throw error;
    }

    // Test 1: Validate API Key format
    if (!apiKey.startsWith('AIza')) {
      const error = new Error('Invalid API key format');
      error.statusCode = 400;
      error.details = 'Firebase API keys should start with "AIza"';
      throw error;
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
          return {
            message: 'Firebase connection successful!',
            details: {
              apiKey: 'valid',
              projectId: projectId,
              authDomain: authDomain,
              storageBucket: storageBucket,
              status: 'connected'
            }
          };
        } else if (errorCode.includes('API_KEY_INVALID')) {
          const error = new Error('Firebase API key is invalid');
          error.statusCode = 400;
          error.details = 'Please verify your API key in Firebase Console';
          throw error;
        }
      }
      
      // Unexpected response but API is reachable
      return {
        message: 'Firebase connection successful!',
        details: {
          apiKey: 'valid',
          projectId: projectId,
          status: 'connected'
        }
      };
      
    } catch (fetchError) {
      console.error('❌ Firebase API connection error:', fetchError.message);
      const error = new Error('Failed to connect to Firebase');
      error.statusCode = 500;
      error.details = 'Please check your internet connection and Firebase configuration';
      throw error;
    }
  }

  /**
   * Get GCS settings
   * Uses a special system settings document that stores all system configs
   */
  async getGcsSettings() {
    const db = mongoose.connection.db;
    const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);
    return settingsDoc?.gcsConfig || {};
  }

  /**
   * Update GCS settings
   * Stores in a single system settings document to avoid unique index conflicts
   */
  async updateGcsSettings(configData) {
    const db = mongoose.connection.db;
    const {
      projectId,
      bucketName,
      credentials,
      keyFilename
    } = configData;

    console.log('💾 [SettingsService] updateGcsSettings called');
    console.log('   Received configData:', {
      hasProjectId: !!projectId,
      hasBucketName: !!bucketName,
      hasCredentials: !!credentials,
      credentialsType: typeof credentials,
      credentialsIsObject: credentials && typeof credentials === 'object',
      credentialsKeys: credentials && typeof credentials === 'object' ? Object.keys(credentials) : [],
      hasKeyFilename: !!keyFilename
    });

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    const existingGcsConfig = systemDoc?.gcsConfig || {};

    console.log('   Existing GCS config:', {
      hasProjectId: !!existingGcsConfig.projectId,
      hasBucketName: !!existingGcsConfig.bucketName,
      hasCredentials: !!existingGcsConfig.credentials
    });

    // Handle credentials - either from credentials object or keyFilename
    let finalCredentials = null;
    
    // Priority 1: Use credentials from request body if provided
    if (credentials && typeof credentials === 'object' && Object.keys(credentials).length > 0) {
      console.log('   ✅ Using credentials from request body');
      finalCredentials = {
        clientEmail: credentials.clientEmail || credentials.client_email || null,
        privateKey: credentials.privateKey || credentials.private_key || null
      };
      
      // Validate credentials
      if (!finalCredentials.clientEmail || !finalCredentials.privateKey) {
        console.warn('   ⚠️  Incomplete credentials in request body');
        console.warn('      clientEmail:', !!finalCredentials.clientEmail);
        console.warn('      privateKey:', !!finalCredentials.privateKey);
        finalCredentials = null; // Reset if incomplete
      } else {
        console.log('   ✅ Extracted credentials successfully:');
        console.log('      Client Email:', finalCredentials.clientEmail.substring(0, 30) + '...');
        console.log('      Private Key:', finalCredentials.privateKey.substring(0, 30) + '...');
      }
    }
    
    // Priority 2: If credentials not in request, check if keyFilename is provided and try to read from file
    if (!finalCredentials && keyFilename && keyFilename.trim() !== '') {
      const fs = require('fs');
      const path = require('path');
      try {
        // Resolve keyFilename path (can be absolute or relative to project root)
        let keyFilePath = keyFilename;
        if (!path.isAbsolute(keyFilename)) {
          keyFilePath = path.join(__dirname, '../..', keyFilename);
        }
        
        if (fs.existsSync(keyFilePath)) {
          console.log('📄 [SettingsService] Reading GCS key file from:', keyFilePath);
          const keyFileContent = fs.readFileSync(keyFilePath, 'utf8');
          const keyData = JSON.parse(keyFileContent);
          
          // Extract credentials from key file
          finalCredentials = {
            clientEmail: keyData.client_email || keyData.clientEmail,
            privateKey: keyData.private_key || keyData.privateKey
          };
          
          // Also update projectId if not provided but found in key file
          if (!projectId && keyData.project_id) {
            configData.projectId = keyData.project_id;
          }
          
          console.log('✅ [SettingsService] Extracted credentials from key file');
          console.log('   Client Email:', finalCredentials.clientEmail ? finalCredentials.clientEmail.substring(0, 30) + '...' : 'N/A');
          console.log('   Private Key:', finalCredentials.privateKey ? '***' : 'N/A');
        } else {
          console.warn('⚠️  [SettingsService] Key file not found:', keyFilePath);
          console.warn('   Will try to use existing credentials if available');
        }
      } catch (keyFileError) {
        console.error('❌ [SettingsService] Error reading key file:', keyFileError.message);
        // Continue without credentials from file
      }
    }
    
    // Priority 3: If still no credentials, try to use existing ones from database
    if (!finalCredentials && existingGcsConfig.credentials && 
        typeof existingGcsConfig.credentials === 'object' &&
        Object.keys(existingGcsConfig.credentials).length > 0) {
      console.log('   ℹ️  Using existing credentials from database');
      finalCredentials = existingGcsConfig.credentials;
    }

    // Build gcsConfig object
    const gcsConfig = { ...existingGcsConfig };
    
    // Update projectId if provided
    if (projectId !== undefined && projectId !== null && projectId !== '' && typeof projectId === 'string') {
      gcsConfig.projectId = projectId.trim();
    }
    
    // Update bucketName if provided
    if (bucketName !== undefined && bucketName !== null && bucketName !== '' && typeof bucketName === 'string') {
      gcsConfig.bucketName = bucketName.trim();
    }
    
    // Update credentials if we have valid ones
    if (finalCredentials && typeof finalCredentials === 'object' && 
        finalCredentials.clientEmail && finalCredentials.privateKey) {
      gcsConfig.credentials = {
        clientEmail: finalCredentials.clientEmail.trim(),
        privateKey: finalCredentials.privateKey // Keep private key as-is (may contain newlines)
      };
      console.log('   ✅ Credentials will be saved');
    } else if (finalCredentials) {
      console.warn('   ⚠️  Credentials object exists but is incomplete, keeping existing credentials');
      // Keep existing credentials if new ones are incomplete
      if (!gcsConfig.credentials && existingGcsConfig.credentials) {
        gcsConfig.credentials = existingGcsConfig.credentials;
      }
    } else {
      console.warn('   ⚠️  No valid credentials found, GCS uploads will use mock mode');
    }
    
    // Store keyFilename for reference
    if (keyFilename !== undefined && keyFilename !== null && keyFilename !== '' && typeof keyFilename === 'string') {
      gcsConfig.keyFilename = keyFilename.trim();
    }
    
    // Update region if provided
    if (configData.region !== undefined && configData.region !== null && configData.region !== '') {
      gcsConfig.region = configData.region;
    }
    
    // Update folder if provided
    if (configData.folder !== undefined && configData.folder !== null && configData.folder !== '') {
      gcsConfig.folder = configData.folder.trim();
    }

    console.log('💾 [SettingsService] Saving GCS config:', {
      projectId: gcsConfig.projectId ? '***' : undefined,
      bucketName: gcsConfig.bucketName,
      hasCredentials: !!gcsConfig.credentials,
      credentialsKeys: gcsConfig.credentials ? Object.keys(gcsConfig.credentials) : [],
      credentialsHasClientEmail: gcsConfig.credentials && !!gcsConfig.credentials.clientEmail,
      credentialsHasPrivateKey: gcsConfig.credentials && !!gcsConfig.credentials.privateKey
    });
    
    if (!gcsConfig.credentials || !gcsConfig.credentials.clientEmail || !gcsConfig.credentials.privateKey) {
      console.warn('⚠️  [SettingsService] Warning: Credentials are incomplete!');
      console.warn('   This means GCS uploads will use mock mode (base64)');
    }

    // Save to database
    const result = await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          gcsConfig: gcsConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    // Verify what was actually saved
    const savedDoc = result.value || await db.collection('settings').findOne({ _id: systemDoc._id });
    const savedGcsConfig = savedDoc?.gcsConfig || {};
    
    console.log('✅ [SettingsService] GCS config saved to database');
    console.log('   Verification:');
    console.log('      Project ID saved:', !!savedGcsConfig.projectId, savedGcsConfig.projectId || 'N/A');
    console.log('      Bucket Name saved:', !!savedGcsConfig.bucketName, savedGcsConfig.bucketName || 'N/A');
    console.log('      Credentials saved:', !!savedGcsConfig.credentials);
    if (savedGcsConfig.credentials) {
      console.log('         Client Email:', !!savedGcsConfig.credentials.clientEmail, savedGcsConfig.credentials.clientEmail ? savedGcsConfig.credentials.clientEmail.substring(0, 30) + '...' : 'N/A');
      console.log('         Private Key:', !!savedGcsConfig.credentials.privateKey, savedGcsConfig.credentials.privateKey ? '***' : 'N/A');
    } else {
      console.log('         ⚠️  No credentials found in saved document!');
    }
    
    return savedGcsConfig;
  }

  /**
   * Get MongoDB settings
   * Uses a special system settings document that stores all system configs
   */
  async getMongodbSettings() {
    const db = mongoose.connection.db;
    const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);
    return settingsDoc?.mongodbConfig || {};
  }

  /**
   * Update MongoDB settings
   */
  async updateMongodbSettings(configData) {
    const db = mongoose.connection.db;
    const {
      connectionString,
      database,
      poolSize,
      socketTimeoutMS,
      connectTimeoutMS
    } = configData;

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    const existingMongoConfig = systemDoc?.mongodbConfig || {};

    const mongodbConfig = {
      ...existingMongoConfig,
      ...(connectionString !== undefined && { connectionString }),
      ...(database !== undefined && { database }),
      ...(poolSize !== undefined && { poolSize }),
      ...(socketTimeoutMS !== undefined && { socketTimeoutMS }),
      ...(connectTimeoutMS !== undefined && { connectTimeoutMS })
    };

    await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          mongodbConfig: mongodbConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return mongodbConfig;
  }

  /**
   * Helper: Get or create the system settings document
   * Ensures there's only ONE system settings document
   */
  async _getOrCreateSystemSettingsDoc(db) {
    // First try to find system settings document
    let systemDoc = await db.collection('settings').findOne({ 
      _systemSettings: true
    });

    // If found, return it
    if (systemDoc) {
      return systemDoc;
    }

    // Try to find any old format document (general, sms, firebase, etc.)
    const oldDocs = await db.collection('settings').find({
      $or: [
        { type: 'general', theaterId: null, category: null, key: null },
        { type: 'sms', theaterId: null, category: null, key: null },
        { type: 'firebase', theaterId: null, category: null, key: null },
        { type: 'gcs', theaterId: null, category: null, key: null },
        { type: 'mail', theaterId: null, category: null, key: null },
        { type: 'mongodb', theaterId: null, category: null, key: null }
      ]
    }).toArray();

    if (oldDocs.length > 0) {
      // Use the first old document and migrate it to system settings format
      const docToMigrate = oldDocs[0];
      
      // Merge all configs from old documents into one
      const mergedConfig = {
        generalConfig: docToMigrate.generalConfig || {},
        smsConfig: docToMigrate.smsConfig || {},
        firebaseConfig: docToMigrate.firebaseConfig || {},
        gcsConfig: docToMigrate.gcsConfig || {},
        mailConfig: docToMigrate.mailConfig || {},
        mongodbConfig: docToMigrate.mongodbConfig || {}
      };
      
      // Merge configs from other old documents
      oldDocs.slice(1).forEach(oldDoc => {
        if (oldDoc.generalConfig) mergedConfig.generalConfig = { ...mergedConfig.generalConfig, ...oldDoc.generalConfig };
        if (oldDoc.smsConfig) mergedConfig.smsConfig = { ...mergedConfig.smsConfig, ...oldDoc.smsConfig };
        if (oldDoc.firebaseConfig) mergedConfig.firebaseConfig = { ...mergedConfig.firebaseConfig, ...oldDoc.firebaseConfig };
        if (oldDoc.gcsConfig) mergedConfig.gcsConfig = { ...mergedConfig.gcsConfig, ...oldDoc.gcsConfig };
        if (oldDoc.mailConfig) mergedConfig.mailConfig = { ...mergedConfig.mailConfig, ...oldDoc.mailConfig };
        if (oldDoc.mongodbConfig) mergedConfig.mongodbConfig = { ...mergedConfig.mongodbConfig, ...oldDoc.mongodbConfig };
      });

      // Migrate the first document to system settings format
      await db.collection('settings').findOneAndUpdate(
        { _id: docToMigrate._id },
        {
          $set: {
            ...mergedConfig,
            _systemSettings: true,
            lastUpdated: new Date()
          },
          $unset: {
            type: '',
            theaterId: '',
            category: '',
            key: ''
          }
        }
      );

      // Delete other duplicate documents
      if (oldDocs.length > 1) {
        const idsToDelete = oldDocs
          .slice(1)
          .map(d => d._id);
        await db.collection('settings').deleteMany({ _id: { $in: idsToDelete } });
        console.log(`✅ Consolidated ${oldDocs.length} old settings documents into one system settings document`);
      }

      // Return the migrated document
      systemDoc = await db.collection('settings').findOne({ _id: docToMigrate._id });
      return systemDoc;
    }

    // No existing document found - create a new system settings document
    // Use a specific ObjectId to ensure we always use the same document
    const systemSettingsId = new mongoose.Types.ObjectId();
    const newDoc = {
      _id: systemSettingsId,
      _systemSettings: true,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    await db.collection('settings').insertOne(newDoc);
    return await db.collection('settings').findOne({ _id: systemSettingsId });
  }

  /**
   * Get SMS settings
   * Uses a special system settings document that stores all system configs
   */
  async getSmsSettings() {
    const db = mongoose.connection.db;
    const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);

    if (settingsDoc && settingsDoc.smsConfig) {
      return settingsDoc.smsConfig;
    }

    // Return default configuration
    return {
      provider: 'msg91',
      // MSG91 Config
      msg91ApiKey: '',
      msg91SenderId: '',
      msg91Route: '4',
      msg91TemplateId: '',
      msg91TemplateVariable: 'OTP',
      // Twilio Config
      twilioAccountSid: '',
      twilioAuthToken: '',
      twilioPhoneNumber: '',
      // TextLocal Config
      textlocalApiKey: '',
      textlocalUsername: '',
      textlocalSender: '',
      // AWS SNS Config
      awsAccessKeyId: '',
      awsSecretAccessKey: '',
      awsRegion: 'us-east-1',
      // General Settings
      otpLength: 6,
      otpExpiry: 300,
      maxRetries: 3,
      enabled: false
    };
  }

  /**
   * Update SMS settings
   */
  async updateSmsSettings(configData) {
    const db = mongoose.connection.db;
    const {
      provider,
      // MSG91 Config
      msg91ApiKey,
      msg91SenderId,
      msg91Route,
      msg91TemplateId,
      msg91TemplateVariable,
      // Twilio Config
      twilioAccountSid,
      twilioAuthToken,
      twilioPhoneNumber,
      // TextLocal Config
      textlocalApiKey,
      textlocalUsername,
      textlocalSender,
      // AWS SNS Config
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion,
      // General Settings
      otpLength,
      otpExpiry,
      maxRetries,
      enabled
      // Note: testPhoneNumber is intentionally excluded from being saved
    } = configData;

    // Get or create the system settings document (ensures only one exists)
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    const existingSmsConfig = systemDoc?.smsConfig || {};

    // Merge with existing configuration, only updating provided fields
    // Include all provider configs to support multiple SMS providers
    const smsConfig = {
      ...existingSmsConfig,
      // Provider selection
      provider: provider !== undefined ? provider : (existingSmsConfig.provider || 'msg91'),
      // MSG91 Config
      ...(msg91ApiKey !== undefined && { msg91ApiKey }),
      ...(msg91SenderId !== undefined && { msg91SenderId }),
      ...(msg91Route !== undefined && { msg91Route }),
      ...(msg91TemplateId !== undefined && { msg91TemplateId }),
      ...(msg91TemplateVariable !== undefined && { msg91TemplateVariable }),
      // Twilio Config
      ...(twilioAccountSid !== undefined && { twilioAccountSid }),
      ...(twilioAuthToken !== undefined && { twilioAuthToken }),
      ...(twilioPhoneNumber !== undefined && { twilioPhoneNumber }),
      // TextLocal Config
      ...(textlocalApiKey !== undefined && { textlocalApiKey }),
      ...(textlocalUsername !== undefined && { textlocalUsername }),
      ...(textlocalSender !== undefined && { textlocalSender }),
      // AWS SNS Config
      ...(awsAccessKeyId !== undefined && { awsAccessKeyId }),
      ...(awsSecretAccessKey !== undefined && { awsSecretAccessKey }),
      ...(awsRegion !== undefined && { awsRegion }),
      // General Settings
      ...(otpLength !== undefined && { otpLength }),
      ...(otpExpiry !== undefined && { otpExpiry }),
      ...(maxRetries !== undefined && { maxRetries }),
      ...(enabled !== undefined && { enabled })
    };

    // Update the system settings document using its _id to avoid conflicts
    try {
      const result = await db.collection('settings').findOneAndUpdate(
        { _id: systemDoc._id },
        {
          $set: {
            smsConfig: smsConfig,
            lastUpdated: new Date(),
            _systemSettings: true
          }
        },
        { returnDocument: 'after' }
      );

      // Log for debugging - verify what was saved
      console.log('✅ SMS settings saved successfully:', {
        provider: smsConfig.provider,
        msg91ApiKey: smsConfig.msg91ApiKey ? '***' + smsConfig.msg91ApiKey.slice(-4) : 'not set',
        msg91SenderId: smsConfig.msg91SenderId || 'not set',
        msg91Route: smsConfig.msg91Route || 'not set',
        msg91TemplateId: smsConfig.msg91TemplateId || 'not set',
        msg91TemplateVariable: smsConfig.msg91TemplateVariable || 'not set',
        otpLength: smsConfig.otpLength,
        otpExpiry: smsConfig.otpExpiry,
        maxRetries: smsConfig.maxRetries,
        enabled: smsConfig.enabled,
        savedToDB: !!result.value
      });

      return smsConfig;
    } catch (error) {
      console.error('❌ Error updating SMS settings:', error);
      // If there's still a duplicate key error, try to fix it
      if (error.code === 11000 || error.message.includes('duplicate key')) {
        console.warn('⚠️ Duplicate key error, attempting recovery...');
        
        // Re-consolidate all system settings documents
        await this._getOrCreateSystemSettingsDoc(db);
        
        // Retry the update
        const updatedSystemDoc = await this._getOrCreateSystemSettingsDoc(db);
        await db.collection('settings').findOneAndUpdate(
          { _id: updatedSystemDoc._id },
          {
            $set: {
              smsConfig: smsConfig,
              lastUpdated: new Date()
            }
          }
        );
        
        return smsConfig;
      }
      
      throw error;
    }
  }

  /**
   * Get Mail settings
   * Uses a special system settings document that stores all system configs
   */
  async getMailSettings() {
    const db = mongoose.connection.db;
    const settingsDoc = await this._getOrCreateSystemSettingsDoc(db);

    if (settingsDoc && settingsDoc.mailConfig) {
      return settingsDoc.mailConfig;
    }

    // Return default configuration
    return {
      host: '',
      port: '587',
      username: '',
      password: '',
      fromName: '',
      fromEmail: '',
      encryption: 'SSL',
      testEmail: ''
    };
  }

  /**
   * Create Mail settings
   */
  async createMailSettings(configData) {
    const db = mongoose.connection.db;
    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption
    } = configData;

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    const existingMailConfig = systemDoc?.mailConfig || {};

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

    await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          mailConfig: mailConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return mailConfig;
  }

  /**
   * Update Mail settings
   */
  async updateMailSettings(configData) {
    const db = mongoose.connection.db;
    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption
    } = configData;

    // Get or create system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    
    if (!systemDoc || !systemDoc.mailConfig) {
      const error = new Error('Mail configuration not found. Use POST to create.');
      error.statusCode = 404;
      throw error;
    }

    const existingMailConfig = systemDoc.mailConfig;

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

    await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $set: {
          mailConfig: mailConfig,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return mailConfig;
  }

  /**
   * Delete Mail settings
   */
  async deleteMailSettings() {
    const db = mongoose.connection.db;
    
    // Get system settings document
    const systemDoc = await this._getOrCreateSystemSettingsDoc(db);
    
    // Check if mailConfig exists
    if (!systemDoc.mailConfig) {
      const error = new Error('Mail configuration not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Only delete the mailConfig field, not the entire system settings document
    await db.collection('settings').findOneAndUpdate(
      { _id: systemDoc._id },
      {
        $unset: { mailConfig: '' },
        $set: { lastUpdated: new Date() }
      }
    );
    
    return true;
  }

  /**
   * Test Mail connection and send test email
   */
  async testMailConnection(configData) {
    // Validate configData exists
    if (!configData || typeof configData !== 'object') {
      const error = new Error('Mail configuration data is required');
      error.statusCode = 400;
      error.details = {
        hint: 'Please provide mail configuration data as an object.',
        receivedType: typeof configData,
        receivedValue: configData
      };
      throw error;
    }

    const {
      host,
      port,
      username,
      password,
      fromName,
      fromEmail,
      encryption,
      testEmail
    } = configData;

    // Log received data for debugging (excluding password)
    console.log('📧 Testing Mail connection with config:', {
      host: host || 'missing',
      port: port || 'missing',
      username: username || 'missing',
      password: password ? '***provided***' : 'missing',
      fromName: fromName || 'missing',
      fromEmail: fromEmail || 'missing',
      encryption: encryption || 'not specified',
      testEmail: testEmail || 'not provided'
    });

    // Validate required fields
    const missingFields = [];
    if (!host || host.trim() === '') missingFields.push('host');
    if (!port || port.toString().trim() === '') missingFields.push('port');
    if (!username || username.trim() === '') missingFields.push('username');
    if (!fromName || fromName.trim() === '') missingFields.push('fromName');
    if (!fromEmail || fromEmail.trim() === '') missingFields.push('fromEmail');

    if (missingFields.length > 0) {
      const error = new Error(`Missing required Mail configuration fields: ${missingFields.join(', ')}`);
      error.statusCode = 400;
      error.details = {
        missingFields: missingFields,
        host: !host || host.trim() === '' ? 'required' : 'ok',
        port: !port || port.toString().trim() === '' ? 'required' : 'ok',
        username: !username || username.trim() === '' ? 'required' : 'ok',
        fromName: !fromName || fromName.trim() === '' ? 'required' : 'ok',
        fromEmail: !fromEmail || fromEmail.trim() === '' ? 'required' : 'ok',
        hint: 'Please ensure all required fields are filled in the Mail configuration form.'
      };
      throw error;
    }

    // Validate password is provided (required for authentication)
    if (!password || password.trim() === '') {
      const error = new Error('Mail password is required for authentication');
      error.statusCode = 400;
      error.details = {
        error: 'Password field is empty',
        hint: 'Please provide your SMTP password/API key in the Mail configuration.'
      };
      throw error;
    }

    // Validate test email if provided
    if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      const error = new Error('Invalid test email address format');
      error.statusCode = 400;
      throw error;
    }

    // Try to import nodemailer (install if not available: npm install nodemailer)
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (err) {
      const error = new Error('Nodemailer is not installed. Please install it: npm install nodemailer');
      error.statusCode = 500;
      error.details = 'nodemailer module not found';
      throw error;
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
      
      // Detect Brevo/Sendinblue SMTP server
      const isBrevo = host && (host.includes('brevo.com') || host.includes('sendinblue.com'));
      
      if (isAuthError) {
        userMessage = 'Authentication failed - Invalid username or password';
        
        // Provide Brevo-specific guidance
        if (isBrevo) {
          helpfulHint = `For Brevo SMTP:
1. Username format: Your full SMTP login (e.g., "81cf02003@smtp-brevo.com" or your account email)
2. Password: Your SMTP key (NOT your account password). Get it from Brevo Dashboard → SMTP & API → SMTP keys
3. Current username being used: "${username}"
4. Make sure you're using your SMTP key, not your Brevo account password.`;
          
          // Additional check for common Brevo username format issues
          if (username && !username.includes('@smtp-brevo.com') && !username.includes('@sendinblue.com')) {
            helpfulHint += `\n\n⚠️ Your username "${username}" doesn't match Brevo's format. It should be in the format: "your-username@smtp-brevo.com" or use your account email address.`;
          }
        } else {
          helpfulHint = 'Please verify your SMTP username and password are correct. Make sure you are using the correct authentication credentials for your SMTP provider.';
        }
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
        userMessage = 'Failed to connect to mail server - Check host and port';
        helpfulHint = 'Please verify the SMTP host address and port number are correct.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Connection timeout - Server may be unreachable';
        helpfulHint = 'The mail server did not respond. Please check your network connection and firewall settings.';
      }
      
      const error = new Error(userMessage);
      error.statusCode = 400;
      error.details = {
        host: host,
        port: port,
        username: username, // Include username for debugging (not password for security)
        encryption: actualEncryption,
        originalEncryption: encryptionCorrected ? encryption : undefined,
        status: isAuthError ? 'authentication_failed' : 'connection_failed',
        errorType: isAuthError ? 'authentication' : 'connection',
        ...(encryptionCorrected && { note: `Encryption was auto-corrected from ${encryption} to ${actualEncryption} based on port ${port}.` }),
        ...(helpfulHint && { hint: helpfulHint })
      };
      throw error;
    }

    // If test email is provided, send a test email
    if (testEmail) {
      try {
        console.log(`📧 Attempting to send test email to: ${testEmail}`);
        console.log(`   From: "${fromName}" <${fromEmail}>`);
        
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

        console.log('📧 Sending email via transporter...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response || 'No response');
        console.log('   Accepted:', info.accepted || []);
        console.log('   Rejected:', info.rejected || []);
        
        if (info.rejected && info.rejected.length > 0) {
          console.warn('⚠️ Some recipients were rejected:', info.rejected);
        }
        
        return {
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
            accepted: info.accepted || [],
            rejected: info.rejected || [],
            response: info.response || 'No response',
            status: 'connected_and_sent',
            ...(info.rejected && info.rejected.length > 0 && {
              warning: `Email was sent but some recipients were rejected: ${info.rejected.join(', ')}`
            }),
            ...(encryptionCorrected && { warning: `Port ${port} typically uses ${actualEncryption}, not ${encryption}. Auto-corrected for connection.` })
          }
        };
      } catch (sendError) {
        console.error('❌ Failed to send test email:', sendError);
        console.error('   Error message:', sendError.message);
        console.error('   Error code:', sendError.code);
        console.error('   Error response:', sendError.response || 'No response');
        
        // Extract more detailed error information
        let errorDetails = {
          host: host,
          port: port,
          encryption: encryption || 'SSL',
          status: 'connected_but_send_failed',
          error: sendError.message,
          errorCode: sendError.code || 'UNKNOWN',
          testEmail: testEmail
        };
        
        // Add SMTP response if available
        if (sendError.response) {
          errorDetails.smtpResponse = sendError.response;
        }
        
        // Add helpful hints based on error type
        if (sendError.code === 'EAUTH' || sendError.message.includes('Authentication')) {
          errorDetails.hint = 'SMTP authentication failed. Please verify your username and password.';
        } else if (sendError.code === 'EMESSAGE' || sendError.message.includes('Invalid')) {
          errorDetails.hint = 'Email address format is invalid. Please check the recipient email address.';
        } else if (sendError.message.includes('ENOTFOUND') || sendError.message.includes('ECONNREFUSED')) {
          errorDetails.hint = 'Could not connect to SMTP server. Please verify host and port settings.';
        } else {
          errorDetails.hint = 'Email sending failed. Please check your SMTP configuration and try again.';
        }
        
        const error = new Error(`Connection successful but failed to send test email: ${sendError.message}`);
        error.statusCode = 400;
        error.details = errorDetails;
        throw error;
      }
    }

    // If no test email, just return connection success
    return {
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
    };
  }

  /**
   * Send test OTP via SMS
   */
  async sendTestOtp(phoneNumber, otp, smsConfig) {
    try {
      const axios = require('axios');
      const provider = smsConfig.provider || 'msg91';

      console.log(`📱 Sending test OTP via ${provider} to ${phoneNumber}`);

      if (provider === 'msg91') {
        // Validate MSG91 configuration
        if (!smsConfig.msg91ApiKey) {
          throw new Error('MSG91 API Key is not configured');
        }
        if (!smsConfig.msg91SenderId) {
          throw new Error('MSG91 Sender ID is not configured');
        }
        if (!smsConfig.msg91TemplateId) {
          throw new Error('MSG91 Template ID is not configured');
        }

        // MSG91 API endpoint for OTP sending
        // Use the newer v5 API for flow-based templates
        const msg91Url = 'https://control.msg91.com/api/v5/flow/';
        
        // Prepare message content with OTP
        const templateVariable = smsConfig.msg91TemplateVariable || 'OTP';
        const messageData = {
          template_id: smsConfig.msg91TemplateId,
          sender: smsConfig.msg91SenderId,
          short_url: '0', // Disable URL shortening
          mobiles: phoneNumber.replace(/\+/g, ''), // Remove + from phone number for MSG91
          [templateVariable]: otp
        };

        // Send SMS via MSG91
        const response = await axios.post(msg91Url, messageData, {
          headers: {
            'Content-Type': 'application/json',
            'authkey': smsConfig.msg91ApiKey,
            'Accept': 'application/json'
          },
          timeout: 15000 // 15 second timeout
        });

        // Check response - MSG91 v5 API returns type: "success" or error message
        if (response.data && (response.data.type === 'success' || response.data.request_id)) {
          console.log('✅ Test OTP sent successfully via MSG91');
          return {
            success: true,
            message: 'Test OTP sent successfully via MSG91',
            details: {
              provider: 'msg91',
              phoneNumber: phoneNumber,
              messageId: response.data.request_id || response.data.messageId || null
            }
          };
        } else {
          // MSG91 error response format
          const errorMsg = response.data?.message || response.data?.error || 'Failed to send SMS via MSG91';
          throw new Error(errorMsg);
        }
      } else if (provider === 'twilio') {
        // Twilio implementation
        if (!smsConfig.twilioAccountSid || !smsConfig.twilioAuthToken || !smsConfig.twilioPhoneNumber) {
          throw new Error('Twilio configuration is incomplete');
        }

        const twilio = require('twilio');
        const client = twilio(smsConfig.twilioAccountSid, smsConfig.twilioAuthToken);

        const message = await client.messages.create({
          body: `Your test OTP is: ${otp}`,
          from: smsConfig.twilioPhoneNumber,
          to: phoneNumber
        });

        console.log('✅ Test OTP sent successfully via Twilio');
        return {
          success: true,
          message: 'Test OTP sent successfully via Twilio',
          details: {
            provider: 'twilio',
            phoneNumber: phoneNumber,
            messageId: message.sid
          }
        };
      } else {
        throw new Error(`SMS provider "${provider}" is not yet implemented`);
      }
    } catch (error) {
      console.error('❌ Error sending test OTP:', error.message);
      return {
        success: false,
        message: error.message || 'Failed to send test OTP',
        details: {
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }
}

module.exports = new SettingsService();
