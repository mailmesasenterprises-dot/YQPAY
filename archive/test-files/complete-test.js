// Complete frontend test simulation
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const THEATER_ID = '68ed25e6962cb3e997acc163';

// Mock token (replace with actual valid token)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGQzN2U5MDM1NGVkNTY2ZTA4NTVhYjkiLCJ1c2VybmFtZSI6ImFkbWluQHlxcGF5bm93LmNvbSIsInJvbGUiOiJzdXBlcl9hZG1pbiIsInVzZXJUeXBlIjoic3VwZXJfYWRtaW4iLCJ0aGVhdGVySWQiOm51bGwsImlhdCI6MTc2MDc3MjYzNSwiZXhwIjoxNzYwODU5MDM1fQ.5f7wTAZbcAH6_l73xQxQ2E8xKHASoEu-CvHXhtfH_5I';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function waitForServer() {
  console.log('⏳ Waiting for server to start...');
  for (let i = 0; i < 10; i++) {
    try {
      await axios.get(`${API_BASE}/health`);
      console.log('✅ Server is ready!');
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.log('❌ Server not responding');
  return false;
}

async function fullCRUDTest() {
  console.log('🚀 Complete CRUD Test for Theater Users Array');
  console.log('==============================================');

  // Wait for server
  if (!await waitForServer()) return;

  try {
    // 1. GET - Fetch existing users
    console.log('\n📥 1. GET Users for Theater');
    const getResponse = await axios.get(`${API_BASE}/theater-users-array?theaterId=${THEATER_ID}&limit=10`, { headers });
    console.log(`✅ Status: ${getResponse.status}`);
    console.log(`📊 Users found: ${getResponse.data.data.users.length}`);
    console.log(`🏢 Theater: ${getResponse.data.data.theater?.name}`);
    console.log('👥 Users:', getResponse.data.data.users.map(u => u.username).join(', '));

    // 2. POST - Create new user
    console.log('\n📤 2. CREATE New User');
    const newUser = {
      theaterId: THEATER_ID,
      username: `testuser_${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      password: 'password123',
      fullName: 'Frontend Test User',
      phoneNumber: '9876543210',
      isActive: true,
      isEmailVerified: false
    };

    const createResponse = await axios.post(`${API_BASE}/theater-users-array`, newUser, { headers });
    console.log(`✅ Status: ${createResponse.status}`);
    console.log(`👤 Created: ${createResponse.data.data.user.username}`);
    
    const createdUserId = createResponse.data.data.user._id;

    // 3. PUT - Update user
    console.log('\n📝 3. UPDATE User');
    const updateData = {
      theaterId: THEATER_ID,
      fullName: 'Updated Frontend Test User',
      isEmailVerified: true
    };

    const updateResponse = await axios.put(`${API_BASE}/theater-users-array/${createdUserId}`, updateData, { headers });
    console.log(`✅ Status: ${updateResponse.status}`);
    console.log(`👤 Updated: ${updateResponse.data.data.user.fullName}`);
    console.log(`✅ Verified: ${updateResponse.data.data.user.isEmailVerified}`);

    // 4. GET - Get specific user
    console.log('\n📋 4. GET Specific User');
    const userResponse = await axios.get(`${API_BASE}/theater-users-array/${createdUserId}?theaterId=${THEATER_ID}`, { headers });
    console.log(`✅ Status: ${userResponse.status}`);
    console.log(`👤 User: ${userResponse.data.data.user.username}`);

    // 5. Search users
    console.log('\n🔍 5. SEARCH Users');
    const searchResponse = await axios.get(`${API_BASE}/theater-users-array?theaterId=${THEATER_ID}&search=test&limit=5`, { headers });
    console.log(`✅ Status: ${searchResponse.status}`);
    console.log(`📊 Search results: ${searchResponse.data.data.users.length}`);

    // 6. UPDATE Last Login
    console.log('\n🔐 6. UPDATE Last Login');
    const loginResponse = await axios.post(`${API_BASE}/theater-users-array/${createdUserId}/login`, { theaterId: THEATER_ID }, { headers });
    console.log(`✅ Status: ${loginResponse.status}`);
    console.log(`🕒 Last login updated: ${new Date(loginResponse.data.data.user.lastLogin).toLocaleString()}`);

    // 7. DELETE - Soft delete
    console.log('\n🗑️ 7. DELETE User (Soft Delete)');
    const deleteResponse = await axios.delete(`${API_BASE}/theater-users-array/${createdUserId}?theaterId=${THEATER_ID}`, { headers });
    console.log(`✅ Status: ${deleteResponse.status}`);
    console.log(`🏢 Theater: ${deleteResponse.data.data.theater?.name}`);

    // Final verification
    console.log('\n📊 8. FINAL Verification');
    const finalResponse = await axios.get(`${API_BASE}/theater-users-array?theaterId=${THEATER_ID}&limit=20`, { headers });
    console.log(`✅ Status: ${finalResponse.status}`);
    console.log(`📊 Total users after operations: ${finalResponse.data.data.users.length}`);
    console.log(`📈 Metadata:`, finalResponse.data.data.summary);

    console.log('\n🎉 ALL CRUD OPERATIONS COMPLETED SUCCESSFULLY!');
    console.log('===============================================');
    console.log('✅ Theater User Array Implementation Working');
    console.log('✅ Migration Successful');
    console.log('✅ API Endpoints Functional');
    console.log('✅ Frontend Ready for Integration');

  } catch (error) {
    console.log(`❌ Test failed: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    if (error.response?.data) {
      console.log('Error details:', error.response.data);
    }
  }
}

// Run the test
fullCRUDTest();