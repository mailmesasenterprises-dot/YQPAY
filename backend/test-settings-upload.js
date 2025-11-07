const mongoose = require('mongoose');

// Simulate uploading a default logo URL to test our implementation
async function testSettingsUpload() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Simulate saving a default logo URL (like what the frontend would do)
    const testLogoUrl = 'https://storage.googleapis.com/yqpaynow-theater-qr-codes/default-logo.png';
    
    console.log('📤 Simulating saving default logo URL to settings...');
    const result = await db.collection('settings').findOneAndUpdate(
      { type: 'general' },
      {
        $set: {
          'generalConfig.qrCodeUrl': testLogoUrl,
          lastUpdated: new Date()
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    console.log('✅ Settings updated successfully');
    console.log('📋 Result:', result);

    // Now test fetching it back
    const { getDefaultLogoUrl } = require('./utils/singleQRGenerator');
    const fetchedUrl = await getDefaultLogoUrl();
    
    console.log('🔍 Testing fetch after update:');
    console.log('  Fetched URL:', fetchedUrl);
    console.log('  Expected URL:', testLogoUrl);
    console.log('  Match:', fetchedUrl === testLogoUrl ? '✅ YES' : '❌ NO');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testSettingsUpload();