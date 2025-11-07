const mongoose = require('mongoose');
require('dotenv').config();

async function verifyAtlasData() {
  try {
    console.log('🔍 Verifying Atlas MongoDB Data...\n');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    
    console.log('✅ Connected to Atlas MongoDB\n');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Total Collections: ${collections.length}\n`);
    
    console.log('📋 Document Counts:');
    console.log('=' .repeat(50));
    
    let totalDocs = 0;
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      totalDocs += count;
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${col.name.padEnd(20)} : ${count.toString().padStart(5)} documents`);
    }
    
    console.log('=' .repeat(50));
    console.log(`\n📦 Total Documents: ${totalDocs}`);
    console.log('\n🎉 Atlas database is ready to use!');
    
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyAtlasData();
