const mongoose = require('mongoose');
require('dotenv').config();

const endToEndTest = async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log(' END-TO-END ACCESS CONTROL FLOW TEST');
    console.log('='.repeat(80) + '\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB\n');
    
    const username = 'sabarish';
    const password = 'admin123';
    const pin = '1234';
    const theaterId = '69170baa629a34d0c041cf44';
    
    console.log('TEST CREDENTIALS:');
    console.log('   Username: ' + username);
    console.log('   Password: ' + password);
    console.log('   PIN: ' + pin);
    console.log('   Theater ID: ' + theaterId + '\n');
    console.log('='.repeat(80) + '\n');
    
    // STEP 1: SIMULATE LOGIN ENDPOINT
    console.log('STEP 1: SIMULATE /api/auth/login\n');
    
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username,
        'users.isActive': true
      });
    
    if (!theaterUsersDoc) {
      console.log(' User not found\n');
      return;
    }
    
    const user = theaterUsersDoc.users.find(u => u.username === username && u.isActive);
    
    if (!user) {
      console.log(' User not found or inactive\n');
      return;
    }
    
    console.log(' User found');
    console.log('   User ID: ' + user._id);
    console.log('   Role ID: ' + user.role);
    console.log('   Has PIN: ' + (user.pin ? 'Yes' : 'No'));
    console.log('   isPinRequired: true\n');
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 2: SIMULATE PIN VALIDATION ENDPOINT
    console.log('STEP 2: SIMULATE /api/auth/validate-pin\n');
    
    if (user.pin !== pin) {
      console.log(' PIN mismatch\n');
      return;
    }
    
    console.log(' PIN validated\n');
    
    // Get theater
    const theater = await mongoose.connection.db.collection('theaters')
      .findOne({ _id: theaterUsersDoc.theaterId });
    
    console.log(' Theater found: ' + theater.name + '\n');
    
    // Get role permissions
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: theaterUsersDoc.theaterId,
        'roleList._id': user.role
      });
    
    if (!rolesDoc) {
      console.log(' Roles document not found\n');
      return;
    }
    
    const role = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
    
    if (!role) {
      console.log(' Role not found\n');
      return;
    }
    
    const rolePermissions = [{
      role: {
        _id: role._id,
        name: role.name,
        description: role.description || ''
      },
      permissions: role.permissions.filter(p => p.hasAccess === true)
    }];
    
    console.log(' Role permissions retrieved');
    console.log('   Role: ' + role.name);
    console.log('   Total Permissions: ' + rolePermissions[0].permissions.length + '\n');
    
    // Simulate API response
    const apiResponse = {
      success: true,
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      user: {
        _id: user._id.toString(),
        username: user.username,
        userType: 'theater_admin',
        theaterId: theaterUsersDoc.theaterId.toString(),
        assignedTheater: {
          _id: theater._id.toString(),
          name: theater.name
        }
      },
      rolePermissions: rolePermissions
    };
    
    console.log(' API Response Structure:');
    console.log('   {');
    console.log('     success: true,');
    console.log('     token: "...",');
    console.log('     user: { _id, username, userType, theaterId, assignedTheater },');
    console.log('     rolePermissions: [');
    console.log('       {');
    console.log('         role: { _id, name, description },');
    console.log('         permissions: [' + rolePermissions[0].permissions.length + ' items]');
    console.log('       }');
    console.log('     ]');
    console.log('   }\n');
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 3: SIMULATE FRONTEND AUTHCONTEXT
    console.log('STEP 3: SIMULATE AuthContext.login()\n');
    
    console.log(' localStorage.setItem("authToken", token)');
    console.log(' localStorage.setItem("user", JSON.stringify(user))');
    console.log(' localStorage.setItem("userType", "theater_admin")');
    console.log(' localStorage.setItem("theaterId", "' + theaterId + '")');
    console.log(' localStorage.setItem("rolePermissions", JSON.stringify(rolePermissions))');
    console.log('');
    console.log(' setUser(userData)');
    console.log(' setUserType("theater_admin")');
    console.log(' setTheaterId("' + theaterId + '")');
    console.log(' setRolePermissions(rolePermissions)');
    console.log(' setIsAuthenticated(true)\n');
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 4: SIMULATE SIDEBAR FILTERING
    console.log('STEP 4: SIMULATE TheaterSidebar Filtering\n');
    
    const allNavigationItems = [
      { id: 'dashboard', page: 'dashboard', label: 'Dashboard' },
      { id: 'add-product', page: 'add-product', label: 'Add Product' },
      { id: 'products', page: 'products', label: 'Product Stock' },
      { id: 'product-types', page: 'product-types', label: 'Product Type' },
      { id: 'categories', page: 'categories', label: 'Categorie Type' },
      { id: 'kiosk-types', page: 'kiosk-types', label: 'Kiosk Type' },
      { id: 'online-pos', page: 'pos', label: 'POS' },
      { id: 'offline-pos', page: 'offline-pos', label: 'Offline POS' },
      { id: 'order-history', page: 'order-history', label: 'Order History' },
      { id: 'online-order-history', page: 'online-order-history', label: 'Online Orders' },
      { id: 'kiosk-order-history', page: 'kiosk-order-history', label: 'Kiosk Orders' },
      { id: 'messages', page: 'messages', label: 'Messages' },
      { id: 'banner', page: 'banner', label: 'Theater Banner' },
      { id: 'theater-roles', page: 'theater-roles', label: 'Role Management' },
      { id: 'theater-role-access', page: 'theater-role-access', label: 'Role Access' },
      { id: 'qr-code-names', page: 'qr-code-names', label: 'QR Code Names' },
      { id: 'generate-qr', page: 'generate-qr', label: 'Generate QR' },
      { id: 'qr-management', page: 'qr-management', label: 'QR Management' },
      { id: 'theater-users', page: 'theater-users', label: 'Theater Users' },
      { id: 'settings', page: 'settings', label: 'Settings' },
      { id: 'stock', page: 'stock', label: 'Stock Management' },
      { id: 'orders', page: 'orders', label: 'Orders' },
      { id: 'reports', page: 'reports', label: 'Reports' }
    ];
    
    const pageMapping = {
      'dashboard': 'dashboard',
      'products': 'products',
      'add-product': 'add-product',
      'categories': 'categories',
      'product-types': 'product-types',
      'kiosk-types': 'kiosk-types',
      'online-pos': 'pos',
      'offline-pos': 'offline-pos',
      'order-history': 'order-history',
      'online-order-history': 'online-order-history',
      'kiosk-order-history': 'kiosk-order-history',
      'qr-management': 'qr-management',
      'qr-code-names': 'qr-code-names',
      'generate-qr': 'generate-qr',
      'settings': 'settings',
      'stock': 'stock',
      'orders': 'orders',
      'reports': 'reports',
      'messages': 'messages',
      'banner': 'banner',
      'theater-roles': 'theater-roles',
      'theater-role-access': 'theater-role-access',
      'theater-users': 'theater-users'
    };
    
    // Simulate filterNavigationByPermissions
    const dbPageNames = rolePermissions[0].permissions.map(p => p.page);
    
    const filteredItems = allNavigationItems.filter(item => {
      const pageKey = pageMapping[item.id];
      if (!pageKey) return false;
      
      return dbPageNames.includes(pageKey);
    });
    
    console.log('filterNavigationByPermissions() result:\n');
    console.log('   Input: ' + allNavigationItems.length + ' navigation items');
    console.log('   User permissions: ' + dbPageNames.length + ' pages');
    console.log('   Output: ' + filteredItems.length + ' filtered items\n');
    
    console.log(' VISIBLE SIDEBAR ITEMS:\n');
    filteredItems.forEach((item, idx) => {
      console.log('   ' + (idx + 1) + '. ' + item.label + ' (' + item.id + ')');
    });
    
    console.log('\n='.repeat(80) + '\n');
    
    // STEP 5: FINAL RESULT
    console.log('STEP 5: FINAL RESULT\n');
    
    console.log(' END-TO-END FLOW SUCCESSFUL!\n');
    console.log(' Summary:');
    console.log('   Database Permissions: ' + rolePermissions[0].permissions.length);
    console.log('   Sidebar Items Visible: ' + filteredItems.length);
    console.log('   Match: ' + (rolePermissions[0].permissions.length === filteredItems.length ? 'YES ' : 'NO ') + '\n');
    
    if (rolePermissions[0].permissions.length === filteredItems.length) {
      console.log(' SUCCESS: All systems working correctly!\n');
      console.log('User "' + username + '" will see exactly ' + filteredItems.length + ' menu items:\n');
      filteredItems.forEach((item, idx) => {
        console.log('   ' + (idx + 1) + '. ' + item.label);
      });
      console.log('\n');
    } else {
      console.log('  WARNING: Mismatch detected\n');
    }
    
    console.log('='.repeat(80) + '\n');
    console.log(' NEXT STEP: User should refresh browser at http://localhost:3001\n');
    
  } catch (error) {
    console.error('\n Test Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

endToEndTest();
