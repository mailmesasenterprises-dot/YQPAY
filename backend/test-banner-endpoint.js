const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:8080';
const THEATER_ID = '68ff8837a541316c6ad54b79f';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with actual token

async function testBannerEndpoints() {
  console.log('🧪 Testing Banner Endpoints\n');
  console.log('=' .repeat(60));

  // Test 1: Check if route is registered
  console.log('\n📋 Test 1: GET /api/theater-banners/:theaterId');
  try {
    const response = await axios.get(`${BASE_URL}/api/theater-banners/${THEATER_ID}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    console.log('✅ GET Success:', response.status);
    console.log('📊 Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ GET Failed:', error.response?.status, error.response?.data || error.message);
  }

  // Test 2: Test POST with mock image
  console.log('\n\n➕ Test 2: POST /api/theater-banners/:theaterId');
  try {
    // Create a simple test image buffer (1x1 PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    const formData = new FormData();
    formData.append('image', testImageBuffer, {
      filename: 'test-banner.png',
      contentType: 'image/png'
    });
    formData.append('isActive', 'true');
    formData.append('sortOrder', '0');

    const response = await axios.post(`${BASE_URL}/api/theater-banners/${THEATER_ID}`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    console.log('✅ POST Success:', response.status);
    console.log('📊 Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ POST Failed:', error.response?.status);
    console.log('Error Details:', JSON.stringify(error.response?.data, null, 2) || error.message);
    
    if (error.response?.status === 500) {
      console.log('\n🔍 Server Error Details:');
      console.log('- Check backend console for stack trace');
      console.log('- Verify GCS configuration');
      console.log('- Check if Theater model exists');
      console.log('- Verify database connection');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing Complete');
}

// Run tests
testBannerEndpoints().catch(console.error);
