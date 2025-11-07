// Quick CRUD test without authentication
const axios = require('axios');

async function quickTest() {
  try {
    console.log('🧪 Quick API Test');
    
    // Test if theater users array endpoint exists
    console.log('\n1. Testing theater users array endpoint...');
    const response = await axios.get('http://localhost:5000/api/theater-users-array?theaterId=68ed25e6962cb3e997acc163', {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📊 Users: ${response.data.data?.users?.length || 0}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    
    // If 401, it means the route exists but needs auth
    if (error.response?.status === 401) {
      console.log('✅ Route exists! Issue is authentication.');
    } else if (error.response?.status === 404) {
      console.log('❌ Route not found. Checking app.js routing...');
    }
  }
}

quickTest();