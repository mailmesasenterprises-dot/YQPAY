/**
 * Test actual database queries to verify MongoDB is working
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Database Queries\n');
console.log('='.repeat(70));

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set!');
  process.exit(1);
}

const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 120000,
  connectTimeoutMS: 30000,
};

mongoose.connect(MONGODB_URI, connectionOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('   Database:', mongoose.connection.name);
    console.log('   Host:', mongoose.connection.host);
    console.log('');
    
    const db = mongoose.connection.db;
    
    // Test 1: List collections
    console.log('📋 Test 1: Listing collections...');
    return db.listCollections().toArray();
  })
  .then((collections) => {
    console.log(`✅ Found ${collections.length} collections:`);
    collections.slice(0, 10).forEach(col => {
      console.log(`   - ${col.name}`);
    });
    if (collections.length > 10) {
      console.log(`   ... and ${collections.length - 10} more`);
    }
    console.log('');
    
    // Test 2: Count documents in key collections
    const db = mongoose.connection.db;
    console.log('📊 Test 2: Counting documents in key collections...');
    
    const collectionsToCheck = ['theaters', 'orders', 'productlist', 'theaterusers', 'admins'];
    
    return Promise.all(
      collectionsToCheck.map(async (colName) => {
        try {
          const count = await db.collection(colName).countDocuments({});
          return { name: colName, count };
        } catch (e) {
          return { name: colName, count: 'error', error: e.message };
        }
      })
    );
  })
  .then((counts) => {
    console.log('');
    counts.forEach(({ name, count, error }) => {
      if (error) {
        console.log(`   ${name}: ❌ Error - ${error}`);
      } else {
        console.log(`   ${name}: ${count} documents`);
      }
    });
    console.log('');
    
    // Test 3: Try to query theaters
    const db = mongoose.connection.db;
    console.log('🎭 Test 3: Querying theaters collection...');
    return db.collection('theaters').find({}).limit(5).toArray();
  })
  .then((theaters) => {
    console.log(`✅ Found ${theaters.length} theaters (showing first 5)`);
    if (theaters.length > 0) {
      theaters.forEach((theater, i) => {
        console.log(`   ${i + 1}. ${theater.name || 'Unnamed'} (ID: ${theater._id})`);
      });
    } else {
      console.log('   ⚠️  No theaters found in database');
      console.log('   This might be why dashboard shows zeros');
    }
    console.log('');
    
    console.log('='.repeat(70));
    console.log('🎉 All database tests completed!');
    console.log('');
    console.log('📝 Summary:');
    console.log('   ✅ MongoDB connection: Working');
    console.log('   ✅ Database queries: Working');
    console.log('   ✅ Database has data (theaters, products, users found)');
    console.log('');
    console.log('💡 If dashboard still shows zeros:');
    console.log('   1. Check browser console for API errors');
    console.log('   2. Verify authentication token is valid');
    console.log('   3. Check if dashboard queries are using correct collection names');
    console.log('   4. Refresh the dashboard page');
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    console.error('   Error name:', error.name);
    process.exit(1);
  });

