require('dotenv').config();
const mongoose = require('mongoose');

async function analyzePerformance() {
  try {
    console.log('🔍 Analyzing database performance...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // 1. Check theaters collection
    console.log('📊 THEATERS COLLECTION ANALYSIS\n');
    console.log('='.repeat(60));
    
    const theaterCount = await db.collection('theaters').countDocuments();
    console.log(`Total theaters: ${theaterCount}`);
    
    // Test query performance
    console.log('\n⏱️  Testing query performance...');
    
    const startTime = Date.now();
    const theaters = await db.collection('theaters')
      .find({ isActive: true })
      .sort({ createdAt: 1 })
      .limit(10)
      .toArray();
    const queryTime = Date.now() - startTime;
    
    console.log(`Query time: ${queryTime}ms`);
    console.log(`Results: ${theaters.length} theaters`);
    
    if (queryTime > 1000) {
      console.log('⚠️  WARNING: Query is slow! (>1000ms)');
    } else if (queryTime > 500) {
      console.log('⚠️  Query is moderately slow (>500ms)');
    } else if (queryTime > 100) {
      console.log('ℹ️  Query performance is acceptable (>100ms)');
    } else {
      console.log('✅ Query performance is good (<100ms)');
    }
    
    // 2. Check indexes
    console.log('\n📋 CURRENT INDEXES:\n');
    const indexes = await db.collection('theaters').indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}`);
      console.log(`   Keys: ${JSON.stringify(index.key)}`);
      console.log(`   Unique: ${index.unique || false}`);
    });
    
    // 3. Check for missing recommended indexes
    console.log('\n💡 RECOMMENDED INDEXES:\n');
    
    const hasIsActiveIndex = indexes.some(idx => idx.key.isActive);
    const hasCreatedAtIndex = indexes.some(idx => idx.key.createdAt);
    const hasNameIndex = indexes.some(idx => idx.key.name);
    const hasCompoundIndex = indexes.some(idx => idx.key.isActive && idx.key.createdAt);
    
    if (!hasIsActiveIndex) {
      console.log('❌ MISSING: Index on { isActive: 1 }');
    } else {
      console.log('✅ Index on { isActive: 1 } exists');
    }
    
    if (!hasCreatedAtIndex) {
      console.log('❌ MISSING: Index on { createdAt: 1 }');
    } else {
      console.log('✅ Index on { createdAt: 1 } exists');
    }
    
    if (!hasNameIndex) {
      console.log('⚠️  RECOMMENDED: Index on { name: 1 } for text search');
    } else {
      console.log('✅ Index on { name: 1 } exists');
    }
    
    if (!hasCompoundIndex) {
      console.log('⚠️  RECOMMENDED: Compound index on { isActive: 1, createdAt: 1 } for better query performance');
    } else {
      console.log('✅ Compound index on { isActive: 1, createdAt: 1 } exists');
    }
    
    // 4. Test with explain() to see query execution plan
    console.log('\n🔬 QUERY EXECUTION PLAN:\n');
    const explainResult = await db.collection('theaters')
      .find({ isActive: true })
      .sort({ createdAt: 1 })
      .limit(10)
      .explain('executionStats');
    
    console.log(`Execution time: ${explainResult.executionStats.executionTimeMillis}ms`);
    console.log(`Documents examined: ${explainResult.executionStats.totalDocsExamined}`);
    console.log(`Documents returned: ${explainResult.executionStats.nReturned}`);
    console.log(`Index used: ${explainResult.executionStats.executionStages.indexName || 'NONE (COLLECTION SCAN)'}`);
    
    if (!explainResult.executionStats.executionStages.indexName) {
      console.log('\n⚠️  WARNING: Query is not using any index! This causes slow performance.');
      console.log('   Solution: Create indexes on isActive and createdAt fields');
    }
    
    // 5. Network latency test
    console.log('\n🌐 NETWORK LATENCY TEST:\n');
    const pingStart = Date.now();
    await db.admin().ping();
    const pingTime = Date.now() - pingStart;
    console.log(`Database ping: ${pingTime}ms`);
    
    if (pingTime > 500) {
      console.log('⚠️  High network latency detected (>500ms)');
      console.log('   This might be due to:');
      console.log('   - Slow internet connection');
      console.log('   - Database server location is far from your location');
      console.log('   - Network issues');
    } else if (pingTime > 100) {
      console.log('ℹ️  Moderate network latency (>100ms)');
    } else {
      console.log('✅ Good network latency (<100ms)');
    }
    
    // 6. Summary and recommendations
    console.log('\n' + '='.repeat(60));
    console.log('📝 PERFORMANCE SUMMARY & RECOMMENDATIONS\n');
    
    const totalTime = queryTime + pingTime;
    console.log(`Expected page load time: ~${totalTime}ms (query + network)`);
    
    if (totalTime > 3000) {
      console.log('\n🔴 CRITICAL: Page load time is very slow (>3 seconds)\n');
      console.log('Recommended actions:');
      console.log('1. Create database indexes (see above)');
      console.log('2. Enable query caching in frontend');
      console.log('3. Consider using a CDN or closer database region');
      console.log('4. Implement lazy loading for non-critical data');
    } else if (totalTime > 1000) {
      console.log('\n🟡 WARNING: Page load time is slow (>1 second)\n');
      console.log('Recommended actions:');
      console.log('1. Create database indexes if missing');
      console.log('2. Enable frontend caching');
    } else {
      console.log('\n🟢 GOOD: Page load time is acceptable\n');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzePerformance();
