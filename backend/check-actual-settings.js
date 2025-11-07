const mongoose = require('mongoose');

// Clean up test data and check what's actually in the settings
async function checkActualSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Check what's actually in the settings
    const settings = await db.collection('settings').findOne({ type: 'general' });
    
    console.log('🔍 Current settings in database:');
    if (settings) {
      console.log('📋 Settings document found:');
      console.log('  Type:', settings.type);
      console.log('  Last Updated:', settings.lastUpdated);
      
      if (settings.generalConfig) {
        console.log('📊 General Config:');
        Object.keys(settings.generalConfig).forEach(key => {
          console.log(`  ${key}:`, settings.generalConfig[key]);
        });
        
        console.log('\n🎨 QR Code URL specifically:', settings.generalConfig.qrCodeUrl);
        
        if (settings.generalConfig.qrCodeUrl) {
          // Test if the URL is accessible
          console.log('\n🌐 Testing QR Code URL accessibility...');
          const axios = require('axios');
          try {
            const response = await axios.head(settings.generalConfig.qrCodeUrl, { 
              timeout: 10000,
              headers: {
                'User-Agent': 'YQPayNow-QR-Generator/1.0'
              }
            });
            console.log('✅ QR Code URL is accessible! Status:', response.status);
            console.log('📄 Content-Type:', response.headers['content-type']);
          } catch (error) {
            console.log('❌ QR Code URL not accessible:', error.message);
          }
        } else {
          console.log('⚠️ No qrCodeUrl found in settings');
        }
      } else {
        console.log('⚠️ No generalConfig found in settings');
      }
    } else {
      console.log('❌ No settings document found');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

checkActualSettings();