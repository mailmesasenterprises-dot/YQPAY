/**
 * Remove pageaccesses_old collection from MongoDB
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function removeOldCollection() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'pageaccesses_old' }).toArray();
    
    if (collections.length === 0) {
      console.log('ℹ️ Collection "pageaccesses_old" does not exist. Nothing to remove.');
    } else {
      // Get document count before deletion
      const count = await db.collection('pageaccesses_old').countDocuments();
      console.log(`📊 Found collection "pageaccesses_old" with ${count} documents`);
      
      if (count > 0) {
        console.log('📄 Documents to be deleted:');
        const docs = await db.collection('pageaccesses_old').find({}).toArray();
        docs.forEach((doc, idx) => {
          console.log(`  ${idx + 1}. ${doc.page || doc.pageName || doc._id}`);
        });
      }
      
      // Drop the collection
      console.log('\n🗑️ Dropping collection "pageaccesses_old"...');
      await db.collection('pageaccesses_old').drop();
      console.log('✅ Collection "pageaccesses_old" has been successfully removed from database!');
    }

    // Verify it's gone
    const remainingCollections = await db.listCollections({ name: 'pageaccesses_old' }).toArray();
    if (remainingCollections.length === 0) {
      console.log('✅ Verification: Collection no longer exists in database');
    }

  } catch (error) {
    console.error('❌ Error removing collection:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the removal
removeOldCollection()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
