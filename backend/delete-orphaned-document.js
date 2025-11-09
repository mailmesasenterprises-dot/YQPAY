const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow').then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const db = mongoose.connection.db;
  
  // Find the orphaned document
  const orphan = await db.collection('theaterusers').findOne({ _id: new mongoose.Types.ObjectId('68ff795a16120ace2373e7e7') });
  
  console.log('🔍 Found orphaned document:');
  console.log(JSON.stringify(orphan, null, 2));
  console.log('');
  
  // Delete it
  const result = await db.collection('theaterusers').deleteOne({ _id: new mongoose.Types.ObjectId('68ff795a16120ace2373e7e7') });
  
  console.log('🗑️  Deleted:', result.deletedCount, 'document(s)');
  console.log('');
  console.log('✅ Cleanup complete! Now frontend user creation should work!');
  
  process.exit(0);
}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});
