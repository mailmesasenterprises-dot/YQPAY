const mongoose = require('mongoose');
const { generateSingleQRCode } = require('./utils/singleQRGenerator');

// Test QR generation with default logo
async function testQRGenerationWithDefaultLogo() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    console.log('🎨 Testing QR generation with default logo...');
    
    // Test generating QR code with logoType 'default' but no logoUrl
    const result = await generateSingleQRCode({
      theaterId: '68f8837a541316c6ad54b79f',
      theaterName: 'Test Theater',
      qrName: 'Test QR',
      seatClass: 'A',
      seat: null,
      logoUrl: '', // Empty - should fetch from settings
      logoType: 'default',
      userId: 'test-user'
    });

    console.log('📊 QR Generation Results:');
    console.log('  QR Code URL:', result.qrCodeUrl);
    console.log('  QR Code Data:', result.qrCodeData.substring(0, 100) + '...');
    console.log('  Logo URL Used:', result.logoUrl);
    console.log('  Logo Type:', result.logoType);
    console.log('  Unique ID:', result.uniqueId);

    if (result.logoUrl && result.logoUrl.includes('default-logo.png')) {
      console.log('✅ SUCCESS: Default logo URL was fetched and used!');
    } else {
      console.log('❌ ISSUE: Default logo URL was not fetched properly');
      console.log('  Expected: URL containing "default-logo.png"');
      console.log('  Actual:', result.logoUrl);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testQRGenerationWithDefaultLogo();