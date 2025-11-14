/**
 * Check MongoDB Connection Status
 * This will verify if MongoDB is actually connected
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🔍 Checking MongoDB Connection Status\n');
console.log('='.repeat(70));

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set!');
  process.exit(1);
}

console.log('📋 Connection Info:');
console.log('   URI:', MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
console.log('   Format:', MONGODB_URI.startsWith('mongodb+srv://') ? 'Atlas' : 'Standard');

// Check if already connected
if (mongoose.connection.readyState === 1) {
  console.log('\n✅ Already connected to MongoDB!');
  console.log('   Database:', mongoose.connection.name);
  console.log('   Host:', mongoose.connection.host);
  console.log('   Ready State:', mongoose.connection.readyState, '(1 = connected)');
  
  // Test query
  mongoose.connection.db.admin().ping()
    .then(() => {
      console.log('✅ Database ping successful');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Database ping failed:', err.message);
      process.exit(1);
    });
} else {
  console.log('\n🔄 Not connected. Attempting connection...');
  console.log('   Current state:', mongoose.connection.readyState);
  console.log('   States: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting');
  
  const connectionOptions = {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 120000,
    connectTimeoutMS: 30000,
  };
  
  mongoose.connect(MONGODB_URI, connectionOptions)
    .then(() => {
      console.log('\n✅ Connected successfully!');
      console.log('   Database:', mongoose.connection.name);
      console.log('   Host:', mongoose.connection.host);
      console.log('   Ready State:', mongoose.connection.readyState);
      
      return mongoose.connection.db.admin().ping();
    })
    .then(() => {
      console.log('✅ Database ping successful');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Connection failed!');
      console.error('   Error:', error.name);
      console.error('   Message:', error.message);
      
      if (error.name === 'MongooseServerSelectionError') {
        console.error('\n🔍 This is a server selection error:');
        console.error('   1. Check IP whitelist in MongoDB Atlas');
        console.error('   2. Check if cluster is running (not paused)');
        console.error('   3. Verify connection string');
      }
      
      process.exit(1);
    });
}

