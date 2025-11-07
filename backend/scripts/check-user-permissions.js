const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  // Find user
  const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
    .findOne({ 'users.username': 'kioas' });
  
  if (theaterUsersDoc) {
    const user = theaterUsersDoc.users.find(u => u.username === 'kioas');
    
    console.log('\n👤 User Details:');
    console.log('Username:', user.username);
    console.log('Role ID:', user.role);
    console.log('Theater ID:', theaterUsersDoc.theaterId);
    
    // Find role details
    if (user.role) {
      const rolesDoc = await mongoose.connection.db.collection('roles')
        .findOne({ 
          theater: theaterUsersDoc.theaterId,
          'roleList._id': user.role
        });
      
      if (rolesDoc && rolesDoc.roleList) {
        const roleInfo = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
        
        if (roleInfo) {
          console.log('\n🎭 Role Details:');
          console.log('Role Name:', roleInfo.name);
          console.log('Role Description:', roleInfo.description);
          console.log('Is Active:', roleInfo.isActive);
          console.log('\n📋 Permissions:');
          
          if (roleInfo.permissions && roleInfo.permissions.length > 0) {
            console.log(`Total permissions: ${roleInfo.permissions.length}`);
            
            const accessiblePages = roleInfo.permissions.filter(p => p.hasAccess === true);
            console.log(`Accessible pages: ${accessiblePages.length}`);
            
            if (accessiblePages.length > 0) {
              console.log('\n✅ Pages user can access:');
              accessiblePages.forEach((perm, index) => {
                console.log(`${index + 1}. ${perm.page} (${perm.pageName || 'No name'})`);
              });
            } else {
              console.log('\n❌ NO ACCESSIBLE PAGES - User has no permissions with hasAccess=true');
            }
            
            console.log('\nAll permissions:');
            roleInfo.permissions.forEach((perm, index) => {
              console.log(`${index + 1}. ${perm.page}: hasAccess=${perm.hasAccess}`);
            });
          } else {
            console.log('❌ NO PERMISSIONS DEFINED for this role');
          }
        } else {
          console.log('❌ Role not found in roleList array');
        }
      } else {
        console.log('❌ Roles document not found for this theater');
      }
    } else {
      console.log('❌ User has no role assigned');
    }
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
