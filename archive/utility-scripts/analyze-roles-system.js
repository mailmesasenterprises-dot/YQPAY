const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theater_canteen_db')
  .then(async () => {
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get all roles
    const roles = await db.collection('roles').find({}).toArray();
    
    console.log('=' .repeat(100));
    console.log('📋 ROLES MANAGEMENT SYSTEM - COMPREHENSIVE ANALYSIS REPORT');
    console.log('=' .repeat(100));
    console.log(`Database: theater_canteen_db`);
    console.log(`Collection: roles`);
    console.log(`Total Roles: ${roles.length}\n`);
    
    if (roles.length === 0) {
      console.log('⚠️  NO ROLES FOUND IN DATABASE');
      console.log('   The roles collection is empty\n');
    } else {
      // Group roles by theater
      const rolesByTheater = {};
      roles.forEach(role => {
        const theaterId = role.theater ? role.theater.toString() : 'NO_THEATER';
        if (!rolesByTheater[theaterId]) {
          rolesByTheater[theaterId] = [];
        }
        rolesByTheater[theaterId].push(role);
      });
      
      console.log('🏛️  STORAGE ARCHITECTURE:');
      console.log('-'.repeat(100));
      console.log('📦 Collection Type: Individual Documents (NOT Array-based)');
      console.log('🔑 Primary Key: _id (MongoDB ObjectId)');
      console.log('🎭 Foreign Key: theater (ObjectId reference)');
      console.log('📂 Structure: Each role is a separate document');
      console.log('🔗 Relationship: Many roles → One theater (Many-to-One)');
      console.log('-'.repeat(100));
      console.log();
      
      console.log('📊 THEATER-BASED DISTRIBUTION:');
      console.log('-'.repeat(100));
      console.log(`Total Theaters with Roles: ${Object.keys(rolesByTheater).length}`);
      console.log();
      
      // Analyze each theater
      for (const [theaterId, theaterRoles] of Object.entries(rolesByTheater)) {
        console.log(`\n🎭 Theater ID: ${theaterId}`);
        console.log(`   Total Roles: ${theaterRoles.length}`);
        console.log(`   Active Roles: ${theaterRoles.filter(r => r.isActive).length}`);
        console.log(`   Inactive Roles: ${theaterRoles.filter(r => !r.isActive).length}`);
        console.log(`   Default Roles: ${theaterRoles.filter(r => r.isDefault).length}`);
        console.log(`   Custom Roles: ${theaterRoles.filter(r => !r.isDefault).length}`);
        console.log();
        
        console.log(`   📝 Role Details:`);
        console.log(`   ${'#'.padEnd(6)} ${'NAME'.padEnd(25)} ${'STATUS'.padEnd(12)} ${'DEFAULT'.padEnd(10)} ${'PERMISSIONS'.padEnd(15)} ${'CREATED'}`);
        console.log(`   ${'-'.repeat(95)}`);
        
        theaterRoles.forEach((role, index) => {
          const status = role.isActive ? '✅ Active' : '❌ Inactive';
          const isDefault = role.isDefault ? '🛡️  Yes' : 'No';
          const permCount = role.permissions?.length || 0;
          const created = role.createdAt ? new Date(role.createdAt).toLocaleDateString() : 'N/A';
          
          console.log(
            `   ${String(index + 1).padEnd(6)} ${(role.name || 'Unnamed').substring(0, 24).padEnd(25)} ${status.padEnd(12)} ${isDefault.padEnd(10)} ${String(permCount).padEnd(15)} ${created}`
          );
        });
      }
      
      console.log('\n' + '='.repeat(100));
      console.log('🔍 DETAILED SCHEMA ANALYSIS:');
      console.log('='.repeat(100));
      
      // Analyze schema structure from first role
      if (roles.length > 0) {
        const sampleRole = roles[0];
        console.log('\n📋 Role Document Structure (Sample):');
        console.log('-'.repeat(100));
        console.log(JSON.stringify({
          _id: sampleRole._id,
          name: sampleRole.name,
          description: sampleRole.description,
          theater: sampleRole.theater,
          permissions: sampleRole.permissions ? `Array[${sampleRole.permissions.length}]` : '[]',
          isGlobal: sampleRole.isGlobal,
          priority: sampleRole.priority,
          isActive: sampleRole.isActive,
          isDefault: sampleRole.isDefault,
          canDelete: sampleRole.canDelete,
          canEdit: sampleRole.canEdit,
          normalizedName: sampleRole.normalizedName,
          createdAt: sampleRole.createdAt,
          updatedAt: sampleRole.updatedAt
        }, null, 2));
        
        if (sampleRole.permissions && sampleRole.permissions.length > 0) {
          console.log('\n📄 Permission Structure (Sample):');
          console.log('-'.repeat(100));
          console.log(JSON.stringify(sampleRole.permissions[0], null, 2));
        }
      }
      
      console.log('\n' + '='.repeat(100));
      console.log('🔄 DATA FLOW ANALYSIS:');
      console.log('='.repeat(100));
      console.log();
      console.log('1️⃣  FRONTEND (http://localhost:3001/roles)');
      console.log('   Component: RoleManagementList.js');
      console.log('   - Displays list of theaters');
      console.log('   - User clicks on theater to manage roles');
      console.log('   - Navigates to: /theater-roles/:theaterId');
      console.log('   - API Call: GET /api/roles?theaterId=<id>&page=1&limit=10');
      console.log();
      
      console.log('2️⃣  BACKEND API (http://localhost:5000/api/roles)');
      console.log('   Route: /backend/routes/roles.js');
      console.log('   - GET /api/roles → Fetch all roles (with optional theaterId filter)');
      console.log('   - GET /api/roles/:id → Fetch single role');
      console.log('   - POST /api/roles → Create new role');
      console.log('   - PUT /api/roles/:id → Update role');
      console.log('   - DELETE /api/roles/:id → Delete role');
      console.log('   Query filters: theaterId, page, limit, search, isActive');
      console.log();
      
      console.log('3️⃣  DATABASE STORAGE');
      console.log('   Collection: roles');
      console.log('   Structure: Individual Documents (NOT array-based)');
      console.log('   - Each role = Separate document');
      console.log('   - Indexed by: theater, isActive, isDefault, normalizedName');
      console.log('   - Relationship: roles.theater → theaters._id');
      console.log();
      
      console.log('='.repeat(100));
      console.log('⚠️  IMPORTANT DIFFERENCES vs ARRAY-BASED COLLECTIONS:');
      console.log('='.repeat(100));
      console.log();
      console.log('❌ NOT Array-Based (like productlist, qrcodenames, theaterusers):');
      console.log('   - Does NOT use embedded array structure');
      console.log('   - Does NOT store all roles in single document per theater');
      console.log('   - Does NOT use roleList[] array field');
      console.log();
      console.log('✅ Individual Document Model (traditional MongoDB):');
      console.log('   - Each role is a separate document');
      console.log('   - Linked to theater via ObjectId reference');
      console.log('   - Better for: Many roles per theater, frequent updates');
      console.log('   - Supports: Pagination, sorting, individual updates');
      console.log('   - Uses: Mongoose populate() for theater details');
      console.log();
      
      console.log('='.repeat(100));
      console.log('📊 STATISTICS SUMMARY:');
      console.log('='.repeat(100));
      
      const totalActive = roles.filter(r => r.isActive).length;
      const totalInactive = roles.filter(r => !r.isActive).length;
      const totalDefault = roles.filter(r => r.isDefault).length;
      const totalCustom = roles.filter(r => !r.isDefault).length;
      const avgPermissions = roles.reduce((sum, r) => sum + (r.permissions?.length || 0), 0) / roles.length;
      
      console.log();
      console.log(`📈 Total Roles: ${roles.length}`);
      console.log(`✅ Active: ${totalActive} (${((totalActive / roles.length) * 100).toFixed(1)}%)`);
      console.log(`❌ Inactive: ${totalInactive} (${((totalInactive / roles.length) * 100).toFixed(1)}%)`);
      console.log(`🛡️  Default: ${totalDefault} (${((totalDefault / roles.length) * 100).toFixed(1)}%)`);
      console.log(`✏️  Custom: ${totalCustom} (${((totalCustom / roles.length) * 100).toFixed(1)}%)`);
      console.log(`📄 Avg Permissions per Role: ${avgPermissions.toFixed(1)}`);
      console.log();
      
      // Check for duplicates
      const nameTheaterPairs = {};
      let hasDuplicates = false;
      
      roles.forEach(role => {
        const key = `${role.theater}_${role.normalizedName || (role.name ? role.name.toLowerCase() : 'unnamed')}`;
        if (nameTheaterPairs[key]) {
          hasDuplicates = true;
          console.log(`⚠️  Duplicate role name detected: "${role.name || 'Unnamed'}" in theater ${role.theater}`);
        }
        nameTheaterPairs[key] = true;
      });
      
      if (!hasDuplicates) {
        console.log('✅ No duplicate role names found (unique per theater)');
      }
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('🎯 CONCLUSION:');
    console.log('='.repeat(100));
    console.log();
    console.log('📋 ROLE STORAGE MODEL: Individual Documents (Traditional MongoDB)');
    console.log();
    console.log('✅ HOW IT WORKS:');
    console.log('   1. Each role is stored as a separate document in "roles" collection');
    console.log('   2. Theater ID is stored as ObjectId reference in "theater" field');
    console.log('   3. Frontend filters roles by theaterId using query parameter');
    console.log('   4. Backend uses theater ObjectId for filtering and population');
    console.log('   5. Supports efficient pagination, search, and individual updates');
    console.log();
    console.log('❌ NOT ARRAY-BASED:');
    console.log('   - Unlike productlist (uses productList array)');
    console.log('   - Unlike qrcodenames (uses qrList array)');
    console.log('   - Unlike theaterusers (uses userList array)');
    console.log('   - Roles use standard relational model with references');
    console.log();
    console.log('='.repeat(100));
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
