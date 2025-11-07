// Theater Cache Management Utility

import config from '../config';

export const clearTheaterCache = () => {

  // Clear localStorage
  if (window.localStorage) {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('theater') || 
        key.includes('cache_') || 
        key.includes('Theater') ||
        key.includes('/api/theaters')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
  });
  }
  
  // Clear sessionStorage
  if (window.sessionStorage) {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.includes('theater') || 
        key.includes('cache_') || 
        key.includes('Theater') ||
        key.includes('/api/theaters')
      )) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
  });
  }
  
  // Clear browser cache for theater-related requests
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.includes('theater') || cacheName.includes('api')) {

            return caches.delete(cacheName);
          }
        })
      );
    }).catch(error => {
  });
  }
  
  };

export const addCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cacheBuster=${Date.now()}&_random=${Math.random()}`;
};

export default {
  clearTheaterCache,
  addCacheBuster
};