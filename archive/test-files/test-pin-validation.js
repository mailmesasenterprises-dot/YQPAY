const mongoose = require('mongoose');

async function testPinValidation() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB');
    
    // Simulate what happens in login
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': 'kioas', 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log('❌ No theater users document found');
      process.exit(1);
      return;
    }
    
    const theaterUser = theaterUsersDoc.users.find(
      u => u.username === 'kioas' && u.isActive === true
    );
    
    if (!theaterUser) {
      console.log('❌ User not found');
      process.exit(1);
      return;
    }
    
    console.log('\n📊 Login Response Data:');
    console.log('=====================================');
    console.log('pendingAuth would contain:');
    console.log('  userId:', theaterUser._id.toString());
    console.log('  username:', theaterUser.username);
    console.log('  theaterId:', theaterUsersDoc.theaterId.toString());
    console.log('=====================================\n');
    
    // Now simulate PIN validation
    const userId = theaterUser._id.toString();
    const theaterId = theaterUsersDoc.theaterId.toString();
    const pin = '1111';
    
    console.log('🔢 Simulating PIN validation:');
    console.log('  Looking for userId:', userId);
    console.log('  Looking for theaterId:', theaterId);
    console.log('  Provided PIN:', pin);
    console.log('');
    
    // Try to find the document again (like PIN validation does)
    const pinValidationDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        theaterId: new mongoose.Types.ObjectId(theaterId),
        'users._id': new mongoose.Types.ObjectId(userId)
      });
    
    console.log('🔍 Found document in PIN validation:', !!pinValidationDoc);
    
    if (pinValidationDoc) {
      const foundUser = pinValidationDoc.users.find(
        u => u._id.toString() === userId && u.isActive === true
      );
      
      console.log('🔍 Found user in array:', !!foundUser);
      
      if (foundUser) {
        console.log('  Username:', foundUser.username);
        console.log('  Stored PIN:', foundUser.pin);
        console.log('  PIN match:', foundUser.pin === pin);
      }
    } else {
      console.log('❌ Could not find document with query:');
      console.log('   theaterId:', theaterId, '(ObjectId)');
      console.log('   users._id:', userId, '(ObjectId)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPinValidation();
