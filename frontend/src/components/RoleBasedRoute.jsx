import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Page name mapping (CamelCase to lowercase)
const pageNameMapping = {
  // CamelCase (used in routes) → lowercase (used in database)
  'TheaterDashboardWithId': 'dashboard',
  'TheaterSettingsWithId': 'settings',
  'TheaterCategories': 'categories',
  'TheaterKioskTypes': 'kiosk-types',
  'TheaterProductTypes': 'product-types',
  'TheaterProductList': 'products',
  'TheaterAddProductWithId': 'add-product',
  'OnlinePOSInterface': 'pos',
  'OfflinePOSInterface': 'offline-pos',
  'TheaterOrderHistory': 'order-history',
  'OnlineOrderHistory': 'online-order-history',
  'KioskOrderHistory': 'kiosk-order-history',
  'TheaterRoles': 'theater-roles',
  'TheaterRoleAccess': 'theater-role-access',
  'TheaterQRCodeNames': 'qr-code-names',
  'TheaterGenerateQR': 'generate-qr',
  'TheaterQRManagement': 'qr-management',
  'TheaterUserManagement': 'theater-users',
  'TheaterBanner': 'banner',
  'TheaterMessages': 'messages',
  'StockManagement': 'stock',
  'OrderManagement': 'orders',
  'ReportGeneration': 'reports'
};

// Helper function to get route from page ID
const getRouteFromPageId = (pageId, theaterId) => {
  const pageRouteMap = {
    'TheaterDashboardWithId': `/theater-dashboard/${theaterId}`,
    'dashboard': `/theater-dashboard/${theaterId}`,
    'TheaterSettingsWithId': `/theater-settings/${theaterId}`,
    'settings': `/theater-settings/${theaterId}`,
    'TheaterCategories': `/theater-categories/${theaterId}`,
    'categories': `/theater-categories/${theaterId}`,
    'TheaterKioskTypes': `/theater-kiosk-types/${theaterId}`,
    'kiosk-types': `/theater-kiosk-types/${theaterId}`,
    'TheaterProductTypes': `/theater-product-types/${theaterId}`,
    'product-types': `/theater-product-types/${theaterId}`,
    'TheaterProductList': `/theater-products/${theaterId}`,
    'products': `/theater-products/${theaterId}`,
    'OnlinePOSInterface': `/pos/${theaterId}`,
    'pos': `/pos/${theaterId}`,
    'OfflinePOSInterface': `/offline-pos/${theaterId}`,
    'offline-pos': `/offline-pos/${theaterId}`,
    'TheaterOrderHistory': `/theater-order-history/${theaterId}`,
    'order-history': `/theater-order-history/${theaterId}`,
    'OnlineOrderHistory': `/online-order-history/${theaterId}`,
    'online-order-history': `/online-order-history/${theaterId}`,
    'KioskOrderHistory': `/kiosk-order-history/${theaterId}`,
    'kiosk-order-history': `/kiosk-order-history/${theaterId}`,
    'TheaterAddProductWithId': `/theater-add-product/${theaterId}`,
    'add-product': `/theater-add-product/${theaterId}`,
    'TheaterRoles': `/theater-roles/${theaterId}`,
    'theater-roles': `/theater-roles/${theaterId}`,
    'TheaterRoleAccess': `/theater-role-access/${theaterId}`,
    'theater-role-access': `/theater-role-access/${theaterId}`,
    'TheaterQRCodeNames': `/theater-qr-code-names/${theaterId}`,
    'qr-code-names': `/theater-qr-code-names/${theaterId}`,
    'TheaterGenerateQR': `/theater-generate-qr/${theaterId}`,
    'generate-qr': `/theater-generate-qr/${theaterId}`,
    'TheaterQRManagement': `/theater-qr-management/${theaterId}`,
    'qr-management': `/theater-qr-management/${theaterId}`,
    'TheaterUserManagement': `/theater-user-management/${theaterId}`,
    'theater-users': `/theater-user-management/${theaterId}`,
    'TheaterBanner': `/theater-banner/${theaterId}`,
    'banner': `/theater-banner/${theaterId}`,
    'TheaterMessages': `/theater-messages/${theaterId}`,
    'messages': `/theater-messages/${theaterId}`,
    'StockManagement': `/theater-stock-management/${theaterId}`,
    'stock': `/theater-stock-management/${theaterId}`,
    'OrderManagement': `/theater-orders/${theaterId}`,
    'orders': `/theater-orders/${theaterId}`,
    'ReportGeneration': `/theater-reports/${theaterId}`,
    'reports': `/theater-reports/${theaterId}`,
    'SimpleProductList': `/simple-products/${theaterId}`,
    'ViewCart': `/view-cart/${theaterId}`,
    'ProfessionalPOSInterface': `/theater-order-pos/${theaterId}`
  };
  
  return pageRouteMap[pageId] || null;
};

