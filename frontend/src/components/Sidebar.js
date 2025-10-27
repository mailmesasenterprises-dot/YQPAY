import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import '../styles/Sidebar.css';

// Theater Canteen Management Icons - More relevant and modern
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
  </svg>
);

const IconTheaters = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
  </svg>
);

const IconAddTheater = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
  </svg>
);

const IconTheaterUsers = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63c-.24-.72-.97-1.37-1.96-1.37h-2.5c-.83 0-1.54.5-1.84 1.22l-1.92 4.53c-.29.7-.14 1.51.36 2.06L15 18.3V22h4zM12.5 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9.5c0-.8-.67-1.5-1.5-1.5S6 8.7 6 9.5V15H4v7h3.5z"/>
  </svg>
);

const IconRoles = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1V3H9V1L3 7V9H1V11H3V19C3 20.1 3.9 21 5 21H11V19H5V11H3V9H21M16 12C14.9 12 14 12.9 14 14S14.9 16 16 16 18 15.1 18 14 17.1 12 16 12M24 20V18H18V20C18 21.1 18.9 22 20 22H22C23.1 22 24 21.1 24 20Z"/>
  </svg>
);

const IconRoleAccess = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
  </svg>
);

const IconPageAccess = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8l6-6V4c0-1.1-.9-2-2-2zm4 18l-4-4h4v4zM8 15h8v2H8v-2zm0-4h8v2H8v-2zm0-4h8v2H8V7z"/>
  </svg>
);

const IconQRGenerate = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4z"/>
  </svg>
);

const IconQRList = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fillOpacity="0.3"/>
  </svg>
);

const IconQRNames = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h7l5-5V4c0-1.1-.9-2-2-2zm4 15l-4 4V17h4z"/>
    <path d="M8 12h8v2H8v-2zm0-2h8v2H8v-2zm0-2h5v2H8V8z"/>
    <path d="M3 11h4V7H3v4zm0 10h4v-4H3v4zM13 7v4h4V7h-4z"/>
  </svg>
);

const IconOrders = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8a1 1 0 0 0-1-1zM10 6a2 2 0 0 1 4 0v1h-4zm8 13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9h2v1a1 1 0 0 0 2 0V9h4v1a1 1 0 0 0 2 0V9h2z"/>
  </svg>
);

const IconSales = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const IconCustomers = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63c-.24-.72-.97-1.37-1.96-1.37h-2.5c-.83 0-1.54.5-1.84 1.22l-1.92 4.53c-.29.7-.14 1.51.36 2.06L15 18.3V22h4zM12.5 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9.5c0-.8-.67-1.5-1.5-1.5S6 8.7 6 9.5V15H4v7h3.5z"/>
  </svg>
);

const IconRefunds = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H11.5v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.65c.1 1.6 1.18 2.68 2.85 3.02V19h1.71v-1.66c1.48-.33 2.68-1.31 2.68-2.88 0-1.52-1.1-2.63-3.58-3.32z"/>
  </svg>
);

const IconMessages = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
);

const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

const IconTransactions = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
  </svg>
);

const IconInvoices = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8l6-6V4c0-1.1-.9-2-2-2zm4 18l-4-4h4v4zM8 15h8v2H8v-2zm0-4h8v2H8v-2zm0-4h8v2H8V7z"/>
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);

const getIcon = (iconName) => {
  const icons = {
    dashboard: <IconDashboard />,
    theaters: <IconTheaters />,
    'add-theater': <IconAddTheater />,
    'theater-users': <IconTheaterUsers />,
    'theater-admin-management': <IconTheaterUsers />,
    roles: <IconRoles />,
    'role-access': <IconRoleAccess />,
    'page-access': <IconPageAccess />,
    'qr-generate': <IconQRGenerate />,
    'qr-list': <IconQRList />,
    'qr-names': <IconQRNames />,
    orders: <IconOrders />,
    sales: <IconSales />,
    customers: <IconCustomers />,
    refunds: <IconRefunds />,
    messages: <IconMessages />,
    email: <IconEmail />,
    transactions: <IconTransactions />,
    invoices: <IconInvoices />,
    settings: <IconSettings />
  };
  return icons[iconName] || null;
};

