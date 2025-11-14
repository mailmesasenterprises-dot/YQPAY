import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { filterNavigationByPermissions } from '../../utils/rolePermissions';
import config from '../../config';

// Theater-specific icons
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
  </svg>
);

const IconOrders = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 4V2C7 1.45 7.45 1 8 1h8c.55 0 1 .45 1 1v2h5c.55 0 1 .45 1 1s-.45 1-1 1h-1v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6H2c-.55 0-1-.45-1-1s.45-1 1-1h5zm2-1v1h6V3H9zm-4 3v13h14V6H5z"/>
  </svg>
);

const IconCategories = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
  </svg>
);

const IconAddProduct = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

const IconProducts = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 6h-2c0-2.21-1.79-4-4-4S10 3.79 10 6H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H8V8h2v2h8V8h2v12zm-9-9h6v2h-6v-2zm0 4h4v2h-4v-2z"/>
  </svg>
);

const IconProductName = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h8c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
  </svg>
);

const IconOrderInterface = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 6V4c0-1.11.89-2 2-2s2 .89 2 2v2h2c.55 0 1 .45 1 1v11c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V7c0-.55.45-1 1-1h2V4c0-1.11.89-2 2-2s2 .89 2 2v2h8zM6 6h2V4H6v2zm-2 5v2h16v-2H4zm0 6h4v-2H4v2zm6-2h4v2h-4v-2zm6 0h4v2h-4v-2z"/>
  </svg>
);

const IconOrderHistory = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
  </svg>
);

const IconQRCode = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM19 13h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM15 19h2v2h-2z"/>
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 7H17c-.8 0-1.54.37-2.01.99l-2.49 3.2A1 1 0 0 0 12.5 12h2.9l2.6 8zM12.5 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9.5c0-.8-.67-1.5-1.5-1.5S6 8.7 6 9.5V15H4v7h3.5z"/>
  </svg>
);

const IconSales = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
  </svg>
);

const IconMessages = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
  </svg>
);

const IconReports = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
  </svg>
);

const IconBanner = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-1l2.5-3.21 1.79 2.15 2.5-3.22L21 19H3l3-3.86z"/>
  </svg>
);



const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
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
    orders: <IconOrders />,
    categories: <IconCategories />,
    products: <IconProducts />,
    addproduct: <IconAddProduct />,
    productname: <IconProductName />,
    orderinterface: <IconOrderInterface />,
    orderhistory: <IconOrderHistory />,
    qrcode: <IconQRCode />,
    users: <IconUsers />,
    sales: <IconSales />,
    messages: <IconMessages />,
    reports: <IconReports />,
    banner: <IconBanner />,
    lock: <IconLock />,
    settings: <IconSettings />
  };
  return icons[iconName] || null;
};

