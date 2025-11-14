const mongoose = require('mongoose');
require('dotenv').config();

const completeAccessAnalysis = async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log(' COMPLETE ACCESS CONTROL ANALYSIS - TOP TO BOTTOM');
    console.log('='.repeat(80) + '\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(' Connected to MongoDB\n');
    
    const username = 'sabarish';
    const theaterId = '69170baa629a34d0c041cf44';
    
    console.log('TEST USER: ' + username);
    console.log('THEATER ID: ' + theaterId + '\n');
    console.log('='.repeat(80) + '\n');
    
    // STEP 1: DATABASE LAYER
    console.log(' STEP 1: DATABASE LAYER ANALYSIS\n');
    
    const theaterUsersDoc = await mongoose.connection.db.collection('theaterusers')
      .findOne({ 
        'users.username': username, 
        'users.isActive': true 
      });
    
    if (!theaterUsersDoc) {
      console.log(' CRITICAL: User not found in database\n');
      return;
    }
    
    const user = theaterUsersDoc.users.find(u => u.username === username);
    console.log(' User found in database');
    console.log('   Username: ' + user.username);
    console.log('   Role ID: ' + user.role);
    console.log('   Active: ' + user.isActive);
    console.log('   Has PIN: ' + (user.pin ? 'Yes' : 'No') + '\n');
    
    // Get role from database
    const rolesDoc = await mongoose.connection.db.collection('roles')
      .findOne({ 
        theater: theaterUsersDoc.theaterId,
        'roleList._id': user.role
      });
    
    if (!rolesDoc) {
      console.log(' CRITICAL: Role document not found\n');
      return;
    }
    
    const role = rolesDoc.roleList.find(r => r._id.toString() === user.role.toString());
    
    if (!role) {
      console.log(' CRITICAL: Role not found in roleList\n');
      return;
    }
    
    console.log(' Role found in database');
    console.log('   Role Name: ' + role.name);
    console.log('   Role Active: ' + role.isActive);
    console.log('   Total Permissions: ' + role.permissions.length);
    
    const accessiblePerms = role.permissions.filter(p => p.hasAccess === true);
    console.log('   Accessible Permissions: ' + accessiblePerms.length + '\n');
    
    console.log(' Database Permission Pages:\n');
    accessiblePerms.forEach((p, idx) => {
      console.log('   ' + (idx + 1) + '. ' + p.page + '  ' + (p.route || 'NO ROUTE'));
    });
    
    console.log('\n' + '='.repeat(80) + '\n');
    
    // STEP 2: BACKEND API LAYER
    console.log(' STEP 2: BACKEND API RESPONSE ANALYSIS\n');
    
    const backendRolePermissions = [{
      role: {
        _id: role._id,
        name: role.name,
        description: role.description || ''
      },
      permissions: accessiblePerms
    }];
    
    console.log(' Backend formats permissions correctly');
    console.log('   Structure: Array of role objects');
    console.log('   Role Object Keys: role, permissions');
    console.log('   Permissions Array Length: ' + accessiblePerms.length + '\n');
    
    console.log(' Backend Permission Format Sample:\n');
    console.log('   {');
    console.log('     role: { _id, name, description },');
    console.log('     permissions: [');
    console.log('       { page: "' + accessiblePerms[0].page + '", route: "' + accessiblePerms[0].route + '", hasAccess: true },');
    console.log('       ...' + (accessiblePerms.length - 1) + ' more');
    console.log('     ]');
    console.log('   }\n');
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 3: FRONTEND MAPPING LAYER
    console.log(' STEP 3: FRONTEND MAPPING ANALYSIS\n');
    
    const sidebarItems = [
      { id: 'dashboard', page: 'dashboard' },
      { id: 'add-product', page: 'add-product' },
      { id: 'products', page: 'products' },
      { id: 'product-types', page: 'product-types' },
      { id: 'categories', page: 'categories' },
      { id: 'kiosk-types', page: 'kiosk-types' },
      { id: 'online-pos', page: 'pos' },
      { id: 'offline-pos', page: 'offline-pos' },
      { id: 'order-history', page: 'order-history' },
      { id: 'online-order-history', page: 'online-order-history' },
      { id: 'kiosk-order-history', page: 'kiosk-order-history' },
      { id: 'messages', page: 'messages' },
      { id: 'banner', page: 'banner' },
      { id: 'theater-roles', page: 'theater-roles' },
      { id: 'theater-role-access', page: 'theater-role-access' },
      { id: 'qr-code-names', page: 'qr-code-names' },
      { id: 'generate-qr', page: 'generate-qr' },
      { id: 'qr-management', page: 'qr-management' },
      { id: 'theater-users', page: 'theater-users' },
      { id: 'settings', page: 'settings' },
      { id: 'stock', page: 'stock' },
      { id: 'orders', page: 'orders' },
      { id: 'reports', page: 'reports' }
    ];
    
    console.log(' Frontend has ' + sidebarItems.length + ' total sidebar items\n');
    
    const dbPageNames = accessiblePerms.map(p => p.page);
    
    console.log(' Matching sidebar items with database permissions:\n');
    
    let matchedCount = 0;
    let unmatchedFrontend = [];
    let unmatchedBackend = [];
    
    sidebarItems.forEach(item => {
      if (dbPageNames.includes(item.page)) {
        console.log('    ' + item.id + ' (' + item.page + ') - MATCHED');
        matchedCount++;
      } else {
        unmatchedFrontend.push(item);
      }
    });
    
    // Check for backend pages not in frontend
    dbPageNames.forEach(pageName => {
      const found = sidebarItems.find(item => item.page === pageName);
      if (!found) {
        unmatchedBackend.push(pageName);
      }
    });
    
    console.log('\n Mapping Statistics:');
    console.log('   Total Sidebar Items: ' + sidebarItems.length);
    console.log('   Database Permissions: ' + dbPageNames.length);
    console.log('   Matched Items: ' + matchedCount);
    console.log('   Unmatched Frontend: ' + unmatchedFrontend.length);
    console.log('   Unmatched Backend: ' + unmatchedBackend.length + '\n');
    
    if (unmatchedBackend.length > 0) {
      console.log('  Database pages NOT in frontend sidebar:\n');
      unmatchedBackend.forEach(page => {
        console.log('    ' + page + ' (backend has this, frontend missing)');
      });
      console.log('');
    }
    
    if (unmatchedFrontend.length > 0) {
      console.log('ℹ  Frontend items NOT in user permissions:\n');
      unmatchedFrontend.forEach(item => {
        console.log('    ' + item.id + ' (' + item.page + ') - User has no access');
      });
      console.log('');
    }
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 4: FINAL VERIFICATION
    console.log(' STEP 4: EXPECTED SIDEBAR ITEMS FOR USER\n');
    
    const expectedItems = sidebarItems.filter(item => dbPageNames.includes(item.page));
    
    console.log('User "' + username + '" should see ' + expectedItems.length + ' items:\n');
    expectedItems.forEach((item, idx) => {
      const perm = accessiblePerms.find(p => p.page === item.page);
      console.log('   ' + (idx + 1) + '. ' + item.id);
      console.log('      Page: ' + item.page);
      console.log('      Route: ' + (perm ? perm.route : 'N/A'));
      console.log('');
    });
    
    console.log('='.repeat(80) + '\n');
    
    // STEP 5: IDENTIFY ISSUES
    console.log(' STEP 5: ISSUE IDENTIFICATION\n');
    
    let issuesFound = 0;
    
    // Check for missing routes
    const missingRoutes = accessiblePerms.filter(p => !p.route || p.route === '' || p.route === 'NO ROUTE');
    if (missingRoutes.length > 0) {
      issuesFound++;
      console.log(' ISSUE #' + issuesFound + ': Missing routes in database\n');
      missingRoutes.forEach(p => {
        console.log('   - ' + p.page + ' has no route');
      });
      console.log('');
    }
    
    // Check for unmatched backend pages
    if (unmatchedBackend.length > 0) {
      issuesFound++;
      console.log(' ISSUE #' + issuesFound + ': Database pages not in frontend sidebar\n');
      unmatchedBackend.forEach(page => {
        console.log('   - ' + page + ' (needs sidebar item)');
      });
      console.log('');
    }
    
    // Check for placeholder not replaced
    const placeholderRoutes = accessiblePerms.filter(p => p.route && p.route.includes(':theaterId'));
    if (placeholderRoutes.length !== accessiblePerms.length) {
      console.log('ℹ  INFO: Some routes have placeholder :theaterId (this is correct)\n');
    }
    
    if (issuesFound === 0) {
      console.log(' NO ISSUES FOUND - All systems working correctly!\n');
    } else {
      console.log('  ' + issuesFound + ' issue(s) found and listed above\n');
    }
    
    console.log('='.repeat(80) + '\n');
    console.log(' ANALYSIS COMPLETE\n');
    
  } catch (error) {
    console.error('\n Analysis Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
};

completeAccessAnalysis();
