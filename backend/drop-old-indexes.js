const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow').then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  
  // List all indexes on theaterusers collection
  console.log('📋 Current indexes:');
  const indexes = await db.collection('theaterusers').indexes();
  indexes.forEach(idx => {
    console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
  });
  console.log('');
  
  // Drop all indexes except _id_
  console.log('🗑️  Dropping old indexes...');
  for (const idx of indexes) {
    if (idx.name !== '_id_') {
      try {
        await db.collection('theaterusers').dropIndex(idx.name);
        console.log(`  ✅ Dropped: ${idx.name}`);
      } catch (error) {
        console.log(`  ❌ Could not drop ${idx.name}:`, error.message);
      }
    }
  }
  
  console.log('\n✅ Index cleanup complete!');
  console.log('✅ The TheaterUserArray model will recreate the correct indexes on next server start.\n');
  
  process.exit(0);
}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
