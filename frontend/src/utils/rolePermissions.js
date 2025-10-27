/**
 * Role Permission Utilities
 * Functions to check if user has access to specific pages based on role permissions
 */

/**
 * Check if user has access to a specific page based on role permissions
 * @param {Array} rolePermissions - Array of role permission objects from user context
 * @param {string} pageKey - Page identifier to check access for
 * @returns {boolean} - True if user has access, false otherwise
 */
export const hasPageAccess = (rolePermissions = [], pageKey) => {
  if (!rolePermissions || !Array.isArray(rolePermissions) || rolePermissions.length === 0) {
    console.log(`🔒 No role permissions found for page access check: ${pageKey}`);
    return false;
  }

  // Find any role permission that has access to this page
  const hasAccess = rolePermissions.some(rolePermission => {
    if (!rolePermission.permissions || !Array.isArray(rolePermission.permissions)) {
      return false;
    }

    // Check if this role has access to the specific page
    return rolePermission.permissions.some(permission => 
      permission.page === pageKey && permission.hasAccess === true
    );
  });

  console.log(`🔒 Page access check for "${pageKey}": ${hasAccess ? 'ALLOWED' : 'DENIED'}`);
  return hasAccess;
};

/**
 * Filter navigation items based on user's role permissions
 * @param {Array} navigationItems - Array of navigation item objects
 * @param {Array} rolePermissions - Array of role permission objects from user context
 * @returns {Array} - Filtered navigation items that user has access to
 */
export const filterNavigationByPermissions = (navigationItems = [], rolePermissions = []) => {
  if (!rolePermissions || rolePermissions.length === 0) {
    console.log('🔒 No role permissions found, showing no navigation items');
    return [];
  }

  const filteredItems = navigationItems.filter(item => {
    // Map navigation item IDs to page keys that are stored in the database
    const pageMapping = {
      'dashboard': 'TheaterDashboardWithId',
      'order-interface': 'TheaterOrderInterface',
      'online-pos': 'OnlinePOSInterface',
      'order-history': 'TheaterOrderHistory',
      'staff-order-history': 'StaffOrderHistory', // Staff can see only their own orders
      'products': 'TheaterProductList',
      'add-product': 'TheaterAddProductWithId', 
      'categories': 'TheaterCategories',
      'kiosk-types': 'TheaterKioskTypes',
      'product-types': 'TheaterProductTypes',
      'reports': 'TheaterReports', // ✅ NEW
      'theater-roles': 'TheaterRoles', // ✅ Theater Roles Management
      'theater-role-access': 'TheaterRoleAccess', // ✅ Theater Role Access Management
      'qr-code-names': 'TheaterQRCodeNames', // ✅ Theater QR Code Names
      'generate-qr': 'TheaterGenerateQR', // ✅ Theater Generate QR
      'qr-management': 'TheaterQRManagement', // ✅ Theater QR Management
      'theater-users': 'TheaterUserManagement', // ✅ Theater User Management
      'settings': 'TheaterSettingsWithId'
    };

    const pageKey = pageMapping[item.id];
    if (!pageKey) {
      console.log(`🔒 No page mapping found for navigation item: ${item.id}`);
      return false;
    }

    return hasPageAccess(rolePermissions, pageKey);
  });

  console.log(`🔒 Filtered navigation: ${filteredItems.length}/${navigationItems.length} items allowed`);
  console.log('🔒 Allowed items:', filteredItems.map(item => item.label));

  return filteredItems;
};

/**
 * Get all accessible pages for a user
 * @param {Array} rolePermissions - Array of role permission objects from user context
 * @returns {Array} - Array of page keys that user has access to
 */
export const getUserAccessiblePages = (rolePermissions = []) => {
  const accessiblePages = [];

  rolePermissions.forEach(rolePermission => {
    if (rolePermission.permissions && Array.isArray(rolePermission.permissions)) {
      rolePermission.permissions.forEach(permission => {
        if (permission.hasAccess === true && !accessiblePages.includes(permission.page)) {
          accessiblePages.push(permission.page);
        }
      });
    }
  });

  console.log('🔒 User accessible pages:', accessiblePages);
  return accessiblePages;
};