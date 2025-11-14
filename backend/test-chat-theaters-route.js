/**
 * Test /api/chat/theaters endpoint
 * This will help verify the route works with authentication
 */

const http = require('http');

console.log('🔍 Testing /api/chat/theaters endpoint\n');
console.log('='.repeat(70));

// Get token from command line argument or use test
const token = process.argv[2];

if (!token) {
  console.log('⚠️  No authentication token provided');
  console.log('\n📝 Usage:');
  console.log('   node test-chat-theaters-route.js YOUR_JWT_TOKEN');
  console.log('\n💡 To get a token:');
  console.log('   1. Login via frontend or API: POST /api/auth/login');
  console.log('   2. Copy token from browser localStorage (authToken)');
  console.log('   3. Run: node test-chat-theaters-route.js YOUR_TOKEN');
  console.log('\n🔍 Testing without token (will show 401 if route exists)...\n');
}

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/chat/theaters',
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
        console.log('   This confirms the server and routes are working correctly');
        console.log('\n💡 To test with authentication:');
        console.log('   1. Login first: POST /api/auth/login');
        console.log('   2. Use the returned token in Authorization header');
        console.log('   3. Format: Authorization: Bearer <token>');
      } else if (res.statusCode === 200) {
        console.log('✅ Success! Chat theaters data retrieved');
        if (Array.isArray(json)) {
          console.log(`\n📊 Found ${json.length} theaters:`);
          json.slice(0, 5).forEach((theater, i) => {
            console.log(`   ${i + 1}. ${theater.name || theater.theaterName} (ID: ${theater._id})`);
            console.log(`      Unread messages: ${theater.unreadCount || 0}`);
          });
          if (json.length > 5) {
            console.log(`   ... and ${json.length - 5} more`);
          }
          console.log('\n✅ Route is working correctly with authentication!');
        } else if (json.success !== undefined) {
          console.log('   Response format:', json.success ? 'Success' : 'Error');
          if (json.data) {
            console.log('   Data:', JSON.stringify(json.data, null, 2));
          }
        }
      } else if (res.statusCode === 503) {
        console.log('⚠️  Service Unavailable (503)');
        if (json.message) {
          console.log('   Message:', json.message);
        }
        if (json.error && json.error.includes('Database')) {
          console.log('\n🔍 ISSUE: MongoDB connection problem');
          console.log('   The route is working, but database is not connected');
          console.log('   Check server logs for MongoDB connection status');
        }
      } else if (res.statusCode === 500) {
        console.log('❌ Server Error (500)');
        if (json.error) {
          console.log('   Error:', json.error);
        }
        console.log('\n💡 Check server console logs for detailed error information');
      } else {
        console.log(`⚠️  Unexpected status: ${res.statusCode}`);
      }
    } catch (e) {
      console.log('Raw response:', data);
      console.log('Parse error:', e.message);
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

