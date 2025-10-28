const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Store SSE connections for real-time notifications
const connections = new Map();

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint for real-time notifications
 */
router.get('/stream', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  console.log(`📡 SSE connection established for user: ${userId}`);

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
    console.log(`🔌 SSE connection closed for user: ${userId}`);
    connections.delete(userId);
  });
});

/**
 * Broadcast notification to specific user
 */
function sendNotificationToUser(userId, notification) {
  const connection = connections.get(userId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify(notification)}\n\n`);
      console.log(`📨 Notification sent to user ${userId}:`, notification);
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
  console.log(`📢 Notification broadcast to ${sentCount} connected users`);
  return sentCount;
}

module.exports = router;
module.exports.sendNotificationToUser = sendNotificationToUser;
module.exports.notifyAllSuperAdmins = notifyAllSuperAdmins;
