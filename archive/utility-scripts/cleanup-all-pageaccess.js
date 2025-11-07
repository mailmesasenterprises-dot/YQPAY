const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow');
    const db = mongoose.connection.db;
    
    console.log('🧹 Cleaning up ALL page access data...\n');
    
    // Delete all from pageaccesses (new collection)
    const result1 = await db.collection('pageaccesses').deleteMany({});
    console.log(`✅ Deleted ${result1.deletedCount} documents from pageaccesses`);
    
    // Delete all from pageaccesses_old (old collection)
    const result2 = await db.collection('pageaccesses_old').deleteMany({});
    console.log(`✅ Deleted ${result2.deletedCount} documents from pageaccesses_old`);
    
    console.log('\n✅ Cleanup complete! Database is clean.');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

cleanup();
