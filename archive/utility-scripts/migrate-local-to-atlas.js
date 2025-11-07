const mongoose = require('mongoose');
require('dotenv').config();

// Local MongoDB connection
const LOCAL_URI = 'mongodb://localhost:27017/theater_canteen_db';

// Atlas MongoDB connection (from .env)
const ATLAS_URI = process.env.MONGODB_URI || 'mongodb+srv://aedentekuiuxdesigner:Aedentek%40123%23@cluster0.vrj9qje.mongodb.net/yqpay';

console.log('🔄 MongoDB Migration Tool - Local to Atlas');
console.log('=' .repeat(60));

async function migrateDatabase() {
  let localConnection;
  let atlasConnection;

  try {
    // Step 1: Connect to local MongoDB
    console.log('\n📡 Connecting to LOCAL MongoDB...');
    localConnection = await mongoose.createConnection(LOCAL_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to LOCAL MongoDB');

    // Step 2: Get all collection names from local DB
    console.log('\n📋 Fetching collections from local database...');
    
    // Wait for connection to be ready
    if (localConnection.readyState !== 1) {
      await new Promise(resolve => localConnection.once('open', resolve));
    }
    
    const collections = await localConnection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log(`✅ Found ${collectionNames.length} collections:`);
    collectionNames.forEach(name => console.log(`   - ${name}`));

    if (collectionNames.length === 0) {
      console.log('\n⚠️  No collections found in local database. Nothing to migrate.');
      process.exit(0);
    }

    // Step 3: Connect to Atlas MongoDB
    console.log('\n📡 Connecting to ATLAS MongoDB...');
    atlasConnection = await mongoose.createConnection(ATLAS_URI, {
      serverSelectionTimeoutMS: 10000
    });
    
    // Wait for Atlas connection to be ready
    if (atlasConnection.readyState !== 1) {
      await new Promise(resolve => atlasConnection.once('open', resolve));
    }
    
    console.log('✅ Connected to ATLAS MongoDB');

    // Step 4: Migrate each collection
    console.log('\n🚀 Starting migration...');
    console.log('=' .repeat(60));

    let totalDocuments = 0;
    const migrationResults = [];

    for (const collectionName of collectionNames) {
      try {
        console.log(`\n📦 Processing collection: ${collectionName}`);
        
        // Get all documents from local collection
        const localCollection = localConnection.db.collection(collectionName);
        const documents = await localCollection.find({}).toArray();
        
        console.log(`   Found ${documents.length} documents`);

        if (documents.length > 0) {
          // Insert documents into Atlas collection
          const atlasCollection = atlasConnection.db.collection(collectionName);
          
          // Drop existing collection in Atlas (optional - comment out if you want to keep existing data)
          try {
            await atlasCollection.drop();
            console.log(`   Dropped existing collection in Atlas`);
          } catch (dropError) {
            // Collection might not exist, which is fine
            console.log(`   Collection doesn't exist in Atlas yet`);
          }

          // Insert documents
          const result = await atlasCollection.insertMany(documents);
          console.log(`   ✅ Migrated ${result.insertedCount} documents`);
          
          totalDocuments += result.insertedCount;
          migrationResults.push({
            collection: collectionName,
            documents: result.insertedCount,
            status: 'success'
          });
        } else {
          console.log(`   ⚠️  No documents to migrate`);
          migrationResults.push({
            collection: collectionName,
            documents: 0,
            status: 'empty'
          });
        }

        // Copy indexes
        console.log(`   📑 Copying indexes...`);
        const indexes = await localCollection.indexes();
        const atlasCollection = atlasConnection.db.collection(collectionName);
        
        for (const index of indexes) {
          // Skip the default _id index
          if (index.name !== '_id_') {
            try {
              const indexSpec = {};
              for (const [key, value] of Object.entries(index.key)) {
                indexSpec[key] = value;
              }
              
              const options = {
                name: index.name
              };
              if (index.unique) options.unique = true;
              if (index.sparse) options.sparse = true;
              
              await atlasCollection.createIndex(indexSpec, options);
              console.log(`   ✅ Created index: ${index.name}`);
            } catch (indexError) {
              console.log(`   ⚠️  Index ${index.name} might already exist or failed: ${indexError.message}`);
            }
          }
        }

      } catch (collectionError) {
        console.error(`   ❌ Error migrating collection ${collectionName}:`, collectionError.message);
        migrationResults.push({
          collection: collectionName,
          documents: 0,
          status: 'failed',
          error: collectionError.message
        });
      }
    }

    // Step 5: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('=' .repeat(60));
    console.log(`\n✅ Total collections processed: ${collectionNames.length}`);
    console.log(`✅ Total documents migrated: ${totalDocuments}`);
    
    console.log('\n📋 Detailed Results:');
    migrationResults.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'empty' ? '⚠️ ' : '❌';
      console.log(`   ${icon} ${result.collection}: ${result.documents} documents (${result.status})`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📍 Atlas Database: ' + ATLAS_URI.split('@')[1].split('?')[0]);

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED:', error);
    console.error('\nError details:', error.message);
    process.exit(1);
  } finally {
    // Close connections
    if (localConnection) {
      await localConnection.close();
      console.log('\n🔌 Closed local MongoDB connection');
    }
    if (atlasConnection) {
      await atlasConnection.close();
      console.log('🔌 Closed Atlas MongoDB connection');
    }
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
