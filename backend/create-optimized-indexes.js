require('dotenv').config();
const mongoose = require('mongoose');

async function createOptimizedIndexes() {
  try {
    console.log('🔧 Creating optimized indexes for theaters collection...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('theaters');
    
    // Drop old indexes that might be causing issues
    console.log('🗑️  Dropping old/redundant indexes...\n');
    
    try {
      await collection.dropIndex('isActive_1_createdAt_-1');
      console.log('✅ Dropped: isActive_1_createdAt_-1 (wrong sort order)');
    } catch (err) {
      console.log('ℹ️  Index isActive_1_createdAt_-1 does not exist or already dropped');
    }
    
    try {
      await collection.dropIndex('createdAt_-1');
      console.log('✅ Dropped: createdAt_-1 (wrong sort order)');
    } catch (err) {
      console.log('ℹ️  Index createdAt_-1 does not exist or already dropped');
    }
    
    // Create optimized indexes
    console.log('\n📊 Creating optimized indexes...\n');
    
    // 1. Compound index for common query pattern: { isActive: true } sorted by createdAt ascending
    try {
      await collection.createIndex(
        { isActive: 1, createdAt: 1 },
        { name: 'isActive_1_createdAt_1_optimized', background: true }
      );
      console.log('✅ Created: { isActive: 1, createdAt: 1 } - Optimized for pagination queries');
    } catch (err) {
      console.log('⚠️  Index already exists or error:', err.message);
    }
    
    // 2. Text index for search functionality
    try {
      await collection.createIndex(
        { name: 'text', username: 'text', email: 'text' },
        { name: 'search_text_index', background: true }
      );
      console.log('✅ Created: Text index on name, username, email - Optimized for search');
    } catch (err) {
      console.log('⚠️  Text index already exists or error:', err.message);
    }
    
    // 3. Compound index for search with active status
    try {
      await collection.createIndex(
        { isActive: 1, name: 1 },
        { name: 'isActive_1_name_1', background: true }
      );
      console.log('✅ Created: { isActive: 1, name: 1 } - Optimized for filtered search');
    } catch (err) {
      console.log('⚠️  Index already exists or error:', err.message);
    }
    
    // Test query performance after creating indexes
    console.log('\n⏱️  Testing query performance after optimization...\n');
    
    const startTime = Date.now();
    const theaters = await collection
      .find({ isActive: true })
      .sort({ createdAt: 1 })
      .limit(10)
      .toArray();
    const queryTime = Date.now() - startTime;
    
    console.log(`Query time: ${queryTime}ms`);
    console.log(`Results: ${theaters.length} theaters`);
    
    if (queryTime < 100) {
      console.log('✅ EXCELLENT: Query performance improved to <100ms');
    } else if (queryTime < 500) {
      console.log('✅ GOOD: Query performance improved to <500ms');
    } else if (queryTime < 1000) {
      console.log('⚠️  OK: Query performance is <1000ms but can be better');
    } else {
      console.log('❌ STILL SLOW: Query is still >1000ms - there might be other issues');
    }
    
    // Verify indexes were created
    console.log('\n📋 Current indexes after optimization:\n');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name} - ${JSON.stringify(index.key)}`);
    });
    
    // Run explain to verify index usage
    console.log('\n🔬 Verifying index usage:\n');
    const explainResult = await collection
      .find({ isActive: true })
      .sort({ createdAt: 1 })
      .limit(10)
      .explain('executionStats');
    
    const indexUsed = explainResult.executionStats.executionStages.indexName || 
                      explainResult.executionStats.executionStages.inputStage?.indexName ||
                      'NONE';
    
    console.log(`Index used: ${indexUsed}`);
    console.log(`Execution time: ${explainResult.executionStats.executionTimeMillis}ms`);
    console.log(`Documents examined: ${explainResult.executionStats.totalDocsExamined}`);
    
    if (indexUsed !== 'NONE') {
      console.log('\n✅ SUCCESS: Query is now using an index!');
    } else {
      console.log('\n⚠️  WARNING: Query is still not using an index');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Index optimization complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Refresh your browser to see the improved performance');
    console.log('2. Page load time should now be <1 second');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createOptimizedIndexes();
