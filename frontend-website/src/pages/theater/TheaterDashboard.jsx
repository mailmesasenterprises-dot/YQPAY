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
    monthly: 0,
    lastYear: 0
  });
  const [trends, setTrends] = useState({
    last7Days: [],
    topProducts: []
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
      if (cached.trends) setTrends(cached.trends);
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
        // Update stats from API response
        setStats({
          totalOrders: data.stats.totalOrders || 0,
          todayOrders: data.stats.todayOrders || 0,
          todayRevenue: data.stats.todayRevenue || 0,
          monthlyRevenue: data.stats.monthlyRevenue || 0,
          yearlyRevenue: data.stats.yearlyRevenue || 0,
          totalRevenue: data.stats.totalRevenue || 0,
          activeProducts: data.stats.activeProducts || 0,
          totalCustomers: data.stats.totalCustomers || 0,
          averageOrderValue: data.stats.averageOrderValue || 0
        });
        
        // Update recent orders
        setRecentOrders(data.recentOrders || []);
        
        // Update order status counts from API
        if (data.stats.orderStatusCounts) {
          setOrderStatusCounts({
            overdue: 0, // Not tracked in current system
            pending: data.stats.orderStatusCounts.pending || 0,
            inProgress: (data.stats.orderStatusCounts.preparing || 0) + (data.stats.orderStatusCounts.ready || 0),
            completed: (data.stats.orderStatusCounts.completed || 0) + (data.stats.orderStatusCounts.served || 0),
            cancelled: data.stats.orderStatusCounts.cancelled || 0
          });
        }
        
        // Update revenue from API
        setRevenue({
          total: data.stats.totalRevenue || 0,
          yearly: data.stats.yearlyRevenue || 0,
          monthly: data.stats.monthlyRevenue || 0,
          lastYear: 0 // Not available in current API
        });
        
        // Update trends if available
        if (data.trends) {
          setTrends({
            last7Days: data.trends.last7Days || [],
            topProducts: data.trends.topProducts || []
          });
        }
        
        // Update theater info
        setTheaterInfo(data.theater || {});
        
        // Cache the fresh data
        setCachedData(cacheKey, {
          stats: data.stats,
          recentOrders: data.recentOrders,
          theaterInfo: data.theater,
          orderStatusCounts: {
            overdue: 0,
            pending: data.stats.orderStatusCounts?.pending || 0,
            inProgress: (data.stats.orderStatusCounts?.preparing || 0) + (data.stats.orderStatusCounts?.ready || 0),
            completed: (data.stats.orderStatusCounts?.completed || 0) + (data.stats.orderStatusCounts?.served || 0),
            cancelled: data.stats.orderStatusCounts?.cancelled || 0
          },
          revenue: {
            total: data.stats.totalRevenue || 0,
            yearly: data.stats.yearlyRevenue || 0,
            monthly: data.stats.monthlyRevenue || 0
          },
          trends: data.trends || { last7Days: [], topProducts: [] }
        });
      } else {
        setError(data.message || 'Failed to load dashboard data');
      }
    } catch (error) {
      console.error('💥 [TheaterDashboard] Error:', error);
      if (!cached) { // Only show error if we don't have cached data
        setError('Unable to load dashboard data. Please try again.');
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
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.totalOrders}</div>
                    <div className="tadmin-stat-label">Total Orders</div>
                    <div className="tadmin-stat-sublabel">{stats.todayOrders} today</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-revenue">
                      💰
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">₹{stats.todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="tadmin-stat-label">Today's Revenue</div>
                    <div className="tadmin-stat-sublabel">₹{stats.monthlyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} this month</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-products">
                      🍿
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.activeProducts}</div>
                    <div className="tadmin-stat-label">Active Products</div>
                    <div className="tadmin-stat-sublabel">Available now</div>
                  </div>
                </div>

                <div className="tadmin-stat-card">
                  <div className="tadmin-stat-icon-wrapper">
                    <div className="tadmin-stat-icon tadmin-icon-customers">
                      👥
                    </div>
                  </div>
                  <div className="tadmin-stat-content">
                    <div className="tadmin-stat-value">{stats.totalCustomers}</div>
                    <div className="tadmin-stat-label">Total Customers</div>
                    <div className="tadmin-stat-sublabel">Unique customers</div>
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
                      {recentOrders.length > 0 ? (
                        recentOrders.map((order) => (
                          <tr key={order.id || order.orderNumber}>
                            <td className="tadmin-order-id">#{order.orderNumber || order.id}</td>
                            <td className="tadmin-order-customer">{order.customerName || 'Customer'}</td>
                            <td className="tadmin-order-amount">₹{order.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td>
                              <span className={`tadmin-status-badge tadmin-status-${order.status}`}>
                                {order.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            No recent orders
                          </td>
                        </tr>
                      )}
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
                          <span className="tadmin-status-amount">—</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-progress"></div>
                          <span className="tadmin-status-name">In Progress</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.inProgress}</span>
                          <span className="tadmin-status-amount">—</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-completed"></div>
                          <span className="tadmin-status-name">Completed</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.completed}</span>
                          <span className="tadmin-status-amount">—</span>
                        </div>
                      </div>

                      <div className="tadmin-status-item">
                        <div className="tadmin-status-info">
                          <div className="tadmin-status-dot tadmin-dot-cancelled"></div>
                          <span className="tadmin-status-name">Cancelled</span>
                        </div>
                        <div className="tadmin-status-value">
                          <span className="tadmin-status-count">{orderStatusCounts.cancelled}</span>
                          <span className="tadmin-status-amount">—</span>
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
                    <div className="tadmin-stat-mini-value">₹{revenue.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>

                  {/* Monthly Revenue */}
                  <div className="tadmin-stat-mini-card">
                    <div className="tadmin-stat-mini-header">
                      <div className="tadmin-stat-mini-icon tadmin-icon-yearly-revenue">
                        📈
                      </div>
                      <span className="tadmin-stat-mini-title">Monthly Revenue</span>
                    </div>
                    <div className="tadmin-stat-mini-value">₹{revenue.monthly.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="tadmin-stat-mini-sublabel">This month</div>
                  </div>

                  {/* Yearly Revenue */}
                  <div className="tadmin-stat-mini-card">
                    <div className="tadmin-stat-mini-header">
                      <div className="tadmin-stat-mini-icon tadmin-icon-yearly-revenue">
                        📊
                      </div>
                      <span className="tadmin-stat-mini-title">Yearly Revenue</span>
                    </div>
                    <div className="tadmin-stat-mini-value">₹{revenue.yearly.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="tadmin-stat-mini-sublabel">This year</div>
                  </div>
                </div>

                {/* Revenue Trend Chart */}
                {trends.last7Days && trends.last7Days.length > 0 && (
                  <div className="tadmin-revenue-chart-widget">
                    <div className="tadmin-widget-header">
                      <div className="tadmin-widget-title-wrapper">
                        <div className="tadmin-widget-icon">📈</div>
                        <h2 className="tadmin-widget-title">Revenue Trend (Last 7 Days)</h2>
                      </div>
                    </div>
                    <div className="tadmin-chart-container">
                      <div className="tadmin-line-chart">
                        <svg viewBox="0 0 600 200" preserveAspectRatio="none" style={{ width: '100%', height: '200px' }}>
                          <defs>
                            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <polyline
                            points={trends.last7Days.map((day, i) => {
                              const x = (i / (trends.last7Days.length - 1)) * 580 + 10;
                              const maxRevenue = Math.max(...trends.last7Days.map(d => d.revenue), 1);
                              const y = 190 - ((day.revenue / maxRevenue) * 170);
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="#7c3aed"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polygon
                            points={`10,190 ${trends.last7Days.map((day, i) => {
                              const x = (i / (trends.last7Days.length - 1)) * 580 + 10;
                              const maxRevenue = Math.max(...trends.last7Days.map(d => d.revenue), 1);
                              const y = 190 - ((day.revenue / maxRevenue) * 170);
                              return `${x},${y}`;
                            }).join(' ')} 590,190`}
                            fill="url(#revenueGradient)"
                          />
                        </svg>
                      </div>
                      <div className="tadmin-chart-labels">
                        {trends.last7Days.map((day, i) => (
                          <div key={i} className="tadmin-chart-label">
                            <div className="tadmin-chart-date">{new Date(day.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
                            <div className="tadmin-chart-value">₹{day.revenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Products */}
                {trends.topProducts && trends.topProducts.length > 0 && (
                  <div className="tadmin-top-products-widget">
                    <div className="tadmin-widget-header">
                      <div className="tadmin-widget-title-wrapper">
                        <div className="tadmin-widget-icon">🏆</div>
                        <h2 className="tadmin-widget-title">Top Selling Products</h2>
                      </div>
                    </div>
                    <div className="tadmin-products-list">
                      {trends.topProducts.map((product, index) => (
                        <div key={index} className="tadmin-product-item">
                          <div className="tadmin-product-rank">#{index + 1}</div>
                          <div className="tadmin-product-info">
                            <div className="tadmin-product-name">{product.name}</div>
                            <div className="tadmin-product-stats">
                              <span>{product.quantity} sold</span>
                              <span>₹{product.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </TheaterLayout>
    </ErrorBoundary>
  );
}

export default TheaterDashboard;