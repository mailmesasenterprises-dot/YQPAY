import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 🚀 OPTIMIZED: Split context values to prevent unnecessary re-renders
const AuthStateContext = createContext();
const AuthActionsContext = createContext();

export const useAuthState = () => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used within an AuthProvider');
  }
  return context;
};

export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = React.memo(({ children }) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [theaterId, setTheaterId] = useState(null); // Add theater ID for data isolation
  const [rolePermissions, setRolePermissions] = useState([]); // Add role-based permissions
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // 🚀 OPTIMIZED: Instant session restoration - synchronous, no blocking
  useEffect(() => {
    const restoreSession = () => {
      const token = localStorage.getItem('authToken');
      const userData = localStorage.getItem('user');
      const storedUserType = localStorage.getItem('userType');
      const storedTheaterId = localStorage.getItem('theaterId');
      const storedRolePermissions = localStorage.getItem('rolePermissions');
      
      // 🚀 INSTANT: Restore from localStorage synchronously (no async needed)
      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          const parsedRolePermissions = storedRolePermissions ? JSON.parse(storedRolePermissions) : [];
          
          // 🚀 INSTANT: Set all state synchronously - no waiting
          setUser(parsedUser);
          setUserType(storedUserType || 'admin');
          setTheaterId(storedTheaterId);
          setRolePermissions(parsedRolePermissions);
          setIsAuthenticated(true);
          setIsLoading(false); // 🚀 CRITICAL: Set false immediately - don't wait for validation
          
          // Optional: Validate token in background (don't block UI)
          validateTokenInBackground(token);
          
        } catch (parseError) {
          // Only clear if data is corrupted
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          localStorage.removeItem('userType');
          localStorage.removeItem('theaterId');
          localStorage.removeItem('rolePermissions');
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsLoading(false); // 🚀 INSTANT: No loading if no session
      }
    };

    // Background token validation (optional, doesn't affect login state)
    const validateTokenInBackground = async (token) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${config.api.baseUrl}/auth/validate`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }).catch(err => {
          // Silently handle 404 or network errors - don't log to avoid noise
          if (err.name === 'AbortError' || err.message?.includes('404')) {
            return null;
          }
          throw err;
        });
        
        if (!response || !response.ok) {
          clearTimeout(timeoutId);
          return; // Silently fail - don't affect user experience
        }
        
        clearTimeout(timeoutId);
        
        // Token is valid - no action needed
        // User will be logged out when they try to make an API call if token is invalid
      } catch (error) {
        // Background validation error - ignore silently
        // Don't logout on network errors - user stays authenticated
      }
    };

    restoreSession();
  }, []);

  // 🚀 OPTIMIZED: Memoized state value to prevent re-renders
  const stateValue = useMemo(() => ({
    user,
    userType,
    theaterId,
    rolePermissions,
    isAuthenticated,
    isLoading,
  }), [user, userType, theaterId, rolePermissions, isAuthenticated, isLoading]);

  // 🚀 OPTIMIZED: Memoized login function
  const login = useCallback((userData, token, type = 'super_admin', userTheaterId = null, userRolePermissions = []) => {
    // ✅ FIX: Clean token before storing (remove quotes, trim whitespace)
    const cleanToken = String(token).trim().replace(/^["']|["']$/g, '');
    
    // Validate token format (should have 3 parts separated by dots)
    if (cleanToken.split('.').length !== 3) {
      console.error('❌ [AuthContext] Invalid token format, login failed');
      return;
    }
    
    localStorage.setItem('authToken', cleanToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('userType', type);
    
    if (userTheaterId) {
      localStorage.setItem('theaterId', userTheaterId);
      setTheaterId(userTheaterId);
    }
    
    if (userRolePermissions && userRolePermissions.length > 0) {
      localStorage.setItem('rolePermissions', JSON.stringify(userRolePermissions));
      setRolePermissions(userRolePermissions);
    }
    
    setUser(userData);
    setUserType(type);
    setIsAuthenticated(true);
  }, []);

  // 🚀 OPTIMIZED: Memoized logout function
  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    localStorage.removeItem('theaterId');
    localStorage.removeItem('rolePermissions');
    localStorage.setItem('logout-event', Date.now().toString());
    
    setUser(null);
    setUserType(null);
    setTheaterId(null);
    setRolePermissions([]);
    setIsAuthenticated(false);
    navigate('/login');
  }, [navigate]);

  // 🚀 OPTIMIZED: Memoized actions value
  const actionsValue = useMemo(() => ({
    login,
    logout,
  }), [login, logout]);

  // 🚀 OPTIMIZED: Combined value for backward compatibility
  const combinedValue = useMemo(() => ({
    ...stateValue,
    ...actionsValue,
  }), [stateValue, actionsValue]);

  // ✅ LISTEN FOR LOGOUT EVENTS: Handle logout from other tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'logout-event') {
        // Another tab triggered logout, sync this tab
        setUser(null);
        setUserType(null);
        setTheaterId(null);
        setRolePermissions([]);
        setIsAuthenticated(false);
        navigate('/login');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [navigate]);

  return (
    <AuthContext.Provider value={combinedValue}>
      <AuthStateContext.Provider value={stateValue}>
        <AuthActionsContext.Provider value={actionsValue}>
          {children}
        </AuthActionsContext.Provider>
      </AuthStateContext.Provider>
    </AuthContext.Provider>
  );
});

AuthProvider.displayName = 'AuthProvider';

export default AuthContext;