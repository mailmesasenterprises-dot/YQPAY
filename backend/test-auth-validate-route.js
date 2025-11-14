/**
 * Test script to verify /api/auth/validate route is accessible
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/auth/validate',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Test without token first to see what error we get
  }
};

console.log('🧪 Testing /api/auth/validate endpoint...\n');
console.log(`Request: ${options.method} http://${options.hostname}:${options.port}${options.path}\n`);

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Status Message: ${res.statusMessage}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📥 Response Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    console.log('\n' + '='.repeat(70));
    
    if (res.statusCode === 404) {
      console.log('❌ Route not found (404)');
      console.log('\n🔍 Possible causes:');
      console.log('   1. Server is not running');
      console.log('   2. Route is not registered');
      console.log('   3. Route path is incorrect');
      console.log('\n💡 Solution:');
      console.log('   1. Start the server: node server.js');
      console.log('   2. Check server logs for route registration');
      console.log('   3. Verify route is mounted at /api/auth');
    } else if (res.statusCode === 401) {
      console.log('✅ Route found! (401 = Authentication required - this is expected)');
      console.log('   The route exists, but requires a valid JWT token');
      console.log('\n💡 To test with token:');
      console.log('   1. Login first: POST /api/auth/login');
      console.log('   2. Use the returned token in Authorization header');
      console.log('   3. Format: Authorization: Bearer <token>');
    } else if (res.statusCode === 403) {
      console.log('✅ Route found! (403 = Invalid token)');
      console.log('   The route exists, but token is invalid/expired');
    } else if (res.statusCode === 200) {
      console.log('✅ Route found and working! (200 = Success)');
    } else {
      console.log(`⚠️  Unexpected status code: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request Error:');
  console.error('   Error:', error.message);
  console.error('\n🔍 Possible causes:');
  console.error('   1. Server is not running on port 8080');
  console.error('   2. Server is running on a different port');
  console.error('   3. Network connectivity issue');
  console.error('\n💡 Solution:');
  console.error('   1. Start the server: cd backend && node server.js');
  console.error('   2. Check if server is running: netstat -ano | findstr :8080');
  console.error('   3. Verify PORT in .env file matches (default: 8080)');
});

req.setTimeout(5000, () => {
  console.error('\n❌ Request Timeout');
  console.error('   Server did not respond within 5 seconds');
  console.error('   Server might not be running');
  req.destroy();
});

req.end();

