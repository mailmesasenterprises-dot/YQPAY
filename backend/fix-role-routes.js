const mongoose = require('mongoose');
require('dotenv').config();

const fixRoleRoutes = async () => {
  try {
    console.log('\n🔧 Fixing Role Routes in Database...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const theaterId = '69170baa629a34d0c041cf44';
    
    // Correct route mappings
    const routeMapping = {
      'dashboard': `/theater-dashboard/${theaterId}`,
      'products': `/theater-products/${theaterId}`,
      'categories': `/theater-categories/${theaterId}`,
      'product-types': `/theater-product-types/${theaterId}`,
      'stock': `/theater-stock-management/${theaterId}`,
      'orders': `/theater-orders/${theaterId}`,
      'pos': `/pos/${theaterId}`,
      'order-history': `/theater-order-history/${theaterId}`,
      'qr-management': `/theater-qr-management/${theaterId}`,
      'settings': `/theater-settings/${theaterId}`,
      'reports': `/theater-reports/${theaterId}`,
      'kiosk-types': `/theater-kiosk-types/${theaterId}`,
      'banner': `/theater-banner/${theaterId}`,
      'messages': `/theater-messages/${theaterId}`,
      'user-management': `/theater-user-management/${theaterId}`,
      'roles': `/theater-roles/${theaterId}`,
      'role-access': `/theater-role-access/${theaterId}`,
      'qr-code-names': `/theater-qr-code-names/${theaterId}`,
      'generate-qr': `/theater-generate-qr/${theaterId}`,
      'add-product': `/theater-add-product/${theaterId}`,
      'simple-products': `/simple-products/${theaterId}`,
      'view-cart': `/view-cart/${theaterId}`,
      'offline-pos': `/offline-pos/${theaterId}`,
      'online-order-history': `/online-order-history/${theaterId}`,
      'theater-order-pos': `/theater-order-pos/${theaterId}`
    };
    
    // Get all roles for this theater
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
    
    if (!rolesDoc) {
      console.log('❌ No roles document found');
      return;
    }
    
    console.log(`Found ${rolesDoc.roleList.length} roles\n`);
    
    let totalFixed = 0;
    
    // Fix each role's permissions
    for (const role of rolesDoc.roleList) {
      console.log(`\n📋 Fixing role: ${role.name}`);
      
      if (!role.permissions || role.permissions.length === 0) {
        console.log('   ⚠️ No permissions to fix');
        continue;
      }
      
      let fixedCount = 0;
      const updatedPermissions = role.permissions.map(p => {
        const oldRoute = p.route;
        
        // Check if route needs fixing
        if (!oldRoute || oldRoute === '/' || !oldRoute.includes(theaterId)) {
          // Try to find correct route
          const newRoute = routeMapping[p.page] || oldRoute;
          
          if (newRoute !== oldRoute) {
            console.log(`   ✏️  ${p.page}: "${oldRoute}" → "${newRoute}"`);
            fixedCount++;
            totalFixed++;
            return { ...p, route: newRoute };
          }
        }
        
        return p;
      });
      
      if (fixedCount > 0) {
        // Update this role's permissions
        await mongoose.connection.db.collection('roles')
          .updateOne(
            { 
              theater: new mongoose.Types.ObjectId(theaterId),
              'roleList._id': role._id
            },
            { 
              $set: { 
                'roleList.$.permissions': updatedPermissions,
                'roleList.$.updatedAt': new Date()
              }
            }
          );
        
        console.log(`   ✅ Fixed ${fixedCount} routes`);
      } else {
        console.log(`   ✅ All routes are correct`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ TOTAL ROUTES FIXED: ${totalFixed}`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
};

fixRoleRoutes();
