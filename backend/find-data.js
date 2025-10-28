const mongoose = require('mongoose');
require('dotenv').config();

async function findData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater-canteen');
    console.log('✅ Connected to MongoDB');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📚 Checking all collections for data:\n');

    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      if (count > 0) {
        console.log(`✅ ${col.name}: ${count} documents`);
        
        // If it looks like theaters, show sample
        if (col.name.toLowerCase().includes('theater')) {
          const sample = await mongoose.connection.db.collection(col.name).findOne({});
          console.log(`   Sample fields: ${Object.keys(sample).join(', ')}`);
        }
      } else {
        console.log(`⚪ ${col.name}: empty`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findData();
