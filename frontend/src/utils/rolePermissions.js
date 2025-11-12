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
      'dashboard': 'TheaterDashboardWithId',
      'online-pos': 'OnlinePOSInterface',
      'offline-pos': 'OfflinePOSInterface', // ✅ Offline POS
      'order-history': 'TheaterOrderHistory',
      'online-order-history': 'OnlineOrderHistory', // ✅ Online Orders (QR Code orders only)
      'kiosk-order-history': 'KioskOrderHistory', // ✅ Kiosk Orders (POS orders only)
      'staff-order-history': 'StaffOrderHistory', // Staff can see only their own orders
      'products': 'TheaterProductList',
      'add-product': 'TheaterAddProductWithId', 
      'categories': 'TheaterCategories',
      'kiosk-types': 'TheaterKioskTypes',
      'product-types': 'TheaterProductTypes',
      'messages': 'TheaterMessages', // ✅ Messages (Chat with Super Admin)
      'banner': 'TheaterBanner', // ✅ Theater Banner
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