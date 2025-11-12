/**
 * 🚀 ULTRA-FAST STATE STORE
 * Using Zustand for minimal re-renders and maximum performance
 * Target: <0.1ms state access time
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { memoryCache } from '../utils/ultraPerformance';

// ============================================================================
// OPTIMIZED CART STORE - Replaces CartContext for better performance
// ============================================================================

export const useCartStore = create(
  persist(
    immer((set, get) => ({
      // State
      items: [],
      totalItems: 0,
      subtotal: 0,
      tax: 0,
      total: 0,

      // Ultra-fast computed values (cached)
      getTotalItems: () => {
        const cached = memoryCache.get('cart_total_items');
        if (cached !== null) return cached;

        const total = get().items.reduce((sum, item) => sum + item.quantity, 0);
        memoryCache.set('cart_total_items', total, 1000); // 1 second cache
        return total;
      },

      getItemQuantity: (itemId) => {
        const item = get().items.find(i => i._id === itemId);
        return item ? item.quantity : 0;
      },

      // Actions (optimized with Immer for mutation-style updates)
      addItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i._id === item._id);
        
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          state.items.push({ ...item, quantity: 1 });
        }

        // Invalidate cache
        memoryCache.delete('cart_total_items');
      }),

      removeItem: (item) => set((state) => {
        const existingItem = state.items.find(i => i._id === item._id);
        
        if (existingItem) {
          if (existingItem.quantity > 1) {
            existingItem.quantity -= 1;
          } else {
            state.items = state.items.filter(i => i._id !== item._id);
          }
        }

        memoryCache.delete('cart_total_items');
      }),

      updateQuantity: (itemId, quantity) => set((state) => {
        if (quantity <= 0) {
          state.items = state.items.filter(i => i._id !== itemId);
        } else {
          const item = state.items.find(i => i._id === itemId);
          if (item) {
            item.quantity = quantity;
          }
        }

        memoryCache.delete('cart_total_items');
      }),

      clearCart: () => set({ items: [], totalItems: 0, subtotal: 0, tax: 0, total: 0 }),

      // Batch update for performance
      updateTotals: (totals) => set({ ...totals })
    })),
    {
      name: 'yqpay-cart-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }) // Only persist items
    }
  )
);

// ============================================================================
// OPTIMIZED AUTH STORE - Replaces AuthContext
// ============================================================================

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      authToken: null,
      userType: null,
      theaterId: null,
      isLoading: false,

      // Actions
      login: (userData) => set({
        user: userData.user,
        isAuthenticated: true,
        authToken: userData.token,
        userType: userData.userType || userData.user?.userType,
        theaterId: userData.user?.theaterId || userData.theaterId,
        isLoading: false
      }),

      logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userType');
        localStorage.removeItem('theaterId');
        set({
          user: null,
          isAuthenticated: false,
          authToken: null,
          userType: null,
          theaterId: null,
          isLoading: false
        });
      },

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),

      // Ultra-fast getters (no re-render)
      getAuthToken: () => get().authToken,
      getUserType: () => get().userType,
      getTheaterId: () => get().theaterId,
      isAdmin: () => get().userType === 'super_admin',
      isTheaterAdmin: () => get().userType === 'theater_admin'
    }),
    {
      name: 'yqpay-auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);

// ============================================================================
// OPTIMIZED UI STORE - For global UI state
// ============================================================================

export const useUIStore = create((set, get) => ({
  // State
  sidebarOpen: false,
  sidebarCollapsed: true,
  loading: {},
  modals: {},
  notifications: [],

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Loading state management
  setLoading: (key, value) => set((state) => ({
    loading: { ...state.loading, [key]: value }
  })),

  isLoading: (key) => get().loading[key] || false,

  // Modal management
  openModal: (modalId, data = {}) => set((state) => ({
    modals: { ...state.modals, [modalId]: { open: true, data } }
  })),

  closeModal: (modalId) => set((state) => ({
    modals: { ...state.modals, [modalId]: { open: false, data: {} } }
  })),

  isModalOpen: (modalId) => get().modals[modalId]?.open || false,

  // Notification management
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: Date.now() }]
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] })
}));

// ============================================================================
// OPTIMIZED DATA CACHE STORE - For API responses
// ============================================================================

export const useDataCacheStore = create((set, get) => ({
  // State
  cache: {},
  timestamps: {},
  ttl: 300000, // 5 minutes default

  // Actions
  setCache: (key, data, customTTL) => {
    const ttl = customTTL || get().ttl;
    set((state) => ({
      cache: { ...state.cache, [key]: data },
      timestamps: { ...state.timestamps, [key]: Date.now() + ttl }
    }));
  },

  getCache: (key) => {
    const state = get();
    const timestamp = state.timestamps[key];
    
    // Check if expired
    if (!timestamp || Date.now() > timestamp) {
      // Remove expired cache
      const { [key]: _, ...newCache } = state.cache;
      const { [key]: __, ...newTimestamps } = state.timestamps;
      set({ cache: newCache, timestamps: newTimestamps });
      return null;
    }

    return state.cache[key];
  },

  hasCache: (key) => {
    const state = get();
    const timestamp = state.timestamps[key];
    return timestamp && Date.now() <= timestamp && key in state.cache;
  },

  invalidateCache: (pattern) => {
    const state = get();
    const newCache = {};
    const newTimestamps = {};

    Object.keys(state.cache).forEach(key => {
      if (!key.includes(pattern)) {
        newCache[key] = state.cache[key];
        newTimestamps[key] = state.timestamps[key];
      }
    });

    set({ cache: newCache, timestamps: newTimestamps });
  },

  clearCache: () => set({ cache: {}, timestamps: {} }),

  // Get cache statistics
  getCacheStats: () => {
    const state = get();
    return {
      totalKeys: Object.keys(state.cache).length,
      validKeys: Object.keys(state.timestamps).filter(
        key => Date.now() <= state.timestamps[key]
      ).length,
      keys: Object.keys(state.cache)
    };
  }
}));

// ============================================================================
// PERFORMANCE STORE - For tracking performance metrics
// ============================================================================

export const usePerformanceStore = create((set, get) => ({
  // State
  metrics: {},
  renderTimes: {},
  apiTimes: {},

  // Actions
  recordRender: (componentName, duration) => {
    const state = get();
    const times = state.renderTimes[componentName] || [];
    times.push({ duration, timestamp: Date.now() });

    // Keep only last 50 measurements
    if (times.length > 50) times.shift();

    set({
      renderTimes: { ...state.renderTimes, [componentName]: times }
    });
  },

  recordAPI: (endpoint, duration, success) => {
    const state = get();
    const times = state.apiTimes[endpoint] || [];
    times.push({ duration, timestamp: Date.now(), success });

    // Keep only last 50 measurements
    if (times.length > 50) times.shift();

    set({
      apiTimes: { ...state.apiTimes, [endpoint]: times }
    });
  },

  getAverageRenderTime: (componentName) => {
    const times = get().renderTimes[componentName] || [];
    if (times.length === 0) return 0;

    const sum = times.reduce((acc, t) => acc + t.duration, 0);
    return sum / times.length;
  },

  getAverageAPITime: (endpoint) => {
    const times = get().apiTimes[endpoint] || [];
    if (times.length === 0) return 0;

    const sum = times.reduce((acc, t) => acc + t.duration, 0);
    return sum / times.length;
  },

  getAllStats: () => {
    const state = get();
    const stats = {
      renders: {},
      apis: {}
    };

    Object.keys(state.renderTimes).forEach(name => {
      const times = state.renderTimes[name];
      const durations = times.map(t => t.duration);
      stats.renders[name] = {
        count: times.length,
        avg: (durations.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
        min: Math.min(...durations).toFixed(2),
        max: Math.max(...durations).toFixed(2)
      };
    });

    Object.keys(state.apiTimes).forEach(endpoint => {
      const times = state.apiTimes[endpoint];
      const durations = times.map(t => t.duration);
      const successRate = (times.filter(t => t.success).length / times.length * 100).toFixed(1);
      stats.apis[endpoint] = {
        count: times.length,
        avg: (durations.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
        min: Math.min(...durations).toFixed(2),
        max: Math.max(...durations).toFixed(2),
        successRate: `${successRate}%`
      };
    });

    return stats;
  },

  clear: () => set({ metrics: {}, renderTimes: {}, apiTimes: {} })
}));

// ============================================================================
// SELECTOR HOOKS - For minimal re-renders
// ============================================================================

// Cart selectors
export const useCartItems = () => useCartStore(state => state.items);
export const useCartTotalItems = () => useCartStore(state => state.getTotalItems());
export const useCartActions = () => useCartStore(state => ({
  addItem: state.addItem,
  removeItem: state.removeItem,
  updateQuantity: state.updateQuantity,
  clearCart: state.clearCart
}));

// Auth selectors
export const useAuthUser = () => useAuthStore(state => state.user);
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated);
export const useAuthToken = () => useAuthStore(state => state.authToken);
export const useUserType = () => useAuthStore(state => state.userType);
export const useAuthActions = () => useAuthStore(state => ({
  login: state.login,
  logout: state.logout,
  setUser: state.setUser
}));

// UI selectors
export const useSidebarState = () => useUIStore(state => ({
  open: state.sidebarOpen,
  collapsed: state.sidebarCollapsed
}));

export const useUIActions = () => useUIStore(state => ({
  toggleSidebar: state.toggleSidebar,
  setSidebarOpen: state.setSidebarOpen,
  setSidebarCollapsed: state.setSidebarCollapsed,
  setLoading: state.setLoading,
  openModal: state.openModal,
  closeModal: state.closeModal
}));

// ============================================================================
// GLOBAL ACCESS FOR DEBUGGING
// ============================================================================

if (typeof window !== 'undefined') {
  window.useCartStore = useCartStore;
  window.useAuthStore = useAuthStore;
  window.useUIStore = useUIStore;
  window.useDataCacheStore = useDataCacheStore;
  window.usePerformanceStore = usePerformanceStore;
  window.showStoreStats = () => {
    console.log('=== STORE STATISTICS ===');
    console.log('Cart Items:', useCartStore.getState().items.length);
    console.log('Cache Stats:', useDataCacheStore.getState().getCacheStats());
    console.log('Performance:', usePerformanceStore.getState().getAllStats());
  };
}

export default {
  useCartStore,
  useAuthStore,
  useUIStore,
  useDataCacheStore,
  usePerformanceStore
};
