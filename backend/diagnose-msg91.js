const mongoose = require('mongoose');
const axios = require('axios');

mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const doc = await db.collection('settings').findOne({ type: 'sms' });
    
    if (!doc || !doc.smsConfig) {
      console.log('❌ No SMS config found');
      mongoose.connection.close();
      return;
    }
    
    const config = doc.smsConfig;
    
    console.log('📋 Current MSG91 Configuration:');
    console.log('================================');
    console.log('API Key:', config.msg91ApiKey);
    console.log('Sender ID:', config.msg91SenderId);
    console.log('Template ID:', config.msg91TemplateId);
    console.log('Template Variable:', config.msg91TemplateVariable);
    console.log('');
    
    // Test 1: Verify Template
    console.log('🧪 Test 1: Verifying Template with MSG91...\n');
    
    try {
      const templateResponse = await axios.get(
        `https://control.msg91.com/api/v5/flow/${config.msg91TemplateId}`,
        {
          headers: {
            'authkey': config.msg91ApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Template Verification: SUCCESS');
      console.log('Template Status:', templateResponse.data.status || 'Active');
      console.log('Template Name:', templateResponse.data.name || 'N/A');
      console.log('');
    } catch (error) {
      console.error('❌ Template Verification: FAILED');
      console.error('Error:', error.response?.data || error.message);
      console.log('');
    }
    
    // Test 2: Send actual OTP
    console.log('🧪 Test 2: Sending OTP to +919944400587...\n');
    
    const testOTP = '123456';
    const phoneNumber = '919944400587';
    
    try {
      const sendResponse = await axios.post(
        `https://control.msg91.com/api/v5/flow/`,
        {
          template_id: config.msg91TemplateId,
          sender: config.msg91SenderId || 'SASENZ',
          short_url: "0",
          mobiles: phoneNumber,
          [config.msg91TemplateVariable]: testOTP
        },
        {
          headers: {
            'authkey': config.msg91ApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ OTP Send: SUCCESS');
      console.log('Response Type:', sendResponse.data.type);
      console.log('Message ID:', sendResponse.data.message);
      console.log('Full Response:', JSON.stringify(sendResponse.data, null, 2));
      console.log('');
      console.log('📱 Check phone +919944400587 for OTP: 123456');
      console.log('');
      
      // Additional info
      if (sendResponse.data.type === 'success') {
        console.log('🎉 MSG91 API accepted the request!');
        console.log('');
        console.log('⚠️  If SMS not received, check:');
        console.log('   1. MSG91 account has sufficient credits');
        console.log('   2. Sender ID "SASENZ" is approved for your account');
        console.log('   3. Template ID is approved and active');
        console.log('   4. Phone number is not in DND (Do Not Disturb)');
        console.log('   5. Try checking MSG91 dashboard for delivery status');
      }
      
    } catch (error) {
      console.error('❌ OTP Send: FAILED');
      console.error('Status:', error.response?.status);
      console.error('Error:', JSON.stringify(error.response?.data, null, 2));
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Database Error:', err);
    process.exit(1);
  });
