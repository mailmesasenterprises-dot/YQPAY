/**
 * Script to drop old PageAccess indexes
 * Run this once to fix the E11000 duplicate key error
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function dropOldIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpay', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('pageaccesses');

    // Get all existing indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the problematic role_1_page_1 index if it exists
    try {
      await collection.dropIndex('role_1_page_1');
      console.log('\n✅ Dropped old index: role_1_page_1');
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log('\n⚠️  Index role_1_page_1 not found (already dropped or never existed)');
      } else {
        throw error;
      }
    }

    // Verify remaining indexes
    const remainingIndexes = await collection.indexes();
    console.log('\n📋 Remaining indexes:');
    remainingIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Index cleanup complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropOldIndexes();
