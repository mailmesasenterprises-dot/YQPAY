/**
 * Frontend Global Configuration
 * Centralizes all frontend environment variables
 * Any new component automatically uses these settings
 */

// Smart API URL detection - uses current hostname DYNAMICALLY
const getApiBaseUrl = () => {
  // If environment variable is set and not empty, use it
  if (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim() !== '') {
    return process.env.REACT_APP_API_URL;
  }
  
  // In development, always use localhost:8080
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8080/api';
  }
  
  // In production, detect based on current window location at runtime
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Use the same hostname as the frontend for the API
  const dynamicUrl = `${protocol}//${hostname}/api`;

  return dynamicUrl;
};

// React environment variables must start with REACT_APP_
const config = {
  // ==============================================
  // API CONFIGURATION
  // ==============================================
  api: {
    // Use getter to make baseUrl dynamic - evaluated on each access
    get baseUrl() {
      return getApiBaseUrl();
    },
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT) || 10000,
    retryAttempts: parseInt(process.env.REACT_APP_API_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.REACT_APP_API_RETRY_DELAY) || 1000
  },

  // ==============================================
  // APP CONFIGURATION
  // ==============================================
  app: {
    name: process.env.REACT_APP_NAME || 'YQPayNow',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    publicUrl: process.env.PUBLIC_URL || ''
  },

  // ==============================================
  // BRANDING & THEME
  // ==============================================
  branding: {
    primaryColor: process.env.REACT_APP_PRIMARY_COLOR || '#6B0E9B',
    secondaryColor: process.env.REACT_APP_SECONDARY_COLOR || '#F3F4F6',
    logoUrl: process.env.REACT_APP_LOGO_URL || '/logo.png',
    faviconUrl: process.env.REACT_APP_FAVICON_URL || '/favicon.ico',
    companyName: process.env.REACT_APP_COMPANY_NAME || 'YQPayNow'
  },

  // ==============================================
  // AUTHENTICATION
  // ==============================================
  auth: {
    tokenKey: process.env.REACT_APP_TOKEN_KEY || 'yqpaynow_token',
    refreshTokenKey: process.env.REACT_APP_REFRESH_TOKEN_KEY || 'yqpaynow_refresh_token',
    userKey: process.env.REACT_APP_USER_KEY || 'yqpaynow_user',
    sessionTimeout: parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 3600000, // 1 hour
    autoLogoutWarning: parseInt(process.env.REACT_APP_AUTO_LOGOUT_WARNING) || 300000 // 5 minutes
  },

  // ==============================================
  // PAYMENT GATEWAYS
  // ==============================================
  payment: {
    stripe: {
      publicKey: process.env.REACT_APP_STRIPE_PUBLIC_KEY || 'pk_test_...',
      elements: {
        appearance: {
          theme: 'stripe'
        }
      }
    },
    paypal: {
      clientId: process.env.REACT_APP_PAYPAL_CLIENT_ID || '',
      currency: process.env.REACT_APP_PAYPAL_CURRENCY || 'USD'
    },
    razorpay: {
      keyId: process.env.REACT_APP_RAZORPAY_KEY_ID || '',
      currency: process.env.REACT_APP_RAZORPAY_CURRENCY || 'INR'
    }
  },

  // ==============================================
  // EXTERNAL SERVICES
  // ==============================================
  external: {
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    googleAnalyticsId: process.env.REACT_APP_GOOGLE_ANALYTICS_ID || '',
    facebookAppId: process.env.REACT_APP_FACEBOOK_APP_ID || '',
    twitterHandle: process.env.REACT_APP_TWITTER_HANDLE || '@yqpaynow'
  },

  // ==============================================
  // PERFORMANCE SETTINGS
  // ==============================================
  performance: {
    enableServiceWorker: process.env.REACT_APP_ENABLE_SERVICE_WORKER !== 'false',
    enableLazyLoading: process.env.REACT_APP_ENABLE_LAZY_LOADING !== 'false',
    imageOptimization: process.env.REACT_APP_ENABLE_IMAGE_OPTIMIZATION !== 'false',
    cacheTimeout: parseInt(process.env.REACT_APP_CACHE_TIMEOUT) || 300000, // 5 minutes
    maxCacheSize: parseInt(process.env.REACT_APP_MAX_CACHE_SIZE) || 50, // MB
    enableVirtualScrolling: process.env.REACT_APP_ENABLE_VIRTUAL_SCROLLING === 'true'
  },

  // ==============================================
  // UI/UX SETTINGS
  // ==============================================
  ui: {
    defaultLanguage: process.env.REACT_APP_DEFAULT_LANGUAGE || 'en',
    supportedLanguages: process.env.REACT_APP_SUPPORTED_LANGUAGES ? 
      process.env.REACT_APP_SUPPORTED_LANGUAGES.split(',') : ['en', 'es', 'hi'],
    defaultTimezone: process.env.REACT_APP_DEFAULT_TIMEZONE || 'UTC',
    dateFormat: process.env.REACT_APP_DATE_FORMAT || 'MM/DD/YYYY',
    timeFormat: process.env.REACT_APP_TIME_FORMAT || '12', // 12 or 24 hour
    currency: process.env.REACT_APP_CURRENCY || 'USD',
    currencySymbol: process.env.REACT_APP_CURRENCY_SYMBOL || '$'
  },

  // ==============================================
  // FEATURE FLAGS
  // ==============================================
  features: {
    enableQROrdering: process.env.REACT_APP_ENABLE_QR_ORDERING !== 'false',
    enableMultiplePayments: process.env.REACT_APP_ENABLE_MULTIPLE_PAYMENTS !== 'false',
    enableRealtimeUpdates: process.env.REACT_APP_ENABLE_REALTIME_UPDATES === 'true',
    enablePushNotifications: process.env.REACT_APP_ENABLE_PUSH_NOTIFICATIONS === 'true',
    enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS !== 'false',
    enableFeedback: process.env.REACT_APP_ENABLE_FEEDBACK !== 'false',
    enableChat: process.env.REACT_APP_ENABLE_CHAT === 'true',
    enableMaintenance: process.env.REACT_APP_MAINTENANCE_MODE === 'true'
  },

  // ==============================================
  // DEVELOPMENT SETTINGS
  // ==============================================
  development: {
    enableDebugMode: process.env.REACT_APP_DEBUG_MODE === 'true',
    enableConsoleLogging: process.env.REACT_APP_CONSOLE_LOGGING !== 'false',
    enablePerformanceLogging: process.env.REACT_APP_PERFORMANCE_LOGGING === 'true',
    enableErrorReporting: process.env.REACT_APP_ERROR_REPORTING !== 'false',
    mockApiDelay: parseInt(process.env.REACT_APP_MOCK_API_DELAY) || 0
  },

  // ==============================================
  // SECURITY SETTINGS
  // ==============================================
  security: {
    enableCSP: process.env.REACT_APP_ENABLE_CSP !== 'false',
    enableHTTPS: process.env.REACT_APP_ENABLE_HTTPS === 'true',
    enableSameSiteCookies: process.env.REACT_APP_ENABLE_SAMESITE_COOKIES !== 'false',
    sessionStoragePrefix: process.env.REACT_APP_SESSION_PREFIX || 'yqpaynow_',
    encryptLocalStorage: process.env.REACT_APP_ENCRYPT_LOCAL_STORAGE === 'true'
  }
};

