/**
 * Check health endpoint for MongoDB connection status
 */

const http = require('http');

console.log('🔍 Checking Server Health & MongoDB Connection Status\n');
console.log('='.repeat(70));

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/health',
  method: 'GET',
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const health = JSON.parse(data);
      
      console.log('📊 Server Health Status:');
      console.log('   Status:', health.status);
      console.log('   Uptime:', Math.floor(health.uptime), 'seconds');
      console.log('   Environment:', health.environment);
      console.log('');
      
      console.log('🗄️  MongoDB Connection Status:');
      if (health.database) {
        console.log('   Connected:', health.database.connected ? '✅ YES' : '❌ NO');
        console.log('   State:', health.database.state);
        console.log('   Ready State:', health.database.readyState, '(1=connected, 0=disconnected)');
        if (health.database.name) {
          console.log('   Database:', health.database.name);
        }
        if (health.database.host) {
          console.log('   Host:', health.database.host);
        }
      } else {
        console.log('   ⚠️  Database status not available in health endpoint');
      }
      console.log('');
      
      console.log('⚙️  Optimizations:');
      console.log('   Database Pooling:', health.optimizations?.databasePooling ? '✅ Enabled' : '❌ Disabled');
      console.log('   Advanced Rate Limit:', health.optimizations?.advancedRateLimit ? '✅ Enabled' : '❌ Disabled');
      console.log('');
      
      console.log('='.repeat(70));
      
      if (health.database && !health.database.connected) {
        console.log('\n❌ MONGODB IS NOT CONNECTED!');
        console.log('\n🔍 Current State:', health.database.state);
        console.log('\n💡 Solution:');
        console.log('   1. Stop the server (Ctrl+C in server terminal)');
        console.log('   2. Check backend/.env file:');
        console.log('      - Ensure MONGODB_URI is set');
        console.log('      - Format: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name');
        console.log('   3. Verify MongoDB Atlas:');
        console.log('      - IP is whitelisted in Network Access');
        console.log('      - Cluster is running (not paused)');
        console.log('   4. Restart server: node server.js');
        console.log('   5. Watch for connection messages:');
        console.log('      ✅ "MongoDB connected..." = Success');
        console.log('      ❌ "MongoDB connection error..." = Check error message');
      } else if (health.database && health.database.connected) {
        console.log('\n✅ MONGODB IS CONNECTED!');
        console.log('   Database:', health.database.name);
        console.log('   Host:', health.database.host);
        console.log('\n💡 If dashboard still shows zeros:');
        console.log('   1. Database is connected, but might be empty');
        console.log('   2. Check if you have data in MongoDB Atlas');
        console.log('   3. Verify you\'re looking at the correct database');
        console.log('   4. Check browser console for API errors');
      } else {
        console.log('\n⚠️  Could not determine connection status');
        console.log('   Check server console logs for MongoDB connection messages');
      }
      
    } catch (e) {
      console.error('❌ Error parsing response:', e.message);
      console.log('Raw response:', data);
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
  console.error('❌ Request timeout');
  req.destroy();
});

req.end();

