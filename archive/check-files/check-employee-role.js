require('dotenv').config();
const mongoose = require('mongoose');

const checkEmployeeRole = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow');
    console.log('✅ Connected to MongoDB\n');

    // Find the user "employee"
    console.log('🔍 Searching for user "employee"...\n');
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': 'employee' });

    if (!theaterUsersDoc) {
      console.log('❌ User "employee" not found');
      process.exit(1);
    }

    const employeeUser = theaterUsersDoc.users.find(u => u.username === 'employee');
    console.log('✅ Found user "employee"');
    console.log('   User ID:', employeeUser._id);
    console.log('   Theater ID:', theaterUsersDoc.theaterId);
    console.log('   Role ID:', employeeUser.role);
    console.log('   Full Name:', employeeUser.fullName);
    console.log('   Email:', employeeUser.email);
    console.log('   PIN:', employeeUser.pin ? 'Set' : 'Not Set');
    console.log('');

    // Find the role
    console.log('🔍 Searching for role...\n');
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: theaterUsersDoc.theaterId,
        'roleList._id': employeeUser.role
      });

    if (!rolesDoc) {
      console.log('❌ Role document not found');
      process.exit(1);
    }

    // Find the specific role in the roleList array
    const employeeRole = rolesDoc.roleList.find(
      r => r._id.toString() === employeeUser.role.toString()
    );

    if (!employeeRole) {
      console.log('❌ Employee role not found in roleList');
      process.exit(1);
    }

    console.log('✅ Found Employee Role');
    console.log('   Role Name:', employeeRole.name);
    console.log('   Role Description:', employeeRole.description || 'N/A');
    console.log('   Is Active:', employeeRole.isActive);
    console.log('   Is Default:', employeeRole.isDefault || false);
    console.log('');

    // Show permissions
    console.log('📋 EMPLOYEE ROLE PERMISSIONS:\n');
    console.log('='.repeat(80));

    if (!employeeRole.permissions || employeeRole.permissions.length === 0) {
      console.log('❌ NO PERMISSIONS ASSIGNED TO THIS ROLE');
      console.log('');
      console.log('⚠️  This means the user will have NO ACCESS to any pages!');
    } else {
      const accessiblePages = employeeRole.permissions.filter(p => p.hasAccess === true);
      const deniedPages = employeeRole.permissions.filter(p => p.hasAccess === false);

      console.log(`\n✅ ACCESSIBLE PAGES (${accessiblePages.length}):\n`);
      accessiblePages.forEach((perm, index) => {
        console.log(`   ${index + 1}. ${perm.pageName || perm.page}`);
        console.log(`      - Page ID: ${perm.page}`);
        console.log(`      - Route: ${perm.route || 'N/A'}`);
        console.log(`      - Description: ${perm.description || 'N/A'}`);
        console.log('');
      });

      if (deniedPages.length > 0) {
        console.log(`\n❌ DENIED PAGES (${deniedPages.length}):\n`);
        deniedPages.forEach((perm, index) => {
          console.log(`   ${index + 1}. ${perm.pageName || perm.page}`);
        });
      }

      console.log('\n' + '='.repeat(80));
      console.log(`\n📊 SUMMARY:`);
      console.log(`   Total Permissions: ${employeeRole.permissions.length}`);
      console.log(`   Accessible Pages: ${accessiblePages.length}`);
      console.log(`   Denied Pages: ${deniedPages.length}`);
    }

    console.log('\n✅ Done!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

checkEmployeeRole();
