const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Force update msg91SenderId to SASENZ
    const result = await db.collection('settings').updateOne(
      { type: 'sms' },
      {
        $set: {
          'smsConfig.msg91SenderId': 'SASENZ',
          lastUpdated: new Date()
        }
      }
    );
    
    console.log('📝 Update result:', result.modifiedCount, 'document(s) modified');
    
    // Verify the update
    const doc = await db.collection('settings').findOne({ type: 'sms' });
    console.log('\n✅ Verification:');
    console.log('msg91SenderId:', doc.smsConfig.msg91SenderId);
    console.log('Length:', doc.smsConfig.msg91SenderId.length);
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
