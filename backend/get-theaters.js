/**
 * Get and display all theaters from MongoDB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

console.log('🎭 Fetching Theaters from MongoDB\n');
console.log('='.repeat(70));

const MONGODB_URI = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not set!');
  process.exit(1);
}

const connectionOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 120000,
  connectTimeoutMS: 30000,
};

mongoose.connect(MONGODB_URI, connectionOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    console.log('   Database:', mongoose.connection.name);
    console.log('');
    
    // Import Theater model
    const Theater = require('./models/Theater');
    
    // Fetch all theaters
    return Theater.find({}).lean().maxTimeMS(20000);
  })
  .then((theaters) => {
    console.log(`📊 Found ${theaters.length} theaters:\n`);
    
    if (theaters.length === 0) {
      console.log('   ⚠️  No theaters found in database');
      mongoose.disconnect();
      process.exit(0);
    }
    
    // Display each theater
    theaters.forEach((theater, index) => {
      console.log(`${'='.repeat(70)}`);
      console.log(`🎭 Theater #${index + 1}`);
      console.log(`${'='.repeat(70)}`);
      console.log('ID:', theater._id);
      console.log('Name:', theater.name || 'N/A');
      console.log('Username:', theater.username || 'N/A');
      console.log('Email:', theater.email || 'N/A');
      console.log('Phone:', theater.phone || 'N/A');
      console.log('Address:', theater.address || 'N/A');
      console.log('Is Active:', theater.isActive ? '✅ Yes' : '❌ No');
      console.log('Is Available:', theater.isAvailable ? '✅ Yes' : '❌ No');
      console.log('Status:', theater.status || 'N/A');
      console.log('Created At:', theater.createdAt ? new Date(theater.createdAt).toLocaleString() : 'N/A');
      console.log('Updated At:', theater.updatedAt ? new Date(theater.updatedAt).toLocaleString() : 'N/A');
      
      // Additional fields if they exist
      if (theater.location) {
        console.log('Location:', JSON.stringify(theater.location, null, 2));
      }
      if (theater.settings) {
        console.log('Settings:', JSON.stringify(theater.settings, null, 2));
      }
      if (theater.features) {
        console.log('Features:', JSON.stringify(theater.features, null, 2));
      }
      
      console.log('');
    });
    
    // Summary
    console.log('='.repeat(70));
    console.log('📊 Summary:');
    console.log(`   Total Theaters: ${theaters.length}`);
    console.log(`   Active Theaters: ${theaters.filter(t => t.isActive).length}`);
    console.log(`   Inactive Theaters: ${theaters.filter(t => !t.isActive).length}`);
    console.log(`   Available Theaters: ${theaters.filter(t => t.isAvailable).length}`);
    console.log('='.repeat(70));
    
    // Display as JSON for easy copy
    console.log('\n📋 JSON Format (for reference):\n');
    console.log(JSON.stringify(theaters, null, 2));
    
    mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fetching theaters:', error.message);
    console.error('   Error name:', error.name);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    mongoose.disconnect();
    process.exit(1);
  });

