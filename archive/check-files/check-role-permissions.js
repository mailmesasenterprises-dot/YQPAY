const mongoose = require('mongoose');

async function checkRolePermissions() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB\n');
    
    const rolesDoc = await mongoose.connection.db.collection('roles').findOne({ 
      theater: new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f') 
    });
    
    const adminRole = rolesDoc.roleList.find(r => r.name === 'Theater Admin');
    
    console.log('🔑 Theater Admin Role Permissions:');
    console.log('=====================================');
    console.log('Total permissions:', adminRole.permissions.length);
    console.log('');
    
    adminRole.permissions.forEach((p, i) => {
      console.log(`${i+1}. ${p.page} - ${p.pageName}: ${p.hasAccess ? '✅' : '❌'}`);
    });
    
    console.log('\n\n📊 Pages with routes:');
    console.log('=====================================');
    const pagesWithRoutes = [
      'TheaterDashboardWithId',
      'OnlinePOSInterface',
      'KioskViewCart',
      'KioskCheckout',
      'KioskPayment',
      'TheaterProductList',
      'TheaterOrderHistory',
      'ViewCart'
    ];
    
    pagesWithRoutes.forEach(pageId => {
      const perm = adminRole.permissions.find(p => p.page === pageId);
      if (perm) {
        console.log(`✅ ${perm.pageName} (${perm.page}): ${perm.hasAccess}`);
      } else {
        console.log(`❌ ${pageId}: NOT IN PERMISSIONS`);
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRolePermissions();
