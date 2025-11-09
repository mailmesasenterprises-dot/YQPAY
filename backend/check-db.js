const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow').then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  console.log('📚 Database Collections:\n');
  for (const coll of collections) {
    const count = await db.collection(coll.name).countDocuments();
    console.log(`   ${coll.name}: ${count} documents`);
  }
  
  console.log('\n✅ Done');
  process.exit(0);
}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
