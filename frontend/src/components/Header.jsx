import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import config from '../config';

// Header-specific icons
const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);

const IconNotification = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
  </svg>
);

const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);

const getIcon = (iconName) => {
  const icons = {
    hamburger: <IconMenu />,
    search: <IconSearch />,
    notification: <IconNotification />,
    email: <IconEmail />,
    settings: <IconSettings />
  };
  return icons[iconName] || null;
};

const Header = ({ sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, pageTitle = 'Dashboard', userProfile = null }) => {
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  
  const defaultUserProfile = {
    firstName: 'Admin',
    lastName: 'User', 
    email: `admin@${config.branding.companyName.toLowerCase()}.com`,
    phone: '+91 89404 16286',
    city: 'Bengaluru',
    country: 'India'
  };

  // Use authenticated user data if available, otherwise use provided userProfile or default
  const user = authUser || userProfile || defaultUserProfile;
  const userInitials = `${user.name?.charAt(0) || user.firstName?.charAt(0) || 'A'}${user.name?.charAt(1) || user.lastName?.charAt(0) || 'U'}`;

  // Fetch unread messages for notifications
  useEffect(() => {
    let controller = null;
    let reader = null;
    
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const response = await fetch(`${config.api.baseUrl}/chat/theaters`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const theaters = await response.json();
          // Handle both array response and {success, data} response
          const theaterList = Array.isArray(theaters) ? theaters : (theaters.data || []);
          const unreadTheaters = theaterList.filter(t => t.unreadCount > 0);
          setNotifications(unreadTheaters);
          const totalUnread = unreadTheaters.reduce((sum, t) => sum + t.unreadCount, 0);
          setUnreadCount(totalUnread);
        }
      } catch (error) {
  }
    };

    // Initial fetch
    fetchNotifications();

    // Setup Server-Sent Events for real-time notifications using fetch API
    const setupSSE = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      try {
        controller = new AbortController();
        const response = await fetch(`${config.api.baseUrl}/notifications/stream`, {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';


        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'new_message') {
                  // Instantly refresh notifications
                  fetchNotifications();
                  
                  // Show browser notification if permission granted
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('New Message from ' + data.theaterName, {
                      body: data.message,
                      icon: '/logo192.png',
                      badge: '/logo192.png',
                      tag: 'message-' + data.theaterId,
                      requireInteraction: false
                    });
                  }
                }
              } catch (e) {
  }
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {

          // Retry connection after 5 seconds
          setTimeout(setupSSE, 5000);
        }
      }
    };

    // Request notification permission on first load
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
  });
    }

    setupSSE();

    // Fallback polling every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      if (controller) {
        controller.abort();
      }
      if (reader) {
        reader.cancel();
      }
      clearInterval(interval);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (theater) => {
    setShowNotificationDropdown(false);
    navigate('/messages', { state: { selectedTheaterId: theater._id } });
  };

  const toggleNotificationDropdown = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
  };

  const handleLogout = () => {
    logout();
    setShowProfileDropdown(false);
  };

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  return (
    <header className="dashboard-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {getIcon('hamburger')}
        </button>
        
        <button 
          className={`desktop-menu-btn ${sidebarCollapsed ? 'collapsed' : ''}`}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {getIcon('hamburger')}
        </button>
        
        <h1 className="header-title">{pageTitle}</h1>
      </div>
      
      <div className="header-actions">
      
        
        <div className="header-icons">
          <div className="notification-container" ref={notificationRef}>
            <button 
              className="icon-btn notification-btn" 
              onClick={toggleNotificationDropdown}
              title="Messages"
            >
              {getIcon('email')}
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            {showNotificationDropdown && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Messages</h3>
                  {unreadCount > 0 && (
                    <span className="unread-count">{unreadCount} unread</span>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <span>📭</span>
                      <p>No new messages</p>
                    </div>
                  ) : (
                    notifications.map((theater) => (
                      <div 
                        key={theater._id} 
                        className="notification-item"
                        onClick={() => handleNotificationClick(theater)}
                      >
                        <div className="notification-avatar">
                          {theater.theaterName?.charAt(0) || 'T'}
                        </div>
                        <div className="notification-content">
                          <div className="notification-title">{theater.theaterName}</div>
                          <div className="notification-message">
                            {theater.unreadCount} new message{theater.unreadCount > 1 ? 's' : ''}
                          </div>
                        </div>
                        {theater.unreadCount > 0 && (
                          <span className="notification-dot"></span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="notification-footer">
                  <button 
                    className="view-all-btn"
                    onClick={() => {
                      setShowNotificationDropdown(false);
                      navigate('/messages');
                    }}
                  >
                    View All Messages
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="user-profile-container" ref={profileRef}>
            <div 
              className="user-avatar clickable" 
              onClick={toggleProfileDropdown}
              title="Profile Menu"
            >
              {userInitials}
            </div>
            {showProfileDropdown && (
              <div className="profile-dropdown">
                <div className="profile-info">
                  <div className="profile-name">{user.name || `${user.firstName} ${user.lastName}`}</div>
                  <div className="profile-email">{user.email}</div>
                  {user.role && (
                    <div className="profile-role">
                      {typeof user.role === 'object' ? user.role.name : user.role.replace('_', ' ').toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="profile-divider"></div>
                <div className="profile-actions">
                  <button className="profile-action-btn" onClick={() => setShowProfileDropdown(false)}>
                    <span>👤</span>
                    Profile Settings
                  </button>
                  <button className="profile-action-btn" onClick={() => setShowProfileDropdown(false)}>
                    <span>⚙️</span>
                    Account Settings
                  </button>
                  <button className="profile-action-btn logout-btn" onClick={handleLogout}>
                    <span>🚪</span>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;