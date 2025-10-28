const axios = require('axios');

async function testMSG91WithAuth() {
  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0Iiwicm9sZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzYxNjE2ODI2LCJleHAiOjE3NjE2MjA0MjZ9.cauTDG25WatlGtIQ6DTkQNmZhryxKODwGFRmz0Xsrxo';
    
    console.log('🧪 Testing MSG91 Connection with Authentication...\n');
    
    const testData = {
      provider: 'msg91',
      msg91ApiKey: '436173AJmUNVLmflnC67f55ec0P1',
      msg91SenderId: 'SASENZ',
      msg91TemplateId: '67f60904d6fc053aa622bdc2',
      msg91TemplateVariable: 'OTP'
    };
    
    console.log('📤 Testing: POST http://localhost:5000/api/sms/test-sms\n');
    
    const response = await axios.post(
      'http://localhost:5000/api/sms/test-sms',
      testData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ STATUS:', response.status, response.statusText);
    console.log('\n📦 RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SUCCESS! MSG91 CONNECTION TEST PASSED');
      console.log('='.repeat(60));
      console.log('✅ API Key: VALID');
      console.log('✅ Template ID: VERIFIED');
      console.log('✅ Sender ID: CONFIGURED');
      console.log('✅ Status: READY TO SEND SMS');
      console.log('='.repeat(60));
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
  }
}

testMSG91WithAuth();
