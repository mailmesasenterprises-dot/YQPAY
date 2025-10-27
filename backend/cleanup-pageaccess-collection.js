/**
 * Cleanup Script: Remove old PageAccess documents from pageaccesses collection
 * This script removes documents that were created with the old PageAccess model structure
 * (one document per page) and prepares the collection for the new PageAccessArray model
 * (one document per theater with array of pages)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function cleanupPageAccessCollection() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const pageAccessCollection = db.collection('pageaccesses');

    // Find all documents that DON'T have the 'theater' field (old structure)
    // Old structure has: _id, page, pageName, route, etc.
    // New structure has: _id, theater, pageAccessList, metadata
    const oldDocuments = await pageAccessCollection.find({ 
      theater: { $exists: false } 
    }).toArray();

    console.log(`\n📊 Found ${oldDocuments.length} old-structure documents to clean up`);

    if (oldDocuments.length > 0) {
      console.log('\n📄 Old documents found:');
      oldDocuments.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.page || doc.pageName || doc._id} (ID: ${doc._id})`);
      });

      console.log('\n🗑️ Deleting old documents...');
      const result = await pageAccessCollection.deleteMany({ 
        theater: { $exists: false } 
      });

      console.log(`✅ Deleted ${result.deletedCount} old documents`);
    } else {
      console.log('✅ No old documents found. Collection is clean!');
    }

    // Show current documents in the new structure
    const newDocuments = await pageAccessCollection.find({ 
      theater: { $exists: true } 
    }).toArray();

    console.log(`\n📊 Collection now has ${newDocuments.length} theater-based documents (new structure)`);
    
    if (newDocuments.length > 0) {
      console.log('\n📄 Current theater-based documents:');
      newDocuments.forEach((doc, index) => {
        const pageCount = doc.pageAccessList ? doc.pageAccessList.length : 0;
        console.log(`  ${index + 1}. Theater: ${doc.theater}, Pages: ${pageCount}`);
      });
    }

    console.log('\n✅ Cleanup completed successfully!');
    console.log('💡 The pageaccesses collection is now ready for the new PageAccessArray model.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup
cleanupPageAccessCollection()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
