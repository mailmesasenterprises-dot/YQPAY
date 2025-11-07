// Create a minimal 1x1 pixel JPEG for testing
const fs = require('fs');

// This is a minimal valid JPEG file (1x1 pixel, black)
// Generated using: https://png-pixel.com/ and converted to JPEG
const minimalJpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H/2Q==';

const dataUrl = `data:image/jpeg;base64,${minimalJpegBase64}`;

console.log('🖼️  Created minimal test JPEG data URL');
console.log(`📋 Data URL length: ${dataUrl.length}`);
console.log(`📋 Data URL: ${dataUrl}`);

// Test if it can be converted to buffer
try {
  const buffer = Buffer.from(minimalJpegBase64, 'base64');
  console.log(`✅ Buffer created successfully, size: ${buffer.length} bytes`);
  
  // Check JPEG header
  if (buffer.length > 2) {
    const firstBytes = buffer.subarray(0, 2);
    console.log(`🔍 First 2 bytes: ${firstBytes.toString('hex')} (should be FFD8 for JPEG)`);
    
    if (firstBytes[0] === 0xFF && firstBytes[1] === 0xD8) {
      console.log('✅ Valid JPEG header detected');
    } else {
      console.log('❌ Invalid JPEG header');
    }
  }
  
  // Save the data URL for testing
  fs.writeFileSync('minimal-test-dataurl.txt', dataUrl);
  console.log('✅ Saved minimal test data URL to minimal-test-dataurl.txt');
  
} catch (error) {
  console.error(`❌ Buffer creation failed: ${error.message}`);
}