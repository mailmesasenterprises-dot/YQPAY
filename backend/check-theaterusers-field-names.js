require('dotenv').config();
const mongoose = require('mongoose');

async function checkFieldName() {
  try {
    console.log('🔍 Checking theaterusers collection field names...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // Find guru user document
    const guruDoc = await db.collection('theaterusers')
      .findOne({ 'users.username': 'guru' });
    
    if (guruDoc) {
      console.log('📋 Guru Cinemas document structure:');
      console.log(`   _id: ${guruDoc._id}`);
      console.log(`   theater: ${guruDoc.theater}`);
      console.log(`   theaterId: ${guruDoc.theaterId}`);
      console.log(`   users count: ${guruDoc.users.length}`);
      console.log();
      
      if (!guruDoc.theaterId) {
        console.log('⚠️  WARNING: theaterId field is missing/null!');
        console.log('   This will cause theaterUsersDoc.theaterId.toString() to fail!');
      }
    }
    
    // Check all documents
    const allDocs = await db.collection('theaterusers').find({}).toArray();
    console.log(`\n📊 Total documents: ${allDocs.length}\n`);
    
    allDocs.forEach((doc, i) => {
      console.log(`Document ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  theater field: ${doc.theater ? 'EXISTS' : 'NULL'}`);
      console.log(`  theaterId field: ${doc.theaterId ? 'EXISTS' : 'NULL'}`);
      console.log(`  users: ${doc.users.length}`);
      doc.users.forEach(u => {
        console.log(`    - ${u.username}`);
      });
      console.log();
    });
    
    await mongoose.disconnect();
    console.log('✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkFieldName();
