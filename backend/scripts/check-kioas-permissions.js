const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
  const roleId = new mongoose.Types.ObjectId('690495e034bc016a11ab5834'); // Kioas role
  
  // Get the role details
  const rolesDoc = await mongoose.connection.db.collection('roles')
    .findOne({ theater: theaterId });
  
  const roleInfo = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
  
  console.log('\n🎭 Role:', roleInfo.name);
  console.log('Active:', roleInfo.isActive);
  console.log('Total Permissions:', roleInfo.permissions ? roleInfo.permissions.length : 0);
  
  if (roleInfo.permissions) {
    const accessible = roleInfo.permissions.filter(p => p.hasAccess === true);
    console.log('\n✅ Accessible Pages:', accessible.length);
    
    accessible.forEach((perm, index) => {
      console.log(`${index + 1}. ${perm.page} (${perm.pageName || 'No name'})`);
      console.log(`   Route: ${perm.route || 'No route'}`);
      console.log(`   hasAccess: ${perm.hasAccess}`);
    });
    
    console.log('\n❌ Inaccessible Pages:', roleInfo.permissions.length - accessible.length);
    
    const inaccessible = roleInfo.permissions.filter(p => p.hasAccess === false);
    inaccessible.forEach((perm, index) => {
      console.log(`${index + 1}. ${perm.page} - hasAccess: ${perm.hasAccess}`);
    });
  }
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