const TheaterSidebar = ({ sidebarOpen, setSidebarOpen, sidebarCollapsed, currentPage = 'dashboard' }) => {
  const navigate = useNavigate();
  const { theaterId, userType, user, rolePermissions } = useAuth();
  
  // Get effective theater ID - same logic as TheaterDashboard
  let effectiveTheaterId = theaterId;
  
  // If no theater ID from context, try to extract from user data
  if (!effectiveTheaterId && user) {
    if (user.assignedTheater) {
      effectiveTheaterId = user.assignedTheater._id || user.assignedTheater;
    } else if (user.theater) {
      effectiveTheaterId = user.theater._id || user.theater;
    }
  }
  
  // Debug logging

  // ✅ USE REAL ROLE PERMISSIONS FROM DATABASE (No hardcoded override)
  let effectiveRolePermissions = rolePermissions;
  
  if (!effectiveRolePermissions || effectiveRolePermissions.length === 0) {
  } else {
  }
  
  // All available navigation items
  const allNavigationItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', path: effectiveTheaterId ? `/theater-dashboard/${effectiveTheaterId}` : '/theater-dashboard' },
    { id: 'add-product', icon: 'addproduct', label: 'Add Product', path: effectiveTheaterId ? `/theater-add-product/${effectiveTheaterId}` : '/theater-add-product' },
    { id: 'products', icon: 'products', label: 'Product Stock', path: effectiveTheaterId ? `/theater-products/${effectiveTheaterId}` : '/theater-products' },
    { id: 'simple-products', icon: 'products', label: 'Simple Products', path: effectiveTheaterId ? `/simple-products/${effectiveTheaterId}` : '/simple-products' }, // ✅ Simple Product List
    { id: 'product-types', icon: 'productname', label: 'Product Type', path: effectiveTheaterId ? `/theater-product-types/${effectiveTheaterId}` : '/theater-product-types' },
    { id: 'categories', icon: 'categories', label: 'Categorie Type', path: effectiveTheaterId ? `/theater-categories/${effectiveTheaterId}` : '/theater-categories' },
    { id: 'kiosk-types', icon: 'categories', label: 'Kiosk Type', path: effectiveTheaterId ? `/theater-kiosk-types/${effectiveTheaterId}` : '/theater-kiosk-types' },
    { id: 'online-pos', icon: 'orderinterface', label: 'POS', path: effectiveTheaterId ? `/pos/${effectiveTheaterId}` : '/pos' },
    { id: 'professional-pos', icon: 'orderinterface', label: 'Professional POS', path: effectiveTheaterId ? `/theater-order-pos/${effectiveTheaterId}` : '/theater-order-pos' }, // ✅ Professional POS Interface
    { id: 'offline-pos', icon: 'orderinterface', label: 'Offline POS', path: effectiveTheaterId ? `/offline-pos/${effectiveTheaterId}` : '/offline-pos' }, // ✅ Offline POS
    { id: 'view-cart', icon: 'orders', label: 'View Cart', path: effectiveTheaterId ? `/view-cart/${effectiveTheaterId}` : '/view-cart' }, // ✅ View Cart
    { id: 'order-history', icon: 'orderhistory', label: 'Order History', path: effectiveTheaterId ? `/theater-order-history/${effectiveTheaterId}` : '/theater-order-history' },
    { id: 'online-order-history', icon: 'orderhistory', label: 'Online Orders', path: effectiveTheaterId ? `/online-order-history/${effectiveTheaterId}` : '/online-order-history' },
    { id: 'kiosk-order-history', icon: 'orderhistory', label: 'Kiosk Orders', path: effectiveTheaterId ? `/kiosk-order-history/${effectiveTheaterId}` : '/kiosk-order-history' },
    { id: 'messages', icon: 'messages', label: 'Messages', path: effectiveTheaterId ? `/theater-messages/${effectiveTheaterId}` : '/theater-messages' },
    { id: 'banner', icon: 'banner', label: 'Theater Banner', path: effectiveTheaterId ? `/theater-banner/${effectiveTheaterId}` : '/theater-banner' }, // ✅ Theater Banner
    { id: 'theater-roles', icon: 'users', label: 'Role Management', path: effectiveTheaterId ? `/theater-roles/${effectiveTheaterId}` : '/theater-roles' }, // ✅ Theater Roles
    { id: 'theater-role-access', icon: 'lock', label: 'Role Access', path: effectiveTheaterId ? `/theater-role-access/${effectiveTheaterId}` : '/theater-role-access' }, // ✅ Theater Role Access
    { id: 'qr-code-names', icon: 'qrcode', label: 'QR Code Names', path: effectiveTheaterId ? `/theater-qr-code-names/${effectiveTheaterId}` : '/theater-qr-code-names' }, // ✅ Theater QR Code Names
    { id: 'generate-qr', icon: 'qrcode', label: 'Generate QR', path: effectiveTheaterId ? `/theater-generate-qr/${effectiveTheaterId}` : '/theater-generate-qr' }, // ✅ Theater Generate QR
    { id: 'qr-management', icon: 'qrcode', label: 'QR Management', path: effectiveTheaterId ? `/theater-qr-management/${effectiveTheaterId}` : '/theater-qr-management' }, // ✅ Theater QR Management
    { id: 'theater-users', icon: 'users', label: 'Theater Users', path: effectiveTheaterId ? `/theater-user-management/${effectiveTheaterId}` : '/theater-user-management' }, // ✅ Theater User Management
    // { id: 'stock', icon: 'categories', label: 'Stock Data', path: effectiveTheaterId ? `/theater-stock-management/${effectiveTheaterId}` : '/theater-stock-management' }, // ✅ Stock Management
    { id: 'orders', icon: 'orders', label: 'Orders', path: effectiveTheaterId ? `/theater-orders/${effectiveTheaterId}` : '/theater-orders' }, // ✅ Orders
    { id: 'reports', icon: 'reports', label: 'Reports', path: effectiveTheaterId ? `/theater-reports/${effectiveTheaterId}` : '/theater-reports' }, // ✅ Reports
    { id: 'settings', icon: 'settings', label: 'Settings', path: effectiveTheaterId ? `/theater-settings/${effectiveTheaterId}` : '/theater-settings' },

  ];

  // Filter navigation items based on role permissions
  let navigationItems;
  
  // ✅ ROLE-BASED FILTERING ENABLED
  // Super admin sees all pages, theater users see only permitted pages
  
  if (userType === 'super_admin') {

    navigationItems = allNavigationItems;
  } else if (!effectiveRolePermissions || effectiveRolePermissions.length === 0) {

    // Fallback: only show Dashboard if no permissions are available
    navigationItems = allNavigationItems.filter(item => item.id === 'dashboard');
  } else {

    navigationItems = filterNavigationByPermissions(allNavigationItems, effectiveRolePermissions);
  }
  

  const handleNavigation = (item) => {
    // Don't automatically close sidebar on navigation - let user control it manually
    // Only close on mobile overlay click (handled by overlay onClick)
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
          <div className="brand-icon" style={{ background: 'transparent' }}>
            <img 
              src="/images/logo.jpg" 
              alt="Theater Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div className="brand-text">Theater Admin</div>
            <div className="brand-subtitle">{config.app.name}</div>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => handleNavigation(item)}
              data-tooltip={item.label}
            >
              <span className="nav-icon">{getIcon(item.icon)}</span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default TheaterSidebar;