/**
 * Helper functions for configuration access
 */
config.helpers = {
  // Get full API URL
  getApiUrl: (endpoint = '') => `${config.api.baseUrl}${endpoint}`,
  
  // Check if environment is development
  isDev: () => config.app.isDevelopment,
  
  // Check if environment is production
  isProd: () => config.app.isProduction,
  
  // Check if feature is enabled
  isFeatureEnabled: (feature) => config.features[feature] || false,
  
  // Get authentication token from storage
  // COMPATIBILITY FIX: Check both 'authToken' (legacy) and 'yqpaynow_token' (new standard)
  getAuthToken: () => {
    return localStorage.getItem('authToken') || localStorage.getItem(config.auth.tokenKey) || localStorage.getItem('token');
  },
  
  // Set authentication token in storage
  setAuthToken: (token) => localStorage.setItem(config.auth.tokenKey, token),
  
  // Remove authentication token from storage
  removeAuthToken: () => {
    localStorage.removeItem(config.auth.tokenKey);
    localStorage.removeItem(config.auth.refreshTokenKey);
    localStorage.removeItem(config.auth.userKey);
  },
  
  // Get user data from storage
  getUserData: () => {
    const userData = localStorage.getItem(config.auth.userKey);
    return userData ? JSON.parse(userData) : null;
  },
  
  // Set user data in storage
  setUserData: (user) => localStorage.setItem(config.auth.userKey, JSON.stringify(user)),
  
  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: config.ui.currency
    }).format(amount);
  },
  
  // Format date
  formatDate: (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(date));
  }
};

// Log configuration in development
if (config.app.isDevelopment && config.development.enableConsoleLogging) {
  }

export default config;
