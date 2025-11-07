const axios = require('axios');

async function testSettingsAPI() {
  try {
    console.log('🔍 Testing settings API...');
    
    // Test the general settings endpoint
    const response = await axios.get('http://localhost:8080/api/settings/general');
    
    console.log(`✅ API Response Status: ${response.status}`);
    console.log('📋 API Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.qrCodeUrl) {
      const dataUrl = response.data.qrCodeUrl;
      console.log(`\n🖼️  Found QR Code URL! Length: ${dataUrl.length}`);
      console.log(`🖼️  First 100 chars: ${dataUrl.substring(0, 100)}...`);
      
      // Test the data URL
      if (dataUrl.startsWith('data:image/')) {
        const parts = dataUrl.split(',');
        if (parts.length === 2) {
          const base64Data = parts[1];
          console.log(`📋 Base64 data length: ${base64Data.length}`);
          
          try {
            const buffer = Buffer.from(base64Data, 'base64');
            console.log(`✅ Buffer created successfully, size: ${buffer.length} bytes`);
          } catch (error) {
            console.error(`❌ Buffer creation failed: ${error.message}`);
          }
        }
      }
    } else {
      console.log('❌ No qrCodeUrl found in response');
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
    if (error.response) {
      console.error('❌ Response Status:', error.response.status);
      console.error('❌ Response Data:', error.response.data);
    }
  }
}

testSettingsAPI();