const mongoose = require('mongoose');
const { generateSingleQRCode } = require('./utils/singleQRGenerator');

// Test QR generation with default logo using the actual frontend data
async function testWithActualData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    // Simulate what happens when frontend sends a request with logoType: 'default'
    // The frontend should send the qrCodeUrl it retrieved from the API
    const actualQrCodeUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4Q1QRXhpZgAASUkqAAgAAAADABIBAwABAAAAAQAAADEBAgAHAAAAMgAAAGmHBAABAAAAOgAAAMgAAABQaWNhc2EAAAYAAJAHAAQAAAAwMjIwAaADAAEAAAABAAAAAqAEAAEAAAAABAAAA6AEAAEAAAAABAAABaAEAAEAAACqAAAAIKQCACEAAACIAAAAAAAAAGRlNTY0MWRlMTBjMjdjNjEwMDAwMDAwMDAwMDAwMDAwAAACAAEAAgAEAAAAUjk4AAIABwAEAAAAMDEwMAAAAAAGAAMBAwABAAAABgAAABoBBQABAAAAFgEAABsBBQABAAAAHgEAACgBAwABAAAAAgAAAAECBAABAAAAJgEAAAICBAABAAAAIgwAAAAAAABIAAAAAQAAAEgAAAABAAAA';
    
    console.log('🎨 Testing QR generation with actual frontend data...');
    console.log('🖼️  Using data URL from frontend (first 100 chars):', actualQrCodeUrl.substring(0, 100) + '...');
    
    // Test generating QR code with the actual data from frontend
    const result = await generateSingleQRCode({
      theaterId: '68f8837a541316c6ad54b79f',
      theaterName: 'Test Theater',
      qrName: 'Test QR',
      seatClass: 'A',
      seat: null,
      logoUrl: actualQrCodeUrl, // Pass the actual data URL from frontend
      logoType: 'default',
      userId: 'test-user'
    });

    console.log('📊 QR Generation Results:');
    console.log('  QR Code URL:', result.qrCodeUrl);
    console.log('  QR Code Data:', result.qrCodeData.substring(0, 100) + '...');
    console.log('  Logo URL Used (first 100 chars):', result.logoUrl.substring(0, 100) + '...');
    console.log('  Logo Type:', result.logoType);

    if (result.logoUrl && result.logoUrl.startsWith('data:image')) {
      console.log('✅ SUCCESS: Data URL logo was used successfully!');
      console.log('🎯 This means the frontend CAN pass data URLs directly to backend');
    } else {
      console.log('❌ Something went wrong with data URL processing');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
    process.exit(0);
  }
}

testWithActualData();