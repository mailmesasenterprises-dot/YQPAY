const mongoose = require('mongoose');

// Clean up all test data and reset to clean state
async function resetToCleanState() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    console.log('🧹 Cleaning up all test data...');
    
    // Remove any settings we created during testing
    await db.collection('settings').deleteOne({ type: 'general' });
    console.log('✅ Removed test settings');
    
    // Check if there are any other settings documents
    const allSettings = await db.collection('settings').find({}).toArray();
    console.log('📄 Remaining settings documents:', allSettings.length);
    
    if (allSettings.length > 0) {
      console.log('📋 Remaining settings:');
      allSettings.forEach((setting, index) => {
        console.log(`  ${index + 1}. Type: ${setting.type}, ID: ${setting._id}`);
        if (setting.generalConfig && setting.generalConfig.qrCodeUrl) {
          console.log(`     QR Code URL: ${setting.generalConfig.qrCodeUrl}`);
        }
      });
    }
    
    console.log('\n🔍 Now testing the frontend settings API...');
    
    // Test the frontend settings API to see what it returns
    const axios = require('axios');
    try {
      const response = await axios.get('http://localhost:8080/api/settings/general', {
        timeout: 10000,
        headers: {
          'User-Agent': 'YQPayNow-Test/1.0'
        }
      });
      
      console.log('✅ Frontend settings API response:');
      console.log('  Success:', response.data.success);
      if (response.data.data) {
        console.log('  QR Code URL:', response.data.data.qrCodeUrl);
        console.log('  Application Name:', response.data.data.applicationName);
        console.log('  Logo URL:', response.data.data.logoUrl);
      }
    } catch (error) {
      console.log('❌ Could not fetch from frontend API:', error.message);
    }

  } catch (error) {
    console.error('❌ Reset failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

resetToCleanState();