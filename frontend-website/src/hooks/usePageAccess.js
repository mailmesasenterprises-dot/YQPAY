import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to check if user has access to current page
 * Returns: { hasAccess, firstAccessiblePage, isLoading, allowedPages }
 */
export const usePageAccess = () => {
  const { user, rolePermissions, theaterId, userType } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [allowedPages, setAllowedPages] = useState([]);
  const [firstAccessiblePage, setFirstAccessiblePage] = useState(null);

  useEffect(() => {
    const checkAccess = async () => {
      // Super admin has access to everything
      if (userType === 'super_admin') {
        setIsLoading(false);
        return;
      }

      // Theater users need to check permissions
      if (!theaterId || !rolePermissions || rolePermissions.length === 0) {

        setAllowedPages([]); // ✅ Explicitly set to empty (NO pages allowed)
        setFirstAccessiblePage(null); // ✅ No accessible page
        setIsLoading(false);
        return; // User will be blocked by ProtectedRoute
      }

      try {
        // Extract allowed pages from role permissions
        const permissions = rolePermissions[0]?.permissions || [];
        const allowedPageRoutes = permissions
          .filter(p => p.hasAccess === true)
          .map(p => ({
            route: p.route,
            pageName: p.pageName,
            page: p.page
          }));


        setAllowedPages(allowedPageRoutes);

        // Set first accessible page
        if (allowedPageRoutes.length > 0) {
          const firstPage = allowedPageRoutes[0];
          const firstRoute = firstPage.route.replace(':theaterId', theaterId);
          setFirstAccessiblePage(firstRoute);
  }

        setIsLoading(false);
      } catch (error) {

        setIsLoading(false);
      }
    };

    checkAccess();
  }, [theaterId, rolePermissions, userType]);

  /**
   * Check if current route is accessible
   */
  const hasAccessToCurrentPage = () => {
    // Super admin has access to everything
    if (userType === 'super_admin') {
      return true;
    }

    // ✅ SECURITY: If no pages are allowed, DENY access to everything
    if (!allowedPages || allowedPages.length === 0) {

      return false;
    }

    // Get current path without parameters
    const currentPath = location.pathname;
    
    // Check if current path matches any allowed route
    const hasAccess = allowedPages.some(page => {
      const routePattern = page.route.replace(':theaterId', theaterId);
      return currentPath === routePattern || currentPath.startsWith(routePattern);
    });


    return hasAccess;
  };

  /**
   * Redirect to first accessible page if no access to current page
   */
  const enforceAccess = () => {
    if (isLoading || userType === 'super_admin') {
      return;
    }

    const hasAccess = hasAccessToCurrentPage();
    
    if (!hasAccess && firstAccessiblePage) {

      navigate(firstAccessiblePage, { replace: true });
    }
  };

  return {
    hasAccess: hasAccessToCurrentPage(),
    firstAccessiblePage,
    isLoading,
    allowedPages,
    enforceAccess
  };
};
