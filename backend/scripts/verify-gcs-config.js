/**
 * Verify GCS Configuration
 * Checks if GCS is properly configured in the database
 */

const mongoose = require('mongoose');
const { initializeGCS, isGCSReady } = require('../utils/gcsUploadUtil');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';

async function verifyGCS() {
  try {
    console.log('🔍 Verifying GCS Configuration...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Check GCS configuration in database
    const db = mongoose.connection.db;
    const settingsDoc = await db.collection('settings').findOne({ _systemSettings: true });
    
    if (!settingsDoc) {
      console.log('❌ System settings document not found');
      await mongoose.disconnect();
      return false;
    }
    
    const gcsConfig = settingsDoc.gcsConfig || {};
    
    console.log('📋 GCS Configuration in Database:');
    console.log('   Project ID:', gcsConfig.projectId || '❌ Not set');
    console.log('   Bucket Name:', gcsConfig.bucketName || '❌ Not set');
    console.log('   Has Credentials:', !!gcsConfig.credentials);
    
    if (gcsConfig.credentials) {
      const creds = gcsConfig.credentials;
      console.log('   Client Email:', creds.clientEmail || creds.client_email || '❌ Not set');
      console.log('   Private Key:', creds.privateKey || creds.private_key ? '✅ Set' : '❌ Not set');
    } else {
      console.log('   ❌ No credentials found');
    }
    
    console.log('\n🔄 Attempting to initialize GCS...');
    const client = await initializeGCS();
    
    if (client) {
      console.log('✅ GCS client initialized successfully!');
      console.log('   GCS is ready to use\n');
      
      const ready = await isGCSReady();
      console.log('   isGCSReady():', ready ? '✅ true' : '❌ false');
      
      await mongoose.disconnect();
      return true;
    } else {
      console.log('❌ GCS client initialization failed');
      console.log('   Please check your GCS configuration in Settings\n');
      
      await mongoose.disconnect();
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    try {
      await mongoose.disconnect();
    } catch (e) {
      // Ignore
    }
    return false;
  }
}

if (require.main === module) {
  verifyGCS().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { verifyGCS };

