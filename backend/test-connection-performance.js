/**
 * MongoDB Atlas Connection Performance Monitor
 * 
 * Tests connection performance multiple times and analyzes:
 * - Connection time consistency
 * - Connection pooling effectiveness
 * - Cluster region/location
 * - Network latency
 * 
 * Usage: node backend/test-connection-performance.js [iterations]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const iterations = parseInt(process.argv[2]) || 5;
const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set!');
  process.exit(1);
}

console.log('🔍 MongoDB Atlas Connection Performance Monitor\n');
console.log('='.repeat(70));
console.log(`📊 Running ${iterations} connection tests...\n`);

const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 120000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
};

const results = [];
let totalTime = 0;
let minTime = Infinity;
let maxTime = 0;

// Extract cluster info from URI
const uriMatch = MONGODB_URI.match(/mongodb\+srv:\/\/(?:[^:]+):(?:[^@]+)@([^/]+)/);
const clusterHost = uriMatch ? uriMatch[1] : 'unknown';

console.log(`🌐 Cluster Host: ${clusterHost}`);
console.log(`📦 Connection Pool Settings:`);
console.log(`   - Max Pool Size: ${connectionOptions.maxPoolSize}`);
console.log(`   - Min Pool Size: ${connectionOptions.minPoolSize}`);
console.log(`\n🔄 Starting tests...\n`);

async function testConnection(iteration) {
  const startTime = Date.now();
  
  try {
    // For first connection, establish new connection
    if (iteration === 1) {
      await mongoose.connect(MONGODB_URI, connectionOptions);
    } else {
      // For subsequent tests, check if connection is already established
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI, connectionOptions);
      } else {
        // Connection exists, just test it
        await mongoose.connection.db.admin().ping();
      }
    }
    
    const duration = Date.now() - startTime;
    results.push({
      iteration,
      duration,
      status: 'success',
      readyState: mongoose.connection.readyState,
    });
    
    totalTime += duration;
    minTime = Math.min(minTime, duration);
    maxTime = Math.max(maxTime, duration);
    
    console.log(`✅ Test ${iteration}/${iterations}: ${duration}ms (State: ${mongoose.connection.readyState})`);
    
    return duration;
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      iteration,
      duration,
      status: 'failed',
      error: error.message,
    });
    
    console.error(`❌ Test ${iteration}/${iterations}: Failed after ${duration}ms - ${error.message}`);
    return null;
  }
}

async function runTests() {
  try {
    // Run all tests
    for (let i = 1; i <= iterations; i++) {
      await testConnection(i);
      
      // Small delay between tests (except last one)
      if (i < iterations) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Get connection info
    const connectionInfo = {
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    };
    
    // Try to get server info (cluster region)
    let serverInfo = null;
    try {
      const admin = mongoose.connection.db.admin();
      const serverStatus = await admin.serverStatus();
      serverInfo = {
        version: serverStatus.version,
        host: serverStatus.host,
        uptime: serverStatus.uptime,
      };
    } catch (e) {
      // Server status might not be available
    }
    
    // Calculate statistics
    const successfulTests = results.filter(r => r.status === 'success');
    const failedTests = results.filter(r => r.status === 'failed');
    const avgTime = successfulTests.length > 0 
      ? totalTime / successfulTests.length 
      : 0;
    
    // Calculate standard deviation
    let variance = 0;
    if (successfulTests.length > 1) {
      const mean = avgTime;
      variance = successfulTests.reduce((sum, r) => {
        return sum + Math.pow(r.duration - mean, 2);
      }, 0) / successfulTests.length;
    }
    const stdDev = Math.sqrt(variance);
    
    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE ANALYSIS\n');
    
    console.log('📈 Connection Statistics:');
    console.log(`   Total Tests: ${iterations}`);
    console.log(`   Successful: ${successfulTests.length} ✅`);
    console.log(`   Failed: ${failedTests.length} ${failedTests.length > 0 ? '❌' : ''}`);
    console.log(`   Success Rate: ${((successfulTests.length / iterations) * 100).toFixed(1)}%`);
    
    if (successfulTests.length > 0) {
      console.log('\n⏱️  Timing Statistics:');
      console.log(`   Average: ${avgTime.toFixed(2)}ms`);
      console.log(`   Minimum: ${minTime}ms`);
      console.log(`   Maximum: ${maxTime}ms`);
      console.log(`   Range: ${(maxTime - minTime)}ms`);
      console.log(`   Std Deviation: ${stdDev.toFixed(2)}ms`);
      
      // Performance assessment
      console.log('\n🎯 Performance Assessment:');
      if (avgTime < 1000) {
        console.log('   ✅ Excellent - Connection time < 1 second');
      } else if (avgTime < 3000) {
        console.log('   ✅ Good - Connection time < 3 seconds');
      } else if (avgTime < 5000) {
        console.log('   ⚠️  Acceptable - Connection time < 5 seconds');
      } else if (avgTime < 10000) {
        console.log('   ⚠️  Slow - Connection time < 10 seconds');
      } else {
        console.log('   ❌ Very Slow - Connection time > 10 seconds');
      }
      
      // Consistency assessment
      const consistency = (stdDev / avgTime) * 100;
      console.log('\n📊 Consistency Analysis:');
      if (consistency < 10) {
        console.log('   ✅ Very Consistent - Low variance in connection times');
      } else if (consistency < 25) {
        console.log('   ✅ Consistent - Acceptable variance');
      } else if (consistency < 50) {
        console.log('   ⚠️  Inconsistent - High variance in connection times');
        console.log('   💡 This suggests network instability or cluster load variations');
      } else {
        console.log('   ❌ Highly Inconsistent - Very high variance');
        console.log('   💡 Check network stability and cluster region');
      }
      
      // Connection pooling analysis
      console.log('\n🔗 Connection Pooling Analysis:');
      const firstConnection = results[0]?.duration || 0;
      const subsequentConnections = results.slice(1).filter(r => r.status === 'success');
      
      if (subsequentConnections.length > 0) {
        const avgSubsequent = subsequentConnections.reduce((sum, r) => sum + r.duration, 0) / subsequentConnections.length;
        const improvement = ((firstConnection - avgSubsequent) / firstConnection) * 100;
        
        console.log(`   First Connection: ${firstConnection}ms`);
        console.log(`   Avg Subsequent: ${avgSubsequent.toFixed(2)}ms`);
        
        if (improvement > 50) {
          console.log(`   ✅ Pooling Working - ${improvement.toFixed(1)}% faster after first connection`);
        } else if (improvement > 20) {
          console.log(`   ✅ Pooling Effective - ${improvement.toFixed(1)}% improvement`);
        } else if (improvement > 0) {
          console.log(`   ⚠️  Pooling Minimal - Only ${improvement.toFixed(1)}% improvement`);
        } else {
          console.log(`   ⚠️  No Pooling Benefit - Subsequent connections slower`);
        }
      }
    }
    
    // Connection info
    console.log('\n🌐 Connection Information:');
    console.log(`   Database: ${connectionInfo.name}`);
    console.log(`   Host: ${connectionInfo.host}`);
    if (connectionInfo.port) {
      console.log(`   Port: ${connectionInfo.port}`);
    }
    console.log(`   Ready State: ${connectionInfo.readyState} (1 = connected)`);
    
    // Cluster region detection
    console.log('\n🌍 Cluster Region Detection:');
    if (clusterHost.includes('.mongodb.net')) {
      // Try to extract region from hostname
      const hostParts = clusterHost.split('.');
      if (hostParts.length > 2) {
        console.log(`   Cluster Hostname: ${clusterHost}`);
        console.log(`   💡 Hostname suggests: ${hostParts[0]} cluster`);
      }
      
      // Check if we can determine region from connection
      if (serverInfo) {
        console.log(`   MongoDB Version: ${serverInfo.version}`);
        console.log(`   Server Uptime: ${(serverInfo.uptime / 3600).toFixed(1)} hours`);
      }
      
      console.log(`\n   📍 To check exact region:`);
      console.log(`   1. Go to MongoDB Atlas Dashboard`);
      console.log(`   2. Navigate to: Database → Clusters`);
      console.log(`   3. Click on your cluster`);
      console.log(`   4. Check "Cloud Provider & Region" section`);
      console.log(`   5. Ensure region is close to your server location`);
    } else {
      console.log(`   ⚠️  Could not determine cluster region from hostname`);
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (avgTime > 5000) {
      console.log('   ⚠️  Connection time is slow (>5s):');
      console.log('      - Check if cluster region matches your server region');
      console.log('      - Consider moving cluster to closer region');
      console.log('      - Check network latency to cluster');
    }
    
    const consistencyPercent = successfulTests.length > 0 ? (stdDev / avgTime) * 100 : 0;
    if (consistencyPercent > 25) {
      console.log('   ⚠️  Connection times are inconsistent:');
      console.log('      - Check network stability');
      console.log('      - Monitor cluster performance in Atlas Dashboard');
      console.log('      - Consider upgrading cluster tier if on free tier');
    }
    
    if (successfulTests.length === iterations) {
      console.log('   ✅ All connections successful - MongoDB Atlas is working correctly!');
    }
    
    console.log('\n' + '='.repeat(70));
    
    // Cleanup
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n🔌 Disconnected from MongoDB');
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

