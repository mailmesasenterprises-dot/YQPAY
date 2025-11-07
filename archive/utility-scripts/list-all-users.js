const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/yqpaynow').then(async () => {
  console.log('✅ Connected');
  
  const usersCollection = mongoose.connection.collection('users');
  const users = await usersCollection.find({}).project({ username: 1, userType: 1 }).toArray();
  
  console.log('\n📋 All users:');
  users.forEach(u => {
    console.log(`  - ${u.username} (${u.userType})`);
  });
  
  await mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
