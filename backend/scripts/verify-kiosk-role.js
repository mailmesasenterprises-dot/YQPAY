const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to MongoDB\n');
  
  // Get all theaters and their Kiosk Screen roles
  const allRoles = await mongoose.connection.db.collection('roles').find({}).toArray();
  
  allRoles.forEach((doc, index) => {
    console.log(`Theater ${index + 1}: (ID: ${doc.theater})`);
    
    const kioskRole = doc.roleList.find(role => role.name === 'Kiosk Screen');
    
    if (kioskRole) {
      console.log(`  ✅ Kiosk Screen Role Found`);
      console.log(`     Role ID: ${kioskRole._id}`);
      console.log(`     Is Default: ${kioskRole.isDefault}`);
      console.log(`     Can Delete: ${kioskRole.canDelete}`);
      console.log(`     Can Edit: ${kioskRole.canEdit}`);
      console.log(`     Priority: ${kioskRole.priority}`);
      console.log(`     Active: ${kioskRole.isActive}`);
      console.log(`     Permissions: ${kioskRole.permissions.length}`);
      
      console.log(`\n     📋 Permissions:`);
      kioskRole.permissions.forEach((perm, i) => {
        console.log(`       ${i + 1}. ${perm.page} (${perm.pageName})`);
        console.log(`          Route: ${perm.route}`);
        console.log(`          Access: ${perm.hasAccess}`);
      });
    } else {
      console.log(`  ❌ No Kiosk Screen role found`);
    }
    
    console.log('\n' + '-'.repeat(60) + '\n');
  });
  
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
