require('dotenv').config();
const mongoose = require('mongoose');

async function dropOldIndexes() {
  try {
    console.log('🔧 Dropping old TheaterUserArray indexes...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collection = db.collection('theaterusers');
    
    const indexesToDrop = [
      'theater_1_username_1',  // Wrong field name, unique constraint issue
      'email_1',               // Wrong level - should be users.email
      'username_1',            // Wrong level - should be users.username  
      'theater_1',             // Wrong field name - should be theaterId
      'role_1',                // Wrong level - should be users.role
      'isActive_1'             // Wrong level - should be users.isActive
    ];
    
    console.log('📋 Indexes to drop:');
    indexesToDrop.forEach(idx => console.log(`   - ${idx}`));
    console.log();
    
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped: ${indexName}`);
      } catch (error) {
        if (error.code === 27 || error.message.includes('index not found')) {
          console.log(`⚠️  Index not found (already dropped): ${indexName}`);
        } else {
          console.error(`❌ Failed to drop ${indexName}:`, error.message);
        }
      }
    }
    
    console.log('\n📋 Remaining indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`   - ${index.name}`);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

dropOldIndexes();
