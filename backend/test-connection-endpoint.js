const axios = require('axios');

async function testMSG91Connection() {
  try {
    console.log('🧪 Testing MSG91 Connection via API endpoint...\n');
    
    const testData = {
      provider: 'msg91',
      msg91ApiKey: '436173AJmUNVLmflnC67f55ec0P1',
      msg91SenderId: 'SASENZ',
      msg91TemplateId: '67f60904d6fc053aa622bdc2',
      msg91TemplateVariable: 'OTP'
    };
    
    console.log('📤 Sending request to: http://localhost:5000/api/sms/test-sms');
    console.log('📦 Request body:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post(
      'http://localhost:5000/api/sms/test-sms',
      testData,
      {
        headers: {
          'Authorization': 'Bearer fake-token-for-testing',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ Response Status:', response.status);
    console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n🎉 SUCCESS! MSG91 Connection Test PASSED');
      console.log('✅ Template ID verified');
      console.log('✅ API Key authenticated');
      console.log('✅ Ready to send SMS');
    } else {
      console.log('\n❌ FAILED:', response.data.message);
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
  }
}

testMSG91Connection();
