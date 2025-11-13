/**
 * Test script to verify /api/theaters endpoint
 * Run with: node backend/test-theaters-api.js
 */

const http = require('http');

const testUrl = 'http://localhost:8080/api/theaters?page=1&limit=10';

console.log('🧪 Testing theaters API endpoint...');
console.log('📡 URL:', testUrl);

const startTime = Date.now();

const req = http.get(testUrl, (res) => {
  console.log(`📥 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const duration = Date.now() - startTime;
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📦 Response length: ${data.length} bytes`);
    
    try {
      const json = JSON.parse(data);
      console.log('✅ Response is valid JSON');
      console.log('📊 Response structure:', {
        hasSuccess: 'success' in json,
        hasData: 'data' in json,
        hasPagination: 'pagination' in json,
        dataIsArray: Array.isArray(json.data),
        dataLength: json.data?.length || 0
      });
      console.log('📄 Response data:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.error('❌ Response is not valid JSON:', e.message);
      console.log('📄 Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.error('❌ Error code:', error.code);
  console.error('❌ Full error:', error);
  
  if (error.code === 'ECONNREFUSED') {
    console.error('\n💡 TIP: Backend server is not running!');
    console.error('   Please start the server with: npm start (or node server.js)');
  }
});

req.setTimeout(30000, () => {
  console.error('⏱️  Request timeout after 30 seconds');
  req.destroy();
});

req.end();

