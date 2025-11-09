require('dotenv').config();
const mongoose = require('mongoose');

async function dropOldIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🗑️  Dropping old index: theaterId_1_name_1...');
    await mongoose.connection.db.collection('roles').dropIndex('theaterId_1_name_1');
    console.log('✅ Index dropped successfully!\n');
    
    // Also drop other old indexes if they exist
    const oldIndexes = ['theaterId_1', 'name_1', 'normalizedName_1', 'priority_1', 'theater_1_name_1'];
    
    for (const indexName of oldIndexes) {
      try {
        console.log(`🗑️  Attempting to drop index: ${indexName}...`);
        await mongoose.connection.db.collection('roles').dropIndex(indexName);
        console.log(`✅ Dropped: ${indexName}`);
      } catch (err) {
        if (err.code === 27 || err.codeName === 'IndexNotFound') {
          console.log(`ℹ️  Index ${indexName} does not exist - skipping`);
        } else {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }
    
    console.log('\n📋 Remaining indexes:');
    const indexes = await mongoose.connection.db.collection('roles').indexes();
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.name}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropOldIndex();
