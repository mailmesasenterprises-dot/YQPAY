require('dotenv').config();
const mongoose = require('mongoose');

async function checkUser() {
  try {
    console.log('🔍 Checking user "vetri"...\n');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    
    // Check in theaterusers collection (array-based)
    console.log('1️⃣  Checking theaterusers collection...\n');
    const theaterUsersCollection = db.collection('theaterusers');
    const theaterUserDocs = await theaterUsersCollection.find({}).toArray();
    
    console.log(`Found ${theaterUserDocs.length} theater user documents\n`);
    
    theaterUserDocs.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`);
      console.log(`  Theater ID: ${doc.theaterId || doc.theater}`);
      console.log(`  Users in array: ${doc.users?.length || 0}`);
      
      if (doc.users && doc.users.length > 0) {
        doc.users.forEach((user, i) => {
          console.log(`\n  User ${i + 1}:`);
          console.log(`    Username: ${user.username}`);
          console.log(`    Full Name: ${user.fullName}`);
          console.log(`    Email: ${user.email}`);
          console.log(`    Role: ${user.role}`);
          console.log(`    Is Active: ${user.isActive}`);
          console.log(`    Phone: ${user.phoneNumber}`);
          console.log(`    Has PIN: ${user.pin ? 'Yes' : 'No'}`);
          
          if (user.username === 'vetri') {
            console.log(`\n  ✅ FOUND USER "vetri"!`);
            console.log(`    User ID: ${user._id}`);
            console.log(`    Role ID: ${user.role}`);
            console.log(`    Active: ${user.isActive}`);
          }
        });
      }
      console.log('\n---\n');
    });
    
    // Check roles collection to verify vetrimanager role exists
    console.log('\n2️⃣  Checking roles for vetrimanager...\n');
    const rolesCollection = db.collection('roles');
    const vetriTheaterRoles = await rolesCollection.findOne({ 
      theater: new mongoose.Types.ObjectId('6910485995ffe942c8fef423')
    });
    
    if (vetriTheaterRoles) {
      console.log('Roles document found for Vetri Cinemas');
      console.log(`Total roles: ${vetriTheaterRoles.roleList.length}\n`);
      
      vetriTheaterRoles.roleList.forEach(role => {
        if (role.name === 'vetrimanager') {
          console.log('✅ Found vetrimanager role:');
          console.log(`  Role ID: ${role._id}`);
          console.log(`  Name: ${role.name}`);
          console.log(`  Active: ${role.isActive}`);
          console.log(`  Permissions: ${role.permissions.length} pages`);
          console.log(`  Can Delete: ${role.canDelete}`);
          console.log(`  Can Edit: ${role.canEdit}`);
          console.log('\n  Permissions:');
          role.permissions.forEach(perm => {
            console.log(`    - ${perm.page} (${perm.pageName}): ${perm.hasAccess}`);
          });
        }
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkUser();
