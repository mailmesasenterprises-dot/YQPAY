const mongoose = require('mongoose');
require('dotenv').config();

async function fixSKUIndex() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/yqpaynow');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Try multiple collection names
    const possibleNames = ['products', 'productlists', 'productlist'];
    let collection = null;
    let collectionName = null;
    
    for (const name of possibleNames) {
      try {
        const cols = await db.listCollections({ name }).toArray();
        if (cols.length > 0) {
          collection = db.collection(name);
          collectionName = name;
          console.log(`✅ Found collection: ${name}`);
          break;
        }
      } catch (e) {}
    }
    
    if (!collection) {
      console.log('❌ Product collection not found. Trying to use Product model...');
      const Product = require('./models/Product');
      collection = Product.collection;
      collectionName = collection.collectionName;
      console.log(`✅ Using collection from model: ${collectionName}`);
    }

    // Get all indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Drop the problematic sku index if it exists
    try {
      console.log('\n🗑️ Dropping sku_1 index...');
      await collection.dropIndex('sku_1');
      console.log('✅ Successfully dropped sku_1 index');
    } catch (error) {
      if (error.code === 27 || error.message.includes('not found')) {
        console.log('ℹ️ Index sku_1 does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Update all null SKUs to undefined (to avoid duplicate null issue)
    console.log('\n🔄 Updating null SKUs to undefined...');
    const result = await collection.updateMany(
      { sku: null },
      { $unset: { sku: "" } }
    );
    console.log(`✅ Updated ${result.modifiedCount} products with null SKU`);

    // Create new sparse unique index
    console.log('\n🔨 Creating new sparse unique index on sku...');
    await collection.createIndex(
      { sku: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'sku_1_sparse'
      }
    );
    console.log('✅ Created sparse unique index on sku');

    console.log('\n📋 New indexes:');
    const newIndexes = await collection.indexes();
    console.log(JSON.stringify(newIndexes, null, 2));

    console.log('\n✅ SKU index fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing SKU index:', error);
    process.exit(1);
  }
}

fixSKUIndex();
