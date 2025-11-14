const mongoose = require('mongoose');
require('dotenv').config();

const fixTheaterUserRole = async () => {
  try {
    console.log('\n🔧 Fixing Theater User Role Issue...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const username = process.argv[2] || 'sabarish';
    const theaterId = '69170baa629a34d0c041cf44'; // From diagnosis
    
    console.log(`👤 User: ${username}`);
    console.log(`🎭 Theater ID: ${theaterId}\n`);
    
    // Step 1: Find available roles for this theater
    console.log('🔍 Checking available roles for this theater...\n');
    
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ theater: new mongoose.Types.ObjectId(theaterId) });
    
    if (!rolesDoc) {
      console.log('❌ No roles document found for this theater');
      console.log('   Creating default roles...\n');
      
      // Create default roles document with admin role
      const defaultRolesDoc = {
        theater: new mongoose.Types.ObjectId(theaterId),
        roleList: [
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Theater Admin',
            description: 'Full access to all theater features',
            isActive: true,
            permissions: [
              { page: 'TheaterDashboardWithId', route: '/theater-dashboard/:theaterId', hasAccess: true },
              { page: 'TheaterSettingsWithId', route: '/theater-settings/:theaterId', hasAccess: true },
              { page: 'TheaterCategories', route: '/theater-categories/:theaterId', hasAccess: true },
              { page: 'TheaterKioskTypes', route: '/theater-kiosk-types/:theaterId', hasAccess: true },
              { page: 'TheaterProductTypes', route: '/theater-product-types/:theaterId', hasAccess: true },
              { page: 'TheaterProductList', route: '/theater-products/:theaterId', hasAccess: true },
              { page: 'OnlinePOSInterface', route: '/pos/:theaterId', hasAccess: true },
              { page: 'OfflinePOSInterface', route: '/offline-pos/:theaterId', hasAccess: true },
              { page: 'TheaterOrderHistory', route: '/theater-order-history/:theaterId', hasAccess: true },
              { page: 'OnlineOrderHistory', route: '/online-order-history/:theaterId', hasAccess: true },
              { page: 'TheaterAddProductWithId', route: '/theater-add-product/:theaterId', hasAccess: true },
              { page: 'TheaterRoles', route: '/theater-roles/:theaterId', hasAccess: true },
              { page: 'TheaterRoleAccess', route: '/theater-role-access/:theaterId', hasAccess: true },
              { page: 'TheaterQRCodeNames', route: '/theater-qr-code-names/:theaterId', hasAccess: true },
              { page: 'TheaterGenerateQR', route: '/theater-generate-qr/:theaterId', hasAccess: true },
              { page: 'TheaterQRManagement', route: '/theater-qr-management/:theaterId', hasAccess: true },
              { page: 'TheaterUserManagement', route: '/theater-user-management/:theaterId', hasAccess: true },
              { page: 'TheaterBanner', route: '/theater-banner/:theaterId', hasAccess: true },
              { page: 'TheaterMessages', route: '/theater-messages/:theaterId', hasAccess: true },
              { page: 'StockManagement', route: '/theater-stock-management/:theaterId', hasAccess: true },
              { page: 'SimpleProductList', route: '/simple-products/:theaterId', hasAccess: true },
              { page: 'ViewCart', route: '/view-cart/:theaterId', hasAccess: true },
              { page: 'ProfessionalPOSInterface', route: '/theater-order-pos/:theaterId', hasAccess: true }
            ],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await mongoose.connection.db.collection('roles').insertOne(defaultRolesDoc);
      console.log('✅ Created default roles document');
      console.log(`   New Admin Role ID: ${defaultRolesDoc.roleList[0]._id}\n`);
      
      // Update user with new admin role
      const updateResult = await mongoose.connection.db.collection('theaterusers')
        .updateOne(
          { 
            theaterId: new mongoose.Types.ObjectId(theaterId),
            'users.username': username
          },
          { 
            $set: { 
              'users.$.role': defaultRolesDoc.roleList[0]._id,
              'users.$.updatedAt': new Date()
            }
          }
        );
      
      console.log(`✅ Updated user '${username}' with Theater Admin role`);
      console.log(`   Modified: ${updateResult.modifiedCount} user(s)\n`);
      
    } else {
      console.log(`✅ Roles document found with ${rolesDoc.roleList.length} role(s):\n`);
      
      // List all roles
      rolesDoc.roleList.forEach((role, index) => {
        const accessCount = role.permissions ? role.permissions.filter(p => p.hasAccess).length : 0;
        console.log(`${index + 1}. ${role.name}`);
        console.log(`   ID: ${role._id}`);
        console.log(`   Active: ${role.isActive}`);
        console.log(`   Accessible Pages: ${accessCount}/${role.permissions?.length || 0}`);
        console.log('');
      });
      
      // Find an active admin role or the first active role
      let targetRole = rolesDoc.roleList.find(r => 
        r.isActive && r.name && r.name.toLowerCase().includes('admin')
      );
      
      if (!targetRole) {
        targetRole = rolesDoc.roleList.find(r => r.isActive);
      }
      
      if (!targetRole) {
        console.log('❌ No active roles found');
        console.log('   ACTION: Activate at least one role or create a new one\n');
        return;
      }
      
      console.log(`🎯 Selected role: ${targetRole.name} (${targetRole._id})\n`);
      
      // Check if role has permissions
      if (!targetRole.permissions || targetRole.permissions.length === 0) {
        console.log('⚠️  WARNING: Selected role has no permissions');
        console.log('   Adding default permissions...\n');
        
        targetRole.permissions = [
          { page: 'TheaterDashboardWithId', route: '/theater-dashboard/:theaterId', hasAccess: true },
          { page: 'TheaterProductList', route: '/theater-products/:theaterId', hasAccess: true },
          { page: 'OnlinePOSInterface', route: '/pos/:theaterId', hasAccess: true },
          { page: 'TheaterOrderHistory', route: '/theater-order-history/:theaterId', hasAccess: true }
        ];
        
        // Update the role with permissions
        await mongoose.connection.db.collection('roles')
          .updateOne(
            { 
              theater: new mongoose.Types.ObjectId(theaterId),
              'roleList._id': targetRole._id
            },
            { 
              $set: { 
                'roleList.$.permissions': targetRole.permissions,
                'roleList.$.updatedAt': new Date()
              }
            }
          );
        
        console.log('✅ Added default permissions to role\n');
      }
      
      // Update user with the selected role
      const updateResult = await mongoose.connection.db.collection('theaterusers')
        .updateOne(
          { 
            theaterId: new mongoose.Types.ObjectId(theaterId),
            'users.username': username
          },
          { 
            $set: { 
              'users.$.role': targetRole._id,
              'users.$.updatedAt': new Date()
            }
          }
        );
      
      console.log(`✅ Updated user '${username}' with role: ${targetRole.name}`);
      console.log(`   Modified: ${updateResult.modifiedCount} user(s)\n`);
    }
    
    console.log('='.repeat(60));
    console.log('✅ FIX COMPLETE - User can now login!');
    console.log('='.repeat(60) + '\n');
    
    // Run diagnosis again to verify
    console.log('🔍 Running verification...\n');
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    const user = theaterUsersDoc.users.find(u => u.username === username);
    console.log(`✅ User role: ${user.role}`);
    
    const verifyRolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: new mongoose.Types.ObjectId(theaterId),
        'roleList._id': user.role
      });
    
    if (verifyRolesDoc) {
      const role = verifyRolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
      if (role) {
        const accessCount = role.permissions.filter(p => p.hasAccess).length;
        console.log(`✅ Role found: ${role.name}`);
        console.log(`✅ Accessible pages: ${accessCount}`);
        console.log('\n🎉 Login should work now!\n');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error during fix:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  }
};

fixTheaterUserRole();
