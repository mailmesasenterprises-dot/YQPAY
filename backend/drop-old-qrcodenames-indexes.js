require('dotenv').config();
const mongoose = require('mongoose');

async function dropOldIndexes() {
  try {
    console.log('🔧 Dropping old QRCodeNames indexes...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collection = db.collection('qrcodenames');
    
    const indexesToDrop = [
      'isActive_1',           // Wrong level - should be qrNameList.isActive
      'normalizedName_1',     // Wrong level - should be qrNameList.normalizedName (if needed)
      'theaterId_1',          // Wrong field name - we use 'theater' not 'theaterId'
      'name_1',               // Wrong level - should be qrNameList.qrName
      'theater_1_isActive_1'  // Wrong - isActive is in array, not document level
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
      console.log(`   - ${index.name}${index.unique ? ' (UNIQUE)' : ''}`);
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
