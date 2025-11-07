const mongoose = require('mongoose');

async function addPermissionsToAdminRole() {
  try {
    await mongoose.connect('mongodb://localhost:27017/theater_canteen_db');
    console.log('✅ Connected to MongoDB');
    
    const theaterId = new mongoose.Types.ObjectId('68f8837a541316c6ad54b79f');
    
    // All available pages for theater admin
    const adminPermissions = [
      { page: 'TheaterDashboardWithId', pageName: 'Theater Dashboard (With ID)', hasAccess: true },
      { page: 'TheaterSettingsWithId', pageName: 'Theater Settings (With ID)', hasAccess: true },
      { page: 'TheaterCategories', pageName: 'Theater Categories', hasAccess: true },
      { page: 'TheaterKioskTypes', pageName: 'Theater Kiosk Types', hasAccess: true },
      { page: 'TheaterProductTypes', pageName: 'Theater Product Names', hasAccess: true },
      { page: 'TheaterProductList', pageName: 'Theater Product List', hasAccess: true },
      { page: 'TheaterOrderInterface', pageName: 'Theater Order Interface', hasAccess: true },
      { page: 'OnlinePOSInterface', pageName: 'Online POS Interface', hasAccess: true },
      { page: 'TheaterOrderHistory', pageName: 'Theater Order History', hasAccess: true },
      { page: 'TheaterAddProductWithId', pageName: 'Theater Add Product (With ID)', hasAccess: true },
      { page: 'TheaterRoles', pageName: 'Theater Roles', hasAccess: true },
      { page: 'TheaterRoleAccess', pageName: 'Theater Role Access', hasAccess: true },
      { page: 'TheaterQRCodeNames', pageName: 'Theater QR Code Names', hasAccess: true },
      { page: 'TheaterGenerateQR', pageName: 'Theater Generate QR', hasAccess: true },
      { page: 'TheaterQRManagement', pageName: 'Theater QR Management', hasAccess: true },
      { page: 'TheaterUserManagement', pageName: 'Theater User Management', hasAccess: true },
      { page: 'StockManagement', pageName: 'Stock Management', hasAccess: true },
      { page: 'SimpleProductList', pageName: 'Simple Product List', hasAccess: true },
      { page: 'ViewCart', pageName: 'View Cart', hasAccess: true },
      { page: 'ProfessionalPOSInterface', pageName: 'Professional POS Interface', hasAccess: true },
      { page: 'TheaterReports', pageName: 'Theater Reports', hasAccess: true },
      { page: 'KioskViewCart', pageName: 'Kiosk View Cart', hasAccess: true },
      { page: 'KioskCheckout', pageName: 'Kiosk Checkout', hasAccess: true },
      { page: 'KioskPayment', pageName: 'Kiosk Payment', hasAccess: true }
    ];
    
    // Add _id to each permission
    const permissionsWithIds = adminPermissions.map(p => ({
      ...p,
      _id: new mongoose.Types.ObjectId()
    }));
    
    console.log('📝 Adding', permissionsWithIds.length, 'permissions to Theater Admin role...');
    
    const result = await mongoose.connection.db.collection('roles').updateOne(
      {
        theater: theaterId,
        'roleList._id': new mongoose.Types.ObjectId('68f8837a541316c6ad54b7a6')
      },
      {
        $set: {
          'roleList.$.permissions': permissionsWithIds,
          'roleList.$.updatedAt': new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully added permissions to Theater Admin role');
      console.log('   Modified count:', result.modifiedCount);
    } else {
      console.log('❌ No documents modified');
    }
    
    // Verify
    const rolesDoc = await mongoose.connection.db.collection('roles').findOne({
      theater: theaterId
    });
    
    const adminRole = rolesDoc.roleList.find(r => r._id.toString() === '68f8837a541316c6ad54b7a6');
    console.log('\n📊 Theater Admin role now has', adminRole.permissions.length, 'permissions');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addPermissionsToAdminRole();
