const Role = require('../models/Role');
const RoleArray = require('../models/RoleArray'); // Use array-based structure
// const PageAccess = require('../models/PageAccess'); // DISABLED - OLD MODEL
const PageAccessArray = require('../models/PageAccessArray'); // NEW MODEL

/**
 * Role Service - Handles role creation and management logic
 * Updated to use nested array structure (RoleArray model) like QRCodeNameArray
 */

/**
 * Get default permissions for Theater Admin role
 * Theater Admin has access to all pages except super_admin specific pages
 */
async function getDefaultTheaterAdminPermissions() {
  try {
    // OLD: Fetch all active pages from global PageAccess collection
    // const allPages = await PageAccess.find({ isActive: true }).lean();
    
    // NEW: With array-based structure, pages are theater-specific
    // For default permissions, we'll use a basic set instead of querying
    return getBasicTheaterAdminPermissions();
    
  } catch (error) {
    console.error('❌ Error fetching default permissions:', error);
    // Return basic permissions if PageAccess fetch fails
    return getBasicTheaterAdminPermissions();
  }
}

/**
 * Fallback: Get basic permissions if PageAccess is not available
 */
function getBasicTheaterAdminPermissions() {
  return [
    { page: 'dashboard', pageName: 'dashboard', hasAccess: true, route: '/' },
    { page: 'products', pageName: 'products', hasAccess: true, route: '/theater/:theaterId/products' },
    { page: 'categories', pageName: 'categories', hasAccess: true, route: '/theater/:theaterId/categories' },
    { page: 'product-types', pageName: 'product-types', hasAccess: true, route: '/theater/:theaterId/product-types' },
    { page: 'stock', pageName: 'stock', hasAccess: true, route: '/theater/:theaterId/stock' },
    { page: 'orders', pageName: 'orders', hasAccess: true, route: '/theater/:theaterId/orders' },
    { page: 'pos', pageName: 'pos', hasAccess: true, route: '/theater/:theaterId/pos' },
    { page: 'order-history', pageName: 'order-history', hasAccess: true, route: '/theater/:theaterId/order-history' },
    { page: 'qr-management', pageName: 'qr-management', hasAccess: true, route: '/theater/:theaterId/qr-management' },
    { page: 'settings', pageName: 'settings', hasAccess: true, route: '/theater/:theaterId/settings' },
    { page: 'reports', pageName: 'reports', hasAccess: true, route: '/theater/:theaterId/reports' }
  ];
}

/**
 * Create default Theater Admin role for a theater (ARRAY-BASED STRUCTURE)
 * This role is created automatically when a new theater is created
 * Uses the nested array structure like QRCodeNameArray
 * 
 * @param {ObjectId} theaterId - The theater's MongoDB ObjectId
 * @param {String} theaterName - The theater's name (for role description)
 * @returns {Promise<Object>} The created role document
 */
async function createDefaultTheaterAdminRole(theaterId, theaterName) {
  try {

    // Find or create roles document for theater (similar to QRCodeNameArray)
    let rolesDoc = await RoleArray.findOrCreateByTheater(theaterId);
    // Check if default role already exists in the roleList array
    const existingDefaultRole = rolesDoc.roleList.find(role => role.isDefault === true);
    
    if (existingDefaultRole) {
      return existingDefaultRole;
    }
    
    // Get default permissions
    const permissions = await getDefaultTheaterAdminPermissions();
    // Create the Theater Admin role data
    const roleData = {
      name: 'Theater Admin',
      description: `Default administrator role for ${theaterName}. This role has full access to manage all theater operations including products, orders, stock, and reports. Cannot be deleted or edited.`,
      permissions: permissions,
      isGlobal: false,
      priority: 1, // Highest priority
      isActive: true,
      isDefault: true, // Mark as default role
      canDelete: false, // Cannot be deleted
      canEdit: false // Cannot be edited
    };
    // Add role to the nested array using the addRole method
    const savedRole = await rolesDoc.addRole(roleData);
    return savedRole;
    
  } catch (error) {
    console.error('❌ Error creating default Theater Admin role:', error);
    throw error;
  }
}

/**
 * Get default permissions for Kiosk Screen role
 * Kiosk users can only access kiosk-specific pages
 */
