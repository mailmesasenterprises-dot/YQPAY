const mongoose = require('mongoose');

async function getSampleUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('Connected to database');
    
    const users = await mongoose.connection.db.collection('theaterusers')
      .find({isActive: true})
      .limit(5)
      .toArray();
    
    console.log('\n=== SAMPLE USERS ===\n');
    users.forEach((u, index) => {
      console.log(`${index + 1}. Username: ${u.username}`);
      console.log(`   Name: ${u.fullName || u.firstName}`);
      console.log(`   Theater: ${u.theater}`);
      console.log(`   Role: ${u.role}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

getSampleUsers();
