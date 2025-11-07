const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  // Find all theater users
  const allTheaterUsers = await mongoose.connection.db.collection('theaterusers').find({}).toArray();
  
  console.log(`\nTotal theater user documents: ${allTheaterUsers.length}\n`);
  
  allTheaterUsers.forEach((doc, index) => {
    console.log(`Document ${index + 1}:`);
    console.log(`Theater ID: ${doc.theaterId}`);
    console.log(`Total users in this theater: ${doc.users ? doc.users.length : 0}`);
    
    if (doc.users && doc.users.length > 0) {
      console.log('Users:');
      doc.users.forEach((user, userIndex) => {
        console.log(`  ${userIndex + 1}. Username: ${user.username}, Email: ${user.email}, PIN: ${user.pin}, Active: ${user.isActive}`);
      });
    }
    console.log('---');
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
