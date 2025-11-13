const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Verification Script: Check Theater Roles
 * 
 * This script verifies that all theaters have both:
 * 1. Theater Admin role
 * 2. Kiosk Screen role
 */

async function verifyTheaterRoles() {
  try {
    console.log('🔍 Starting verification: Theater roles\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get all theaters
    const theaters = await mongoose.connection.db.collection('theaters').find({}).toArray();
    console.log(`📊 Found ${theaters.length} theaters\n`);
    
    let allGood = true;
    
    // Check each theater
    for (const theater of theaters) {
      console.log(`\n📍 Theater: ${theater.name} (ID: ${theater._id})`);
      
      // Find roles document for this theater
      const rolesDoc = await mongoose.connection.db.collection('roles')
        .findOne({ theater: theater._id });
      
      if (!rolesDoc) {
        console.log('   ❌ No roles document found!');
        allGood = false;
        continue;
      }
      
      // Check for Theater Admin role
      const adminRole = rolesDoc.roleList.find(role => 
        role.name === 'Theater Admin' && role.isDefault === true
      );
      
      // Check for Kiosk Screen role
      const kioskRole = rolesDoc.roleList.find(role => 
        role.name === 'Kiosk Screen' && role.isDefault === true
      );
      
      console.log(`   Total Roles: ${rolesDoc.roleList.length}`);
      console.log(`   ${adminRole ? '✅' : '❌'} Theater Admin Role: ${adminRole ? 'EXISTS' : 'MISSING'}`);
      if (adminRole) {
        console.log(`      - ID: ${adminRole._id}`);
        console.log(`      - Permissions: ${adminRole.permissions.length}`);
        console.log(`      - Priority: ${adminRole.priority}`);
        console.log(`      - Active: ${adminRole.isActive}`);
      }
      
      console.log(`   ${kioskRole ? '✅' : '❌'} Kiosk Screen Role: ${kioskRole ? 'EXISTS' : 'MISSING'}`);
      if (kioskRole) {
        console.log(`      - ID: ${kioskRole._id}`);
        console.log(`      - Permissions: ${kioskRole.permissions.length}`);
        console.log(`      - Priority: ${kioskRole.priority}`);
        console.log(`      - Active: ${kioskRole.isActive}`);
      }
      
      if (!adminRole || !kioskRole) {
        allGood = false;
      }
      
      // List all other roles
      const otherRoles = rolesDoc.roleList.filter(role => 
        role.name !== 'Theater Admin' && role.name !== 'Kiosk Screen'
      );
      
      if (otherRoles.length > 0) {
        console.log(`   \n   📋 Other Roles (${otherRoles.length}):`);
        otherRoles.forEach(role => {
          console.log(`      - ${role.name} (Priority: ${role.priority}, Active: ${role.isActive})`);
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    if (allGood) {
      console.log('✅ All theaters have both required default roles!');
      console.log('   - Theater Admin role');
      console.log('   - Kiosk Screen role');
    } else {
      console.log('❌ Some theaters are missing required roles!');
      console.log('   Run: node migrations/add-kiosk-role-to-theaters.js');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the verification
verifyTheaterRoles()
  .then(() => {
    console.log('\n✅ Verification completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
