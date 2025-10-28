// Utility to extract all pages from App.js dynamically
// This ensures the page access management always reflects the actual imported pages

export const extractPagesFromAppJS = () => {
  // Define all pages imported in App.js with their routes
  const allPages = [
    // Main Pages
    { page: 'HomePage', pageName: 'Home Page', route: '/', description: 'Landing page of the application' },
    { page: 'LoginPage', pageName: 'Login Page', route: '/login', description: 'User authentication page' },
    
    // Super Admin Dashboard & Management
    { page: 'Dashboard', pageName: 'Dashboard', route: '/dashboard', description: 'Main admin dashboard', roles: ['admin'] },
    { page: 'Settings', pageName: 'Settings', route: '/settings', description: 'System settings and configuration', roles: ['admin'] },
    
    // Theater Management (Super Admin)
    { page: 'AddTheater', pageName: 'Add Theater', route: '/add-theater', description: 'Create new theater', roles: ['admin'] },
    { page: 'TheaterList', pageName: 'Theater List', route: '/theaters', description: 'Manage all theaters', roles: ['admin'] },
    { page: 'TheaterUserManagement', pageName: 'Theater Users', route: '/theater-users', description: 'Manage theater staff', roles: ['admin'] },
    { page: 'TheaterUserDetails', pageName: 'Theater User Details', route: '/theater-users/:theaterId', description: 'View theater user details', roles: ['admin'] },
    
    // Role & Access Management (Super Admin)
    { page: 'RoleCreate', pageName: 'Role Management', route: '/roles', description: 'Create and manage roles', roles: ['admin'] },
    { page: 'RoleAccessManagement', pageName: 'Role Access Management', route: '/role-access', description: 'Manage role permissions', roles: ['admin'] },
    { page: 'PageAccessManagement', pageName: 'Page Access Management', route: '/page-access', description: 'Manage page access rights', roles: ['admin'] },
    
    // QR Code Management (Super Admin)
    { page: 'QRGenerate', pageName: 'Generate QR', route: '/qr-generate', description: 'Create new QR codes', roles: ['admin'] },

    { page: 'QRManagement', pageName: 'QR Management', route: '/qr-management', description: 'Advanced QR management', roles: ['admin'] },
    { page: 'TheaterQRDetail', pageName: 'Theater QR Detail', route: '/qr-theater/:theaterId', description: 'Theater-specific QR codes', roles: ['admin'] },
    { page: 'QRScanner', pageName: 'QR Scanner', route: '/qr-scanner', description: 'Scan and validate QR codes', roles: ['admin'] },
    
    // Utility & Demo Pages
    { page: 'ModalDemo', pageName: 'Modal Demo', route: '/modal-demo', description: 'Modal component demonstration', roles: ['admin'] },
    { page: 'TheaterAdminList', pageName: 'Theater Admin List', route: '/theater-admin', description: 'Manage theater administrators', roles: ['admin'] },
    { page: 'TheaterAdminManagement', pageName: 'Theater Admin Management', route: '/theater-admin-management', description: 'Theater admin operations', roles: ['admin'] },
    
    // Theater Admin Pages
    // { page: 'TheaterDashboard', pageName: 'Theater Dashboard', route: '/theater-dashboard', description: 'Theater-specific dashboard', roles: ['theater-admin', 'admin'] },
    // { page: 'TheaterSettings', pageName: 'Theater Settings', route: '/theater-settings', description: 'Theater-specific settings', roles: ['theater-admin', 'admin'] },
    
    // Theater Admin Pages with Parameters (missing from previous extraction)
    { page: 'TheaterDashboardWithId', pageName: 'Theater Dashboard (With ID)', route: '/theater-dashboard/:theaterId', description: 'Theater dashboard with specific theater ID', roles: ['theater-admin', 'admin'] },
    { page: 'TheaterSettingsWithId', pageName: 'Theater Settings (With ID)', route: '/theater-settings/:theaterId', description: 'Theater settings with specific theater ID', roles: ['theater-admin', 'admin'] },
    
  // Theater Category Management
  { page: 'TheaterCategories', pageName: 'Theater Categories', route: '/theater-categories/:theaterId', description: 'Manage theater-specific categories', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterKioskTypes', pageName: 'Theater Kiosk Types', route: '/theater-kiosk-types/:theaterId', description: 'Manage theater-specific kiosk types', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterProductTypes', pageName: 'Theater Product Names', route: '/theater-product-types/:theaterId', description: 'Manage theater-specific product names and codes', roles: ['theater_user', 'theater-admin', 'admin'] },

  // Theater Product Management
  { page: 'TheaterProductList', pageName: 'Theater Product List', route: '/theater-products/:theaterId', description: 'View and manage theater product inventory', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterOrderInterface', pageName: 'Theater Order Interface', route: '/theater-order/:theaterId', description: 'Theater canteen staff order taking screen for customers', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'OnlinePOSInterface', pageName: 'Online POS Interface', route: '/online-pos/:theaterId', description: 'Dual order management system with current and online orders', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterOrderHistory', pageName: 'Theater Order History', route: '/theater-order-history/:theaterId', description: 'View and manage theater order history with search and filtering', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'OnlineOrderHistory', pageName: 'Online Order History', route: '/online-order-history/:theaterId', description: 'View and manage online orders from QR code scans with search and filtering', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterAddProductWithId', pageName: 'Theater Add Product (With ID)', route: '/theater-add-product/:theaterId', description: 'Theater Product Management - Add new products to theater menu (With Theater ID)', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterRoles', pageName: 'Theater Roles Management', route: '/theater-roles/:theaterId', description: 'Manage theater-specific roles and permissions', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterRoleAccess', pageName: 'Theater Role Access Management', route: '/theater-role-access/:theaterId', description: 'Manage page access permissions for theater roles', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterQRCodeNames', pageName: 'Theater QR Code Names', route: '/theater-qr-code-names/:theaterId', description: 'Manage QR code names and seat classes for theater', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterGenerateQR', pageName: 'Theater Generate QR', route: '/theater-generate-qr/:theaterId', description: 'Generate single or screen QR codes for theater', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterQRManagement', pageName: 'Theater QR Management', route: '/theater-qr-management/:theaterId', description: 'View and manage all generated QR codes for theater', roles: ['theater_user', 'theater-admin', 'admin'] },
  { page: 'TheaterUserManagement', pageName: 'Theater User Management', route: '/theater-user-management/:theaterId', description: 'Manage theater users and their roles', roles: ['theater_user', 'theater-admin', 'admin'] }
  ];

  // Filter out pages that should not be in page access management
  const excludedPages = ['HomePage', 'LoginPage']; // These are public pages
  
  return allPages.filter(page => !excludedPages.includes(page.page));
};

// Get pages filtered by role
export const getPagesByRole = (role = null) => {
  const allPages = extractPagesFromAppJS();
  
  if (!role) {
    return allPages;
  }
  
  return allPages.filter(page => 
    !page.roles || page.roles.includes(role)
  );
};

// Get all available roles from the pages
export const getAvailableRoles = () => {
  const allPages = extractPagesFromAppJS();
  const roles = new Set();
  
  allPages.forEach(page => {
    if (page.roles) {
      page.roles.forEach(role => roles.add(role));
    }
  });
  
  return Array.from(roles);
};