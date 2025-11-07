/**
 * Kiosk Helper Utilities
 * Provides functionality for kiosk mode operations
 */

/**
 * Request fullscreen mode for kiosk
 */
export const enterFullscreen = () => {
  const elem = document.documentElement;
  
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) { /* Safari */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { /* IE11 */
    elem.msRequestFullscreen();
  }
};

/**
 * Exit fullscreen mode
 */
export const exitFullscreen = () => {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) { /* Safari */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { /* IE11 */
    document.msExitFullscreen();
  }
};

/**
 * Check if currently in fullscreen mode
 */
export const isFullscreen = () => {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
};

/**
 * Toggle fullscreen mode
 */
export const toggleFullscreen = () => {
  if (isFullscreen()) {
    exitFullscreen();
  } else {
    enterFullscreen();
  }
};

/**
 * Detect if device is a kiosk (based on screen size and touch capability)
 */
export const isKioskDevice = () => {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isLargeScreen = window.innerWidth >= 1024;
  return hasTouch && isLargeScreen;
};

/**
 * Get kiosk screen orientation
 */
export const getKioskOrientation = () => {
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
};

/**
 * Prevent accidental exits from kiosk mode
 */
export const enableKioskMode = () => {
  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Disable F11 key (fullscreen toggle)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
      e.preventDefault();
    }
  });
  
  // Enter fullscreen
  enterFullscreen();
  
  // Prevent text selection
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  
  // Disable pull-to-refresh on mobile
  document.body.style.overscrollBehavior = 'none';
};

/**
 * Disable kiosk mode protections
 */
export const disableKioskMode = () => {
  exitFullscreen();
  document.body.style.userSelect = 'auto';
  document.body.style.webkitUserSelect = 'auto';
  document.body.style.overscrollBehavior = 'auto';
};

/**
 * Auto-idle timeout for kiosk (returns to home after inactivity)
 */
export const setupIdleTimeout = (timeoutMs = 300000, onIdle = () => {}) => {
  let idleTimer;
  
  const resetTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(onIdle, timeoutMs);
  };
  
  // Track user activity
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, resetTimer, true);
  });
  
  // Start timer
  resetTimer();
  
  // Return cleanup function
  return () => {
    clearTimeout(idleTimer);
    events.forEach(event => {
      document.removeEventListener(event, resetTimer, true);
    });
  };
};

/**
 * Wake lock to prevent screen from sleeping (for kiosks)
 */
export const requestWakeLock = async () => {
  if ('wakeLock' in navigator) {
    try {
      const wakeLock = await navigator.wakeLock.request('screen');

      return wakeLock;
    } catch (err) {
  }
  }
  return null;
};

/**
 * Optimize for kiosk display
 */
export const optimizeForKiosk = () => {
  // Set viewport for kiosk
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }
  
  // Disable bounce/elastic scrolling (iOS)
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
  
  // Enable hardware acceleration
  document.body.style.transform = 'translateZ(0)';
  document.body.style.backfaceVisibility = 'hidden';
};

/**
 * Check if running in standalone/installed mode (PWA kiosk)
 */
export const isStandaloneMode = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

/**
 * Get optimal font size based on screen size
 */
export const getOptimalFontSize = () => {
  const width = window.innerWidth;
  if (width >= 1920) return 22; // Large kiosk
  if (width >= 1280) return 20; // Medium kiosk
  if (width >= 1024) return 18; // Small kiosk
  return 16; // Mobile fallback
};

/**
 * Haptic feedback for touch interactions (if supported)
 */
export const hapticFeedback = (style = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 50
    };
    navigator.vibrate(patterns[style] || 20);
  }
};

export default {
  enterFullscreen,
  exitFullscreen,
  isFullscreen,
  toggleFullscreen,
  isKioskDevice,
  getKioskOrientation,
  enableKioskMode,
  disableKioskMode,
  setupIdleTimeout,
  requestWakeLock,
  optimizeForKiosk,
  isStandaloneMode,
  getOptimalFontSize,
  hapticFeedback
};
