const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const Theater = require('../models/Theater');
const { authenticateToken } = require('../middleware/auth');
const { notifyAllSuperAdmins, sendNotificationToUser } = require('./notifications');

/**
 * GET /api/chat/theaters
 * Get list of theaters with unread message counts (Super Admin only)
 */
router.get('/theaters', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Fetching theaters for chat list...');
    console.log('👤 User from token:', req.user);
    
    // Get all theaters
    const theaters = await Theater.find({}, {
      name: 1,
      logoUrl: 1,
      logo: 1,
      isActive: 1
    }).sort({ name: 1});

    // Get unread counts for each theater
    const theatersWithUnread = await Promise.all(
      theaters.map(async (theater) => {
        const unreadCount = await ChatMessage.getUnreadCount(theater._id, true);
        return {
          _id: theater._id,
          theaterName: theater.name, // Use theaterName for consistency
          name: theater.name,
          logoUrl: theater.logoUrl || theater.logo,
          isActive: theater.isActive,
          unreadCount
        };
      })
    );

    console.log(`✅ Found ${theaters.length} theaters`);

    // Return array directly for backward compatibility
    res.json(theatersWithUnread);

  } catch (error) {
    console.error('❌ Error fetching theaters for chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theaters',
      error: error.message
    });
  }
});

/**
 * GET /api/chat/messages/:theaterId
 * Get chat messages for a specific theater
 */
router.get('/messages/:theaterId', authenticateToken, async (req, res) => {
  try {
    const { theaterId } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    console.log(`💬 Fetching messages for theater: ${theaterId}`);

    const messages = await ChatMessage.find({ theaterId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Reverse to show oldest first
    messages.reverse();

    console.log(`✅ Found ${messages.length} messages`);

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('❌ Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

/**
 * POST /api/chat/messages
 * Send a new message
 */
router.post('/messages', authenticateToken, async (req, res) => {
  try {
    const { theaterId, message } = req.body;
    const user = req.user;

    console.log('📤 Sending new message...');
    console.log('👤 User info:', { userId: user.userId, role: user.role, username: user.username });

    // Validate
    if (!theaterId || !message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Theater ID and message are required'
      });
    }

    // Map role to match ChatMessage enum - flexible approach
    let senderRole;
    
    // Check if it's super admin
    if (user.role === 'super_admin' || user.role === 'admin') {
      senderRole = 'super_admin';
    } 
    // Check if it's theater admin (any management role)
    else if (user.role === 'theater-admin' || user.role === 'theater_admin' || 
             user.role.toLowerCase().includes('admin') || 
             user.role.toLowerCase().includes('manager')) {
      senderRole = 'theater_admin';
    } 
    // All other theater roles default to theater_user
    else {
      senderRole = 'theater_user';
    }

    console.log('📝 Mapped role:', user.role, '→', senderRole);

    // Create message
    const newMessage = new ChatMessage({
      theaterId,
      senderId: user.userId,
      senderRole: senderRole,
      senderName: user.fullName || user.username,
      message: message.trim(),
      messageType: 'text'
    });

    await newMessage.save();

    console.log('✅ Message sent successfully');

    // Send real-time notification
    try {
      const theater = await Theater.findById(theaterId);
      
      if (senderRole === 'super_admin') {
        // Super admin sent message - notify theater users
        // You can add theater user notification logic here
        console.log('📨 Notifying theater users about new message from super admin');
      } else {
        // Theater user sent message - notify super admins
        const notification = {
          type: 'new_message',
          theaterId: theaterId,
          theaterName: theater?.name || 'Unknown Theater',
          message: message.trim(),
          senderName: user.fullName || user.username,
          timestamp: new Date()
        };
        
        const sentCount = notifyAllSuperAdmins(notification);
        console.log(`📢 Real-time notification sent to ${sentCount} super admins`);
      }
    } catch (notifError) {
      console.error('⚠️ Error sending real-time notification:', notifError);
      // Don't fail the message send if notification fails
    }

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });

  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

/**
 * PUT /api/chat/messages/:theaterId/mark-read
 * Mark messages as read for a theater
 */
router.put('/messages/:theaterId/mark-read', authenticateToken, async (req, res) => {
  try {
    const { theaterId } = req.params;
    const user = req.user;

    console.log(`✅ Marking messages as read for theater: ${theaterId}`);

    // Super admin marks theater messages as read
    const forSuperAdmin = user.role === 'super_admin';
    
    await ChatMessage.markAsRead(theaterId, forSuperAdmin);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('❌ Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
});

/**
 * DELETE /api/chat/messages/:messageId
 * Delete a message
 */
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const user = req.user;

    console.log(`🗑️ Deleting message: ${messageId}`);

    const message = await ChatMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Only sender or super admin can delete
    if (message.senderId.toString() !== user.userId && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await ChatMessage.findByIdAndDelete(messageId);

    console.log('✅ Message deleted successfully');

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

module.exports = router;
