const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function checkAllCollections() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📚 All Collections:');
    
    for (const col of collections) {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      console.log(`\n  ${col.name}: ${count} documents`);
      
      if (count > 0 && count < 100) {
        const sample = await collection.find({}).limit(2).toArray();
        console.log(`  Sample:`, JSON.stringify(sample[0], null, 2).substring(0, 200) + '...');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkAllCollections();
