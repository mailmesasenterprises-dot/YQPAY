const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * Test script to verify logo fetching functionality
 */
async function testLogoFetch(logoUrl) {
  try {
    console.log(`🔍 Testing logo fetch for: ${logoUrl}`);
    console.log(`🔍 Logo URL type: ${typeof logoUrl}, starts with http: ${logoUrl.startsWith('http')}`);

    // Handle URL (http/https)
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      console.log(`🌐 Fetching logo from HTTP URL: ${logoUrl}`);
      const response = await axios.get(logoUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log(`✅ HTTP fetch successful, response size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    }

    // Handle relative paths (e.g., /images/logo.jpg)
    if (logoUrl.startsWith('/')) {
      console.log(`🔗 Relative URL detected: ${logoUrl}`);
      
      // Convert relative path to full URL using frontend base URL
      const baseUrl = 'http://localhost:3000'; // Development URL
      const fullUrl = `${baseUrl}${logoUrl}`;
      console.log(`🔄 Converted relative path to full URL: ${fullUrl}`);
      
      const response = await axios.get(fullUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'YQPayNow-QR-Generator/1.0'
        }
      });
      console.log(`✅ Relative URL fetch successful, response size: ${response.data.byteLength} bytes`);
      return Buffer.from(response.data);
    }

    console.log(`❌ Unsupported URL format: ${logoUrl}`);
    return null;

  } catch (error) {
    console.error('❌ Failed to fetch logo:', {
      logoUrl,
      errorMessage: error.message,
      errorCode: error.code,
      errorStatus: error.response?.status,
      errorStatusText: error.response?.statusText
    });
    return null;
  }
}

// Test common logo URLs
async function runTests() {
  console.log('🧪 Starting logo fetch tests...\n');

  const testUrls = [
    '/images/logo.jpg',
    'http://localhost:3000/images/logo.jpg',
    'https://example.com/logo.png',
    '/logo192.png',
    'http://localhost:3000/logo192.png'
  ];

  for (const url of testUrls) {
    console.log(`\n=== Testing: ${url} ===`);
    const result = await testLogoFetch(url);
    if (result) {
      console.log(`✅ Success: Fetched ${result.length} bytes`);
    } else {
      console.log(`❌ Failed to fetch logo`);
    }
    console.log('---');
  }
}

// Run the tests
runTests().catch(console.error);