const fetch = require('node-fetch');

async function testPinAPI() {
  try {
    const theaterId = '68f8837a541316c6ad54b79f';
    const url = `http://localhost:5000/api/theater-users?theaterId=${theaterId}&page=1&limit=10&isActive=true`;
    
    console.log('🧪 Testing API endpoint:', url);
    
    // Get auth token from localStorage (you'll need to replace this with actual token)
    const authToken = process.env.AUTH_TOKEN || 'your-auth-token-here';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();
    
    console.log('\n📊 Response Status:', response.status);
    console.log('\n📦 Response Data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.users && data.data.users.length > 0) {
      console.log('\n👤 First User:');
      console.log('  - Username:', data.data.users[0].username);
      console.log('  - PIN:', data.data.users[0].pin || 'NOT FOUND');
      console.log('  - Has PIN property:', 'pin' in data.data.users[0]);
      console.log('\n🔑 All User Properties:', Object.keys(data.data.users[0]));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPinAPI();
