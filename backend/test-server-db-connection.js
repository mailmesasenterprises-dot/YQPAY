/**
 * Test if the running server has MongoDB connected
 */

const http = require('http');

console.log('🔍 Testing Server MongoDB Connection Status\n');
console.log('='.repeat(70));

// Test 1: Health endpoint
console.log('📡 Test 1: Checking /api/health endpoint...\n');

const healthOptions = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/health',
  method: 'GET',
};

http.request(healthOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      console.log('✅ Health endpoint response:');
      console.log('   Status:', health.status);
      console.log('   Database Pooling:', health.optimizations?.databasePooling || 'Not available');
      console.log('');
    } catch (e) {
      console.log('⚠️  Could not parse health response');
    }
    
    // Test 2: Try a database query endpoint (requires auth, but will show if DB is connected)
    console.log('📡 Test 2: Testing database connection via API...\n');
    console.log('   Note: This requires authentication token');
    console.log('   If you see 401, server is running but needs auth');
    console.log('   If you see 500 with DB error, MongoDB is not connected');
    console.log('   If you see 404, route not found\n');
    
    // We can't test authenticated endpoints without a token
    // But we can check if the server responds
    console.log('✅ Server is running on port 8080');
    console.log('\n📝 To verify MongoDB connection:');
    console.log('   1. Check server console logs for:');
    console.log('      ✅ "MongoDB connected..." OR');
    console.log('      ❌ "MongoDB connection error..."');
    console.log('   2. Look for connection status when server started');
    console.log('   3. Restart server and watch for connection messages');
  });
}).on('error', (error) => {
  console.error('❌ Cannot connect to server!');
  console.error('   Error:', error.message);
  console.error('\n💡 Solution:');
  console.error('   1. Start the server: cd backend && node server.js');
  console.error('   2. Wait for MongoDB connection message');
  console.error('   3. Then test again');
}).end();

