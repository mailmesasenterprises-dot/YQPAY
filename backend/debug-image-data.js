const mongoose = require('mongoose');
const Settings = require('./models/Settings');

async function debugImageData() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/cinema-app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Get the settings
    const settings = await Settings.findOne({});
    
    if (!settings || !settings.generalConfig || !settings.generalConfig.qrCodeUrl) {
      console.log('❌ No QR Code URL found in settings');
      return;
    }

    const dataUrl = settings.generalConfig.qrCodeUrl;
    console.log(`🖼️  Data URL length: ${dataUrl.length}`);
    console.log(`🖼️  Data URL header: ${dataUrl.substring(0, 50)}...`);
    
    // Check if it's a valid data URL format
    if (!dataUrl.startsWith('data:image/')) {
      console.log('❌ Not a valid data URL format');
      return;
    }

    // Extract the base64 part
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      console.log('❌ Invalid data URL structure');
      return;
    }

    const header = parts[0];
    const base64Data = parts[1];
    
    console.log(`📋 Header: ${header}`);
    console.log(`📋 Base64 data length: ${base64Data.length}`);
    console.log(`📋 Base64 first 50 chars: ${base64Data.substring(0, 50)}...`);
    console.log(`📋 Base64 last 50 chars: ...${base64Data.substring(base64Data.length - 50)}`);

    // Try to decode and validate
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      console.log(`✅ Successfully created buffer, size: ${buffer.length} bytes`);
      
      // Check if it looks like a valid JPEG (starts with FF D8)
      if (buffer.length > 2) {
        const firstBytes = buffer.subarray(0, 2);
        console.log(`🔍 First 2 bytes: ${firstBytes.toString('hex')} (should be FFD8 for JPEG)`);
        
        if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) {
          console.log('✅ Valid JPEG header detected');
        } else {
          console.log('❌ Invalid JPEG header');
        }
      }
      
    } catch (error) {
      console.error(`❌ Buffer creation failed: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📋 Disconnected from MongoDB');
  }
}

debugImageData();