/**
 * Migration Script: Add Default Roles to Existing Theaters
 * 
 * This script adds the default "Theater Admin" and "Kiosk Screen" roles 
 * to all existing theaters that don't have them yet.
 * 
 * Run with: node add-default-roles-to-existing-theaters.js
 */

const mongoose = require('mongoose');
const Theater = require('./models/Theater');
const RoleArray = require('./models/RoleArray');
const roleService = require('./services/roleService');
require('dotenv').config();

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function addDefaultRolesToExistingTheaters() {
  try {
    console.log('\n🎭 Starting migration: Add default roles to existing theaters...\n');
    
    // Get all active theaters
    const theaters = await Theater.find({ isActive: true }).lean();
    console.log(`📊 Found ${theaters.length} active theaters\n`);
    
    if (theaters.length === 0) {
      console.log('ℹ️  No theaters found. Nothing to migrate.');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const theater of theaters) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🎬 Processing: ${theater.name} (ID: ${theater._id})`);
      console.log(`${'='.repeat(60)}`);
      
      try {
        // Find or create roles document for this theater
        let rolesDoc = await RoleArray.findOrCreateByTheater(theater._id);
        
        // Check existing roles
        const hasTheaterAdmin = rolesDoc.roleList.some(role => 
          role.name === 'Theater Admin' && role.isDefault === true
        );
        const hasKioskScreen = rolesDoc.roleList.some(role => 
          role.name === 'Kiosk Screen' && role.isDefault === true
        );
        
        console.log(`\n📋 Current Roles Status:`);
        console.log(`   • Theater Admin: ${hasTheaterAdmin ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`   • Kiosk Screen:  ${hasKioskScreen ? '✅ EXISTS' : '❌ MISSING'}`);
        
        let rolesAdded = [];
        
        // Add Theater Admin role if missing
        if (!hasTheaterAdmin) {
          console.log(`\n➕ Creating "Theater Admin" role...`);
          try {
            const theaterAdminRole = await roleService.createDefaultTheaterAdminRole(
              theater._id,
              theater.name
            );
            console.log(`   ✅ Theater Admin role created successfully`);
            console.log(`      Role ID: ${theaterAdminRole._id}`);
            console.log(`      Permissions: ${theaterAdminRole.permissions.length} pages`);
            rolesAdded.push('Theater Admin');
          } catch (roleError) {
            console.error(`   ❌ Failed to create Theater Admin role:`, roleError.message);
            throw roleError;
          }
        } else {
          console.log(`   ℹ️  Theater Admin role already exists - skipping`);
        }
        
        // Add Kiosk Screen role if missing
        if (!hasKioskScreen) {
          console.log(`\n➕ Creating "Kiosk Screen" role...`);
          try {
            const kioskRole = await roleService.createDefaultKioskRole(
              theater._id,
              theater.name
            );
            console.log(`   ✅ Kiosk Screen role created successfully`);
            console.log(`      Role ID: ${kioskRole._id}`);
            console.log(`      Permissions: ${kioskRole.permissions.length} pages`);
            rolesAdded.push('Kiosk Screen');
          } catch (roleError) {
            console.error(`   ❌ Failed to create Kiosk Screen role:`, roleError.message);
            throw roleError;
          }
        } else {
          console.log(`   ℹ️  Kiosk Screen role already exists - skipping`);
        }
        
        // Summary for this theater
        if (rolesAdded.length > 0) {
          console.log(`\n✅ SUCCESS: Added ${rolesAdded.length} role(s) to ${theater.name}`);
          console.log(`   Roles added: ${rolesAdded.join(', ')}`);
          successCount++;
        } else {
          console.log(`\n⏭️  SKIPPED: ${theater.name} already has all default roles`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`\n❌ ERROR: Failed to process ${theater.name}`);
        console.error(`   Error: ${error.message}`);
        errorCount++;
      }
    }
    
    // Final summary
    console.log(`\n\n${'='.repeat(60)}`);
    console.log(`📊 MIGRATION COMPLETE - SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Theaters:      ${theaters.length}`);
    console.log(`Successfully Updated: ${successCount} theaters`);
    console.log(`Skipped (No Changes): ${skippedCount} theaters`);
    console.log(`Failed:              ${errorCount} theaters`);
    console.log(`${'='.repeat(60)}\n`);
    
    if (errorCount > 0) {
      console.log('⚠️  Some theaters failed to update. Check the errors above.');
    } else if (successCount > 0) {
      console.log('✅ All missing default roles have been added successfully!');
    } else {
      console.log('ℹ️  All theaters already have their default roles.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

async function verifyResults() {
  try {
    console.log('\n🔍 Verifying results...\n');
    
    const theaters = await Theater.find({ isActive: true }).lean();
    
    for (const theater of theaters) {
      const rolesDoc = await RoleArray.findOne({ theater: theater._id }).lean();
      
      if (!rolesDoc) {
        console.log(`⚠️  ${theater.name}: No roles document found`);
        continue;
      }
      
      const theaterAdminRole = rolesDoc.roleList.find(r => r.name === 'Theater Admin' && r.isDefault);
      const kioskRole = rolesDoc.roleList.find(r => r.name === 'Kiosk Screen' && r.isDefault);
      
      console.log(`${theater.name}:`);
      console.log(`  • Total Roles: ${rolesDoc.roleList.length}`);
      console.log(`  • Theater Admin: ${theaterAdminRole ? '✅' : '❌'}`);
      console.log(`  • Kiosk Screen:  ${kioskRole ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function main() {
  try {
    // Connect to database
    await connectDB();
    
    // Run migration
    await addDefaultRolesToExistingTheaters();
    
    // Verify results
    await verifyResults();
    
    console.log('\n✅ Script completed successfully!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
