const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📚 All collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));

    // Check pageaccesses collection
    const pageAccessCount = await mongoose.connection.db.collection('pageaccesses').countDocuments();
    console.log(`\n📊 Documents in 'pageaccesses' collection: ${pageAccessCount}`);

    if (pageAccessCount > 0) {
      const docs = await mongoose.connection.db.collection('pageaccesses').find({}).toArray();
      console.log('\n📄 Sample document:');
      console.log(JSON.stringify(docs[0], null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDatabase();
