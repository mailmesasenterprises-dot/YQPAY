const mongoose = require('mongoose');
require('dotenv').config();

const checkTheaterUserLogin = async () => {
  try {
    console.log('\n🔍 Diagnosing Theater User Login Issue...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Get the username from command line or use default
    const username = process.argv[2] || 'sabarish'; // Default to 'sabarish' from screenshot
    
    console.log(`👤 Checking user: ${username}\n`);
    
    // Step 1: Find the theater user
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log('❌ Theater user document not found');
      process.exit(1);
    }
    
    console.log('✅ Theater users document found');
    console.log(`   Theater ID: ${theaterUsersDoc.theaterId}`);
    
    // Find the specific user in the array
    const theaterUser = theaterUsersDoc.users.find(
      u => u.username === username && u.isActive === true
    );
    
    if (!theaterUser) {
      console.log('❌ User not found in array or inactive');
      process.exit(1);
    }
    
    console.log(`✅ User found: ${theaterUser.username}`);
    console.log(`   User ID: ${theaterUser._id}`);
    console.log(`   Full Name: ${theaterUser.fullName || 'N/A'}`);
    console.log(`   Email: ${theaterUser.email || 'N/A'}`);
    console.log(`   Role: ${theaterUser.role}`);
    console.log(`   PIN: ${theaterUser.pin ? '****' : 'NOT SET'}`);
    console.log(`   Active: ${theaterUser.isActive}`);
    
    // Step 2: Check theater status
    const theaterInfo = await mongoose.connection.db.collection('theaters')
      .findOne({ _id: theaterUsersDoc.theaterId });
    
    if (!theaterInfo) {
      console.log('\n❌ Theater not found');
      process.exit(1);
    }
    
    console.log(`\n✅ Theater found: ${theaterInfo.name}`);
    console.log(`   Active: ${theaterInfo.isActive}`);
    console.log(`   Location: ${theaterInfo.location || 'N/A'}`);
    
    if (!theaterInfo.isActive) {
      console.log('\n⚠️  WARNING: Theater is INACTIVE - User cannot login');
    }
    
    // Step 3: Check role and permissions
    if (!theaterUser.role) {
      console.log('\n❌ User has NO ROLE assigned');
      console.log('   ACTION: Assign a role to this user');
      process.exit(1);
    }
    
    console.log(`\n🔍 Checking role permissions...`);
    console.log(`   Role value: ${theaterUser.role}`);
    console.log(`   Role type: ${typeof theaterUser.role}`);
    
    // Check if it's a string role (like 'admin')
    if (typeof theaterUser.role === 'string') {
      if (theaterUser.role.toLowerCase().includes('admin')) {
        console.log('✅ User has ADMIN role (string-based)');
        console.log('   Admins typically have access to all pages');
      } else {
        console.log(`⚠️  User has custom string role: ${theaterUser.role}`);
      }
    } 
    // Check if it's an ObjectId (role from roles collection)
    else if (mongoose.Types.ObjectId.isValid(theaterUser.role)) {
      console.log('✅ User has ObjectId-based role');
      
      // Find role in the roles collection
      const rolesDoc = await mongoose.connection.db.collection('roles')
        .findOne({ 
          theater: theaterUsersDoc.theaterId,
          'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
        });
      
      if (!rolesDoc) {
        console.log('\n❌ PROBLEM FOUND: Role document not found in roles collection');
        console.log('   The role ID exists but the role document is missing');
        console.log('   ACTION: Either reassign a valid role or create this role');
        process.exit(1);
      }
      
      // Find the specific role in roleList
      const roleInfo = rolesDoc.roleList.find(
        r => r._id.toString() === theaterUser.role.toString()
      );
      
      if (!roleInfo) {
        console.log('\n❌ PROBLEM FOUND: Role not found in roleList array');
        console.log('   ACTION: Reassign a valid role to this user');
        process.exit(1);
      }
      
      console.log(`\n✅ Role found: ${roleInfo.name}`);
      console.log(`   Role ID: ${roleInfo._id}`);
      console.log(`   Description: ${roleInfo.description || 'N/A'}`);
      console.log(`   Active: ${roleInfo.isActive}`);
      
      if (!roleInfo.isActive) {
        console.log('\n⚠️  WARNING: Role is INACTIVE - User cannot access any pages');
      }
      
      // Check permissions
      if (!roleInfo.permissions || !Array.isArray(roleInfo.permissions)) {
        console.log('\n❌ PROBLEM FOUND: Role has NO PERMISSIONS array');
        console.log('   ACTION: Add permissions to this role');
        process.exit(1);
      }
      
      console.log(`\n📋 Role has ${roleInfo.permissions.length} total permissions`);
      
      // Filter accessible permissions
      const accessiblePermissions = roleInfo.permissions.filter(p => p.hasAccess === true);
      
      console.log(`✅ Accessible permissions: ${accessiblePermissions.length}`);
      
      if (accessiblePermissions.length === 0) {
        console.log('\n❌ PROBLEM FOUND: User has ZERO accessible pages!');
        console.log('   This is why login fails with "No role permissions found"');
        console.log('   ACTION: Grant access to at least one page in the role settings');
        console.log('\n📋 Available pages (all currently denied):');
        roleInfo.permissions.slice(0, 10).forEach(p => {
          console.log(`   - ${p.page} (hasAccess: ${p.hasAccess})`);
        });
        if (roleInfo.permissions.length > 10) {
          console.log(`   ... and ${roleInfo.permissions.length - 10} more`);
        }
      } else {
        console.log('\n✅ User CAN access these pages:');
        accessiblePermissions.forEach(p => {
          console.log(`   - ${p.page}${p.route ? ` (${p.route})` : ''}`);
        });
        
        console.log('\n✅ LOGIN SHOULD WORK!');
        console.log(`   First accessible page: ${accessiblePermissions[0].page}`);
      }
    } else {
      console.log('\n❌ PROBLEM FOUND: Invalid role format');
      console.log(`   Role value: ${theaterUser.role}`);
      console.log('   ACTION: Assign a valid role to this user');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSIS COMPLETE');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
};

checkTheaterUserLogin();
