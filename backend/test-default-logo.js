const mongoose = require('mongoose');
const { getDefaultLogoUrl } = require('./utils/singleQRGenerator');

// Test default logo URL fetching
async function testDefaultLogoFetch() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    // Test fetching default logo URL
    console.log('🔍 Testing default logo URL fetch...');
    const defaultLogoUrl = await getDefaultLogoUrl();
    
    console.log('📊 Results:');
    console.log('  Default Logo URL:', defaultLogoUrl);
    console.log('  Type:', typeof defaultLogoUrl);
    console.log('  Length:', defaultLogoUrl.length);
    console.log('  Truthy:', !!defaultLogoUrl);

    if (defaultLogoUrl) {
      console.log('✅ Default logo URL retrieved successfully!');
    } else {
      console.log('⚠️ No default logo URL found in settings');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testDefaultLogoFetch();