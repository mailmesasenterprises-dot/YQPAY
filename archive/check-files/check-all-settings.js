const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    const db = mongoose.connection.db;
    const docs = await db.collection('settings').find({ type: 'sms' }).toArray();
    
    console.log(`📊 Found ${docs.length} documents with type='sms'`);
    
    docs.forEach((doc, index) => {
      console.log(`\n📄 Document ${index + 1}:`);
      console.log('_id:', doc._id);
      console.log('msg91SenderId:', doc.smsConfig?.msg91SenderId);
      console.log('msg91ApiKey:', doc.smsConfig?.msg91ApiKey?.substring(0, 20) + '...');
      console.log('msg91TemplateId:', doc.smsConfig?.msg91TemplateId);
      console.log('lastUpdated:', doc.lastUpdated);
    });
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
