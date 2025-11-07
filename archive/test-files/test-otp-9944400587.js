const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('📱 Testing OTP Send to 9944400587\n');
console.log('⏳ Sending OTP request...\n');

const phoneNumber = '+919944400587';
const testOTP = Math.floor(100000 + Math.random() * 900000).toString();

console.log(`📞 Phone: ${phoneNumber}`);
console.log(`🔢 OTP: ${testOTP}\n`);

axios.post('http://localhost:5000/api/sms/send-test-otp', {
  phoneNumber: phoneNumber,
  otp: testOTP
}, {
  headers: { 
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('✅ SUCCESS!\n');
  console.log('Response:', JSON.stringify(response.data, null, 2));
  console.log('\n🎉 OTP SENT SUCCESSFULLY!');
  console.log(`📱 Check phone ${phoneNumber} for OTP: ${testOTP}`);
  console.log('\n✅ MSG91 Integration is working perfectly!');
})
.catch(error => {
  console.error('\n❌ FAILED!\n');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Error:', JSON.stringify(error.response.data, null, 2));
  } else if (error.request) {
    console.error('No response received. Is the backend running?');
    console.error('Error:', error.message);
  } else {
    console.error('Error:', error.message);
  }
});
