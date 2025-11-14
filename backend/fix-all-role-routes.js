const mongoose = require('mongoose');
require('dotenv').config();

const fixAllRoleRoutes = async () => {
  try {
    console.log('\n🔧 Fixing All Role Routes Properly...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const theaterId = process.argv[2] || '69170baa629a34d0c041cf44';
    
    // Correct page-to-route mappings
    const pageRouteMap = {
      // Dashboard
      'dashboard': '/theater-dashboard/:theaterId',
      'TheaterDashboardWithId': '/theater-dashboard/:theaterId',
      
      // Products
      'products': '/theater-products/:theaterId',
      'TheaterProductList': '/theater-products/:theaterId',
      'SimpleProductList': '/simple-products/:theaterId',
      'add-product': '/theater-add-product/:theaterId',
      'TheaterAddProductWithId': '/theater-add-product/:theaterId',
      
      // Categories & Types
      'categories': '/theater-categories/:theaterId',
      'TheaterCategories': '/theater-categories/:theaterId',
      'product-types': '/theater-product-types/:theaterId',
      'TheaterProductTypes': '/theater-product-types/:theaterId',
      'kiosk-types': '/theater-kiosk-types/:theaterId',
      'TheaterKioskTypes': '/theater-kiosk-types/:theaterId',
      
      // Stock
      'stock': '/theater-stock-management/:theaterId',
      'StockManagement': '/theater-stock-management/:theaterId',
      
      // Orders
      'orders': '/theater-orders/:theaterId',
      'order-history': '/theater-order-history/:theaterId',
      'TheaterOrderHistory': '/theater-order-history/:theaterId',
      'KioskOrderHistory': '/kiosk-order-history/:theaterId',
      'OnlineOrderHistory': '/online-order-history/:theaterId',
      
      // POS
      'pos': '/pos/:theaterId',
      'OnlinePOSInterface': '/pos/:theaterId',
      'OfflinePOSInterface': '/offline-pos/:theaterId',
      'ProfessionalPOSInterface': '/theater-order-pos/:theaterId',
      
      // QR Management
      'qr-management': '/theater-qr-management/:theaterId',
      'TheaterQRManagement': '/theater-qr-management/:theaterId',
      'qr-code-names': '/theater-qr-code-names/:theaterId',
      'TheaterQRCodeNames': '/theater-qr-code-names/:theaterId',
      'generate-qr': '/theater-generate-qr/:theaterId',
      'TheaterGenerateQR': '/theater-generate-qr/:theaterId',
      
      // Settings & Configuration
      'settings': '/theater-settings/:theaterId',
      'TheaterSettingsWithId': '/theater-settings/:theaterId',
      'banner': '/theater-banner/:theaterId',
      'TheaterBanner': '/theater-banner/:theaterId',
      
      // Reports
      'reports': '/theater-reports/:theaterId',
      
      // User & Role Management
      'user-management': '/theater-user-management/:theaterId',
      'TheaterUserManagement': '/theater-user-management/:theaterId',
      'roles': '/theater-roles/:theaterId',
      'TheaterRoles': '/theater-roles/:theaterId',
      'role-access': '/theater-role-access/:theaterId',
      'TheaterRoleAccess': '/theater-role-access/:theaterId',
      
      // Messages
      'messages': '/theater-messages/:theaterId',
      'TheaterMessages': '/theater-messages/:theaterId',
      
      // Cart
      'view-cart': '/view-cart/:theaterId',
      'ViewCart': '/view-cart/:theaterId',
      
      // Kiosk Pages
      'KioskProductList': '/kiosk-products/:theaterId',
      'KioskCart': '/kiosk-cart/:theaterId',
      'KioskCheckout': '/kiosk-checkout/:theaterId',
      'KioskPayment': '/kiosk-payment/:theaterId',
      'KioskViewCart': '/kiosk-view-cart/:theaterId'
    };
    
    // Get all roles for this theater
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
    
    if (!rolesDoc) {
      console.log('❌ No roles document found');
      return;
    }
    
    console.log(`Theater ID: ${theaterId}`);
    console.log(`Found ${rolesDoc.roleList.length} roles\n`);
    
    let totalFixed = 0;
    
    // Fix each role's permissions
    for (const role of rolesDoc.roleList) {
      console.log(`\n📋 Processing role: ${role.name}`);
      
      if (!role.permissions || role.permissions.length === 0) {
        console.log('   ⚠️  No permissions to fix');
        continue;
      }
      
      let fixedCount = 0;
      const updatedPermissions = role.permissions.map(p => {
        const oldRoute = p.route;
        
        // Check if route needs fixing (missing, empty, or has hardcoded theater ID)
        const needsFix = !oldRoute || 
                        oldRoute === 'NO ROUTE' || 
                        oldRoute === '/' ||
                        (oldRoute.includes(theaterId) && !oldRoute.includes(':theaterId'));
        
        if (needsFix) {
          // Find correct route from mapping
          const newRoute = pageRouteMap[p.page];
          
          if (newRoute) {
            if (newRoute !== oldRoute) {
              console.log(`   ✏️  ${p.page}:`);
              console.log(`      OLD: "${oldRoute || 'MISSING'}"`);
              console.log(`      NEW: "${newRoute}"`);
              fixedCount++;
              totalFixed++;
            }
            return { ...p, route: newRoute };
          } else {
            console.log(`   ⚠️  ${p.page}: No mapping found (page: "${p.page}")`);
            return p;
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
        
        console.log(`   ✅ Fixed ${fixedCount} routes in ${role.name}`);
      } else {
        console.log(`   ✅ All routes are correct`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ TOTAL ROUTES FIXED: ${totalFixed}`);
    console.log('='.repeat(60) + '\n');
    
    if (totalFixed > 0) {
      console.log('🎉 Routes have been fixed! Login should work now.\n');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
};

fixAllRoleRoutes();
