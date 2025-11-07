/**
 * Advanced Frontend Bundle Optimization
 * Code splitting, tree shaking, and dynamic imports
 */

import { lazy, Suspense } from 'react';

/**
 * Advanced lazy loading with error boundaries
 */
const createLazyComponent = (importFunc, fallback = null) => {
  const LazyComponent = lazy(importFunc);
  
  return (props) => (
    <Suspense 
      fallback={
        fallback || (
          <div className="lazy-loading-container">
            <div className="loading-spinner"></div>
            <p>Loading component...</p>
          </div>
        )
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
};

/**
 * Route-based code splitting
 */
export const LazyRoutes = {
  // Settings page with chunk name
  Settings: createLazyComponent(
    () => import(/* webpackChunkName: "settings" */ '../pages/Settings'),
    <div>Loading Settings...</div>
  ),
  
  // Dashboard with preload
  Dashboard: createLazyComponent(
    () => import(/* webpackChunkName: "dashboard", webpackPreload: true */ '../pages/Dashboard'),
    <div>Loading Dashboard...</div>
  ),
  
  // Upload demo page
  UploadDemo: createLazyComponent(
    () => import(/* webpackChunkName: "upload-demo" */ '../pages/UploadDemo'),
    <div>Loading Upload Demo...</div>
  ),
  
  // Modal demo (load on demand)
  ModalDemo: createLazyComponent(
    () => import(/* webpackChunkName: "modal-demo" */ '../pages/ModalDemo')
  )
};

/**
 * Component-level code splitting
 */
export const LazyComponents = {
  // Heavy components that can be split
  DataTable: createLazyComponent(
    () => import(/* webpackChunkName: "data-table" */ '../components/DataTable')
  ),
  
  Chart: createLazyComponent(
    () => import(/* webpackChunkName: "chart" */ '../components/Chart')
  ),
  
  ImageEditor: createLazyComponent(
    () => import(/* webpackChunkName: "image-editor" */ '../components/ImageEditor')
  )
};

/**
 * Feature-based code splitting
 */
export const LazyFeatures = {
  // Settings features
  DatabaseSettings: createLazyComponent(
    () => import(/* webpackChunkName: "settings-database" */ '../components/settings/DatabaseSettings')
  ),
  
  SecuritySettings: createLazyComponent(
    () => import(/* webpackChunkName: "settings-security" */ '../components/settings/SecuritySettings')
  ),
  
  // Menu management features
  MenuEditor: createLazyComponent(
    () => import(/* webpackChunkName: "menu-editor" */ '../components/menu/MenuEditor')
  )
};

/**
 * Dynamic import utilities
 */
export const dynamicImport = {
  /**
   * Load component on user interaction
   */
  loadOnClick: (importFunc) => {
    return async (event) => {
      event.preventDefault();
      const module = await importFunc();
      return module.default;
    };
  },
  
  /**
   * Load component on hover (preload)
   */
  loadOnHover: (importFunc) => {
    let componentPromise = null;
    
    return {
      onMouseEnter: () => {
        if (!componentPromise) {
          componentPromise = importFunc();
        }
      },
      onClick: async () => {
        const module = await (componentPromise || importFunc());
        return module.default;
      }
    };
  },
  
  /**
   * Load component when visible
   */
  loadOnVisible: (importFunc, targetRef) => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          importFunc().then((module) => {
            // Component loaded when visible
  });
          observer.disconnect();
        }
      });
    });
    
    if (targetRef.current) {
      observer.observe(targetRef.current);
    }
    
    return () => observer.disconnect();
  }
};

/**
 * Bundle analysis utilities
 */
export const bundleAnalyzer = {
  /**
   * Log bundle loading performance
   */
  logChunkLoad: (chunkName) => {

    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
  };
  },
  
  /**
   * Monitor bundle sizes
   */
  monitorBundleSize: () => {
    if (process.env.NODE_ENV === 'development') {
      // Monitor script tags for bundle sizes
      const scripts = document.querySelectorAll('script[src*="chunk"]');
      scripts.forEach(script => {
        fetch(script.src, { method: 'HEAD' })
          .then(response => {
            const size = response.headers.get('content-length');
            if (size) {
  }
          })
          .catch(console.error);
      });
    }
  }
};

/**
 * Preloading strategies
 */
export const preloadStrategies = {
  /**
   * Preload critical routes
   */
  preloadCriticalRoutes: () => {
    const criticalRoutes = [
      () => import('../pages/Dashboard'),
      () => import('../pages/Settings')
    ];
    
    // Preload after initial page load
    requestIdleCallback(() => {
      criticalRoutes.forEach(route => route());
    });
  },
  
  /**
   * Preload on user intent
   */
  preloadOnIntent: (routeImport) => {
    let preloaded = false;
    
    return {
      onMouseEnter: () => {
        if (!preloaded) {
          routeImport();
          preloaded = true;
        }
      },
      onFocus: () => {
        if (!preloaded) {
          routeImport();
          preloaded = true;
        }
      }
    };
  },
  
  /**
   * Preload based on connection speed
   */
  preloadBasedOnConnection: (routeImports) => {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      // Only preload on fast connections
      if (connection.effectiveType === '4g' && connection.downlink > 1.5) {
        routeImports.forEach(routeImport => {
          requestIdleCallback(() => routeImport());
        });
      }
    } else {
      // Fallback: preload one at a time
      routeImports.forEach((routeImport, index) => {
        setTimeout(() => routeImport(), index * 1000);
      });
    }
  }
};

/**
 * Tree shaking optimization helpers
 */
export const treeShaking = {
  /**
   * Import only needed functions from libraries
   */
  importOptimized: {
    // Instead of: import * as lodash from 'lodash'
    // Use: import { debounce, throttle } from 'lodash-es'
    
    // Example for date libraries
    formatDate: () => import('date-fns/format'),
    parseDate: () => import('date-fns/parse'),
    
    // Example for utility libraries
    debounce: () => import('lodash-es/debounce'),
    throttle: () => import('lodash-es/throttle')
  },
  
  /**
   * Dead code elimination markers
   */
  markUnused: (code) => {
    if (process.env.NODE_ENV === 'production') {
      // This will be removed in production builds
      return null;
    }
    return code;
  }
};

export default {
  LazyRoutes,
  LazyComponents,
  LazyFeatures,
  dynamicImport,
  bundleAnalyzer,
  preloadStrategies,
  treeShaking
};