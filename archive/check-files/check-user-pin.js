const mongoose = require('mongoose');

async function checkUserPin() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB');
    
    const doc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': 'kioas' });
    
    if (!doc) {
      console.log('❌ No theater users document found');
      process.exit(1);
      return;
    }
    
    const user = doc.users.find(u => u.username === 'kioas');
    
    if (!user) {
      console.log('❌ User kioas not found');
      process.exit(1);
      return;
    }
    
    console.log('\n📊 User Details:');
    console.log('=====================================');
    console.log('Username:', user.username);
    console.log('User ID:', user._id);
    console.log('PIN:', user.pin);
    console.log('PIN type:', typeof user.pin);
    console.log('PIN length:', user.pin ? user.pin.length : 0);
    console.log('Role:', user.role);
    console.log('Active:', user.isActive);
    console.log('Theater ID:', doc.theaterId);
    console.log('=====================================\n');
    
    // Test PIN comparison
    const testPin = '1111';
    console.log('Testing PIN comparison:');
    console.log('  Stored PIN:', JSON.stringify(user.pin));
    console.log('  Test PIN:', JSON.stringify(testPin));
    console.log('  Match (===):', user.pin === testPin);
    console.log('  Match (==):', user.pin == testPin);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserPin();
