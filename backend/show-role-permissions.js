const mongoose = require('mongoose');
require('dotenv').config();

const showRolePermissions = async () => {
  try {
    console.log('\n📋 Showing All Role Permissions...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const theaterId = '69170baa629a34d0c041cf44';
    
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
    
    if (!rolesDoc) {
      console.log('❌ No roles document found');
      return;
    }
    
    console.log(`Theater ID: ${theaterId}\n`);
    console.log('='.repeat(70) + '\n');
    
    for (const role of rolesDoc.roleList) {
      console.log(`📌 ROLE: ${role.name} (${role._id})`);
      console.log(`   Active: ${role.isActive}`);
      console.log(`   Description: ${role.description || 'N/A'}\n`);
      
      if (!role.permissions || role.permissions.length === 0) {
        console.log('   ⚠️  No permissions\n');
        continue;
      }
      
      console.log(`   Total Permissions: ${role.permissions.length}`);
      const accessible = role.permissions.filter(p => p.hasAccess === true);
      console.log(`   Accessible: ${accessible.length}\n`);
      
      console.log('   Permissions:');
      role.permissions.forEach((p, idx) => {
        if (p.hasAccess) {
          console.log(`   ${idx + 1}. ✅ ${p.page}`);
          console.log(`      Route: ${p.route || 'NO ROUTE'}`);
        }
      });
      
      console.log('\n' + '='.repeat(70) + '\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

showRolePermissions();
