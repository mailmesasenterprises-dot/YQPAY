import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import ErrorBoundary from '../../components/ErrorBoundary';
import '../../styles/TheaterAdminDashboard.css';

// Static Theater Dashboard with Fixed Data
const TheaterDashboard = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();

  // Static data - no API calls
  const stats = {
    totalOrders: 156,
    todayOrders: 12,
    todayRevenue: 4850.00,
    monthlyRevenue: 125000.00,
    yearlyRevenue: 1250000.00,
    activeProducts: 48,
    totalCustomers: 892
  };

  const orderStatusCounts = {
    overdue: 2,
    pending: 8,
    inProgress: 5,
    completed: 132,
    cancelled: 9
  };

  const revenue = {
    total: 1250000.00,
    yearly: 1250000.00,
    monthly: 125000.00
  };

  const recentOrders = [
    { id: 1, orderNumber: 'ORD-2025-001', customerName: 'Rajesh Kumar', amount: 850.00, status: 'completed' },
    { id: 2, orderNumber: 'ORD-2025-002', customerName: 'Priya Sharma', amount: 450.00, status: 'pending' },
    { id: 3, orderNumber: 'ORD-2025-003', customerName: 'Amit Patel', amount: 1200.00, status: 'inProgress' },
    { id: 4, orderNumber: 'ORD-2025-004', customerName: 'Sneha Reddy', amount: 350.00, status: 'completed' },
    { id: 5, orderNumber: 'ORD-2025-005', customerName: 'Vikram Singh', amount: 920.00, status: 'pending' }
  ];

  const trends = {
    last7Days: [
      { date: '2025-01-08', revenue: 15000 },
      { date: '2025-01-09', revenue: 18000 },
      { date: '2025-01-10', revenue: 16500 },
      { date: '2025-01-11', revenue: 21000 },
      { date: '2025-01-12', revenue: 19000 },
      { date: '2025-01-13', revenue: 23000 },
      { date: '2025-01-14', revenue: 20500 }
    ],
    topProducts: [
      { name: 'Popcorn (Large)', quantity: 145, revenue: 43500 },
      { name: 'Coca-Cola (Medium)', quantity: 230, revenue: 34500 },
      { name: 'Nachos with Cheese', quantity: 98, revenue: 29400 },
      { name: 'Combo Pack', quantity: 76, revenue: 45600 },
      { name: 'Hot Dog', quantity: 67, revenue: 20100 }
    ]
  };

  const theaterInfo = {
    name: 'YQ PAY NOW'
  };

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Theater Dashboard" currentPage="dashboard">
        <div className="tadmin-wrapper">
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
        </div>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterDashboard;