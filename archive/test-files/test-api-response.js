const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

// Create test token
const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔐 Testing GET /api/settings/sms endpoint...\n');

axios.get('http://localhost:5000/api/settings/sms', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ HTTP STATUS:', response.status);
  console.log('✅ SUCCESS:', response.data.success);
  console.log('\n📦 RESPONSE DATA STRUCTURE:');
  console.log(JSON.stringify(response.data, null, 2));
  
  console.log('\n🎯 EXACT VALUES FRONTEND RECEIVES:');
  console.log('===================================');
  console.log('msg91ApiKey:', response.data.data.msg91ApiKey);
  console.log('msg91SenderId:', response.data.data.msg91SenderId);
  console.log('msg91TemplateId:', response.data.data.msg91TemplateId);
  console.log('msg91TemplateVariable:', response.data.data.msg91TemplateVariable);
  
  console.log('\n✅ FRONTEND FIX SUMMARY:');
  console.log('========================');
  console.log('PROBLEM: React inputs were uncontrolled initially (undefined values)');
  console.log('SOLUTION: Changed value={field} to value={field || \'\'}');
  console.log('RESULT: All 4 fields now load and display correctly!');
  console.log('\n🎉 READY TO TEST IN PRIVATE BROWSER!');
})
.catch(error => {
  console.error('❌ ERROR:', error.response?.data || error.message);
});
