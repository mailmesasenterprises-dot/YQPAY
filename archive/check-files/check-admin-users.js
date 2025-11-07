const mongoose = require('mongoose');

async function checkAdmins() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB\n');
    
    const admins = await mongoose.connection.db.collection('admins').find({}).toArray();
    
    console.log('📊 Admins in database:', admins.length);
    console.log('=====================================\n');
    
    if (admins.length > 0) {
      admins.forEach((a, i) => {
        console.log(`${i + 1}. Email: ${a.email}`);
        console.log(`   Name: ${a.name || 'N/A'}`);
        console.log(`   Active: ${a.isActive !== false}`);
        console.log('');
      });
    } else {
      console.log('❌ No admin users found!');
      console.log('   You need to create an admin user first.\n');
    }
    
    // Also check theater users
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': 'kioas' });
    
    if (theaterUsersDoc) {
      const user = theaterUsersDoc.users.find(u => u.username === 'kioas');
      console.log('📊 Theater User (kioas):');
      console.log('=====================================');
      console.log('Username:', user.username);
      console.log('Email:', user.email);
      console.log('Active:', user.isActive);
      console.log('\n💡 Use this to login:');
      console.log('   Username: kioas');
      console.log('   Password: admin123');
      console.log('   PIN: 1111');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAdmins();
