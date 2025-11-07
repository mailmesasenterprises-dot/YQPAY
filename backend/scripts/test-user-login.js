const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
    .findOne({ 'users.username': 'kioas' });
  
  if (theaterUsersDoc) {
    const user = theaterUsersDoc.users.find(u => u.username === 'kioas');
    
    if (user) {
      console.log('\n✅ User found:');
      console.log('Username:', user.username);
      console.log('Email:', user.email);
      console.log('Full Name:', user.fullName);
      console.log('PIN:', user.pin);
      console.log('Role:', user.role);
      console.log('Active:', user.isActive);
      console.log('\n🔐 Testing passwords...');
      
      const passwords = ['admin123', 'Admin123', 'password', 'kioas123'];
      
      for (const pwd of passwords) {
        const isMatch = await bcrypt.compare(pwd, user.password);
        console.log(`Password "${pwd}": ${isMatch ? '✅ MATCH' : '❌ No match'}`);
      }
    }
  } else {
    console.log('❌ User not found');
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
