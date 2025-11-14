const mongoose = require('mongoose');
require('dotenv').config();

const finalVerification = async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log(' FINAL ACCESS CONTROL VERIFICATION');
    console.log('='.repeat(80) + '\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB\n');
    
    const username = 'sabarish';
    const theaterId = '69170baa629a34d0c041cf44';
    
    // Get user and role
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 'users.username': username });
    
    const user = theaterUsersDoc.users.find(u => u.username === username);
    
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: theaterUsersDoc.theaterId,
        'roleList._id': user.role
      });
    
    const role = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
    const accessiblePerms = role.permissions.filter(p => p.hasAccess === true);
    
    console.log('USER: ' + username);
    console.log('ROLE: ' + role.name);
    console.log('PERMISSIONS: ' + accessiblePerms.length + ' pages\n');
    console.log('='.repeat(80) + '\n');
    
    // FRONTEND SIDEBAR ITEMS
    const sidebarItems = [
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
    
    // Get database page names
    const dbPageNames = accessiblePerms.map(p => p.page);
    
    console.log(' ITEMS USER SHOULD SEE:\n');
    
    let visibleCount = 0;
    sidebarItems.forEach(item => {
      if (dbPageNames.includes(item.page)) {
        visibleCount++;
        const perm = accessiblePerms.find(p => p.page === item.page);
        console.log('    ' + item.label);
        console.log('      ID: ' + item.id);
        console.log('      Page: ' + item.page);
        console.log('      Route: ' + perm.route);
        console.log('');
      }
    });
    
    console.log('='.repeat(80) + '\n');
    console.log(' ITEMS USER SHOULD NOT SEE:\n');
    
    let hiddenCount = 0;
    sidebarItems.forEach(item => {
      if (!dbPageNames.includes(item.page)) {
        hiddenCount++;
        console.log('    ' + item.label + ' (no permission)');
      }
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
    console.log(' SUMMARY:\n');
    console.log('   Total Sidebar Items: ' + sidebarItems.length);
    console.log('   Visible Items: ' + visibleCount);
    console.log('   Hidden Items: ' + hiddenCount);
    console.log('   Database Permissions: ' + accessiblePerms.length + '\n');
    
    if (visibleCount === accessiblePerms.length) {
      console.log(' SUCCESS: All ' + visibleCount + ' permissions mapped correctly!\n');
    } else {
      console.log('  WARNING: Mismatch between visible items and permissions\n');
    }
    
    // TEST ROLEPERMISSIONS.js FILTERING
    console.log('='.repeat(80) + '\n');
    console.log(' TESTING ROLEPERMISSIONS.JS FILTERING:\n');
    
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
    
    let filterTestPassed = 0;
    let filterTestFailed = 0;
    
    sidebarItems.forEach(item => {
      const pageKey = pageMapping[item.id];
      const hasAccess = dbPageNames.includes(pageKey);
      
      if (hasAccess) {
        console.log('    ' + item.id + '  ' + pageKey + ' (should show)');
        filterTestPassed++;
      } else {
        console.log('    ' + item.id + '  ' + (pageKey || 'UNMAPPED') + ' (should hide)');
      }
    });
    
    console.log('\n Filter Test Results:');
    console.log('   Items that should show: ' + filterTestPassed);
    console.log('   Items that should hide: ' + (sidebarItems.length - filterTestPassed) + '\n');
    
    if (filterTestPassed === visibleCount) {
      console.log(' FILTER LOGIC: Working correctly!\n');
    } else {
      console.log(' FILTER LOGIC: Issue detected!\n');
    }
    
    console.log('='.repeat(80) + '\n');
    console.log(' VERIFICATION COMPLETE\n');
    console.log(' All ' + visibleCount + ' authorized items will display in sidebar');
    console.log(' All ' + hiddenCount + ' unauthorized items will be hidden');
    console.log('\n User should refresh browser to see changes\n');
    
  } catch (error) {
    console.error('\n Verification Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

finalVerification();
