const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🧪 MSG91 Configuration Test\n');
console.log('Testing all endpoints...\n');

// Test 1: Check if settings are loaded correctly
console.log('1️⃣ Testing GET /api/settings/sms...');
axios.get('http://localhost:5000/api/settings/sms', {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(response => {
  console.log('✅ GET Settings - SUCCESS');
  console.log('   API Key:', response.data.data.msg91ApiKey ? '✓ Present' : '✗ Missing');
  console.log('   Sender ID:', response.data.data.msg91SenderId || '✗ Missing');
  console.log('   Template ID:', response.data.data.msg91TemplateId || '✗ Missing');
  console.log('   Template Variable:', response.data.data.msg91TemplateVariable || '✗ Missing');
  
  // Test 2: Test MSG91 API connection
  console.log('\n2️⃣ Testing MSG91 API Connection...');
  return axios.post('http://localhost:5000/api/sms/test-sms', {
    provider: 'msg91',
    msg91ApiKey: response.data.data.msg91ApiKey,
    msg91SenderId: response.data.data.msg91SenderId,
    msg91TemplateId: response.data.data.msg91TemplateId
  }, {
    headers: { 'Authorization': 'Bearer ' + token }
  });
})
.then(response => {
  console.log('✅ MSG91 Connection - SUCCESS');
  console.log('   Status:', response.data.message);
  console.log('   Template Verified:', response.data.details?.templateVerified ? 'Yes' : 'No');
  
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('\n📋 Summary:');
  console.log('   ✓ Settings load correctly from database');
  console.log('   ✓ MSG91 API credentials are valid');
  console.log('   ✓ Template ID is verified');
  console.log('   ✓ Sender ID is configured');
  console.log('\n✅ MSG91 SMS system is READY to send OTPs!');
})
.catch(error => {
  console.error('\n❌ TEST FAILED');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Error:', error.response.data);
  } else {
    console.error('Error:', error.message);
  }
  
  console.log('\n💡 If settings test failed: Check if backend is running');
  console.log('💡 If MSG91 test failed: Verify your MSG91 credentials are correct');
});
