import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageAccess } from '../hooks/usePageAccess';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, userType } = useAuth();
  const location = useLocation();
  const { hasAccess, firstAccessiblePage, isLoading: accessLoading, enforceAccess } = usePageAccess();

  // Show loading spinner while checking authentication
  if (isLoading || accessLoading) {
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

  // Super admin has access to everything
  if (userType === 'super_admin') {
    return children;
  }

  // Enforce page-level access control for theater users
  useEffect(() => {
    if (!accessLoading) {
      enforceAccess();
    }
  }, [location.pathname, accessLoading, enforceAccess]);

  // If no access and we have a first accessible page, redirect
  if (!hasAccess && firstAccessiblePage) {
    console.log('🚫 Redirecting to first accessible page:', firstAccessiblePage);
    return <Navigate to={firstAccessiblePage} replace />;
  }

  // If no access and no first accessible page, show error
  if (!hasAccess && !firstAccessiblePage && userType !== 'super_admin') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{ 
          background: 'white', 
          padding: '40px', 
          borderRadius: '10px',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '20px' }}>🚫 Access Denied</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            You don't have permission to access any pages. Please contact your administrator.
          </p>
          <button 
            onClick={() => window.location.href = '/login'}
            style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '10px 30px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Render the protected component
  return children;
};

export default ProtectedRoute;