function getDefaultKioskPermissions() {
  return [
    { page: 'KioskProductList', pageName: 'Kiosk Product List', hasAccess: true, route: '/kiosk-products/:theaterId' },
    { page: 'KioskCart', pageName: 'Kiosk Cart', hasAccess: true, route: '/kiosk-cart/:theaterId' },
    { page: 'KioskCheckout', pageName: 'Kiosk Checkout', hasAccess: true, route: '/kiosk-checkout/:theaterId' },
    { page: 'KioskPayment', pageName: 'Kiosk Payment', hasAccess: true, route: '/kiosk-payment/:theaterId' },
    { page: 'KioskViewCart', pageName: 'Kiosk View Cart', hasAccess: true, route: '/kiosk-view-cart/:theaterId' }
  ];
}

/**
 * Create default Kiosk Screen role for a theater
 * This role is created automatically when a new theater is created
 * 
 * @param {ObjectId} theaterId - The theater's MongoDB ObjectId
 * @param {String} theaterName - The theater's name (for role description)
 * @returns {Promise<Object>} The created role document
 */
async function createDefaultKioskRole(theaterId, theaterName) {
  try {
    // Find or create roles document for theater
    let rolesDoc = await RoleArray.findOrCreateByTheater(theaterId);
    
    // Check if Kiosk role already exists
    const existingKioskRole = rolesDoc.roleList.find(role => 
      role.name === 'Kiosk Screen' && role.isDefault === true
    );
    
    if (existingKioskRole) {
      return existingKioskRole;
    }
    
    // Get kiosk permissions
    const permissions = getDefaultKioskPermissions();
    
    // Create the Kiosk Screen role data
    const roleData = {
      name: 'Kiosk Screen',
      description: `Default kiosk role for ${theaterName}. This role provides access to self-service kiosk screens for customers to browse menu, add items to cart, and checkout. Cannot be deleted or edited.`,
      permissions: permissions,
      isGlobal: false,
      priority: 10, // Lower priority than Theater Admin
      isActive: true,
      isDefault: true, // Mark as default role
      canDelete: false, // Cannot be deleted
      canEdit: false // Cannot be edited
    };
    
    // Add role to the nested array using the addRole method
    const savedRole = await rolesDoc.addRole(roleData);
    return savedRole;
    
  } catch (error) {
    console.error('❌ Error creating default Kiosk Screen role:', error);
    throw error;
  }
}

/**
 * Check if a role is protected (default role) - ARRAY-BASED STRUCTURE
 * 
 * @param {ObjectId} roleId - The role's MongoDB ObjectId
 * @returns {Promise<Boolean>} True if role is protected
 */
async function isProtectedRole(roleId) {
  try {
    // Find the roles document that contains this role in its roleList
    const rolesDoc = await RoleArray.findOne({ 'roleList._id': roleId }).lean();
    if (!rolesDoc) return false;
    
    // Find the role in the roleList array
    const role = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
    return role && role.isDefault === true;
  } catch (error) {
    console.error('❌ Error checking if role is protected:', error);
    return false;
  }
}

/**
 * Check if role can be deleted - ARRAY-BASED STRUCTURE
 * 
 * @param {ObjectId} roleId - The role's MongoDB ObjectId
 * @returns {Promise<Object>} { canDelete: Boolean, reason: String }
 */
async function canDeleteRole(roleId) {
  try {
    // Find the roles document that contains this role in its roleList
    const rolesDoc = await RoleArray.findOne({ 'roleList._id': roleId }).lean();
    
    if (!rolesDoc) {
      return { canDelete: false, reason: 'Role not found' };
    }
    
    // Find the role in the roleList array
    const role = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
    
    if (!role) {
      return { canDelete: false, reason: 'Role not found' };
    }
    
    if (role.isDefault && !role.canDelete) {
      return { 
        canDelete: false, 
        reason: `Cannot delete default Theater Admin role. This role is automatically created and protected.` 
      };
    }
    
    return { canDelete: true, reason: null };
    
  } catch (error) {
    console.error('❌ Error checking if role can be deleted:', error);
    return { canDelete: false, reason: 'Error checking role permissions' };
  }
}

/**
 * Check if role can be edited - ARRAY-BASED STRUCTURE
 * 
 * @param {ObjectId} roleId - The role's MongoDB ObjectId
 * @returns {Promise<Object>} { canEdit: Boolean, reason: String }
 */
