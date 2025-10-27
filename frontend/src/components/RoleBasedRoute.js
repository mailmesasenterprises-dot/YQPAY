import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Helper function to get route from page ID
const getRouteFromPageId = (pageId, theaterId) => {
  const pageRouteMap = {
    'TheaterDashboardWithId': `/theater-dashboard/${theaterId}`,
    'TheaterSettingsWithId': `/theater-settings/${theaterId}`,
    'TheaterCategories': `/theater-categories/${theaterId}`,
    'TheaterKioskTypes': `/theater-kiosk-types/${theaterId}`,
    'TheaterProductTypes': `/theater-product-types/${theaterId}`,
    'TheaterProductList': `/theater-products/${theaterId}`,
    'TheaterOrderInterface': `/theater-order/${theaterId}`,
    'OnlinePOSInterface': `/online-pos/${theaterId}`,
    'TheaterOrderHistory': `/theater-order-history/${theaterId}`,
    'TheaterAddProductWithId': `/theater-add-product/${theaterId}`,
    'TheaterRoles': `/theater-roles/${theaterId}`,
    'TheaterRoleAccess': `/theater-role-access/${theaterId}`,
    'TheaterQRCodeNames': `/theater-qr-code-names/${theaterId}`,
    'TheaterGenerateQR': `/theater-generate-qr/${theaterId}`,
    'TheaterQRManagement': `/theater-qr-management/${theaterId}`,
    'TheaterUserManagement': `/theater-user-management/${theaterId}`,
    'StockManagement': `/theater-stock-management/${theaterId}`,
    'SimpleProductList': `/simple-products/${theaterId}`,
    'ViewCart': `/view-cart/${theaterId}`,
    'ProfessionalPOSInterface': `/theater-order-pos/${theaterId}`,
    'TheaterReports': `/theater-reports/${theaterId}`
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

  console.log('🛡️ ROLE DEBUG: RoleBasedRoute called for path:', location.pathname);
  console.log('🛡️ ROLE DEBUG: Auth state - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);
  console.log('🛡️ ROLE DEBUG: User info - userType:', userType, 'theaterId:', theaterId);
  console.log('🛡️ ROLE DEBUG: Allowed roles:', allowedRoles);

  // Show loading spinner while checking authentication
  if (isLoading) {
    console.log('🛡️ ROLE DEBUG: Still loading, showing spinner');
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
    console.log('🛡️ ROLE DEBUG: Not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (allowedRoles && allowedRoles.length > 0) {
    const hasValidRole = allowedRoles.includes(userType);
    console.log('🛡️ ROLE DEBUG: Role check - hasValidRole:', hasValidRole, 'for userType:', userType);
    
    if (!hasValidRole) {
      console.log('🛡️ ROLE DEBUG: Invalid role, redirecting based on userType:', userType);
      // Redirect theater users to their first accessible page
      if (userType === 'theater_user' && theaterId) {
        const firstAccessibleRoute = getFirstAccessibleRoute(rolePermissions, theaterId);
        if (firstAccessibleRoute) {
          console.log('🛡️ ROLE DEBUG: Redirecting theater_user to first accessible page:', firstAccessibleRoute);
          return <Navigate to={firstAccessibleRoute} replace />;
        }
      }
      // Redirect theater admin to their theater dashboard
      if (userType === 'theater_admin' && theaterId) {
        console.log('🛡️ ROLE DEBUG: Redirecting theater_admin to theater dashboard');
        return <Navigate to={`/theater-dashboard/${theaterId}`} replace />;
      }
      // Redirect super admin to admin dashboard for unauthorized access
      console.log('🛡️ ROLE DEBUG: Redirecting to admin dashboard');
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check for specific permissions if required (for theater users with role-based permissions)
  if (requiredPermissions.length > 0) {
    console.log('🛡️ PERMISSION CHECK: Required permissions:', requiredPermissions);
    console.log('🛡️ PERMISSION CHECK: User rolePermissions:', rolePermissions);
    
    let hasRequiredPermissions = false;
    
    // For super admin, grant all permissions
    if (userType === 'super_admin') {
      console.log('✅ PERMISSION CHECK: Super admin - all permissions granted');
      hasRequiredPermissions = true;
    }
    // For theater users, check role-based permissions from rolePermissions array
    else if (userType === 'theater_user' && rolePermissions && rolePermissions.length > 0) {
      // rolePermissions is an array like: [{ role: {...}, permissions: [...] }]
      const userPermissions = rolePermissions[0]?.permissions || [];
      console.log('🔍 PERMISSION CHECK: User has', userPermissions.length, 'permissions');
      
      hasRequiredPermissions = requiredPermissions.every(permission => {
        const hasAccess = userPermissions.some(p => p.page === permission && p.hasAccess === true);
        console.log(`🔍 PERMISSION CHECK: Checking "${permission}" - ${hasAccess ? '✅ GRANTED' : '❌ DENIED'}`);
        return hasAccess;
      });
      console.log(`🛡️ PERMISSION CHECK: Final result for theater_user - ${hasRequiredPermissions ? '✅ ACCESS GRANTED' : '❌ ACCESS DENIED'}`);
    }
    // For theater admins, grant all permissions (they have full access)
    else if (userType === 'theater_admin') {
      console.log('✅ PERMISSION CHECK: Theater admin - all permissions granted');
      hasRequiredPermissions = true;
    }
    // Legacy fallback for user.permissions
    else if (user?.permissions) {
      hasRequiredPermissions = requiredPermissions.every(permission => 
        user.permissions.includes(permission)
      );
      console.log(`🛡️ PERMISSION CHECK: Legacy permissions check - ${hasRequiredPermissions ? '✅ GRANTED' : '❌ DENIED'}`);
    }
    
    if (!hasRequiredPermissions) {
      console.log('❌ PERMISSION CHECK: Access denied - redirecting to first accessible page');
      // Redirect theater users to their first accessible page (not hardcoded dashboard)
      if (userType === 'theater_user' && theaterId) {
        const firstAccessibleRoute = getFirstAccessibleRoute(rolePermissions, theaterId);
        if (firstAccessibleRoute) {
          console.log('🔀 Redirecting to first accessible page:', firstAccessibleRoute);
          return <Navigate to={firstAccessibleRoute} replace />;
        } else {
          console.error('❌ No accessible pages found for user');
          return <Navigate to="/login" replace />;
        }
      }
      if (userType === 'theater_admin' && theaterId) {
        return <Navigate to={`/theater-dashboard/${theaterId}`} replace />;
      }
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Render the protected component
  console.log('🛡️ ROLE DEBUG: All checks passed, rendering protected component');
  return children;
};

export default RoleBasedRoute;