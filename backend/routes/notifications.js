const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { 
  getCustomerNotifications, 
  markNotificationAsRead, 
  markAllAsRead,
  getUnreadCount 
} = require('../services/notificationService');

// Store SSE connections for real-time notifications
const connections = new Map();

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
router.get('/stream', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Notification stream connected' })}\n\n`);

  // Store connection
  connections.set(userId, res);

  // Handle client disconnect
  req.on('close', () => {
    connections.delete(userId);
  });
});

/**
 * GET /api/notifications/customer/:phoneNumber
 * Get notifications for a customer by phone number
 */
router.get('/customer/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { limit = 20 } = req.query;
    
    const notifications = await getCustomerNotifications(phoneNumber, parseInt(limit));
    const unreadCount = await getUnreadCount(phoneNumber);
    
    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('❌ Error fetching customer notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

/**
 * PUT /api/notifications/:notificationId/read
 * Mark a notification as read
 */
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await markNotificationAsRead(notificationId);
    
    res.json({
      success,
      message: success ? 'Notification marked as read' : 'Failed to mark notification as read'
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * PUT /api/notifications/customer/:phoneNumber/read-all
 * Mark all notifications as read for a customer
 */
router.put('/customer/:phoneNumber/read-all', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const success = await markAllAsRead(phoneNumber);
    
    res.json({
      success,
      message: success ? 'All notifications marked as read' : 'Failed to mark notifications as read'
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
});

/**
 * Broadcast notification to specific user
 */
function sendNotificationToUser(userId, notification) {
  const connection = connections.get(userId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify(notification)}\n\n`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      connections.delete(userId);
      return false;
    }
  }
  return false;
}

/**
 * Broadcast notification to all super admins
 */
function notifyAllSuperAdmins(notification) {
  let sentCount = 0;
  for (const [userId, connection] of connections.entries()) {
    try {
      connection.write(`data: ${JSON.stringify(notification)}\n\n`);
      sentCount++;
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      connections.delete(userId);
    }
  }
  return sentCount;
}

module.exports = router;
module.exports.sendNotificationToUser = sendNotificationToUser;
module.exports.notifyAllSuperAdmins = notifyAllSuperAdmins;
