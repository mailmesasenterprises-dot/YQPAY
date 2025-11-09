require('dotenv').config();
const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const indexes = await mongoose.connection.db.collection('roles').indexes();
    console.log('📋 Indexes on roles collection:\n');
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. Index: ${index.name}`);
      console.log(`   Keys:`, JSON.stringify(index.key));
      console.log(`   Unique: ${index.unique || false}`);
      console.log();
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIndexes();
