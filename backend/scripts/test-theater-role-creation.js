const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Test Script: Theater Role Creation
 * 
 * This script tests that both Theater Admin and Kiosk Screen roles
 * are created automatically when a new theater is created.
 */

async function testTheaterRoleCreation() {
  try {
    console.log('🧪 Testing Theater Role Creation\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Import after connection is established
    const theaterService = require('../services/theaterService');
    
    // Create test theater data
    const testTheaterData = {
      name: 'TEST_THEATER_' + Date.now(),
      username: 'test_' + Date.now(),
      email: `test${Date.now()}@example.com`,
      password: 'test123',
      phone: '1234567890',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'India'
      },
      ownerDetails: {
        name: 'Test Owner',
        contactNumber: '9876543210',
        personalAddress: '456 Owner St'
      },
      settings: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        language: 'en'
      },
      branding: {
        primaryColor: '#6B0E9B',
        secondaryColor: '#F3F4F6'
      },
      isActive: true,
      status: 'active'
    };
    
    console.log('📝 Creating test theater...');
    console.log('   Name:', testTheaterData.name);
    console.log('   Username:', testTheaterData.username);
    console.log('   Email:', testTheaterData.email);
    console.log('');
    
    // Create the theater
    const createdTheater = await theaterService.createTheater(testTheaterData, {});
    console.log('\n✅ Theater created successfully!');
    console.log('   ID:', createdTheater._id);
    console.log('   Name:', createdTheater.name);
    
    // Wait a moment for async role creation to complete
    console.log('\n⏳ Waiting 2 seconds for role initialization...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify roles were created
    console.log('\n🔍 Verifying roles...');
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: createdTheater._id });
    
    if (!rolesDoc) {
      console.log('❌ No roles document found!');
      return false;
    }
    
    console.log(`   Total roles created: ${rolesDoc.roleList.length}`);
    
    // Check for Theater Admin role
    const adminRole = rolesDoc.roleList.find(role => 
      role.name === 'Theater Admin' && role.isDefault === true
    );
    
    if (adminRole) {
      console.log('\n✅ Theater Admin Role Found:');
      console.log('   ID:', adminRole._id);
      console.log('   Permissions:', adminRole.permissions.length);
      console.log('   Priority:', adminRole.priority);
      console.log('   Can Delete:', adminRole.canDelete);
      console.log('   Can Edit:', adminRole.canEdit);
      console.log('   Is Active:', adminRole.isActive);
    } else {
      console.log('❌ Theater Admin role NOT FOUND!');
    }
    
    // Check for Kiosk Screen role
    const kioskRole = rolesDoc.roleList.find(role => 
      role.name === 'Kiosk Screen' && role.isDefault === true
    );
    
    if (kioskRole) {
      console.log('\n✅ Kiosk Screen Role Found:');
      console.log('   ID:', kioskRole._id);
      console.log('   Permissions:', kioskRole.permissions.length);
      console.log('   Priority:', kioskRole.priority);
      console.log('   Can Delete:', kioskRole.canDelete);
      console.log('   Can Edit:', kioskRole.canEdit);
      console.log('   Is Active:', kioskRole.isActive);
    } else {
      console.log('❌ Kiosk Screen role NOT FOUND!');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(60));
    
    const success = adminRole && kioskRole;
    if (success) {
      console.log('✅ SUCCESS: Both default roles were created automatically!');
      console.log('   - Theater Admin role: ✅');
      console.log('   - Kiosk Screen role: ✅');
    } else {
      console.log('❌ FAILED: Some roles are missing!');
      console.log(`   - Theater Admin role: ${adminRole ? '✅' : '❌'}`);
      console.log(`   - Kiosk Screen role: ${kioskRole ? '✅' : '❌'}`);
    }
    console.log('='.repeat(60));
    
    // Cleanup - delete test theater
    console.log('\n🧹 Cleaning up test data...');
    await mongoose.connection.db.collection('theaters').deleteOne({ _id: createdTheater._id });
    await mongoose.connection.db.collection('roles').deleteOne({ theater: createdTheater._id });
    await mongoose.connection.db.collection('settings').deleteOne({ theater: createdTheater._id });
    console.log('✅ Test data cleaned up');
    
    return success;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTheaterRoleCreation()
  .then((success) => {
    if (success) {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });
