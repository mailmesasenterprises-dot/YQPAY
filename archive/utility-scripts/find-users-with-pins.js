const mongoose = require('mongoose');
require('dotenv').config();

async function findUsers() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check all possible collections for users
    const collections = ['theateruserarrays', 'theaterusers', 'users'];
    
    for (const collName of collections) {
      console.log(`\n🔍 Checking ${collName}...`);
      try {
        const docs = await db.collection(collName).find({}).toArray();
        console.log(`   Found ${docs.length} documents`);
        
        if (docs.length > 0) {
          // Check if it's array format or flat format
          const firstDoc = docs[0];
          
          if (firstDoc.users && Array.isArray(firstDoc.users)) {
            // Array format
            console.log('   📋 Array format detected');
            docs.forEach((doc, index) => {
              console.log(`\n   Document ${index + 1} (Theater: ${doc.theaterId}):`);
              doc.users.forEach((user, userIndex) => {
                console.log(`     User ${userIndex + 1}:`);
                console.log(`       Username: ${user.username}`);
                console.log(`       PIN: ${user.pin || '❌ NO PIN'}`);
                console.log(`       Email: ${user.email}`);
              });
            });
          } else if (firstDoc.username) {
            // Flat format
            console.log('   📄 Flat format detected');
            docs.slice(0, 3).forEach((user, index) => {
              console.log(`\n   User ${index + 1}:`);
              console.log(`     Username: ${user.username}`);
              console.log(`     PIN: ${user.pin || '❌ NO PIN'}`);
              console.log(`     Email: ${user.email}`);
              console.log(`     Theater: ${user.theaterId}`);
            });
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Collection might not exist: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n\n🔌 MongoDB connection closed');
  }
}

findUsers();
