const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('📱 MSG91 OTP Sending Test\n');
console.log('⚠️  WARNING: This will send a REAL SMS to the specified phone number!\n');

// Change this to your phone number for testing
const TEST_PHONE_NUMBER = '919876543210'; // Replace with your number

console.log(`Testing OTP send to: ${TEST_PHONE_NUMBER}\n`);
console.log('Sending OTP request...\n');

axios.post('http://localhost:5000/api/sms/send-test-otp', {
  phoneNumber: TEST_PHONE_NUMBER,
  otp: '123456' // Test OTP
}, {
  headers: { 'Authorization': 'Bearer ' + token }
})
.then(response => {
  console.log('✅ OTP SENT SUCCESSFULLY!\n');
  console.log('Response:', response.data);
  console.log('\n📱 Check your phone for the OTP message!');
  console.log(`   Number: ${TEST_PHONE_NUMBER}`);
  console.log('   Expected OTP: 123456');
  console.log('\n🎉 MSG91 SMS System is FULLY OPERATIONAL!');
})
.catch(error => {
  console.error('\n❌ OTP SEND FAILED\n');
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Error:', error.response.data);
    
    if (error.response.status === 404) {
      console.log('\n💡 The /api/sms/send-test-otp endpoint might not be implemented yet');
    }
  } else {
    console.error('Error:', error.message);
  }
  
  console.log('\n💡 To enable actual OTP sending:');
  console.log('   1. Update TEST_PHONE_NUMBER in this script');
  console.log('   2. Make sure your MSG91 account has credits');
  console.log('   3. Verify sender ID "SASENZ" is approved for your account');
});
