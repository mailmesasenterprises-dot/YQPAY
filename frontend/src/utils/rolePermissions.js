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

    return [];
  }

  const filteredItems = navigationItems.filter(item => {
    // Map navigation item IDs to page keys that are stored in the database
    const pageMapping = {
      // Match database page names (lowercase simple names)
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
      'theater-users': 'theater-users',
      // Also support CamelCase names for backward compatibility
      'TheaterDashboardWithId': 'dashboard',
      'OnlinePOSInterface': 'pos',
      'OfflinePOSInterface': 'offline-pos',
      'TheaterOrderHistory': 'order-history',
      'OnlineOrderHistory': 'online-order-history',
      'KioskOrderHistory': 'kiosk-order-history',
      'StaffOrderHistory': 'staff-order-history',
      'TheaterProductList': 'products',
      'TheaterAddProductWithId': 'add-product',
      'TheaterCategories': 'categories',
      'TheaterKioskTypes': 'kiosk-types',
      'TheaterProductTypes': 'product-types',
      'TheaterMessages': 'messages',
      'TheaterBanner': 'banner',
      'TheaterRoles': 'theater-roles',
      'TheaterRoleAccess': 'theater-role-access',
      'TheaterQRCodeNames': 'qr-code-names',
      'TheaterGenerateQR': 'generate-qr',
      'TheaterQRManagement': 'qr-management',
      'TheaterUserManagement': 'theater-users',
      'TheaterSettingsWithId': 'settings'
    };

    const pageKey = pageMapping[item.id];
    if (!pageKey) {

      return false;
    }

    return hasPageAccess(rolePermissions, pageKey);
  });


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


  return accessiblePages;
};