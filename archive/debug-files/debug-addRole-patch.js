const mongoose = require('mongoose');
const RoleArray = require('./models/RoleArray');

// Let's monkey-patch the addRole method to add logging
const originalAddRole = RoleArray.schema.methods.addRole;
RoleArray.schema.methods.addRole = async function(roleData) {
  console.log('🔍 addRole called with data:', JSON.stringify(roleData, null, 2));
  
  // Check if permissions are being modified somewhere
  if (roleData.permissions) {
    console.log('📋 Original permissions count:', roleData.permissions.length);
    roleData.permissions.forEach((perm, index) => {
      console.log(`📋 Permission ${index}:`, JSON.stringify(perm, null, 2));
    });
  }
  
  try {
    const result = await originalAddRole.call(this, roleData);
    console.log('✅ addRole result:', {
      id: result._id,
      name: result.name,
      permissionsCount: result.permissions.length
    });
    return result;
  } catch (error) {
    console.error('❌ addRole error:', error.message);
    throw error;
  }
};

console.log('🔧 Debug monkey-patch applied to addRole method');