const mongoose = require('mongoose');
require('dotenv').config();
const roleService = require('../services/roleService');

/**
 * Migration Script: Add Kiosk Screen Role to All Existing Theaters
 * 
 * This script adds the default "Kiosk Screen" role to all theaters that don't have it yet.
 * Safe to run multiple times - it will skip theaters that already have the role.
 */

async function addKioskRoleToAllTheaters() {
  try {
    console.log('🔧 Starting migration: Add Kiosk Screen role to all theaters\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all theaters
    const theaters = await mongoose.connection.db.collection('theaters').find({}).toArray();
    console.log(`📊 Found ${theaters.length} theaters\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Process each theater
    for (const theater of theaters) {
      try {
        console.log(`\n📍 Processing: ${theater.name} (ID: ${theater._id})`);
        
        // Check if Kiosk Screen role already exists
        const rolesDoc = await mongoose.connection.db.collection('roles')
          .findOne({ theater: theater._id });
        
        if (rolesDoc) {
          const hasKioskRole = rolesDoc.roleList.some(role => 
            role.name === 'Kiosk Screen' && role.isDefault === true
          );
          
          if (hasKioskRole) {
            console.log('   ⏭️  Kiosk Screen role already exists - Skipping');
            skipCount++;
            continue;
          }
        }
        
        // Create the Kiosk Screen role
        console.log('   ➕ Creating Kiosk Screen role...');
        await roleService.createDefaultKioskRole(theater._id, theater.name);
        console.log('   ✅ Kiosk Screen role created successfully');
        successCount++;
        
      } catch (error) {
        console.error(`   ❌ Error processing theater ${theater.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Theaters: ${theaters.length}`);
    console.log(`✅ Successfully Added: ${successCount}`);
    console.log(`⏭️  Skipped (Already Exists): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));
    
    if (successCount > 0) {
      console.log('\n✨ Migration completed successfully!');
      console.log(`${successCount} theater(s) now have the Kiosk Screen role.`);
    } else if (skipCount === theaters.length) {
      console.log('\n✨ All theaters already have the Kiosk Screen role - No changes needed.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the migration
addKioskRoleToAllTheaters()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
