/**
 * Test Dashboard API to check if MongoDB is actually connected
 * This will make a real API call that requires database access
 */

const http = require('http');

console.log('🔍 Testing Dashboard API (Requires MongoDB Connection)\n');
console.log('='.repeat(70));

// You need to provide a valid JWT token
// Get it from browser localStorage or login first
const token = process.argv[2];

if (!token) {
  console.log('⚠️  No token provided');
  console.log('\n📝 Usage:');
  console.log('   node test-dashboard-api.js YOUR_JWT_TOKEN');
  console.log('\n💡 To get a token:');
  console.log('   1. Login via frontend or API');
  console.log('   2. Copy token from browser localStorage (authToken)');
  console.log('   3. Run: node test-dashboard-api.js YOUR_TOKEN');
  console.log('\n🔍 Testing without token (will show 401 if route exists)...\n');
}

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/dashboard/super-admin-stats',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
};

console.log(`📡 Request: ${options.method} http://${options.hostname}:${options.port}${options.path}`);
if (token) {
  console.log('   Authorization: Bearer [token provided]');
} else {
  console.log('   Authorization: [none - will get 401]');
}
console.log('');

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Status Message: ${res.statusMessage}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📥 Response:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      
      console.log('\n' + '='.repeat(70));
      
      if (res.statusCode === 401) {
        console.log('✅ Route exists! (401 = Authentication required)');
        console.log('   The route is working, but you need a valid token');
        console.log('   This confirms the server and routes are working');
      } else if (res.statusCode === 200) {
        console.log('✅ Success! Dashboard data retrieved');
        if (json.data) {
          console.log('\n📊 Dashboard Stats:');
          console.log('   Total Theaters:', json.data.theaters?.total || 0);
          console.log('   Total Orders:', json.data.orders?.total || 0);
          console.log('   Monthly Revenue:', json.data.revenue?.monthly || '₹0.00');
          console.log('\n✅ MongoDB is connected and working!');
        }
      } else if (res.statusCode === 500) {
        console.log('❌ Server Error (500)');
        if (json.error) {
          console.log('   Error:', json.error);
          if (json.error.includes('Database not connected') || json.error.includes('not connected')) {
            console.log('\n🔍 ISSUE FOUND: MongoDB is not connected!');
            console.log('   The server is running but MongoDB connection failed');
            console.log('\n💡 Solution:');
            console.log('   1. Stop the server (Ctrl+C)');
            console.log('   2. Check backend/.env file has correct MONGODB_URI');
            console.log('   3. Restart server: node server.js');
            console.log('   4. Watch for connection success message');
          }
        }
      } else {
        console.log(`⚠️  Unexpected status: ${res.statusCode}`);
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request Error:', error.message);
  console.error('\n💡 Server might not be running');
  console.error('   Start server: cd backend && node server.js');
});

req.setTimeout(10000, () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.end();

