const mongoose = require('mongoose');

async function updateUserRole() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB');
    
    const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
    const adminRoleId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b7a6');
    
    console.log('📝 Updating kioas user role from string to ObjectId...');
    
    const result = await mongoose.connection.db.collection('theaterusers').updateOne(
      {
        theaterId: theaterId,
        'users.username': 'kioas'
      },
      {
        $set: {
          'users.$.role': adminRoleId,
          'users.$.updatedAt': new Date()
        }
      }
    );
    
    console.log('✅ Updated:', result.modifiedCount, 'user(s)');
    
    // Verify
    const doc = await mongoose.connection.db.collection('theaterusers').findOne({
      theaterId: theaterId,
      'users.username': 'kioas'
    });
    
    const user = doc.users.find(u => u.username === 'kioas');
    console.log('\n📊 User role is now:', user.role);
    console.log('   Type:', typeof user.role);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateUserRole();
