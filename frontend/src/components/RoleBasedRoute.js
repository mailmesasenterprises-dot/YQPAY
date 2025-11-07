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
    // For theater users, check role-based permissions from rolePermissions array
    else if (userType === 'theater_user' && rolePermissions && rolePermissions.length > 0) {
      // rolePermissions is an array like: [{ role: {...}, permissions: [...] }]
      const userPermissions = rolePermissions[0]?.permissions || [];

      hasRequiredPermissions = requiredPermissions.every(permission => {
        const hasAccess = userPermissions.some(p => p.page === permission && p.hasAccess === true);
        return hasAccess;
      });
    }
    // For theater admins, grant all permissions (they have full access)
    else if (userType === 'theater_admin') {
      hasRequiredPermissions = true;
    }
    // Legacy fallback for user.permissions
    else if (user?.permissions) {
      hasRequiredPermissions = requiredPermissions.every(permission => 
        user.permissions.includes(permission)
      );
    }
    
    if (!hasRequiredPermissions) {
      // Redirect theater users to their first accessible page (not hardcoded dashboard)
      if (userType === 'theater_user' && theaterId) {
        const firstAccessibleRoute = getFirstAccessibleRoute(rolePermissions, theaterId);
        if (firstAccessibleRoute) {
          return <Navigate to={firstAccessibleRoute} replace />;
        } else {
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
  return children;
};

export default RoleBasedRoute;