const Sidebar = ({ sidebarOpen, setSidebarOpen, sidebarCollapsed, currentPage = 'dashboard', userRole = 'super_admin' }) => {
  const navigate = useNavigate();
  const { userType, rolePermissions, theaterId } = useAuth();
  
  const navigationItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: '/dashboard', tooltip: 'Main Dashboard - Overview & Analytics' },
    { id: 'add-theater', icon: 'add-theater', label: 'Add Theater', path: '/add-theater', tooltip: 'Add New Theater - Register Theater Location' },
    { id: 'theaters', icon: 'theaters', label: 'Theater List', path: '/theaters', tooltip: 'Theater Management - View All Theaters' },
    { id: 'page-access', icon: 'page-access', label: 'Page Access', path: '/page-access', tooltip: 'Page Access Control - Manage Page Permissions' },
    { id: 'roles', icon: 'roles', label: 'Create Role ', path: '/roles', tooltip: 'Role Management - Create & Edit User Roles' },
    { id: 'role-access', icon: 'role-access', label: 'Role Access', path: '/role-access', tooltip: 'Role Permissions - Configure Role Access Rights' },
    { id: 'theater-users', icon: 'theater-users', label: 'Theater Users', path: '/theater-users', tooltip: 'User Management - Manage Theater Staff & Admins' },
    { id: 'qr-generate', icon: 'qr-generate', label: 'Generate QR', path: '/qr-generate', tooltip: 'QR Generator - Create New QR Codes' },
    { id: 'qr-names', icon: 'qr-names', label: 'QR Code Names', path: '/qr-names', tooltip: 'QR Code Names - Manage QR Names & Seat Classes' },
    { id: 'qr-list', icon: 'qr-list', label: 'QR Management', path: '/qr-management', tooltip: 'QR Management - View & Manage All QR Codes' },
    { id: 'settings', icon: 'settings', label: 'Settings', path: '/settings', tooltip: 'System Settings - Configure Application Settings' }
  ];

  // ✅ FILTER MENU BASED ON ROLE PERMISSIONS
  const filteredNavigationItems = useMemo(() => {
    // Super admin sees everything
    if (userType === 'super_admin') {
      return navigationItems;
    }

    // Theater users see only pages they have permission for
    if (userType === 'theater_user' || userType === 'theater_admin') {
      if (!rolePermissions || rolePermissions.length === 0) {
        console.warn('⚠️ No role permissions found for user');
        return [];
      }

      const allowedPages = rolePermissions[0]?.permissions
        ?.filter(p => p.hasAccess === true)
        .map(p => p.route) || [];

      console.log('🔐 Filtering menu items based on permissions:', allowedPages);

      return navigationItems.filter(item => {
        // Replace :theaterId in route for comparison
        const itemRoute = item.path.replace(':theaterId', theaterId);
        
        // Check if this menu item's path matches any allowed page route
        const isAllowed = allowedPages.some(allowedRoute => {
          const normalizedAllowed = allowedRoute.replace(':theaterId', theaterId);
          return itemRoute === normalizedAllowed || itemRoute.startsWith(normalizedAllowed);
        });

        if (isAllowed) {
          console.log('✅ Menu item allowed:', item.label, item.path);
        }

        return isAllowed;
      });
    }

    // Default: show nothing
    return [];
  }, [userType, rolePermissions, theaterId, navigationItems]);

  const handleNavigation = (item) => {
    // Don't automatically close sidebar on navigation - let user control it manually
    // Use React Router navigation instead of window.location.href
    if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <>
      {/* Sidebar Overlay for Mobile */}
      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div>
            <div className="brand-text">{config.branding.companyName}</div>
            <div className="brand-subtitle">{config.app.name}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {filteredNavigationItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavigation(item)}
              data-tooltip={item.tooltip}
            >
              <span className="nav-icon">{getIcon(item.icon)}</span>
              <span className="nav-text">{item.label}</span>
              <div className="nav-tooltip">{item.tooltip}</div>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
