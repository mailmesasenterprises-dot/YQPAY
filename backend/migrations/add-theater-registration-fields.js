/**
 * Migration Script: Add GST, FSSAI, and Unique Number fields to existing theaters
 * 
 * This script adds three new optional fields to all existing theater documents:
 * - gstNumber: GST registration number (15 characters)
 * - fssaiNumber: FSSAI license number (14 digits)
 * - uniqueNumber: Custom unique identifier
 * 
 * Usage: node migrations/add-theater-registration-fields.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function migrateTheaters() {
  try {
    console.log('🚀 Starting migration: Add theater registration fields...\n');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB\n');

    const Theater = mongoose.model('Theater', new mongoose.Schema({}, { strict: false }));
    
    // Get all theaters
    const theaters = await Theater.find({}).select('_id name gstNumber fssaiNumber uniqueNumber');
    console.log(`📊 Found ${theaters.length} theaters\n`);

    if (theaters.length === 0) {
      console.log('⚠️  No theaters found to migrate');
      await mongoose.disconnect();
      return;
    }

    // Check existing fields
    let theatersWithGST = 0;
    let theatersWithFSSAI = 0;
    let theatersWithUnique = 0;
    let theatersNeedingUpdate = 0;

    theaters.forEach(theater => {
      if (theater.gstNumber) theatersWithGST++;
      if (theater.fssaiNumber) theatersWithFSSAI++;
      if (theater.uniqueNumber) theatersWithUnique++;
      if (!theater.gstNumber && !theater.fssaiNumber && !theater.uniqueNumber) {
        theatersNeedingUpdate++;
      }
    });

    console.log('📈 Current Status:');
    console.log(`   Theaters with GST Number: ${theatersWithGST}`);
    console.log(`   Theaters with FSSAI Number: ${theatersWithFSSAI}`);
    console.log(`   Theaters with Unique Number: ${theatersWithUnique}`);
    console.log(`   Theaters needing field initialization: ${theatersNeedingUpdate}\n`);

    // Update theaters that don't have these fields
    const updateResult = await Theater.updateMany(
      {
        $or: [
          { gstNumber: { $exists: false } },
          { fssaiNumber: { $exists: false } },
          { uniqueNumber: { $exists: false } }
        ]
      },
      {
        $set: {
          gstNumber: null,
          fssaiNumber: null,
          uniqueNumber: null
        }
      }
    );

    console.log('✅ Migration completed successfully!');
    console.log(`   Theaters updated: ${updateResult.modifiedCount}`);
    console.log(`   Theaters matched: ${updateResult.matchedCount}\n`);

    // Show sample theater with new fields
    const sampleTheater = await Theater.findOne({}).select('name gstNumber fssaiNumber uniqueNumber').lean();
    if (sampleTheater) {
      console.log('📝 Sample Theater Document:');
      console.log(`   Name: ${sampleTheater.name}`);
      console.log(`   GST Number: ${sampleTheater.gstNumber || 'Not set'}`);
      console.log(`   FSSAI Number: ${sampleTheater.fssaiNumber || 'Not set'}`);
      console.log(`   Unique Number: ${sampleTheater.uniqueNumber || 'Not set'}`);
    }

    console.log('\n✨ All theaters now have the registration fields available!');
    console.log('   You can now add GST, FSSAI, and Unique numbers via:');
    console.log('   - Add Theater page (http://localhost:3000/add-theater)');
    console.log('   - Edit Theater modal in Theater List page\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run migration
migrateTheaters();
