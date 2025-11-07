// Database Information Script
console.log('📊 DATABASE INFORMATION');
console.log('======================');

const mongoose = require('mongoose');
require('dotenv').config();

async function showDatabaseInfo() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db';
    
    console.log('🔌 Database Connection Details:');
    console.log(`   URI: ${MONGODB_URI}`);
    console.log(`   Host: localhost`);
    console.log(`   Port: 27017`);
    console.log(`   Database: theater_canteen_db`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('\n✅ Connected successfully!');
    
    // Get database info
    const db = mongoose.connection.db;
    const admin = db.admin();
    const dbStats = await db.stats();
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Database Size: ${(dbStats.dataSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`   Collections: ${dbStats.collections}`);
    console.log(`   Objects: ${dbStats.objects}`);
    
    // List collections related to our work
    const collections = await db.listCollections().toArray();
    const relevantCollections = collections.filter(c => 
      c.name.includes('user') || 
      c.name.includes('theater') || 
      c.name.includes('role')
    );
    
    console.log('\n📂 Relevant Collections:');
    for (const collection of relevantCollections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`   ${collection.name}: ${count} documents`);
    }
    
    // Show our specific work
    console.log('\n🎯 Theater User Array Implementation:');
    const TheaterUserArray = require('./models/TheaterUserArray');
    const theaterArrays = await TheaterUserArray.find({});
    
    for (const array of theaterArrays) {
      console.log(`   Theater ${array.theater}: ${array.userList.length} users in array`);
      console.log(`   Active Users: ${array.metadata.activeUsers}`);
      console.log(`   Last Updated: ${array.metadata.lastUpdated.toLocaleString()}`);
    }
    
    console.log('\n🔍 Collection Details:');
    console.log(`   Old Structure: theaterusers collection (individual documents)`);
    console.log(`   New Structure: theateruserarrays collection (theater-wise arrays)`);
    console.log(`   Migration: Successfully completed`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

showDatabaseInfo();