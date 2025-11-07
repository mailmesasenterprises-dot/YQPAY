const mongoose = require('mongoose');

// Test what's in the settings collection
async function checkSettingsCollection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Get all settings documents
    const allSettings = await db.collection('settings').find({}).toArray();
    console.log('📄 All settings documents:', JSON.stringify(allSettings, null, 2));

    // Check specifically for general settings
    const generalSettings = await db.collection('settings').findOne({ type: 'general' });
    console.log('🔍 General settings document:');
    console.log(JSON.stringify(generalSettings, null, 2));

    if (generalSettings && generalSettings.generalConfig) {
      console.log('📋 General config fields:');
      Object.keys(generalSettings.generalConfig).forEach(key => {
        console.log(`  ${key}:`, generalSettings.generalConfig[key]);
      });
      
      console.log('🎨 qrCodeUrl specifically:', generalSettings.generalConfig.qrCodeUrl);
    } else {
      console.log('⚠️ No generalConfig found in general settings');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkSettingsCollection();