import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import config from '../config';
import './Messages.css';

const Messages = () => {
  const location = useLocation();
  const [theaters, setTheaters] = useState([]);
  const [selectedTheater, setSelectedTheater] = useState(null);
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

  // Fetch theaters list
  const fetchTheaters = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      
      console.log('🎭 Fetching theaters...', {
        url: `${config.api.baseUrl}/chat/theaters`,
        hasToken: !!token,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
      });

      const response = await fetch(`${config.api.baseUrl}/chat/theaters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Theater fetch response:', response.status, response.statusText);
      
      const data = await response.json();
      
      console.log('🎭 Theater data received:', data);
      
      if (response.status === 403 || response.status === 401) {
        console.error('❌ Authentication error:', data);
        return;
      }
      
      // Handle both array response and {success, data} response
      const theaterList = Array.isArray(data) ? data : (data.data || []);
      setTheaters(theaterList);
      console.log(`✅ Set ${theaterList.length} theaters`);
    } catch (error) {
      console.error('❌ Error fetching theaters:', error);
    }
  }, []);

  // Fetch messages for selected theater
  const fetchMessages = useCallback(async (theaterId) => {
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
  }, []);

  // Mark messages as read
  const markAsRead = useCallback(async (theaterId) => {
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
      
      // Refresh theater list to update unread counts
      fetchTheaters();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [fetchTheaters]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedTheater || sending) return;
    
    setSending(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          theaterId: selectedTheater._id,
          message: newMessage.trim()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewMessage('');
        // Refresh messages
        fetchMessages(selectedTheater._id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  // Select theater
  const handleSelectTheater = (theater) => {
    setSelectedTheater(theater);
    setLoading(true);
    fetchMessages(theater._id).finally(() => setLoading(false));
    markAsRead(theater._id);
  };

  // Initial fetch
  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters]);

  // Handle navigation from notification
  useEffect(() => {
    if (location.state?.selectedTheaterId && theaters.length > 0) {
      const theater = theaters.find(t => t._id === location.state.selectedTheaterId);
      if (theater) {
        handleSelectTheater(theater);
      }
      // Clear the state to prevent re-selection on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state, theaters]);

  // Setup polling for new messages
  useEffect(() => {
    if (selectedTheater) {
      // Poll every 5 seconds
      pollingIntervalRef.current = setInterval(() => {
        fetchMessages(selectedTheater._id);
        fetchTheaters(); // Update unread counts
      }, 5000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [selectedTheater, fetchMessages, fetchTheaters]);

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
    <AdminLayout pageTitle="Messages" currentPage="messages">
      <div className="messages-container">
        {/* Theater List Sidebar */}
        <div className="theater-list-sidebar">
          <div className="sidebar-header">
            <h2>Messages</h2>
            <div className="theater-count">{theaters.length} Theaters</div>
          </div>

          <div className="theater-list">
            {theaters.map((theater) => (
              <div
                key={theater._id}
                className={`theater-item ${selectedTheater?._id === theater._id ? 'active' : ''}`}
                onClick={() => handleSelectTheater(theater)}
              >
                <div className="theater-logo">
                  {theater.logoUrl ? (
                    <img 
                      src={theater.logoUrl} 
                      alt={theater.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="logo-placeholder"
                    style={{ display: theater.logoUrl ? 'none' : 'flex' }}
                  >
                    {theater.name.charAt(0)}
                  </div>
                </div>
                <div className="theater-info">
                  <h3>{theater.name}</h3>
                  {theater.unreadCount > 0 && (
                    <span className="unread-badge">{theater.unreadCount}</span>
                  )}
                </div>
              </div>
            ))}

            {theaters.length === 0 && (
              <div className="no-theaters">
                <p>No theaters available</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Box */}
        <div className="chat-box">
          {selectedTheater ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <div className="chat-theater-info">
                  <div className="chat-theater-logo">
                    {selectedTheater.logoUrl ? (
                      <img 
                        src={selectedTheater.logoUrl} 
                        alt={selectedTheater.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="logo-placeholder"
                      style={{ display: selectedTheater.logoUrl ? 'none' : 'flex' }}
                    >
                      {selectedTheater.name.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <h3>{selectedTheater.name}</h3>
                    <span className="status-indicator">
                      <span className="status-dot"></span>
                      Online
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
                      
                      const isSent = msg.senderRole === 'super_admin';

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
                                <div className="sender-name">{msg.senderName}</div>
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
                    <span>Start the conversation with {selectedTheater.name}</span>
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
            </>
          ) : (
            <div className="no-chat-selected">
              <svg viewBox="0 0 24 24" fill="none" width="80" height="80">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="2"/>
              </svg>
              <h3>Select a Theater</h3>
              <p>Choose a theater from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Messages;
