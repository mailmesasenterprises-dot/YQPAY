/**
 * Comprehensive MongoDB Connection Diagnostic
 * This will help identify exactly why the connection is failing
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🔍 MongoDB Connection Diagnostic\n');
console.log('='.repeat(70));

// Step 1: Check .env file
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ CRITICAL: .env file does not exist!');
  console.error(`   Expected location: ${envPath}`);
  process.exit(1);
}
console.log('✅ Step 1: .env file exists');

// Step 2: Check MONGODB_URI
const MONGODB_URI = process.env.MONGODB_URI?.trim();
if (!MONGODB_URI) {
  console.error('❌ CRITICAL: MONGODB_URI is not set!');
  console.error('   Check your .env file');
  process.exit(1);
}
console.log('✅ Step 2: MONGODB_URI is set');

// Step 3: Show connection string (masked)
const maskedUri = MONGODB_URI.replace(/:[^:@]+@/, ':****@');
console.log(`   Connection string: ${maskedUri.substring(0, 60)}...`);

// Step 4: Check for localhost
if (MONGODB_URI.includes('localhost') || MONGODB_URI.includes('127.0.0.1')) {
  console.error('❌ CRITICAL: Connection string contains localhost!');
  console.error('   This will NOT connect to MongoDB Atlas');
  console.error('   Update your .env file with Atlas connection string');
  process.exit(1);
}
console.log('✅ Step 3: No localhost references');

// Step 5: Validate format
if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
  console.error('❌ CRITICAL: Invalid connection string format!');
  process.exit(1);
}
console.log('✅ Step 4: Connection string format is valid');

// Step 6: Test connection with detailed logging
console.log('\n🔌 Step 5: Attempting connection...');
console.log('   This may take up to 30 seconds...\n');

// Set up connection event listeners BEFORE connecting
mongoose.connection.on('connecting', () => {
  console.log('   📡 Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('   ✅ Connected to MongoDB!');
  console.log(`   Database: ${mongoose.connection.name}`);
  console.log(`   Host: ${mongoose.connection.host}`);
});

mongoose.connection.on('error', (err) => {
  console.error('   ❌ Connection error:', err.message);
  console.error('   Error name:', err.name);
});

mongoose.connection.on('disconnected', () => {
  console.log('   ⚠️  Disconnected from MongoDB');
});

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
    console.log(`\n✅ Step 5: Connection successful! (${duration}ms)`);
    console.log(`   Ready State: ${mongoose.connection.readyState} (1 = connected)`);
    
    // Test query
    return mongoose.connection.db.admin().ping();
  })
  .then(() => {
    console.log('✅ Step 6: Database query test successful');
    
    console.log('\n' + '='.repeat(70));
    console.log('🎉 ALL CHECKS PASSED!\n');
    console.log('✅ Your MongoDB Atlas connection is working correctly!');
    console.log('✅ The connection test succeeded');
    console.log('\n📝 If your server is still not connecting:');
    console.log('   1. Check server startup logs for errors');
    console.log('   2. Verify the server is using the same .env file');
    console.log('   3. Check if there are multiple .env files');
    console.log('   4. Restart the server after fixing any issues');
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    const duration = Date.now() - startTime;
    console.error(`\n❌ Step 5: Connection FAILED after ${duration}ms`);
    console.error('   Error name:', error.name);
    console.error('   Error message:', error.message);
    
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    
    console.error('\n' + '='.repeat(70));
    console.error('🔍 TROUBLESHOOTING GUIDE:\n');
    
    if (error.name === 'MongooseServerSelectionError') {
      console.error('❌ Server Selection Error - This means:');
      console.error('   1. IP address is NOT whitelisted in MongoDB Atlas');
      console.error('   2. Cluster might be paused');
      console.error('   3. Network connectivity issue');
      console.error('\n   SOLUTION:');
      console.error('   1. Go to: https://cloud.mongodb.com');
      console.error('   2. Navigate to: Network Access → IP Access List');
      console.error('   3. Click "Add IP Address"');
      console.error('   4. Add your current IP or use 0.0.0.0/0 (development only)');
      console.error('   5. Wait 1-2 minutes for changes to propagate');
      console.error('   6. Try connecting again');
    } else if (error.message.includes('Authentication failed') || error.message.includes('bad auth')) {
      console.error('❌ Authentication Error - This means:');
      console.error('   1. Wrong username or password');
      console.error('   2. User doesn\'t exist in Atlas');
      console.error('   3. Password has special characters that need URL encoding');
      console.error('\n   SOLUTION:');
      console.error('   1. Go to: Atlas Dashboard → Database Access');
      console.error('   2. Verify your user exists');
      console.error('   3. Reset password if needed');
      console.error('   4. Update MONGODB_URI in .env with correct credentials');
      console.error('   5. URL-encode special characters in password (@ → %40, etc.)');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('❌ DNS/Network Error - This means:');
      console.error('   1. Cannot resolve cluster hostname');
      console.error('   2. Internet connectivity issue');
      console.error('   3. Firewall blocking connection');
      console.error('\n   SOLUTION:');
      console.error('   1. Check internet connection');
      console.error('   2. Verify cluster hostname in connection string');
      console.error('   3. Check firewall/VPN settings');
      console.error('   4. Try: nslookup <cluster-hostname>');
    } else if (error.message.includes('timeout')) {
      console.error('❌ Timeout Error - This means:');
      console.error('   1. Connection took too long (>30 seconds)');
      console.error('   2. IP not whitelisted (most common)');
      console.error('   3. Network latency too high');
      console.error('\n   SOLUTION:');
      console.error('   1. Check IP whitelist in Atlas (most likely issue)');
      console.error('   2. Check internet connection speed');
      console.error('   3. Verify cluster is running (not paused)');
    } else {
      console.error('❌ Unknown Error');
      console.error('   Please check the error message above');
      console.error('   Common issues:');
      console.error('   - IP not whitelisted');
      console.error('   - Wrong credentials');
      console.error('   - Cluster paused');
      console.error('   - Network issues');
    }
    
    console.error('\n📝 Next Steps:');
    console.error('   1. Fix the issue identified above');
    console.error('   2. Run this diagnostic again: node diagnose-connection-issue.js');
    console.error('   3. Once connection test passes, start your server');
    
    process.exit(1);
  });

