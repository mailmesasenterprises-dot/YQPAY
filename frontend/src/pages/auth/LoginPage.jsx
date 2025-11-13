import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import config from '../../config';
import '../../styles/LoginPage.css';
import LoginHowItWorksSlider from '../../components/LoginHowItWorksSlider';
import { ultraFetch, useUltraFetch } from '../../utils/ultraFetch';


const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '', // Changed from email to support both email and username
    password: '',
    rememberMe: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false); // Add password visibility state
  const [showPinInput, setShowPinInput] = useState(false); // Show PIN input after password validation
  const [pin, setPin] = useState(''); // 4-digit PIN
  const [pendingAuth, setPendingAuth] = useState(null); // Store pending authentication data
  const navigate = useNavigate();
  const { login, logout, isAuthenticated, userType, theaterId, rolePermissions, isLoading: authLoading } = useAuth();
  const toast = useToast();

  // Helper function to get route from page ID
  const getRouteFromPageId = (pageId, theaterId) => {
    const pageRouteMap = {
      'TheaterDashboardWithId': `/theater-dashboard/${theaterId}`,
      'TheaterSettingsWithId': `/theater-settings/${theaterId}`,
      'TheaterCategories': `/theater-categories/${theaterId}`,
      'TheaterKioskTypes': `/theater-kiosk-types/${theaterId}`,
      'TheaterProductTypes': `/theater-product-types/${theaterId}`,
      'TheaterProductList': `/theater-products/${theaterId}`,
      'OnlinePOSInterface': `/pos/${theaterId}`,
      'OfflinePOSInterface': `/offline-pos/${theaterId}`, // Fixed: Use correct route
      'TheaterOrderHistory': `/theater-order-history/${theaterId}`,
      'OnlineOrderHistory': `/online-order-history/${theaterId}`, // Fixed: Use correct route
      'TheaterAddProductWithId': `/theater-add-product/${theaterId}`,
      'TheaterRoles': `/theater-roles/${theaterId}`,
      'TheaterRoleAccess': `/theater-role-access/${theaterId}`,
      'TheaterQRCodeNames': `/theater-qr-code-names/${theaterId}`,
      'TheaterGenerateQR': `/theater-generate-qr/${theaterId}`,
      'TheaterQRManagement': `/theater-qr-management/${theaterId}`,
      'TheaterUserManagement': `/theater-user-management/${theaterId}`,
      'TheaterBanner': `/theater-banner/${theaterId}`, // Added missing mapping
      'TheaterMessages': `/theater-messages/${theaterId}`, // Added missing mapping
      'StockManagement': `/theater-stock-management/${theaterId}`,
      'SimpleProductList': `/simple-products/${theaterId}`,
      'ViewCart': `/view-cart/${theaterId}`,
      'ProfessionalPOSInterface': `/theater-order-pos/${theaterId}`
    };
    
    return pageRouteMap[pageId] || null;
  };

  // Set browser tab title
  useEffect(() => {
    document.title = 'Login - YQPayNow';
  }, []);

  // ✅ REDIRECT LOGIC: Check if user is already authenticated (e.g., page refresh)
  useEffect(() => {
    // Only run redirect logic if coming from a page refresh or direct URL access
    // NOT during active login flow (handled in handlePinSubmit)
    if (!authLoading && isAuthenticated && !showPinInput) {
      console.log('🔄 [Redirect] Already authenticated, redirecting...');
      console.log('🔄 [Redirect] userType:', userType);
      console.log('🔄 [Redirect] rolePermissions:', rolePermissions);

      // Redirect based on user type
      if (userType === 'theater_user' || userType === 'theater_admin') {
        if (theaterId) {
          // ✅ Navigate to FIRST ACCESSIBLE PAGE based on role permissions
          if (rolePermissions && rolePermissions.length > 0 && rolePermissions[0].permissions) {
            const accessiblePages = rolePermissions[0].permissions.filter(p => p.hasAccess === true);
            if (accessiblePages.length > 0) {
              const firstPage = accessiblePages[0];
              // Get route from page ID using helper function
              const firstRoute = firstPage.route 
                ? firstPage.route.replace(':theaterId', theaterId)
                : getRouteFromPageId(firstPage.page, theaterId);
              
              if (firstRoute) {
                console.log('✅ [Redirect] Navigating to:', firstRoute);
                navigate(firstRoute, { replace: true });
                return;
              }
            }
          }
          // Only theater_admin should fallback to dashboard
          if (userType === 'theater_admin') {
            console.log('✅ [Redirect] Theater admin → dashboard');
            navigate(`/theater-dashboard/${theaterId}`, { replace: true });
          } else {
            // Theater user already logged in but no accessible pages
            // This shouldn't happen if login validation worked properly
            console.warn('⚠️ [Redirect] Theater user with no pages - this should have been caught at login');
            navigate(`/theater-dashboard/${theaterId}`, { replace: true });
          }
        } else {
          // Fallback if theaterId is missing
          navigate('/dashboard', { replace: true });
        }
      } else {
        // Super admin users go to admin dashboard
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, userType, theaterId, rolePermissions, authLoading, showPinInput, navigate]);

  // Show loading while checking authentication status
  if (authLoading) {
    return (
      <div className="page-loader">
        <div className="loader-container">
          <div className="loader-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // Handle PIN input change
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 4) {
      setPin(value);
      if (errors.pin) {
        setErrors(prev => ({ ...prev, pin: '' }));
      }
    }
  };

  // Handle PIN submission
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    
    if (pin.length !== 4) {
      setErrors({ pin: 'PIN must be 4 digits' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {

      const response = await fetch(`${config.api.baseUrl}/auth/validate-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: pendingAuth.userId,
          pin: pin,
          theaterId: pendingAuth.theaterId
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const userData = data.user;
        const userType = data.user.userType;
        const theaterId = data.user.theaterId;
        const rolePermissions = data.rolePermissions;
        
        console.log('🔍 [PIN] rolePermissions:', rolePermissions);
        console.log('🔍 [PIN] userType:', userType);
        console.log('🔍 [PIN] theaterId:', theaterId);
        
        // ✅ ROLE-BASED NAVIGATION: Check permissions BEFORE login to avoid useEffect race condition
        if (rolePermissions && rolePermissions.length > 0 && rolePermissions[0].permissions) {
          const accessiblePages = rolePermissions[0].permissions.filter(p => p.hasAccess === true);
          console.log('✅ [PIN] Accessible pages:', accessiblePages.length);
          
          if (accessiblePages.length > 0) {
            // Navigate to FIRST accessible page
            const firstPage = accessiblePages[0];
            console.log('🎯 [PIN] First accessible page:', firstPage);
            
            // Get route from page ID using helper function
            const firstRoute = firstPage.route 
              ? firstPage.route.replace(':theaterId', theaterId)
              : getRouteFromPageId(firstPage.page, theaterId);
            
            console.log('🚀 [PIN] Navigating to:', firstRoute);
            
            if (firstRoute) {
              // Complete login with AuthContext AFTER confirming navigation route
              login(userData, data.token, userType, theaterId, rolePermissions);
              
              // Show success toast
              toast.success('Login Successfully.');
              
              // Navigate to first accessible page
              navigate(firstRoute, { replace: true });
              return;
            } else {
              console.error('❌ [PIN] No valid route found for page:', firstPage);
              setErrors({ pin: 'Navigation error. Contact administrator.' });
              return;
            }
          } else {
            // ❌ NO accessible pages - show error, don't login
            console.error('❌ [PIN] No accessible pages found');
            setErrors({ pin: 'Your account has no page access. Contact administrator.' });
            return;
          }
        } else {
          // ❌ NO permissions defined - show error, don't login
          console.error('❌ [PIN] No role permissions found or invalid structure');
          setErrors({ pin: 'No role permissions found. Contact administrator.' });
          return;
        }
      } else {
        setErrors({ pin: data.error || 'Invalid PIN. Please try again.' });
      }
    } catch (error) {

      setErrors({ pin: 'Unable to validate PIN. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle back to password screen
  const handleBackToPassword = () => {
    setShowPinInput(false);
    setPin('');
    setPendingAuth(null);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Validation
    const newErrors = {};
    if (!formData.username) newErrors.username = 'Username/Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      // Real API call to backend authentication

      const response = await fetch(`${config.api.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // ✅ FIX: Send both email and username fields
          // Backend checks: email (for admins) || username (for theater users)
          ...(formData.username.includes('@') 
            ? { email: formData.username }
            : { username: formData.username }
          ),
          password: formData.password
        }),
      });


      const data = await response.json();

      if (response.ok && data.success) {
        // Check if PIN is required (theater users)
        if (data.isPinRequired) {

          setPendingAuth(data.pendingAuth);
          setShowPinInput(true);
          setIsLoading(false);
          return;
        }

        // Admin login - no PIN required
        const userData = data.user;
        const userType = data.user.userType; // Fix: get userType from data.user.userType
        const theaterId = data.user.theaterId || data.theaterId;
        const rolePermissions = data.rolePermissions; // Role-based permissions for theater users
        
        // Use AuthContext login method with theater data and permissions
        login(userData, data.token, userType, theaterId, rolePermissions);
        
        // Show success toast
        toast.success('Login Successfully.');
        
        // ✅ ROLE-BASED NAVIGATION: Navigate to first accessible page based on permissions
        console.log('🔍 [Login] User type:', userType);
        console.log('🔍 [Login] rolePermissions:', rolePermissions);
        
        if (userType === 'theater_user' || userType === 'theater_admin') {
          // For theater users, navigate to their first accessible page
          if (rolePermissions && rolePermissions.length > 0 && rolePermissions[0].permissions) {
            const accessiblePages = rolePermissions[0].permissions.filter(p => p.hasAccess === true);
            console.log('✅ [Login] Accessible pages:', accessiblePages.length);
            
            if (accessiblePages.length > 0) {
              // Navigate to FIRST accessible page (not always theater-dashboard)
              const firstPage = accessiblePages[0];
              console.log('🎯 [Login] First accessible page:', firstPage);
              
              // Get route from page ID using helper function
              const firstRoute = firstPage.route 
                ? firstPage.route.replace(':theaterId', theaterId)
                : getRouteFromPageId(firstPage.page, theaterId);
              
              console.log('🚀 [Login] Navigating to:', firstRoute);
              
              if (firstRoute) {
                navigate(firstRoute);
              } else {
                console.error('❌ [Login] No valid route found for page:', firstPage);
                setErrors({ password: 'Navigation error. Contact administrator.' });
                setIsLoading(false);
                return;
              }
            } else {
              // ❌ NO accessible pages - show error, don't navigate
              console.error('❌ [Login] No accessible pages found');
              setErrors({ password: 'Your account has no page access. Contact administrator.' });
              setIsLoading(false);
              return;
            }
          } else {
            // ❌ NO permissions defined - show error, don't navigate
            console.error('❌ [Login] No role permissions found or invalid structure');
            setErrors({ password: 'No role permissions found. Contact administrator.' });
            setIsLoading(false);
            return;
          }
        } else {
          // Super admin users go to admin dashboard
          navigate('/dashboard');
        }
      } else {
        // Handle login failure - show error message
        setErrors({ 
          general: data.message || 'Invalid email or password. Please try again.' 
        });
      }
    } catch (error) {

      setErrors({ 
        general: 'Unable to connect to server. Please check your connection and try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Side - How It Works Images Slider */}
      <div className="login-left-section">
        <div className="login-left-overlay"></div>
        <div className="login-left-content">
          <LoginHowItWorksSlider />
        </div>
      </div>

      {/* Right Side - Login Form Section */}
      <div className="login-right-section">
        <div className="login-form-container">
          {/* Header */}
          <div className="login-header">
            <h2 className="login-title">
              Welcome Back
            </h2>
            <p className="login-subtitle">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Error Message */}
          {errors.general && (
            <div className="error-banner">
              <span className="error-icon">!</span>
              {errors.general}
            </div>
          )}

          {/* Login Form - Password Step */}
          {!showPinInput && (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username / Email
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`form-input ${errors.username ? 'error' : ''}`}
                  placeholder="Enter username or email"
                />
                <span className="input-icon">👤</span>
              </div>
              {errors.username && (
                <span className="error-text">
                  {errors.username}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Enter your password"
                />
                <span 
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" stroke="currentColor" strokeWidth="2"/>
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              </div>
              {errors.password && (
                <span className="error-text">
                  {errors.password}
                </span>
              )}
            </div>

            <div className="form-options">
              <label className="checkbox-wrapper">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-label">Remember me</span>
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className={`submit-btn ${isLoading ? 'loading' : ''}`}
            >
              {isLoading && (
                <span className="loading-spinner"></span>
              )}
              {isLoading ? 'Signing In...' : 'Sign In to Dashboard'}
            </button>
          </form>
          )}

          {/* PIN Input Form - Second Step for Theater Users */}
          {showPinInput && (
          <form onSubmit={handlePinSubmit} className="login-form pin-form">
            <div className="pin-header">
              <h2 className="login-title">
                Enter Your PIN
              </h2>
              <p className="pin-instruction">
                Welcome, <strong>{pendingAuth?.username}</strong>!
                <br />
                Please enter your 4-digit PIN to continue
              </p>
            </div>

            {errors.pin && (
              <div className="error-banner">
                <span className="error-icon">!</span>
                {errors.pin}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="pin" className="form-label">
                4-Digit PIN
              </label>
              <div className="input-wrapper pin-input-wrapper">
                <button 
                  type="button" 
                  onClick={handleBackToPassword}
                  className="pin-back-button"
                  title="Back to password"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
                  </svg>
                </button>
                <input
                  type="password"
                  id="pin"
                  name="pin"
                  value={pin}
                  onChange={handlePinChange}
                  className={`form-input pin-input ${errors.pin ? 'error' : ''}`}
                  placeholder="••••"
                  maxLength="4"
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={pin.length !== 4 || isLoading}
              className={`submit-btn ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  <span>Validating PIN...</span>
                </>
              ) : (
                'Verify PIN & Continue'
              )}
            </button>
          </form>
          )}

          {/* Footer */}
          <div className="login-footer">
            <p className="footer-text">© 2025 YQPayNow. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