async function canEditRole(roleId) {
  try {
    // Find the roles document that contains this role in its roleList
    const rolesDoc = await RoleArray.findOne({ 'roleList._id': roleId }).lean();
    
    if (!rolesDoc) {
      return { canEdit: false, reason: 'Role not found' };
    }
    
    // Find the role in the roleList array
    const role = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
    
    if (!role) {
      return { canEdit: false, reason: 'Role not found' };
    }
    
    if (role.isDefault && !role.canEdit) {
      return { 
        canEdit: false, 
        reason: `Cannot edit default Theater Admin role. This role is automatically managed and protected.` 
      };
    }
    
    return { canEdit: true, reason: null };
    
  } catch (error) {
    console.error('❌ Error checking if role can be edited:', error);
    return { canEdit: false, reason: 'Error checking role permissions' };
  }
}

/**
 * Get default role for a theater - ARRAY-BASED STRUCTURE
 * 
 * @param {ObjectId} theaterId - The theater's MongoDB ObjectId
 * @returns {Promise<Object|null>} The default role document or null
 */
async function getDefaultRoleForTheater(theaterId) {
  try {
    // Find the roles document for this theater
    const rolesDoc = await RoleArray.findOne({ theater: theaterId }).lean();
    if (!rolesDoc) return null;
    
    // Find the default role in the roleList array
    return rolesDoc.roleList.find(role => role.isDefault === true) || null;
  } catch (error) {
    console.error('❌ Error fetching default role:', error);
    return null;
  }
}

/**
 * Check if update request is permission-only (for default roles)
 * Default roles can update permissions but not other fields
 * 
 * @param {Object} updateData - The update request data
 * @returns {Boolean} True if only permissions/isActive are being updated
 */
function isPermissionOnlyUpdate(updateData) {
  const allowedFields = ['permissions', 'isActive'];
  const restrictedFields = ['name', 'description', 'priority', 'isGlobal', 'canDelete', 'canEdit', 'isDefault'];
  
  // Check if any restricted fields are present
  const hasRestrictedFields = restrictedFields.some(field => updateData[field] !== undefined);
  
  // Check if at least permissions field is present
  const hasPermissions = updateData.permissions !== undefined;
  
  return hasPermissions && !hasRestrictedFields;
}

/**
 * Validate role update request for default roles - ARRAY-BASED STRUCTURE
 * Provides detailed validation of what can/cannot be updated
 * 
 * @param {ObjectId} roleId - The role's MongoDB ObjectId
 * @param {Object} updateData - The update request data
 * @returns {Promise<Object>} Validation result with details
 */
async function validateRoleUpdate(roleId, updateData) {
  try {
    // Find the roles document that contains this role in its roleList
    const rolesDoc = await RoleArray.findOne({ 'roleList._id': roleId }).lean();
    
    if (!rolesDoc) {
      return { 
        canUpdate: false, 
        reason: 'Role not found',
        updateType: null
      };
    }
    
    // Find the role in the roleList array
    const role = rolesDoc.roleList.find(r => r._id.toString() === roleId.toString());
    
    if (!role) {
      return { 
        canUpdate: false, 
        reason: 'Role not found',
        updateType: null
      };
    }
    
    // Default roles have special rules
    if (role.isDefault) {
      // Check if this is a permission-only update
      if (isPermissionOnlyUpdate(updateData)) {
        return { 
          canUpdate: true, 
          reason: null,
          updateType: 'permissions_only',
          message: 'Default Theater Admin role: Only permissions can be updated'
        };
      } else {
        return { 
          canUpdate: false, 
          reason: 'Default Theater Admin role is protected. Only page access permissions can be updated. Role name, description, and other properties cannot be modified.',
          updateType: 'restricted',
          allowedFields: ['permissions', 'isActive'],
          blockedFields: ['name', 'description', 'priority', 'isGlobal', 'canDelete', 'canEdit', 'isDefault'],
          providedFields: Object.keys(updateData)
        };
      }
    }
    
    // Non-default roles can be fully edited
    return { 
      canUpdate: true, 
      reason: null, 
      updateType: 'full',
      message: 'Regular role: All fields can be updated'
    };
    
  } catch (error) {
    console.error('❌ Error validating role update:', error);
    return { 
      canUpdate: false, 
      reason: 'Error validating update request',
      updateType: null
    };
  }
}

module.exports = {
  createDefaultTheaterAdminRole,
  createDefaultKioskRole,
  getDefaultTheaterAdminPermissions,
  getBasicTheaterAdminPermissions,
  getDefaultKioskPermissions,
  isProtectedRole,
  canDeleteRole,
  canEditRole,
  getDefaultRoleForTheater,
  isPermissionOnlyUpdate,
  validateRoleUpdate
};
