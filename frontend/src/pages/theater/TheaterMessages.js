import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import config from '../../config';
import './TheaterMessages.css';

const TheaterMessages = () => {
  const { theaterId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/chat/messages/${theaterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.data);
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [theaterId]);

  // Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`${config.api.baseUrl}/chat/messages/${theaterId}/mark-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [theaterId]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || sending) {
      console.log('❌ Cannot send - Message empty or already sending');
      return;
    }
    
    if (!theaterId) {
      console.error('❌ No theater ID found');
      alert('Theater ID is missing. Please log in again.');
      return;
    }
    
    console.log('📤 Sending message:', { theaterId, message: newMessage.trim() });
    
    setSending(true);
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.error('❌ No auth token found');
        alert('Authentication token missing. Please log in again.');
        setSending(false);
        return;
      }
      
      const response = await fetch(`${config.api.baseUrl}/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          theaterId: theaterId,
          message: newMessage.trim()
        })
      });
      
      console.log('📡 Response status:', response.status);
      
      const data = await response.json();
      console.log('📡 Response data:', data);
      
      if (data.success) {
        console.log('✅ Message sent successfully');
        setNewMessage('');
        fetchMessages();
      } else {
        console.error('❌ Failed to send message:', data.message);
        alert(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Error sending message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (theaterId) {
      setLoading(true);
      fetchMessages().finally(() => setLoading(false));
      markAsRead();
    }
  }, [theaterId, fetchMessages, markAsRead]);

  // Setup polling for new messages
  useEffect(() => {
    if (theaterId) {
      // Poll every 5 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages();
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [theaterId, fetchMessages]);

  // Format timestamp
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  return (
    <TheaterLayout pageTitle="Messages" currentPage="messages">
      <div className="theater-messages-container">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-admin-info">
            <div className="admin-avatar">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
            <div>
              <h3>Super Admin</h3>
              <span className="status-indicator">
                <span className="status-dot"></span>
                Support Team
              </span>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="messages-area">
          {loading ? (
            <div className="loading-messages">
              <div className="spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((msg, index) => {
                const showDate = index === 0 || 
                  new Date(messages[index - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                
                const isSent = msg.senderRole !== 'super_admin';

                return (
                  <React.Fragment key={msg._id}>
                    {showDate && (
                      <div className="date-divider">
                        <span>{formatDate(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
                      <div className="message-bubble">
                        {!isSent && (
                          <div className="sender-name">Super Admin</div>
                        )}
                        <div className="message-text">{msg.message}</div>
                        <div className="message-time">
                          {formatTime(msg.createdAt)}
                          {isSent && msg.isRead && (
                            <span className="read-indicator">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="no-messages">
              <svg viewBox="0 0 24 24" fill="none" width="64" height="64">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <p>No messages yet</p>
              <span>Start a conversation with Super Admin</span>
            </div>
          )}
        </div>

        {/* Message Input */}
        <form className="message-input-area" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message here..."
            disabled={sending}
          />
          <button type="submit" disabled={!newMessage.trim() || sending}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </TheaterLayout>
  );
};

export default TheaterMessages;