// Helper function to get first accessible page route
const getFirstAccessibleRoute = (rolePermissions, theaterId) => {
  if (!rolePermissions || rolePermissions.length === 0) {
    return null;
  }
  
  const userPermissions = rolePermissions[0]?.permissions || [];
  const accessiblePages = userPermissions.filter(p => p.hasAccess === true);
  
  if (accessiblePages.length > 0) {
    const firstPage = accessiblePages[0];
    // Try to get route from permission object first, then fall back to page ID mapping
    return firstPage.route 
      ? firstPage.route.replace(':theaterId', theaterId)
      : getRouteFromPageId(firstPage.page, theaterId);
  }
  
  return null;
};

// Role-based route protection component
const RoleBasedRoute = ({ children, allowedRoles, requiredPermissions = [] }) => {
  const { isAuthenticated, isLoading, user, userType, rolePermissions, theaterId } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="page-loader">
        <div className="loader-container">
          <div className="loader-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (allowedRoles && allowedRoles.length > 0) {
    const hasValidRole = allowedRoles.includes(userType);

    if (!hasValidRole) {
      // Redirect theater users to their first accessible page
      if (userType === 'theater_user' && theaterId) {
        const firstAccessibleRoute = getFirstAccessibleRoute(rolePermissions, theaterId);
        if (firstAccessibleRoute) {
          return <Navigate to={firstAccessibleRoute} replace />;
        }
      }
      // Redirect theater admin to their theater dashboard
      if (userType === 'theater_admin' && theaterId) {
        return <Navigate to={`/theater-dashboard/${theaterId}`} replace />;
      }
      // Redirect super admin to admin dashboard for unauthorized access
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check for specific permissions if required (for theater users with role-based permissions)
  if (requiredPermissions.length > 0) {

    let hasRequiredPermissions = false;
    
    // For super admin, grant all permissions
    if (userType === 'super_admin') {
      hasRequiredPermissions = true;
    }
    // For theater users AND theater admins, check role-based permissions from rolePermissions array
    else if ((userType === 'theater_user' || userType === 'theater_admin') && rolePermissions && rolePermissions.length > 0) {
      // rolePermissions is an array like: [{ role: {...}, permissions: [...] }]
      const userPermissions = rolePermissions[0]?.permissions || [];

      hasRequiredPermissions = requiredPermissions.every(permission => {
        // Convert CamelCase permission to lowercase for comparison
        const lowercasePermission = pageNameMapping[permission] || permission.toLowerCase();
        
        // Check if user has access to this page (support both naming conventions)
        const hasAccess = userPermissions.some(p => {
          const pageName = p.page.toLowerCase();
          return (pageName === lowercasePermission || p.page === permission) && p.hasAccess === true;
        });
        
        return hasAccess;
      });
    }
    // Legacy fallback for user.permissions
    else if (user?.permissions) {
      hasRequiredPermissions = requiredPermissions.every(permission => 
        user.permissions.includes(permission)
      );
    }
    
    if (!hasRequiredPermissions) {
      // Show access denied page with first accessible page link
      const firstAccessibleRoute = (userType === 'theater_user' || userType === 'theater_admin') && theaterId
        ? getFirstAccessibleRoute(rolePermissions, theaterId)
        : null;
      
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '40px', 
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            textAlign: 'center',
            maxWidth: '500px',
            width: '100%'
          }}>
            <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚫</div>
            <h2 style={{ color: '#dc3545', marginBottom: '15px', fontSize: '24px' }}>Access Denied</h2>
            <p style={{ color: '#666', marginBottom: '25px', lineHeight: '1.6' }}>
              You don't have permission to access this page. Please contact your administrator if you believe this is an error.
            </p>
            {firstAccessibleRoute ? (
              <button 
                onClick={() => window.location.href = firstAccessibleRoute}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  marginRight: '10px',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#5568d3'}
                onMouseOut={(e) => e.target.style.background = '#667eea'}
              >
                Go to Dashboard
              </button>
            ) : (
              <button 
                onClick={() => window.location.href = '/login'}
                style={{
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '500',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#5568d3'}
                onMouseOut={(e) => e.target.style.background = '#667eea'}
              >
                Back to Login
              </button>
            )}
          </div>
        </div>
      );
    }
  }

  // Render the protected component
  return children;
};

export default RoleBasedRoute;