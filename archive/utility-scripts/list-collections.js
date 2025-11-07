const mongoose = require('mongoose');

async function listCollections() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow');
    console.log('✅ Connected to MongoDB');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('\n📦 Collections in database:');
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
    
    // Check if theaterusers collection exists
    const theaterUsersCollection = collections.find(c => c.name === 'theaterusers');
    if (theaterUsersCollection) {
      const TheaterUserArray = mongoose.model('TheaterUserArray', new mongoose.Schema({}, { strict: false }), 'theaterusers');
      const docs = await TheaterUserArray.find({});
      console.log('\n👥 Theater Users Documents:', docs.length);
      if (docs.length > 0) {
        docs.forEach((doc, index) => {
          console.log(`\n${index + 1}. Document ID: ${doc._id}`);
          console.log(`   Theater field: ${doc.theater}`);
          console.log(`   TheaterId field: ${doc.theaterId}`);
          console.log(`   Users count: ${doc.users?.length || 0}`);
          if (doc.users && doc.users.length > 0) {
            console.log('   Usernames:', doc.users.map(u => u.username).join(', '));
          }
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listCollections();
