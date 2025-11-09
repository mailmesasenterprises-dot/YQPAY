const mongoose = require('mongoose');
require('dotenv').config();

async function fixSKUIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('productlist');
    
    // Check existing indexes
    console.log('\n📋 Current indexes on productlist:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '', idx.sparse ? '(sparse)' : '');
    });
    
    // Drop the old global sku indexes
    const indexesToDrop = ['sku_1', 'sku_1_sparse'];
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`\n✅ Dropped old ${indexName} index`);
      } catch (error) {
        if (error.code === 27) {
          console.log(`\n⚠️  Index ${indexName} does not exist (already dropped)`);
        } else if (error.message.includes('index not found')) {
          console.log(`\n⚠️  Index ${indexName} not found`);
        } else {
          console.log(`\n⚠️  Could not drop ${indexName}:`, error.message);
        }
      }
    }
    
    // Create new compound index: theaterId + sku (unique per theater)
    try {
      await collection.createIndex(
        { theaterId: 1, sku: 1 }, 
        { 
          unique: true,
          sparse: true, // Allows multiple null SKUs per theater
          name: 'theaterId_1_sku_1_unique'
        }
      );
      console.log('\n✅ Created new compound index: theaterId + sku (unique per theater, sparse)');
    } catch (error) {
      if (error.code === 85 || error.message.includes('already exists')) {
        console.log('\n⚠️  Compound index already exists');
      } else {
        throw error;
      }
    }
    
    // Verify new indexes
    console.log('\n📋 Updated indexes on productlist:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '', idx.sparse ? '(sparse)' : '');
    });
    
    console.log('\n✅ Index fix complete!');
    console.log('📝 Now:');
    console.log('   - SKU is unique WITHIN each theater');
    console.log('   - Different theaters CAN have the same SKU');
    console.log('   - Multiple products per theater can have null/empty SKU');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixSKUIndex();
