/**
 * Order Sync Utility
 * Handles automatic syncing of offline orders to server
 * - Connectivity checking every 5 seconds
 * - Automatic upload when online
 * - Retry logic with exponential backoff
 * - Batch order processing
 */

import config from '../config/index';
import {
  getOrderQueue,
  removeFromOrderQueue,
  updateOrderStatus,
  updateLastSyncTime
} from './offlineStorage';

const SYNC_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff: 2s, 4s, 8s

/**
 * Check if browser is online
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Test actual network connectivity (not just browser status)
 */
export const testConnectivity = async () => {
  try {
    // Try to reach the API server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(`${config.api.baseUrl}/health`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-cache'
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log('[OrderSync] Connectivity test failed:', error.message);
    return false;
  }
};

/**
 * Upload single order to server
 */
export const uploadOrder = async (order, token) => {
  try {
    console.log(`⬆️ [OrderSync] Uploading order ${order.queueId}...`);
    
    const response = await fetch(`${config.api.baseUrl}/theater-orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ [OrderSync] Order ${order.queueId} uploaded successfully`);
      return { success: true, data: data.order };
    } else {
      throw new Error(data.message || 'Order upload failed');
    }
  } catch (error) {
    console.error(`❌ [OrderSync] Upload failed for order ${order.queueId}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Sync all pending orders for a theater
 */
export const syncPendingOrders = async (theaterId, token, onProgress) => {
  try {
    // Check connectivity first
    const online = await testConnectivity();
    if (!online) {
      console.log('[OrderSync] Not online, skipping sync');
      return { success: false, message: 'No internet connection' };
    }

    const queue = getOrderQueue(theaterId);
    const pendingOrders = queue.filter(
      order => order.syncStatus === 'pending' || order.syncStatus === 'failed'
    );

    if (pendingOrders.length === 0) {
      console.log('[OrderSync] No pending orders to sync');
      return { success: true, synced: 0 };
    }

    console.log(`🔄 [OrderSync] Starting sync of ${pendingOrders.length} orders...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingOrders.length; i++) {
      const order = pendingOrders[i];

      // Check if order has exceeded max retries
      if (order.retryCount >= MAX_RETRIES) {
        console.warn(`⚠️ [OrderSync] Order ${order.queueId} exceeded max retries, skipping`);
        updateOrderStatus(theaterId, order.queueId, 'failed', 'Max retries exceeded');
        failCount++;
        continue;
      }

      // Update UI with progress
      if (onProgress) {
        onProgress(i + 1, pendingOrders.length, order);
      }

      // Update status to syncing
      updateOrderStatus(theaterId, order.queueId, 'syncing');

      // Attempt upload
      const result = await uploadOrder(order, token);

      if (result.success) {
        // Remove from queue on success
        removeFromOrderQueue(theaterId, order.queueId);
        successCount++;
      } else {
        // Mark as failed, will retry next sync
        updateOrderStatus(theaterId, order.queueId, 'failed', result.error);
        failCount++;

        // Wait before next retry (exponential backoff)
        if (order.retryCount < RETRY_DELAYS.length) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[order.retryCount]));
        }
      }
    }

    // Update last sync time
    updateLastSyncTime(theaterId);

    console.log(`✅ [OrderSync] Sync complete: ${successCount} succeeded, ${failCount} failed`);

    return {
      success: failCount === 0,
      synced: successCount,
      failed: failCount,
      message: `${successCount} orders synced successfully`
    };
  } catch (error) {
    console.error('[OrderSync] Sync process error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Start automatic sync timer
 */
export const startAutoSync = (theaterId, token, onSyncComplete, onProgress) => {
  console.log('🔄 [OrderSync] Starting auto-sync (checking every 5 seconds)...');

  const syncInterval = setInterval(async () => {
    try {
      // Only sync if online
      if (!isOnline()) {
        return;
      }

      const queue = getOrderQueue(theaterId);
      const pendingCount = queue.filter(
        order => order.syncStatus === 'pending' || order.syncStatus === 'failed'
      ).length;

      if (pendingCount > 0) {
        console.log(`🔄 [OrderSync] Auto-sync triggered (${pendingCount} pending)`);
        const result = await syncPendingOrders(theaterId, token, onProgress);
        
        if (onSyncComplete) {
          onSyncComplete(result);
        }
      }
    } catch (error) {
      console.error('[OrderSync] Auto-sync error:', error);
    }
  }, SYNC_INTERVAL);

  return syncInterval;
};

/**
 * Stop automatic sync timer
 */
export const stopAutoSync = (syncInterval) => {
  if (syncInterval) {
    clearInterval(syncInterval);
    console.log('⏹️ [OrderSync] Auto-sync stopped');
  }
};

/**
 * Manual sync trigger
 */
export const triggerManualSync = async (theaterId, token, onProgress) => {
  console.log('🔄 [OrderSync] Manual sync triggered');
  return await syncPendingOrders(theaterId, token, onProgress);
};

/**
 * Retry failed orders
 */
export const retryFailedOrders = async (theaterId, token, onProgress) => {
  try {
    const queue = getOrderQueue(theaterId);
    const failedOrders = queue.filter(order => order.syncStatus === 'failed');

    if (failedOrders.length === 0) {
      console.log('[OrderSync] No failed orders to retry');
      return { success: true, retried: 0 };
    }

    console.log(`🔄 [OrderSync] Retrying ${failedOrders.length} failed orders...`);

    // Reset retry count and status for failed orders
    failedOrders.forEach(order => {
      updateOrderStatus(theaterId, order.queueId, 'pending');
    });

    // Attempt sync again
    return await syncPendingOrders(theaterId, token, onProgress);
  } catch (error) {
    console.error('[OrderSync] Retry failed orders error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get sync status summary
 */
export const getSyncStatus = (theaterId) => {
  const queue = getOrderQueue(theaterId);
  
  return {
    total: queue.length,
    pending: queue.filter(o => o.syncStatus === 'pending').length,
    syncing: queue.filter(o => o.syncStatus === 'syncing').length,
    failed: queue.filter(o => o.syncStatus === 'failed').length,
    isOnline: isOnline()
  };
};

export default {
  isOnline,
  testConnectivity,
  uploadOrder,
  syncPendingOrders,
  startAutoSync,
  stopAutoSync,
  triggerManualSync,
  retryFailedOrders,
  getSyncStatus
};
