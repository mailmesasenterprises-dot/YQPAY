/**
 * Check if the running server has MongoDB connected
 * This will make an actual API call to test database connectivity
 */

const http = require('http');

console.log('🔍 Checking Running Server MongoDB Connection\n');
console.log('='.repeat(70));

// First, get a token by logging in (or use existing token)
// For now, let's just check if we can reach the server and see error messages

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/health',
  method: 'GET',
};

console.log('📡 Testing server health endpoint...\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      console.log('✅ Server Health Status:');
      console.log('   Status:', health.status);
      console.log('   Database Pooling:', health.optimizations?.databasePooling ? '✅ Enabled' : '❌ Disabled');
      console.log('');
      
      console.log('📝 Next Steps:');
      console.log('   1. Check server console logs for MongoDB connection status');
      console.log('   2. Look for one of these messages:');
      console.log('      ✅ "MongoDB connected with optimized connection pooling"');
      console.log('      ✅ "Connected to MongoDB (basic mode)"');
      console.log('      ❌ "MongoDB connection error"');
      console.log('   3. Check connection status when server started:');
      console.log('      📡 "MongoDB Connection Status: ✅ Connected (State: 1)"');
      console.log('      OR');
      console.log('      📡 "MongoDB Connection Status: ❌ Disconnected (State: 0)"');
      console.log('');
      console.log('💡 If MongoDB is not connected:');
      console.log('   1. Stop the server (Ctrl+C)');
      console.log('   2. Check backend/.env file has MONGODB_URI set');
      console.log('   3. Restart server: node server.js');
      console.log('   4. Watch for connection messages');
      
    } catch (e) {
      console.log('⚠️  Could not parse response');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Cannot connect to server!');
  console.error('   Error:', error.message);
  console.error('\n💡 Solution:');
  console.error('   1. Start the server: cd backend && node server.js');
  console.error('   2. Wait for startup messages');
  console.error('   3. Then run this test again');
});

req.setTimeout(5000, () => {
  console.error('❌ Request timeout - server might not be responding');
  req.destroy();
});

req.end();

