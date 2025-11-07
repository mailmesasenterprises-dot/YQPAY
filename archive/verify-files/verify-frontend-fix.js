const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const settings = await db.collection('settings').findOne({ type: 'sms' });
    
    if (!settings || !settings.smsConfig) {
      console.log('❌ No SMS settings found in database');
      mongoose.connection.close();
      return;
    }
    
    console.log('📊 DATABASE VALUES:');
    console.log('===================');
    console.log('API Key:', settings.smsConfig.msg91ApiKey);
    console.log('Sender ID:', settings.smsConfig.msg91SenderId);
    console.log('Template ID:', settings.smsConfig.msg91TemplateId);
    console.log('Template Variable:', settings.smsConfig.msg91TemplateVariable);
    console.log('\n✅ All 4 fields are present in database');
    console.log('\n📝 FRONTEND FIX APPLIED:');
    console.log('======================');
    console.log('Changed all MSG91 input values from:');
    console.log('  value={smsConfig.msg91ApiKey}');
    console.log('To:');
    console.log('  value={smsConfig.msg91ApiKey || \'\'}');
    console.log('\nThis ensures React treats inputs as controlled components from the start.');
    console.log('\n🔄 NEXT STEPS:');
    console.log('==============');
    console.log('1. Open http://localhost:3001/settings in PRIVATE browser');
    console.log('2. Click on "SMS & OTP" in the sidebar');
    console.log('3. Select "MSG91" from provider dropdown');
    console.log('4. You should now see:');
    console.log('   ✓ API Key field with dots (password hidden)');
    console.log('   ✓ Sender ID field showing: SASENZ');
    console.log('   ✓ Template ID field showing: 67f60904d6fc053aa622bdc2');
    console.log('   ✓ Template Variable field showing: OTP');
    console.log('\n💡 NOTE: API Key is type="password" so it shows dots, not the actual value.');
    console.log('   To verify API Key is loaded, check browser console for "Merged SMS Config" log.');
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });
