const axios = require('axios');

async function createTestUser() {
  try {
    // Get auth token (you'll need to login first)
    const token = 'YOUR_TOKEN_HERE'; // Replace with actual token from localStorage
    
    const theaterId = '68ed25e6962cb3e997acc163';
    const timestamp = Date.now();
    
    const userData = {
      theaterId: theaterId,
      username: `testuser_${timestamp}`,
      email: `testuser_${timestamp}@example.com`,
      password: 'password123',
      fullName: 'Test User ' + timestamp,
      phoneNumber: `+1234567${timestamp.toString().slice(-3)}`,
      role: '68f3f561c88746381Ga24fd', // Manager role ID from console
      isActive: true,
      isEmailVerified: false
    };
    
    console.log('🚀 Creating user with data:', userData);
    
    const response = await axios.post('http://localhost:5000/api/theater-users', userData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success:', response.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createTestUser();
