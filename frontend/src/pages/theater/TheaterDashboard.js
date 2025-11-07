import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import { getCachedData, setCachedData } from '../../utils/cacheUtils';
import config from '../../config';
import '../../styles/TheaterAdminDashboard.css';

function TheaterDashboard() {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  
  const [stats, setStats] = useState({
    totalOrders: 0,
    todayRevenue: 0,
    activeProducts: 0,
    totalCustomers: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [orderStatusCounts, setOrderStatusCounts] = useState({
    overdue: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0
  });
  const [revenue, setRevenue] = useState({
    total: 0,
    yearly: 0,
    lastYear: 0
  });
  const [theaterInfo, setTheaterInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    
    // TEMPORARY: For existing sessions without theater ID, try to get it from user data
    let effectiveTheaterId = theaterId || userTheaterId;
    
    // If still no theater ID, try to extract from user data
    if (!effectiveTheaterId && user) {
      if (user.assignedTheater) {
        effectiveTheaterId = user.assignedTheater._id || user.assignedTheater;
      } else if (user.theater) {
        effectiveTheaterId = user.theater._id || user.theater;
      }
    }
    
    
    // Security check: Ensure user can only access their assigned theater
    if (userType === 'theater-admin' && userTheaterId && theaterId !== userTheaterId) {
      // Redirect to their own theater dashboard if trying to access another theater
      navigate(`/theater/dashboard/${userTheaterId}`);
      return;
    }

    // If no theaterId in URL but we found one, redirect to proper URL
    if (!theaterId && effectiveTheaterId) {
      navigate(`/theater/dashboard/${effectiveTheaterId}`);
      return;
    }

    // If theaterId exists, fetch that theater's data
    if (effectiveTheaterId) {
      fetchDashboardData(effectiveTheaterId);
    } else {
      setError('Theater ID not found. Please login again.');
      setLoading(false);
    }
  }, [theaterId, userTheaterId, userType, navigate, user]);

  const fetchDashboardData = async (theaterIdToFetch) => {
    const cacheKey = `theaterDashboard_${theaterIdToFetch}`;
    
    // Check cache first for instant loading
    const cached = getCachedData(cacheKey, 60000); // 1-minute cache for dashboard stats
    if (cached) {
      console.log('⚡ [TheaterDashboard] Loading from cache');
      setStats(cached.stats);
      setRecentOrders(cached.recentOrders);
      setTheaterInfo(cached.theaterInfo);
      if (cached.orderStatusCounts) setOrderStatusCounts(cached.orderStatusCounts);
      if (cached.revenue) setRevenue(cached.revenue);
      setLoading(false);
    }
    
    // Fetch fresh data in background
    try {
      setError('');
      const token = localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/theater-dashboard/${theaterIdToFetch}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
        setRecentOrders(data.recentOrders);
        setTheaterInfo(data.theater);
        
        // Cache the fresh data
        setCachedData(cacheKey, {
          stats: data.stats,
          recentOrders: data.recentOrders,
          theaterInfo: data.theater
        });
      } else {
        setError(data.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('💥 [TheaterDashboard] Error:', error);
      if (!cached) { // Only show error if we don't have cached data
        setError('Unable to load dashboard data. Please try again.');
        // Fallback to mock data for development
        setStats({
          totalOrders: 156,
          todayRevenue: 12450,
          activeProducts: 25,
          totalCustomers: 89
        });
        setRecentOrders([
          { id: 1, customerName: 'John Doe', amount: 150, status: 'completed' },
          { id: 2, customerName: 'Jane Smith', amount: 89, status: 'pending' },
          { id: 3, customerName: 'Mike Wilson', amount: 245, status: 'processing' },
          { id: 4, customerName: 'Sarah Brown', amount: 320, status: 'completed' },
          { id: 5, customerName: 'Tom Davis', amount: 175, status: 'cancelled' }
        ]);
        setOrderStatusCounts({
          overdue: 0,
          pending: 5,
          inProgress: 3,
          completed: 142,
          cancelled: 6
        });
        setRevenue({
          total: 245680,
          yearly: 189450,
          lastYear: 156320
        });
        setTheaterInfo({
          name: 'YQ PAY NOW',
          id: theaterIdToFetch
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Theater Dashboard" currentPage="dashboard">
        <div className="tadmin-wrapper">
          {loading ? (
            <div className="tadmin-loading">
              <div className="tadmin-spinner"></div>
              <p>Loading your theater dashboard...</p>
            </div>
          ) : error ? (
            <div className="tadmin-error">
              <div className="tadmin-error-icon">⚠️</div>
              <h3>Error Loading Dashboard</h3>
              <p>{error}</p>
            </div>
          ) : (
            <>
              {/* Hero Banner */}
              <div className="tadmin-hero-banner">
                <div className="tadmin-hero-content">
                  <h1 className="tadmin-hero-title">
                    {theaterInfo.name || 'YQ PAY NOW'} Dashboard
                  </h1>
                  <p className="tadmin-hero-subtitle">
                    Overview of your theater operations {theaterId && `(ID: ${theaterId})`}
                  </p>
                </div>
              </div>

              {/* Stats Cards Row */}
              <div className="tadmin-stats-row">
                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-orders">
                      📊
                    </div>
                    <div className="tadmin-stat-trend tadmin-trend-up">
                      +12%
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.totalOrders}</div>
                    <div className="tadmin-stat-label">Total Orders</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-revenue">
                      💰
                    </div>
                    <div className="tadmin-stat-trend tadmin-trend-up">
                      +18%
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">₹{stats.todayRevenue.toLocaleString()}</div>
                    <div className="tadmin-stat-label">Today's Revenue</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-products">
                      🍿
                    </div>
                    <div className="tadmin-stat-trend tadmin-trend-up">
                      +5%
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.activeProducts}</div>
                    <div className="tadmin-stat-label">Active Products</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-customers">
                      👥
                    </div>
                    <div className="tadmin-stat-trend tadmin-trend-up">
                      +22%
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.totalCustomers}</div>
                    <div className="tadmin-stat-label">Total Customers</div>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="tadmin-content-grid">
                {/* Recent Orders Table */}
                <div className="tadmin-orders-widget">
                  <div className="tadmin-widget-header">
                    <div className="tadmin-widget-title-wrapper">
                      <div className="tadmin-widget-icon">📋</div>
                      <h2 className="tadmin-widget-title">Recent Orders</h2>
                    </div>
                    <button 
                      className="tadmin-view-all-btn"
                      onClick={() => navigate(`/theater-order-history/${theaterId}`)}
                    >
                      View All Orders
                    </button>
                  </div>

                  <table className="tadmin-orders-table">
                    <thead>
                      <tr>
                        <th>ORDER ID</th>
                        <th>CUSTOMER</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="tadmin-order-id">#{order.id}</td>
                          <td className="tadmin-order-customer">{order.customerName}</td>
                          <td className="tadmin-order-amount">₹{order.amount}</td>
                          <td>
                            <span className={`tadmin-status-badge tadmin-status-${order.status}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quick Stats Sidebar */}
                <div className="tadmin-quick-stats">
                  {/* Order Status Overview */}
                  <div className="tadmin-status-overview">
                    <div className="tadmin-widget-header" style={{padding: 0, border: 'none', background: 'transparent', marginBottom: '16px'}}>
                      <div className="tadmin-widget-title-wrapper">
                        <div className="tadmin-widget-icon">📊</div>
                        <h2 className="tadmin-widget-title">Orders Overview</h2>
                      </div>
                    </div>

                    <div className="tadmin-status-list">
                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-overdue"></div>
                          <span className="tadmin-status-name">Overdue</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.overdue}</span>
                          <span className="tadmin-status-amount">₹0.00</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-pending"></div>
                          <span className="tadmin-status-name">Pending</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.pending}</span>
                          <span className="tadmin-status-amount">₹{(orderStatusCounts.pending * 150).toLocaleString()}.00</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-progress"></div>
                          <span className="tadmin-status-name">In Progress</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.inProgress}</span>
                          <span className="tadmin-status-amount">₹{(orderStatusCounts.inProgress * 200).toLocaleString()}.00</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-completed"></div>
                          <span className="tadmin-status-name">Completed</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.completed}</span>
                          <span className="tadmin-status-amount">₹{(orderStatusCounts.completed * 180).toLocaleString()}.00</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-cancelled"></div>
                          <span className="tadmin-status-name">Cancelled</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.cancelled}</span>
                          <span className="tadmin-status-amount">₹{(orderStatusCounts.cancelled * 90).toLocaleString()}.00</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Revenue */}
                  <div className="tadmin-stat-mini-card">
                    <div className="tadmin-stat-mini-header">
                      <div className="tadmin-stat-mini-icon tadmin-icon-total-revenue">
                        💰
                      </div>
                      <span className="tadmin-stat-mini-title">Total Revenue</span>
                    </div>
                    <div className="tadmin-stat-mini-value">₹{revenue.total.toLocaleString()}.00</div>
                  </div>

                  {/* Yearly Revenue */}
                  <div className="tadmin-stat-mini-card">
                    <div className="tadmin-stat-mini-header">
                      <div className="tadmin-stat-mini-icon tadmin-icon-yearly-revenue">
                        📈
                      </div>
                      <span className="tadmin-stat-mini-title">Yearly Revenue</span>
                    </div>
                    <div className="tadmin-stat-mini-value">₹{revenue.yearly.toLocaleString()}.00</div>
                    <div className="tadmin-stat-mini-sublabel">Last 12 months</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </TheaterLayout>
    </ErrorBoundary>
  );
}

export default TheaterDashboard;