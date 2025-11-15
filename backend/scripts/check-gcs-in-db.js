/**
 * Check GCS Configuration in Database
 * Directly inspects what's saved in the database
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/test';

async function checkGCSConfig() {
  try {
    console.log('🔍 Checking GCS Configuration in Database...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Find system settings document
    const settingsDoc = await db.collection('settings').findOne({ _systemSettings: true });
    
    if (!settingsDoc) {
      console.log('❌ System settings document not found');
      console.log('   Creating one will be attempted on next save');
      
      // Check for any settings documents
      const allSettings = await db.collection('settings').find({}).toArray();
      console.log(`\n📋 Found ${allSettings.length} setting document(s) in collection`);
      allSettings.forEach((doc, index) => {
        console.log(`   ${index + 1}. ID: ${doc._id}`);
        console.log(`      _systemSettings: ${doc._systemSettings || false}`);
        console.log(`      Has gcsConfig: ${!!doc.gcsConfig}`);
        if (doc.gcsConfig) {
          console.log(`         Project ID: ${doc.gcsConfig.projectId || 'N/A'}`);
          console.log(`         Bucket: ${doc.gcsConfig.bucketName || 'N/A'}`);
          console.log(`         Has Credentials: ${!!doc.gcsConfig.credentials}`);
        }
      });
      
      await mongoose.disconnect();
      return;
    }
    
    console.log('✅ Found system settings document');
    console.log(`   ID: ${settingsDoc._id}\n`);
    
    const gcsConfig = settingsDoc.gcsConfig || {};
    
    console.log('📋 GCS Configuration:');
    console.log('   Project ID:', gcsConfig.projectId || '❌ Not set');
    console.log('   Bucket Name:', gcsConfig.bucketName || '❌ Not set');
    console.log('   Region:', gcsConfig.region || 'N/A');
    console.log('   Key Filename:', gcsConfig.keyFilename || 'N/A');
    console.log('   Has Credentials Object:', !!gcsConfig.credentials);
    
    if (gcsConfig.credentials) {
      const creds = gcsConfig.credentials;
      console.log('\n   Credentials:');
      console.log('      Type:', typeof creds);
      console.log('      Keys:', Object.keys(creds).join(', '));
      console.log('      Client Email:', creds.clientEmail || creds.client_email || '❌ Not set');
      console.log('      Client Email (type):', typeof (creds.clientEmail || creds.client_email));
      console.log('      Private Key:', creds.privateKey || creds.private_key ? '✅ Set (' + (creds.privateKey || creds.private_key).substring(0, 30) + '...)' : '❌ Not set');
      console.log('      Private Key (type):', typeof (creds.privateKey || creds.private_key));
    } else {
      console.log('\n   ❌ No credentials object found');
    }
    
    // Check last updated
    if (settingsDoc.lastUpdated) {
      console.log(`\n   Last Updated: ${new Date(settingsDoc.lastUpdated).toISOString()}`);
    }
    
    console.log('\n' + '='.repeat(60));
    if (gcsConfig.projectId && gcsConfig.bucketName && gcsConfig.credentials && 
        (gcsConfig.credentials.clientEmail || gcsConfig.credentials.client_email) &&
        (gcsConfig.credentials.privateKey || gcsConfig.credentials.private_key)) {
      console.log('✅ GCS Configuration is COMPLETE');
      console.log('   All required fields are present');
    } else {
      console.log('⚠️  GCS Configuration is INCOMPLETE');
      console.log('   Missing fields:');
      if (!gcsConfig.projectId) console.log('      - Project ID');
      if (!gcsConfig.bucketName) console.log('      - Bucket Name');
      if (!gcsConfig.credentials) console.log('      - Credentials object');
      else {
        if (!gcsConfig.credentials.clientEmail && !gcsConfig.credentials.client_email) console.log('      - Client Email');
        if (!gcsConfig.credentials.privateKey && !gcsConfig.credentials.private_key) console.log('      - Private Key');
      }
    }
    console.log('='.repeat(60));
    
    await mongoose.disconnect();
    
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
  }
}

if (require.main === module) {
  checkGCSConfig().then(() => {
    process.exit(0);
  });
}

module.exports = { checkGCSConfig };

