require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    console.log('🔧 Testing login flow for user "vetri"...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const username = 'vetri';
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
    console.log();
    
    // Step 2: Verify password
    console.log('2️⃣  Verifying password...');
    const passwordMatch = await bcrypt.compare(password, theaterUser.password);
    console.log(`   Password match: ${passwordMatch}`);
    if (!passwordMatch) {
      console.log('❌ Password does not match');
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
      return;
    }
    
    const roleInfo = rolesDoc.roleList.find(
      r => r._id.toString() === theaterUser.role.toString() && r.isActive
    );
    
    if (!roleInfo) {
      console.log('❌ Role not found in roleList');
      return;
    }
    
    console.log('✅ Role found:');
    console.log(`   Role ID: ${roleInfo._id}`);
    console.log(`   Role Name: ${roleInfo.name}`);
    console.log(`   Is Active: ${roleInfo.isActive}`);
    console.log(`   Total permissions: ${roleInfo.permissions.length}`);
    console.log();
    
    // Step 5: Filter permissions with hasAccess === true
    console.log('5️⃣  Filtering permissions...');
    const accessiblePermissions = roleInfo.permissions.filter(p => p.hasAccess === true);
    console.log(`   Total permissions: ${roleInfo.permissions.length}`);
    console.log(`   Accessible permissions: ${accessiblePermissions.length}`);
    console.log();
    
    if (accessiblePermissions.length === 0) {
      console.log('❌ No accessible permissions found!');
      console.log('\n📋 All permissions:');
      roleInfo.permissions.forEach((perm, i) => {
        console.log(`   ${i + 1}. ${perm.page} - hasAccess: ${perm.hasAccess} (type: ${typeof perm.hasAccess})`);
      });
      return;
    }
    
    // Step 6: Build rolePermissions array (as sent to frontend)
    console.log('6️⃣  Building response...');
    const rolePermissions = [{
      role: {
        _id: roleInfo._id,
        name: roleInfo.name,
        description: roleInfo.description || ''
      },
      permissions: accessiblePermissions
    }];
    
    console.log('✅ Role permissions structure:');
    console.log(JSON.stringify(rolePermissions, null, 2));
    console.log();
    
    // Step 7: Verify what frontend will receive
    console.log('7️⃣  Frontend validation check...');
    if (rolePermissions && rolePermissions.length > 0 && rolePermissions[0].permissions) {
      const frontendAccessiblePages = rolePermissions[0].permissions.filter(p => p.hasAccess === true);
      console.log(`✅ Frontend will see ${frontendAccessiblePages.length} accessible pages`);
      
      if (frontendAccessiblePages.length > 0) {
        console.log('\n📋 First 5 accessible pages:');
        frontendAccessiblePages.slice(0, 5).forEach((page, i) => {
          console.log(`   ${i + 1}. ${page.pageName} (${page.page})`);
          console.log(`      hasAccess: ${page.hasAccess}`);
          console.log(`      route: ${page.route || 'N/A'}`);
        });
      }
    } else {
      console.log('❌ Frontend validation will FAIL - no permissions structure');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testLogin();
