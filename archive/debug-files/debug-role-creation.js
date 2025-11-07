const mongoose = require('mongoose');
const RoleArray = require('./models/RoleArray');

async function debugRoleCreation() {
  try {
    console.log('🔍 Debugging role creation process...');
    
    await mongoose.connect('mongodb://localhost:27017/yqpay_db');
    console.log('✅ Connected to MongoDB');
    
    const theaterId = '68ed25e6962cb3e997acc163';
    
    // Step 1: Check if document exists
    console.log('\n1️⃣ Checking if RoleArray document exists...');
    let rolesDoc = await RoleArray.findOne({ theater: theaterId });
    console.log('Existing document:', rolesDoc ? 'Found' : 'Not found');
    
    // Step 2: Find or create
    console.log('\n2️⃣ Calling findOrCreateByTheater...');
    rolesDoc = await RoleArray.findOrCreateByTheater(theaterId);
    console.log('Document after findOrCreate:', {
      theater: rolesDoc.theater,
      roleListLength: rolesDoc.roleList.length,
      roleList: rolesDoc.roleList
    });
    
    // Step 3: Prepare role data
    const roleData = {
      name: 'Debug Test Role',
      description: 'Debug test description',
      permissions: [],
      priority: 1,
      isGlobal: false,
      isDefault: false,
      canDelete: true,
      canEdit: true
    };
    
    console.log('\n3️⃣ Role data to add:', roleData);
    
    // Step 4: Add role with detailed logging
    console.log('\n4️⃣ Calling addRole...');
    
    try {
      const newRole = await rolesDoc.addRole(roleData);
      console.log('✅ Role added successfully:', {
        id: newRole._id,
        name: newRole.name,
        permissionsLength: newRole.permissions.length,
        permissions: newRole.permissions
      });
    } catch (addError) {
      console.error('❌ Error in addRole:', addError.message);
      console.error('Full error:', addError);
      
      // Let's also check the validation errors
      if (addError.errors) {
        console.error('Validation errors:', addError.errors);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Debug error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

debugRoleCreation();