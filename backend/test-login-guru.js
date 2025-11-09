require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testGuruLogin() {
  try {
    console.log('🔧 Testing login flow for user "guru"...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const username = 'guru';
    const password = 'admin123';
    const pin = '1234';
    
    // Step 1: Find user by username
    console.log('1️⃣  Finding user...');
    const theaterUsersDoc = await db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log('❌ User not found');
      return;
    }
    
    const theaterUser = theaterUsersDoc.users.find(
      u => u.username === username && u.isActive === true
    );
    
    console.log('✅ User found:');
    console.log(`   User ID: ${theaterUser._id}`);
    console.log(`   Username: ${theaterUser.username}`);
    console.log(`   Theater ID: ${theaterUsersDoc.theaterId}`);
    console.log(`   Role ID: ${theaterUser.role}`);
    console.log(`   Email: ${theaterUser.email}`);
    console.log(`   Is Active: ${theaterUser.isActive}`);
    console.log();
    
    // Step 2: Check password hash
    console.log('2️⃣  Checking password...');
    console.log(`   Password stored (hashed): ${theaterUser.password.substring(0, 20)}...`);
    console.log(`   Password provided: ${password}`);
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, theaterUser.password);
    console.log(`   Password match: ${passwordMatch}`);
    
    if (!passwordMatch) {
      console.log('❌ Password does not match!');
      console.log('\n🔍 Testing if password might not be hashed...');
      const directMatch = theaterUser.password === password;
      console.log(`   Direct string match: ${directMatch}`);
      
      if (directMatch) {
        console.log('⚠️  PASSWORD IS NOT HASHED! This is a security issue.');
        console.log('   Need to hash the password properly.');
      }
      return;
    }
    console.log();
    
    // Step 3: Verify PIN
    console.log('3️⃣  Verifying PIN...');
    console.log(`   Stored PIN: ${theaterUser.pin}`);
    console.log(`   Provided PIN: ${pin}`);
    console.log(`   PIN match: ${theaterUser.pin === pin}`);
    if (theaterUser.pin !== pin) {
      console.log('❌ PIN does not match');
      return;
    }
    console.log();
    
    // Step 4: Get role permissions
    console.log('4️⃣  Getting role permissions...');
    const rolesDoc = await db.collection('roles')
      .findOne({
        theater: theaterUsersDoc.theaterId,
        'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
      });
    
    if (!rolesDoc || !rolesDoc.roleList) {
      console.log('❌ Roles document not found');
      console.log(`   Searching for theater: ${theaterUsersDoc.theaterId}`);
      console.log(`   Searching for role: ${theaterUser.role}`);
      
      // Check if roles exist for this theater
      const allRolesDoc = await db.collection('roles').findOne({ theater: theaterUsersDoc.theaterId });
      if (allRolesDoc) {
        console.log(`\n   Theater has ${allRolesDoc.roleList.length} roles:`);
        allRolesDoc.roleList.forEach(r => {
          console.log(`     - ${r.name} (ID: ${r._id})`);
        });
      } else {
        console.log('   No roles document found for this theater!');
      }
      return;
    }
    
    const roleInfo = rolesDoc.roleList.find(
      r => r._id.toString() === theaterUser.role.toString() && r.isActive
    );
    
    if (!roleInfo) {
      console.log('❌ Role not found or inactive in roleList');
      return;
    }
    
    console.log('✅ Role found:');
    console.log(`   Role ID: ${roleInfo._id}`);
    console.log(`   Role Name: ${roleInfo.name}`);
    console.log(`   Is Active: ${roleInfo.isActive}`);
    console.log(`   Total permissions: ${roleInfo.permissions.length}`);
    console.log();
    
    // Step 5: Check permissions
    console.log('5️⃣  Checking permissions...');
    const accessiblePermissions = roleInfo.permissions.filter(p => p.hasAccess === true);
    console.log(`   Total permissions: ${roleInfo.permissions.length}`);
    console.log(`   Accessible permissions: ${accessiblePermissions.length}`);
    
    if (accessiblePermissions.length > 0) {
      console.log('\n   First 5 accessible pages:');
      accessiblePermissions.slice(0, 5).forEach((perm, i) => {
        console.log(`     ${i + 1}. ${perm.pageName} (${perm.page})`);
      });
    }
    
    console.log('\n✅ Login should succeed for user "guru"!');
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testGuruLogin();
