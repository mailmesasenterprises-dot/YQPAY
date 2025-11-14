/**
 * Script to clean up PageAccess collection
 * - Remove documents with null pageName
 * - Drop problematic indexes
 * - Rebuild correct indexes
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function cleanupPageAccess() {
  try {
    // Connect to MongoDB - require environment variable
    const MONGODB_URI = process.env.MONGODB_URI?.trim();
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URI is not set in environment variables!');
      console.error('   Please set MONGODB_URI in backend/.env file');
      process.exit(1);
    }
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
      connectTimeoutMS: 30000,
    });

    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('pageaccesses');

    // 1. Check for documents with null pageName
    console.log('\n🔍 Checking for documents with null pageName...');
    const nullDocs = await collection.find({ pageName: null }).toArray();
    console.log(`Found ${nullDocs.length} documents with null pageName`);
    
    if (nullDocs.length > 0) {
      console.log('Sample documents:', JSON.stringify(nullDocs.slice(0, 3), null, 2));
    }

    // 2. Delete documents with null pageName
    if (nullDocs.length > 0) {
      const deleteResult = await collection.deleteMany({ pageName: null });
      console.log(`\n✅ Deleted ${deleteResult.deletedCount} documents with null pageName`);
    }

    // 3. Check for documents with null page
    console.log('\n🔍 Checking for documents with null page...');
    const nullPageDocs = await collection.find({ page: null }).toArray();
    console.log(`Found ${nullPageDocs.length} documents with null page`);
    
    if (nullPageDocs.length > 0) {
      const deleteResult = await collection.deleteMany({ page: null });
      console.log(`✅ Deleted ${deleteResult.deletedCount} documents with null page`);
    }

    // 4. Get all existing indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // 5. Drop problematic indexes
    const indexesToDrop = ['role_1_page_1', 'role_1_isActive_1', 'pageName_1'];
    for (const indexName of indexesToDrop) {
      try {
        await collection.dropIndex(indexName);
        console.log(`\n✅ Dropped index: ${indexName}`);
      } catch (error) {
        if (error.codeName === 'IndexNotFound') {
          console.log(`\n⚠️  Index ${indexName} not found`);
        } else {
          console.error(`\n❌ Error dropping ${indexName}:`, error.message);
        }
      }
    }

    // 6. Verify remaining indexes
    const remainingIndexes = await collection.indexes();
    console.log('\n📋 Remaining indexes:');
    remainingIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // 7. Count total documents
    const totalDocs = await collection.countDocuments();
    console.log(`\n📊 Total documents in collection: ${totalDocs}`);

    console.log('\n✅ Cleanup complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupPageAccess();
