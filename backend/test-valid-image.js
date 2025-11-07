const mongoose = require('mongoose');
const { generateSingleQRCode } = require('./utils/singleQRGenerator');

async function testWithValidImage() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/cinema-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Use the minimal valid JPEG data URL
    const validDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H/2Q==';

    console.log('🎨 Testing QR generation with valid minimal JPEG...');
    console.log(`🖼️  Using data URL length: ${validDataUrl.length}`);

    const qrData = {
      theaterId: '68f8837a541316c6ad54b79f',
      qrName: 'Test QR With Valid Logo',
      seatClass: 'A',
      seat: null,
      logoUrl: validDataUrl,
      finalLogoUrl: validDataUrl,
      logoType: 'default'
    };

    const result = await generateSingleQRCode(qrData);
    
    console.log('📊 QR Generation Results:');
    console.log(`  QR Code URL: ${result.gcsPath}`);
    console.log(`  QR Code Data (first 100 chars): ${result.qrCodeData.substring(0, 100)}...`);
    console.log(`  Logo URL Used: ${validDataUrl.substring(0, 50)}...`);
    console.log(`  Logo Type: ${qrData.logoType}`);
    
    if (result.gcsPath) {
      console.log('✅ SUCCESS: QR code generated with default logo!');
    } else {
      console.log('❌ FAILED: QR code generation failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
  }
}

testWithValidImage();