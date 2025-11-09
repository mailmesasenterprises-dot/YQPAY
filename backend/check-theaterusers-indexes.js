require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    console.log('🔍 Checking TheaterUserArray indexes...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const collection = db.collection('theaterusers');
    
    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`\n${i + 1}. ${index.name}`);
      console.log('   Keys:', JSON.stringify(index.key));
      if (index.unique) console.log('   ⚠️  UNIQUE');
      if (index.sparse) console.log('   Sparse');
    });
    
    // Check for documents with null theater
    console.log('\n\n🔍 Checking for null theater values...');
    const nullTheaterDocs = await collection.find({ theater: null }).toArray();
    console.log(`Found ${nullTheaterDocs.length} documents with theater: null`);
    
    if (nullTheaterDocs.length > 0) {
      console.log('\n📋 Documents with null theater:');
      nullTheaterDocs.forEach(doc => {
        console.log(`  - _id: ${doc._id}, theaterId: ${doc.theaterId}, users: ${doc.users?.length || 0}`);
      });
    }
    
    // Check for documents with theaterId instead
    console.log('\n🔍 Checking for theaterId field...');
    const theaterIdDocs = await collection.find({ theaterId: { $exists: true } }).toArray();
    console.log(`Found ${theaterIdDocs.length} documents with theaterId field`);
    
    await mongoose.disconnect();
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkIndexes();
