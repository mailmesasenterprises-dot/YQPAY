/**
 * Create Theater Indexes Script
 * Run this to ensure all performance indexes are created in MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Theater = require('../models/Theater');

const MONGODB_URI = process.env.MONGODB_URI;

async function createIndexes() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 120000,
      connectTimeoutMS: 30000
    });
    
    console.log('✅ Connected to MongoDB');
    console.log('📊 Creating indexes for Theater collection...');
    
    // Create all indexes
    await Theater.createIndexes();
    
    console.log('✅ All indexes created successfully!');
    
    // List all indexes
    const indexes = await Theater.collection.getIndexes();
    console.log('\n📋 Current indexes:');
    Object.keys(indexes).forEach(indexName => {
      console.log(`  - ${indexName}:`, JSON.stringify(indexes[indexName]));
    });
    
    // Test query performance
    console.log('\n🔍 Testing query performance...');
    const startTime = Date.now();
    const theaters = await Theater.find({})
      .select('-password -__v')
      .sort({ createdAt: 1 })
      .limit(10)
      .lean();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Query completed in ${duration}ms`);
    console.log(`📊 Found ${theaters.length} theaters`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createIndexes();
