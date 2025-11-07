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
  
  const accessible = roleInfo.permissions.filter(p => p.hasAccess === true);
  
  console.log('\n✅ ALL Accessible Pages (hasAccess=true):', accessible.length);
  accessible.forEach((perm, index) => {
    console.log(`\n${index + 1}. Page ID: ${perm.page}`);
    console.log(`   Page Name: ${perm.pageName || 'No name'}`);
    console.log(`   Route: ${perm.route || 'NOT DEFINED ❌'}`);
    console.log(`   Description: ${perm.description || 'No description'}`);
    console.log(`   hasAccess: ${perm.hasAccess}`);
  });
  
  console.log('\n\n📊 SUMMARY:');
  const withRoutes = accessible.filter(p => p.route && p.route.trim() !== '');
  const withoutRoutes = accessible.filter(p => !p.route || p.route.trim() === '');
  
  console.log(`Pages WITH routes: ${withRoutes.length}`);
  withRoutes.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.page} → ${p.route}`);
  });
  
  console.log(`\nPages WITHOUT routes: ${withoutRoutes.length} ❌`);
  withoutRoutes.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.page} (${p.pageName})`);
  });
  
  console.log('\n💡 Only pages WITH routes will appear in the sidebar!');
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
