import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterSidebar from './TheaterSidebar';
import Header from '../Header'; // Use global header component
import config from '../../config';
import '../../styles/Dashboard.css'; // Use same styles as admin layout

const TheaterLayout = ({ children, pageTitle = 'Theater Dashboard' }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Persist sidebar state in localStorage
    const savedState = localStorage.getItem('theater-sidebar-open');
    return savedState ? JSON.parse(savedState) : false;
  });
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist sidebar collapsed state in localStorage
    const savedState = localStorage.getItem('theater-sidebar-collapsed');
    return savedState !== null ? JSON.parse(savedState) : true; // Default to collapsed (icons only)
  });
  
  const [theaterName, setTheaterName] = useState('');
  const location = useLocation();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId } = useAuth();

  // Custom setSidebarOpen that persists state
  const handleSetSidebarOpen = (value) => {
    setSidebarOpen(value);
    localStorage.setItem('theater-sidebar-open', JSON.stringify(value));
  };
  
  // Custom setSidebarCollapsed that persists state
  const handleSetSidebarCollapsed = (value) => {
    setSidebarCollapsed(value);
    localStorage.setItem('theater-sidebar-collapsed', JSON.stringify(value));
  };

  // User profile for theater admin (similar to AdminLayout structure)
  const [userProfile] = useState({
    firstName: 'Theater',
    lastName: 'Admin', 
    email: 'admin@theater.com',
    role: 'Theater Administrator'
  });

  // Determine current page from location
  const getCurrentPage = () => {
    const path = location.pathname;
    if (path.includes('/theater-dashboard')) return 'dashboard';
    if (path.includes('/theater-banner')) return 'banner';
    if (path.includes('/theater-order-history')) return 'order-history';
    if (path.includes('/online-order-history')) return 'online-order-history';
    if (path.includes('/kiosk-order-history')) return 'kiosk-order-history';
    if (path.includes('/view-cart')) return 'order-interface'; // View Cart should highlight Order Interface
    if (path.includes('/theater-order/')) return 'order-interface';
    if (path.includes('/online-pos/')) return 'online-pos';
    if (path.includes('/offline-pos/')) return 'offline-pos';
    if (path.includes('/theater/orders')) return 'orders';
    if (path.includes('/theater-categories')) return 'categories';
    if (path.includes('/theater-kiosk-types')) return 'kiosk-types';
    if (path.includes('/theater-products')) return 'products';
    if (path.includes('/theater-product-types')) return 'product-types';
    if (path.includes('/theater-add-product')) return 'add-product';
    if (path.includes('/theater-stock-management')) return 'products';
    if (path.includes('/theater-messages')) return 'messages';
    if (path.includes('/theater-reports')) return 'reports';
    if (path.includes('/theater-roles')) return 'theater-roles';
    if (path.includes('/theater-role-access')) return 'theater-role-access';
    if (path.includes('/theater-qr-code-names')) return 'qr-code-names';
    if (path.includes('/theater-generate-qr')) return 'generate-qr';
    if (path.includes('/theater-qr-management')) return 'qr-management';
    if (path.includes('/theater-user-management')) return 'theater-users';
    if (path.includes('/theater/qr-codes')) return 'qrcode';
    if (path.includes('/theater/staff')) return 'users';
    if (path.includes('/theater/sales')) return 'sales';
    if (path.includes('/theater/messages')) return 'messages';
    if (path.includes('/theater/analytics')) return 'reports';
    if (path.includes('/theater-settings')) return 'settings';
    return 'dashboard';
  };

  const currentPage = getCurrentPage();

  // REMOVED: Don't close sidebar on route change - let user control it manually
  // The sidebar state is now persisted in localStorage

  // Add body class for sidebar state
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }

    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarOpen]);

  // Fetch theater name and update browser title
  useEffect(() => {
    const fetchTheaterName = async () => {
      // Determine effective theater ID
      let effectiveTheaterId = theaterId || userTheaterId;
      
      if (!effectiveTheaterId && user) {
        if (user.assignedTheater) {
          effectiveTheaterId = user.assignedTheater._id || user.assignedTheater;
        } else if (user.theater) {
          effectiveTheaterId = user.theater._id || user.theater;
        }
      }

      if (!effectiveTheaterId) {
        document.title = `${pageTitle} - YQPayNow`;
        return;
      }

      // Check if theater name is cached in localStorage
      const cachedTheaterName = localStorage.getItem(`theater_${effectiveTheaterId}_name`);
      if (cachedTheaterName) {
        setTheaterName(cachedTheaterName);
        document.title = `${pageTitle} - ${cachedTheaterName}`;
        return;
      }

      // Fetch theater info from API
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${config.api.baseUrl}/theater-dashboard/${effectiveTheaterId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.theater && data.theater.name) {
            const name = data.theater.name;
            setTheaterName(name);
            // Cache the theater name to avoid repeated API calls
            localStorage.setItem(`theater_${effectiveTheaterId}_name`, name);
            document.title = `${pageTitle} - ${name}`;
          } else {
            document.title = `${pageTitle} - YQPayNow`;
          }
        } else {
          document.title = `${pageTitle} - YQPayNow`;
        }
      } catch (error) {
        console.error('Failed to fetch theater name:', error);
        document.title = `${pageTitle} - YQPayNow`;
      }
    };

    fetchTheaterName();
  }, [theaterId, userTheaterId, user, pageTitle]);


  return (
    <div className={`dashboard-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <TheaterSidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={handleSetSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        currentPage={currentPage}
      />

      {/* Main Content */}
      <main className={`dashboard-main ${!sidebarCollapsed ? 'expanded' : 'collapsed'}`}>
        <Header 
          sidebarOpen={sidebarOpen}
          setSidebarOpen={handleSetSidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={handleSetSidebarCollapsed}
          pageTitle={pageTitle}
          userProfile={userProfile}
        />

        {/* Content */}
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default TheaterLayout;