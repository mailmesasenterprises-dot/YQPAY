const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    const db = mongoose.connection.db;
    const doc = await db.collection('settings').findOne({ type: 'sms' });
    
    console.log('🔍 Checking msg91SenderId in database:');
    console.log('Value:', JSON.stringify(doc.smsConfig.msg91SenderId));
    console.log('Length:', doc.smsConfig.msg91SenderId.length);
    console.log('Type:', typeof doc.smsConfig.msg91SenderId);
    console.log('Has value:', !!doc.smsConfig.msg91SenderId);
    console.log('\n📊 All MSG91 Fields:');
    console.log('API Key:', doc.smsConfig.msg91ApiKey);
    console.log('Sender ID:', doc.smsConfig.msg91SenderId);
    console.log('Template ID:', doc.smsConfig.msg91TemplateId);
    console.log('Template Variable:', doc.smsConfig.msg91TemplateVariable);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
