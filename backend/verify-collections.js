/**
 * Verification Script: Check MongoDB collections
 * This script verifies which collections exist and their document counts
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function verifyCollections() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('📊 All Collections in Database:');
    console.log('=' .repeat(60));

    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`  📁 ${collection.name}: ${count} documents`);
    }

    console.log('='.repeat(60));
    console.log('\n🔍 Checking specific collections:\n');

    // Check pageaccesses
    const pageaccessesCount = await db.collection('pageaccesses').countDocuments();
    console.log(`📄 pageaccesses: ${pageaccessesCount} documents`);
    
    if (pageaccessesCount > 0) {
      const pageaccessesDocs = await db.collection('pageaccesses').find({}).limit(2).toArray();
      console.log('   Sample documents:');
      pageaccessesDocs.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. Theater: ${doc.theater || 'N/A'}, Pages: ${doc.pageAccessList?.length || 0}`);
      });
    }

    // Check pageaccesses_old
    const pageaccessesOldCount = await db.collection('pageaccesses_old').countDocuments();
    console.log(`\n📄 pageaccesses_old: ${pageaccessesOldCount} documents`);
    
    if (pageaccessesOldCount > 0) {
      const pageaccessesOldDocs = await db.collection('pageaccesses_old').find({}).limit(2).toArray();
      console.log('   Sample documents:');
      pageaccessesOldDocs.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. ID: ${doc._id}, Page: ${doc.page || doc.pageName || 'N/A'}`);
      });
    }

    // Check if there's a pageaccessarrays collection (wrong pluralization)
    const pageaccessarraysCount = await db.collection('pageaccessarrays').countDocuments().catch(() => 0);
    if (pageaccessarraysCount > 0) {
      console.log(`\n⚠️ pageaccessarrays (WRONG): ${pageaccessarraysCount} documents`);
      console.log('   This collection should NOT exist - data should be in "pageaccesses"');
    }

    console.log('\n✅ Verification completed successfully!');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyCollections()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
