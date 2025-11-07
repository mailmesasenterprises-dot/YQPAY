const axios = require('axios');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'yqpaynow-super-secret-jwt-key-development-only';

const token = jwt.sign(
  { userId: 'test-user', role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Testing API...\n');

axios.get('http://localhost:5000/api/settings/sms', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
})
.then(response => {
  console.log('✅ SUCCESS!');
  console.log('Status:', response.status);
  console.log('\nData:');
  console.log(JSON.stringify(response.data, null, 2));
  
  if (response.data.data) {
    console.log('\n🎯 MSG91 FIELDS:');
    console.log('API Key:', response.data.data.msg91ApiKey || '(empty)');
    console.log('Sender ID:', response.data.data.msg91SenderId || '(empty)');
    console.log('Template ID:', response.data.data.msg91TemplateId || '(empty)');
    console.log('Template Variable:', response.data.data.msg91TemplateVariable || '(empty)');
  }
})
.catch(error => {
  console.error('❌ ERROR:');
  console.error('Message:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else {
    console.error('No response received. Is the server running?');
  }
});
