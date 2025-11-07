const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('🔄 Retesting after IP whitelisting...\n');
console.log('📋 Your IPs to whitelist:');
console.log('   IPv4: 223.185.24.37');
console.log('   IPv6: 2401:4900:8824:91e5:c004:2bb3:7fcb:440d');
console.log('');
console.log('⏳ Sending test OTP to +919944400587...\n');

const phoneNumber = '+919944400587';
const testOTP = '999888';

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
  
  if (response.data.success) {
    console.log('\n🎉 OTP SENT!');
    console.log(`📱 Check phone for OTP: ${testOTP}`);
    console.log('');
    console.log('✅ IP whitelisting worked! MSG91 is now functional.');
  } else {
    console.log('\n⚠️  Still failing. Check MSG91 dashboard for details.');
  }
})
.catch(error => {
  console.error('\n❌ FAILED!\n');
  if (error.response) {
    console.error('Response:', JSON.stringify(error.response.data, null, 2));
  } else {
    console.error('Error:', error.message);
  }
  console.log('\n💡 Make sure you have whitelisted the IPs in MSG91!');
});
