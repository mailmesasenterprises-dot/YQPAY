const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
  const userRoleId = new mongoose.Types.ObjectId('6902841ab94c230e4ea91a17');
  
  // Get user
  const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
    .findOne({ 'users.username': 'kioas' });
  
  const user = theaterUsersDoc.users.find(u => u.username === 'kioas');
  
  console.log('\n👤 User kioas role ID:', user.role.toString());
  
  // Get all roles for this theater
  const rolesDoc = await mongoose.connection.db.collection('roles')
    .findOne({ theater: theaterId });
  
  console.log('\n🎭 Available roles in theater:');
  rolesDoc.roleList.forEach((role, index) => {
    console.log(`${index + 1}. ${role.name} - ID: ${role._id.toString()}`);
    
    if (role._id.toString() === user.role.toString()) {
      console.log('   ✅ THIS IS THE USER\'S ROLE!');
      console.log('   Permissions:', role.permissions ? role.permissions.length : 0);
      
      if (role.permissions && role.permissions.length > 0) {
        const accessible = role.permissions.filter(p => p.hasAccess === true);
        console.log(`   Accessible pages: ${accessible.length}`);
        
        if (accessible.length > 0) {
          accessible.forEach(p => {
            console.log(`     - ${p.page} (${p.pageName})`);
          });
        } else {
          console.log('   ❌ NO ACCESSIBLE PAGES! All permissions have hasAccess=false');
        }
      } else {
        console.log('   ❌ NO PERMISSIONS ARRAY!');
      }
    }
  });
  
  // Check if user's role exists in the list
  const userRole = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
  
  if (!userRole) {
    console.log('\n❌ ERROR: User\'s role ID does not exist in the roles list!');
    console.log('User needs to be reassigned to a valid role.');
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
