const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow').then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  
  // List all indexes
  console.log('📋 Current indexes:');
  const indexes = await db.collection('theaterusers').indexes();
  console.log(JSON.stringify(indexes, null, 2));
  console.log('');
  
  // Count documents
  const count = await db.collection('theaterusers').countDocuments();
  console.log('📊 Total documents:', count);
  
  // List all documents
  const docs = await db.collection('theaterusers').find({}).toArray();
  console.log('📄 Documents:');
  docs.forEach(doc => {
    console.log(`  - ID: ${doc._id}, TheaterId: ${doc.theaterId}, Users: ${doc.users ? doc.users.length : 0}`);
  });
  
  console.log('\n✅ Analysis complete');
  process.exit(0);
}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
