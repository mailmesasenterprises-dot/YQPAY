/**
 * useOfflineQueue Hook
 * React hook for managing offline order queue with auto-sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addToOrderQueue,
  getOrderQueue,
  getPendingOrderCount,
  getLastSyncTime
} from '../utils/offlineStorage';
import {
  startAutoSync,
  stopAutoSync,
  triggerManualSync,
  retryFailedOrders,
  getSyncStatus,
  isOnline
} from '../utils/orderSync';

export const useOfflineQueue = (theaterId, token) => {
  const [queue, setQueue] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  
  const syncIntervalRef = useRef(null);

  /**
   * Load queue from localStorage
   */
  const loadQueue = useCallback(() => {
    try {
      const currentQueue = getOrderQueue(theaterId);
      setQueue(currentQueue);
      setPendingCount(getPendingOrderCount(theaterId));
      
      const lastSync = getLastSyncTime(theaterId);
      setLastSyncTime(lastSync);
      
      const status = getSyncStatus(theaterId);
      setConnectionStatus(status.isOnline ? 'online' : 'offline');
    } catch (error) {
      console.error('[useOfflineQueue] Error loading queue:', error);
    }
  }, [theaterId]);

  /**
   * Add order to queue
   */
  const addOrder = useCallback((order) => {
    try {
      const queuedOrder = addToOrderQueue(theaterId, order);
      loadQueue(); // Reload queue after adding
      return queuedOrder;
    } catch (error) {
      console.error('[useOfflineQueue] Error adding order:', error);
      throw error;
    }
  }, [theaterId, loadQueue]);

  /**
   * Handle sync completion
   */
  const handleSyncComplete = useCallback((result) => {
    setIsSyncing(false);
    setSyncProgress({ current: 0, total: 0 });
    
    if (result.success) {
      setSyncError(null);
      loadQueue(); // Reload queue after successful sync
    } else {
      setSyncError(result.error || result.message);
    }
  }, [loadQueue]);

  /**
   * Handle sync progress updates
   */
  const handleSyncProgress = useCallback((current, total, order) => {
    setSyncProgress({ current, total, order });
  }, []);

  /**
   * Manual sync trigger
   */
  const manualSync = useCallback(async () => {
    if (isSyncing) {
      console.log('[useOfflineQueue] Sync already in progress');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await triggerManualSync(theaterId, token, handleSyncProgress);
      handleSyncComplete(result);
      return result;
    } catch (error) {
      handleSyncComplete({ success: false, error: error.message });
      throw error;
    }
  }, [theaterId, token, isSyncing, handleSyncProgress, handleSyncComplete]);

  /**
   * Retry failed orders
   */
  const retryFailed = useCallback(async () => {
    if (isSyncing) {
      console.log('[useOfflineQueue] Sync already in progress');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    
    try {
      const result = await retryFailedOrders(theaterId, token, handleSyncProgress);
      handleSyncComplete(result);
      return result;
    } catch (error) {
      handleSyncComplete({ success: false, error: error.message });
      throw error;
    }
  }, [theaterId, token, isSyncing, handleSyncProgress, handleSyncComplete]);

  /**
   * Get current sync status
   */
  const getStatus = useCallback(() => {
    return getSyncStatus(theaterId);
  }, [theaterId]);

  /**
   * Initialize auto-sync on mount
   */
  useEffect(() => {
    // Initial load
    loadQueue();

    // Start auto-sync
    if (token) {
      syncIntervalRef.current = startAutoSync(
        theaterId,
        token,
        handleSyncComplete,
        handleSyncProgress
      );
    }

    // Cleanup on unmount
    return () => {
      if (syncIntervalRef.current) {
        stopAutoSync(syncIntervalRef.current);
      }
    };
  }, [theaterId, token, loadQueue, handleSyncComplete, handleSyncProgress]);

  /**
   * Monitor online/offline status
   */
  useEffect(() => {
    const updateOnlineStatus = () => {
      const status = isOnline() ? 'online' : 'offline';
      setConnectionStatus(status);
      
      if (status === 'online') {
        console.log('[useOfflineQueue] Connection restored, queue will auto-sync');
      } else {
        console.log('[useOfflineQueue] Connection lost, orders will queue offline');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  /**
   * Refresh queue periodically
   */
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadQueue();
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(refreshInterval);
  }, [loadQueue]);

  return {
    // Queue data
    queue,
    pendingCount,
    lastSyncTime,
    
    // Sync state
    isSyncing,
    syncError,
    syncProgress,
    connectionStatus,
    
    // Actions
    addOrder,
    manualSync,
    retryFailed,
    getStatus,
    refresh: loadQueue
  };
};

export default useOfflineQueue;
