/**
 * MongoDB Atlas Connection Diagnostic Script
 * 
 * This script tests your MongoDB Atlas connection and provides
 * detailed diagnostics to help identify connection issues.
 * 
 * Usage: node backend/test-mongodb-connection.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🔍 MongoDB Atlas Connection Diagnostic Tool\n');
console.log('='.repeat(60));

// Step 1: Check if MONGODB_URI is set
const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in environment variables!');
  console.error('\nSolution:');
  console.error('1. Create backend/.env file if it doesn\'t exist');
  console.error('2. Add: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name');
  console.error('3. Replace username, password, cluster, and database_name with your values');
  process.exit(1);
}

console.log('✅ MONGODB_URI is set');
console.log('   URI format:', MONGODB_URI.startsWith('mongodb+srv://') ? 'mongodb+srv:// (Atlas)' : 
            MONGODB_URI.startsWith('mongodb://') ? 'mongodb:// (Standard)' : '❌ Invalid format');

// Step 2: Validate connection string format
console.log('\n📋 Connection String Analysis:');

if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  console.error('❌ Invalid connection string format!');
  console.error('   Must start with mongodb:// or mongodb+srv://');
  process.exit(1);
}

// Check for common issues
const issues = [];

// Check for multiple @ symbols (password encoding issue)
const atCount = (MONGODB_URI.match(/@/g) || []).length;
if (atCount > 1) {
  issues.push('Multiple @ symbols detected - password might need URL encoding');
}

// Check if database name is included
const parts = MONGODB_URI.split('/');
if (parts.length < 4 || !parts[3] || parts[3].trim() === '') {
  issues.push('Database name might be missing');
}

// Check for special characters that might need encoding
if (MONGODB_URI.includes('@') && MONGODB_URI.split('@')[0].includes(':')) {
  const credentials = MONGODB_URI.split('@')[0].split('://')[1];
  const password = credentials.split(':')[1];
  if (password && (password.includes('@') || password.includes(':') || password.includes('/'))) {
    issues.push('Password contains special characters - should be URL-encoded');
  }
}

if (issues.length > 0) {
  console.warn('⚠️  Potential issues found:');
  issues.forEach((issue, i) => {
    console.warn(`   ${i + 1}. ${issue}`);
  });
} else {
  console.log('✅ Connection string format looks good');
}

// Step 3: Attempt connection
console.log('\n🔌 Attempting to connect to MongoDB Atlas...');
console.log('   (This may take up to 30 seconds)');

const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 120000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  retryWrites: true,
  retryReads: true,
};

const startTime = Date.now();

mongoose.connect(MONGODB_URI, connectionOptions)
  .then(() => {
    const duration = Date.now() - startTime;
    console.log('\n✅ Connection successful!');
    console.log(`   Connection time: ${duration}ms`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Ready state: ${mongoose.connection.readyState} (1 = connected)`);
    
    // Test a simple query
    console.log('\n🧪 Testing database query...');
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log('✅ Database ping successful - connection is working!');
    console.log('\n🎉 All checks passed! Your MongoDB Atlas connection is working correctly.');
    process.exit(0);
  })
  .catch((error) => {
    const duration = Date.now() - startTime;
    console.error('\n❌ Connection failed!');
    console.error(`   Attempt duration: ${duration}ms`);
    console.error(`   Error name: ${error.name}`);
    console.error(`   Error message: ${error.message}`);
    
    // Provide specific guidance based on error
    console.error('\n🔍 Diagnostic Information:');
    
    if (error.name === 'MongooseServerSelectionError') {
      console.error('\n📌 This is a server selection error. Common causes:');
      console.error('   1. IP address not whitelisted in MongoDB Atlas');
      console.error('      → Go to: Atlas Dashboard → Network Access → IP Access List');
      console.error('      → Add your current IP or use 0.0.0.0/0 for development');
      console.error('   2. Cluster is paused (free tier auto-pauses after 1 hour)');
      console.error('      → Go to: Atlas Dashboard → Database → Clusters');
      console.error('      → Click "Resume" if cluster is paused');
      console.error('   3. Wrong connection string (cluster hostname incorrect)');
      console.error('      → Verify connection string in Atlas Dashboard → Connect → Connect your application');
      console.error('   4. Network/firewall blocking connection');
      console.error('      → Check firewall settings');
      console.error('      → Try disabling VPN if using one');
    } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.error('\n📌 This is an authentication error. Common causes:');
      console.error('   1. Wrong username or password');
      console.error('      → Verify credentials in Atlas Dashboard → Database Access');
      console.error('   2. Password contains special characters that need URL encoding');
      console.error('      → Special chars (@, :, /, ?, #, [, ]) must be URL-encoded');
      console.error('      → Example: @ becomes %40');
      console.error('   3. User doesn\'t exist or was deleted');
      console.error('      → Check Atlas Dashboard → Database Access → Database Users');
      console.error('   4. User doesn\'t have database access permissions');
      console.error('      → Verify user has "Read and write to any database" or specific database access');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n📌 This is a DNS/network error. Common causes:');
      console.error('   1. Internet connectivity issue');
      console.error('      → Check your internet connection');
      console.error('   2. Wrong cluster hostname');
      console.error('      → Verify cluster name in connection string matches Atlas');
      console.error('   3. DNS resolution failure');
      console.error('      → Try: nslookup cluster0.xxxxx.mongodb.net');
      console.error('   4. Firewall/VPN blocking DNS or connections');
      console.error('      → Check firewall settings');
    } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
      console.error('\n📌 This is a timeout error. Common causes:');
      console.error('   1. IP not whitelisted (most common)');
      console.error('      → Add IP to Atlas Network Access whitelist');
      console.error('   2. Cluster is paused');
      console.error('      → Resume cluster in Atlas Dashboard');
      console.error('   3. Network latency too high');
      console.error('      → Check internet connection speed');
      console.error('   4. Firewall blocking connection');
      console.error('      → Check firewall/VPN settings');
    } else {
      console.error('\n📌 General connection error. Check:');
      console.error('   1. MongoDB Atlas cluster status');
      console.error('   2. Network connectivity');
      console.error('   3. Connection string format');
      console.error('   4. IP whitelist in Atlas');
    }
    
    console.error('\n📚 For more details, see: MONGODB_ATLAS_CONNECTION_ANALYSIS.md');
    process.exit(1);
  });

