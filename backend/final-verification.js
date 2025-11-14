const mongoose = require('mongoose');
require('dotenv').config();

const finalVerification = async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 FINAL VERIFICATION - Theater User Login Fix');
    console.log('='.repeat(70) + '\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const username = process.argv[2] || 'sabarish';
    
    // Get user info
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log('❌ User not found\n');
      return;
    }
    
    const user = theaterUsersDoc.users.find(u => u.username === username);
    const theaterId = theaterUsersDoc.theaterId;
    
    console.log('👤 USER INFORMATION');
    console.log('   Username: ' + username);
    console.log('   Theater ID: ' + theaterId);
    console.log('   Has PIN: ' + (user.pin ? 'Yes ✅' : 'No ❌'));
    console.log('   Active: ' + (user.isActive ? 'Yes ✅' : 'No ❌'));
    console.log('');
    
    // Get role info
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: theaterId,
        'roleList._id': user.role
      });
    
    if (!rolesDoc) {
      console.log('❌ Role document not found\n');
      return;
    }
    
    const role = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
    
    if (!role) {
      console.log('❌ Role not found in roleList\n');
      return;
    }
    
    console.log('🎭 ROLE INFORMATION');
    console.log('   Role Name: ' + role.name);
    console.log('   Role Active: ' + (role.isActive ? 'Yes ✅' : 'No ❌'));
    console.log('   Total Permissions: ' + role.permissions.length);
    
    const accessiblePerms = role.permissions.filter(p => p.hasAccess === true);
    console.log('   Accessible Pages: ' + accessiblePerms.length);
    console.log('');
    
    if (accessiblePerms.length === 0) {
      console.log('❌ ERROR: No accessible pages! User cannot login.\n');
      return;
    }
    
    const firstPage = accessiblePerms[0];
    console.log('🎯 FIRST ACCESSIBLE PAGE');
    console.log('   Page ID: ' + firstPage.page);
    console.log('   Route Template: ' + (firstPage.route || 'MISSING'));
    
    if (!firstPage.route) {
      console.log('   ❌ ERROR: No route defined!\n');
      return;
    }
    
    const finalRoute = firstPage.route.replace(':theaterId', theaterId);
    console.log('   Final Route: ' + finalRoute);
    console.log('');
    
    console.log('='.repeat(70));
    console.log('✅ LOGIN VERIFICATION: PASSED');
    console.log('='.repeat(70));
    console.log('');
    console.log('📝 Test Instructions:');
    console.log('   1. Open: http://localhost:3001');
    console.log('   2. Enter username: ' + username);
    console.log('   3. Enter password: (your password)');
    console.log('   4. Enter PIN: (your 4-digit PIN)');
    console.log('   5. Expected redirect: ' + finalRoute);
    console.log('');
    console.log('🎉 If you see the dashboard page, the fix is successful!');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

finalVerification();
