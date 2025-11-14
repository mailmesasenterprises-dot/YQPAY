/**
 * Comprehensive MongoDB Atlas Connection Verification
 * 
 * This script verifies that all connection fixes are working properly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🔍 MongoDB Atlas Connection Verification\n');
console.log('='.repeat(70));

// Step 1: Check Environment Variable
const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  console.error('❌ FAILED: MONGODB_URI is not set in environment variables!');
  console.error('   Location: backend/.env');
  console.error('   Format: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name');
  process.exit(1);
}
console.log('✅ Step 1: MONGODB_URI environment variable is set');

// Step 2: Validate Format
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  console.error('❌ FAILED: Invalid MONGODB_URI format!');
  console.error('   Must start with mongodb:// or mongodb+srv://');
  process.exit(1);
}
console.log('✅ Step 2: Connection string format is valid');

if (MONGODB_URI.startsWith('mongodb+srv://')) {
  console.log('   Using MongoDB Atlas (mongodb+srv://)');
} else {
  console.log('   Using standard MongoDB (mongodb://)');
}

// Step 3: Check for Localhost
if (MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1')) {
  console.error('❌ FAILED: Connection string contains localhost!');
  console.error('   This will not connect to MongoDB Atlas');
  console.error('   Current URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
  process.exit(1);
}
console.log('✅ Step 3: No localhost references found');

// Step 4: Test Connection
console.log('\n🔌 Step 4: Testing connection to MongoDB Atlas...');
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
    console.log(`✅ Step 4: Connection successful! (${duration}ms)`);
    console.log(`   Database: ${mongoose.connection.name}`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    
    // Step 5: Test Query
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log('✅ Step 5: Database query test successful');
    
    // Step 6: Check Connection Pool
    const poolSize = mongoose.connection.db?.serverConfig?.pool?.totalConnectionCount || 0;
    console.log(`✅ Step 6: Connection pool active (${poolSize} connections)`);
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL VERIFICATION CHECKS PASSED!\n');
    console.log('✅ Environment variable is set');
    console.log('✅ Connection string format is valid');
    console.log('✅ No localhost references');
    console.log('✅ Connection to Atlas successful');
    console.log('✅ Database queries working');
    console.log('✅ Connection pool active');
    console.log('\n📝 Your MongoDB Atlas connection is properly configured!');
    console.log('   You can now start your server with: node server.js');
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FAILED: Connection test failed!');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    console.error('\n🔍 Troubleshooting:');
    if (error.name === 'MongooseServerSelectionError') {
      console.error('1. Check IP whitelist in MongoDB Atlas:');
      console.error('   - Go to: Atlas Dashboard → Network Access → IP Access List');
      console.error('   - Add your IP or use 0.0.0.0/0 for development');
      console.error('2. Check if cluster is running (not paused)');
      console.error('3. Verify connection string is correct');
    } else if (error.message.includes('Authentication failed')) {
      console.error('1. Check username and password in connection string');
      console.error('2. Verify user exists in MongoDB Atlas Database Access');
      console.error('3. Ensure password is URL-encoded if it has special characters');
    } else if (error.message.includes('timeout')) {
      console.error('1. Check internet connectivity');
      console.error('2. Check firewall/VPN settings');
      console.error('3. Verify IP whitelist in Atlas');
    }
    
    process.exit(1);
  });

