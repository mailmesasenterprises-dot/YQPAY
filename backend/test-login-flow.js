const mongoose = require('mongoose');
require('dotenv').config();

const testLoginFlow = async () => {
  try {
    console.log('\n🔍 Testing Complete Login Flow for Theater User...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const username = process.argv[2] || 'sabarish';
    console.log(`Testing login for: ${username}\n`);
    
    // Step 1: Password validation (like /api/auth/login)
    console.log('STEP 1: Password Validation\n');
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log('❌ User not found');
      return;
    }
    
    const theaterUser = theaterUsersDoc.users.find(
      u => u.username === username && u.isActive === true
    );
    
    console.log(`✅ Password validated (simulated)`);
    console.log(`   Username: ${theaterUser.username}`);
    console.log(`   Theater ID: ${theaterUsersDoc.theaterId}`);
    console.log(`   User ID: ${theaterUser._id}\n`);
    
    // Step 2: PIN validation (like /api/auth/validate-pin)
    console.log('STEP 2: PIN Validation & Role Permissions Fetch\n');
    
    // Get theater info
    const theaterInfo = await mongoose.connection.db.collection('theaters')
      .findOne({ _id: theaterUsersDoc.theaterId });
    
    console.log(`Theater: ${theaterInfo.name}`);
    console.log(`Theater Active: ${theaterInfo.isActive}\n`);
    
    // Get role details
    let roleInfo = null;
    let userType = 'theater_user';
    let rolePermissions = [];
    
    if (theaterUser.role && mongoose.Types.ObjectId.isValid(theaterUser.role)) {
      const rolesDoc = await mongoose.connection.db.collection('roles')
        .findOne({ 
          theater: theaterUsersDoc.theaterId,
          'roleList._id': new mongoose.Types.ObjectId(theaterUser.role)
        });
      
      if (rolesDoc && rolesDoc.roleList) {
        roleInfo = rolesDoc.roleList.find(
          r => r._id.toString() === theaterUser.role.toString() && r.isActive
        );
        
        if (roleInfo) {
          console.log(`✅ Role Found: ${roleInfo.name}`);
          console.log(`   Role ID: ${roleInfo._id}`);
          console.log(`   Active: ${roleInfo.isActive}`);
          
          if (roleInfo.name && roleInfo.name.toLowerCase().includes('admin')) {
            userType = 'theater_admin';
          }
          
          if (roleInfo.permissions && Array.isArray(roleInfo.permissions)) {
            console.log(`   Total Permissions: ${roleInfo.permissions.length}`);
            
            const accessiblePermissions = roleInfo.permissions.filter(p => p.hasAccess === true);
            console.log(`   Accessible: ${accessiblePermissions.length}\n`);
            
            rolePermissions = [{
              role: {
                _id: roleInfo._id,
                name: roleInfo.name,
                description: roleInfo.description || ''
              },
              permissions: accessiblePermissions
            }];
            
            // Show first 5 accessible permissions
            console.log('📋 First 5 Accessible Permissions:\n');
            accessiblePermissions.slice(0, 5).forEach((p, idx) => {
              console.log(`${idx + 1}. Page: ${p.page || 'N/A'}`);
              console.log(`   Route: ${p.route || 'N/A'}`);
              console.log(`   Has Access: ${p.hasAccess}`);
              console.log('');
            });
          } else {
            console.log('⚠️ No permissions array found\n');
          }
        } else {
          console.log('❌ Role not found in roleList\n');
        }
      } else {
        console.log('❌ Roles document not found\n');
      }
    } else {
      console.log('⚠️ Invalid or missing role\n');
    }
    
    // Step 3: Simulate frontend route resolution
    console.log('STEP 3: Frontend Route Resolution\n');
    
    const getRouteFromPageId = (pageId, theaterId) => {
      const pageRouteMap = {
        'TheaterDashboardWithId': `/theater-dashboard/${theaterId}`,
        'TheaterSettingsWithId': `/theater-settings/${theaterId}`,
        'TheaterCategories': `/theater-categories/${theaterId}`,
        'TheaterKioskTypes': `/theater-kiosk-types/${theaterId}`,
        'TheaterProductTypes': `/theater-product-types/${theaterId}`,
        'TheaterProductList': `/theater-products/${theaterId}`,
        'OnlinePOSInterface': `/pos/${theaterId}`,
        'OfflinePOSInterface': `/offline-pos/${theaterId}`,
        'TheaterOrderHistory': `/theater-order-history/${theaterId}`,
        'OnlineOrderHistory': `/online-order-history/${theaterId}`,
        'TheaterAddProductWithId': `/theater-add-product/${theaterId}`,
        'TheaterRoles': `/theater-roles/${theaterId}`,
        'TheaterRoleAccess': `/theater-role-access/${theaterId}`,
        'TheaterQRCodeNames': `/theater-qr-code-names/${theaterId}`,
        'TheaterGenerateQR': `/theater-generate-qr/${theaterId}`,
        'TheaterQRManagement': `/theater-qr-management/${theaterId}`,
        'TheaterUserManagement': `/theater-user-management/${theaterId}`,
        'TheaterBanner': `/theater-banner/${theaterId}`,
        'TheaterMessages': `/theater-messages/${theaterId}`,
        'StockManagement': `/theater-stock-management/${theaterId}`,
        'SimpleProductList': `/simple-products/${theaterId}`,
        'ViewCart': `/view-cart/${theaterId}`,
        'ProfessionalPOSInterface': `/theater-order-pos/${theaterId}`,
        // Additional mappings from diagnosis
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
        'reports': `/theater-reports/${theaterId}`
      };
      
      return pageRouteMap[pageId] || null;
    };
    
    if (rolePermissions && rolePermissions.length > 0 && rolePermissions[0].permissions) {
      const accessiblePages = rolePermissions[0].permissions.filter(p => p.hasAccess === true);
      
      if (accessiblePages.length > 0) {
        const firstPage = accessiblePages[0];
        console.log(`First Accessible Page:`);
        console.log(`   page: "${firstPage.page}"`);
        console.log(`   route: "${firstPage.route || 'N/A'}"`);
        
        // Try to resolve route
        const firstRoute = firstPage.route 
          ? firstPage.route.replace(':theaterId', theaterUsersDoc.theaterId)
          : getRouteFromPageId(firstPage.page, theaterUsersDoc.theaterId);
        
        console.log(`\n🎯 Resolved Route: ${firstRoute || 'NOT FOUND'}`);
        
        if (!firstRoute) {
          console.log(`\n❌ BUG FOUND: Page ID "${firstPage.page}" has no route mapping!`);
          console.log(`   This is why it redirects to home page (fallback behavior)\n`);
          
          // Show all unmapped pages
          console.log('🔍 Checking all accessible pages for missing mappings:\n');
          accessiblePages.forEach((p, idx) => {
            const route = p.route 
              ? p.route.replace(':theaterId', theaterUsersDoc.theaterId)
              : getRouteFromPageId(p.page, theaterUsersDoc.theaterId);
            
            if (!route) {
              console.log(`❌ ${idx + 1}. "${p.page}" - NO MAPPING`);
            } else {
              console.log(`✅ ${idx + 1}. "${p.page}" → ${route}`);
            }
          });
        } else {
          console.log(`\n✅ LOGIN SHOULD WORK - Will redirect to: ${firstRoute}`);
        }
      } else {
        console.log('❌ No accessible pages found');
      }
    } else {
      console.log('❌ No role permissions found');
    }
    
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

testLoginFlow();
