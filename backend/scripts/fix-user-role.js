const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
  const correctRoleId = new mongoose.Types.ObjectId('690495e034bc016a11ab5834'); // Kioas role
  
  console.log('\n🔧 Updating user kioas role...');
  
  const result = await mongoose.connection.db.collection('theaterusers')
    .updateOne(
      { 
        theaterId: theaterId,
        'users.username': 'kioas'
      },
      { 
        $set: { 
          'users.$.role': correctRoleId,
          'users.$.updatedAt': new Date()
        }
      }
    );
  
  console.log('Update result:', result);
  
  if (result.modifiedCount > 0) {
    console.log('✅ User role updated successfully!');
    
    // Verify the update
    const updatedDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': 'kioas' });
    
    const updatedUser = updatedDoc.users.find(u => u.username === 'kioas');
    console.log('\nUpdated user role ID:', updatedUser.role.toString());
    
    // Get the role details
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: theaterId });
    
    const roleInfo = rolesDoc.roleList.find(r => r._id.toString() === updatedUser.role.toString());
    
    if (roleInfo) {
      console.log('✅ Role found:', roleInfo.name);
      console.log('Permissions:', roleInfo.permissions ? roleInfo.permissions.length : 0);
      
      if (roleInfo.permissions) {
        const accessible = roleInfo.permissions.filter(p => p.hasAccess === true);
        console.log(`Accessible pages: ${accessible.length}`);
      }
    }
  } else {
    console.log('❌ No changes made');
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
