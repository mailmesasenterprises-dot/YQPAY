const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://localhost:27017/yqpaynow');
  
  try {
    // Get all roles
    const roles = await mongoose.connection.collection('roles').find({}).toArray();
    
    console.log('\n=== THEATER ADMIN PERMISSIONS ANALYSIS ===\n');
    
    roles.forEach(roleDoc => {
      roleDoc.roleList?.forEach(role => {
        if (role.name === 'Theater Admin') {
          console.log(`Theater: ${roleDoc.theaterName || 'Unknown'} (ID: ${roleDoc.theater})`);
          console.log(`\nAccessible Pages (${role.permissions?.filter(p => p.hasAccess).length || 0}):`);
          
          const accessiblePages = [];
          role.permissions?.forEach(p => {
            if (p.hasAccess) {
              accessiblePages.push(p.page);
              console.log(`  ✅ ${p.page}`);
            }
          });
          
          console.log(`\nNot Accessible (${role.permissions?.filter(p => !p.hasAccess).length || 0}):`);
          role.permissions?.forEach(p => {
            if (!p.hasAccess) {
              console.log(`  ❌ ${p.page}`);
            }
          });
          
          console.log('\n' + '='.repeat(60) + '\n');
        }
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
})();
