import React, { useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import config from '../config';
import { useCachedFetch } from '../hooks/useCachedFetch';
import { SkeletonDashboard } from '../components/SkeletonLoader';
import { useToast } from '../contexts/ToastContext';
import '../styles/SuperAdminDashboard.css';



const Dashboard = () => {
  const token = useMemo(() => localStorage.getItem('authToken'), []);
  
  // 🚀 INSTANT: Check cache first before hook loads
  const [initialStats] = React.useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('cache_dashboard_super_admin_stats') || 'null');
      if (cached && cached.data && cached.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < 30000) { // 30 seconds
          return cached.data;
        }
      }
    } catch (e) {}
    return null;
  });
  
  // 🚀 PERFORMANCE: Use cached fetch hook with 30 second cache TTL
  const { data: response, error: fetchError, refetch } = useCachedFetch(
    token ? `${config.api.baseUrl}/dashboard/super-admin-stats` : null,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    },
    'dashboard_super_admin_stats', // Cache key
    30000, // 30 second cache TTL
    [token] // Refetch when token changes
  );

  // 🚀 PERFORMANCE: Memoize stats extraction - use cached if available
  const stats = useMemo(() => {
    if (response && response.success) return response.data;
    if (initialStats) return initialStats; // Use cached data if API not ready
    return null;
  }, [response, initialStats]);

  // 🚀 PERFORMANCE: Memoize error message
  const error = useMemo(() => {
    if (fetchError) return fetchError;
    if (response && !response.success) {
      return response.error || 'Failed to load dashboard data';
    }
    if (!token) return 'Authentication token not found';
    return null;
  }, [fetchError, response, token]);

  // 🚀 PERFORMANCE: Auto-refresh every 30 seconds using refetch
  React.useEffect(() => {
    if (!token) return;
    
    const interval = setInterval(() => {
      refetch(); // Refresh data in background
    }, 30000);
    
    return () => clearInterval(interval);
  }, [token, refetch]);

  // Check for expiring agreements and show notification
  const [expiringAgreements, setExpiringAgreements] = React.useState([]);
  const { warning } = useToast();

  React.useEffect(() => {
    if (!token) return;

    const checkExpiringAgreements = async () => {
      try {
        const response = await fetch(`${config.api.baseUrl}/theaters/expiring-agreements`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.expiringTheaters.length > 0) {
            setExpiringAgreements(result.data.expiringTheaters);
            
            // Show notification for each expiring agreement
            result.data.expiringTheaters.forEach(theater => {
              warning(
                `Agreement for ${theater.theaterName} expires in ${theater.daysUntilExpiration} day(s)`,
                5000
              );
            });
          }
        }
      } catch (error) {
        console.error('Error checking expiring agreements:', error);
      }
    };

    // Check immediately and then every 5 minutes
    checkExpiringAgreements();
    const interval = setInterval(checkExpiringAgreements, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [token, warning]);

  // 🚀 INSTANT: Always show content - use skeleton if no data
  const hasData = stats || initialStats;
  
  // Show skeleton instead of spinner - instant UI
  if (!hasData) {
    return (
      <AdminLayout pageTitle="Dashboard" currentPage="dashboard">
        <div className="sadmin-wrapper">
          <SkeletonDashboard />
        </div>
      </AdminLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <AdminLayout pageTitle="Dashboard" currentPage="dashboard">
        <div className="sadmin-wrapper">
          <div className="sadmin-error">
            <div className="sadmin-error-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3>Error Loading Dashboard</h3>
            <p>{error}</p>
            <button onClick={refetch} className="sadmin-retry-btn">
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // No data state
  if (!stats) {
    return (
      <AdminLayout pageTitle="Dashboard" currentPage="dashboard">
        <div className="sadmin-wrapper">
          <div className="sadmin-empty">
            <p>No dashboard data available</p>
            <button onClick={refetch} className="sadmin-retry-btn">
              Reload
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }


  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Dashboard" currentPage="dashboard">
        <div className="sadmin-wrapper">
          {/* Top Stats Row */}
          <div className="sadmin-top-stats">
            <div className="sadmin-stat-card sadmin-card-logout">
              <div className="sadmin-stat-icon sadmin-icon-logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="sadmin-stat-content">
                <div className="sadmin-stat-value">{stats?.summary?.totalTheaters || 0}</div>
                <div className="sadmin-stat-label">Total Theaters</div>
                <div className="sadmin-stat-sublabel">{stats?.summary?.activeTheaters || 0} active</div>
              </div>
            </div>

          <div className="sadmin-stat-card sadmin-card-tasks">
            <div className="sadmin-stat-icon sadmin-icon-tasks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="sadmin-stat-content">
              <div className="sadmin-stat-value">{stats?.summary?.totalOrders || 0}</div>
              <div className="sadmin-stat-label">Total Orders</div>
              <div className="sadmin-stat-sublabel">{stats?.summary?.todayOrders || 0} today</div>
            </div>
          </div>

          <div className="sadmin-stat-card sadmin-card-events">
            <div className="sadmin-stat-icon sadmin-icon-events">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="sadmin-stat-content">
              <div className="sadmin-stat-value">₹{(stats?.summary?.monthlyRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div className="sadmin-stat-label">Monthly Revenue</div>
              <div className="sadmin-stat-sublabel">This month</div>
            </div>
          </div>

          <div className="sadmin-stat-card sadmin-card-due">
            <div className="sadmin-stat-icon sadmin-icon-due">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="sadmin-stat-content">
              <div className="sadmin-stat-value">{stats?.summary?.pendingOrders || 0}</div>
              <div className="sadmin-stat-label">Pending Orders</div>
              <div className="sadmin-stat-sublabel">Need attention</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="sadmin-main-grid">
          {/* Theaters Overview */}
          <div className="sadmin-widget sadmin-projects-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">Theaters Overview</h3>
              <button className="sadmin-widget-menu">⋯</button>
            </div>
            <div className="sadmin-projects-stats">
              <div className="sadmin-project-stat">
                <div className="sadmin-project-number">{stats?.projects?.open || stats?.summary?.activeTheaters || 0}</div>
                <div className="sadmin-project-label">Active</div>
              </div>
              <div className="sadmin-project-stat">
                <div className="sadmin-project-number">{stats?.projects?.completed || 0}</div>
                <div className="sadmin-project-label">Setup Complete</div>
              </div>
              <div className="sadmin-project-stat">
                <div className="sadmin-project-number">{stats?.projects?.hold || stats?.summary?.inactiveTheaters || 0}</div>
                <div className="sadmin-project-label">Inactive</div>
              </div>
            </div>
            <div className="sadmin-progress-bar">
              <div className="sadmin-progress-fill" style={{ width: `${stats?.projects?.progression || (stats?.summary?.totalTheaters > 0 ? Math.round((stats?.summary?.activeTheaters / stats?.summary?.totalTheaters) * 100) : 0)}%` }}></div>
              <div className="sadmin-progress-label">Active Rate {stats?.projects?.progression || (stats?.summary?.totalTheaters > 0 ? Math.round((stats?.summary?.activeTheaters / stats?.summary?.totalTheaters) * 100) : 0)}%</div>
            </div>
          </div>

          {/* Orders Overview */}
          <div className="sadmin-widget sadmin-invoice-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">Orders Overview</h3>
              <button className="sadmin-widget-menu">⋯</button>
            </div>
            <div className="sadmin-invoice-list">
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-overdue"></span>
                <span className="sadmin-invoice-label">Overdue</span>
                <span className="sadmin-invoice-count">{stats?.invoices?.overdue || 0}</span>
                <span className="sadmin-invoice-amount">₹{((stats?.invoices?.overdue || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-notpaid"></span>
                <span className="sadmin-invoice-label">Pending</span>
                <span className="sadmin-invoice-count">{stats?.invoices?.notPaid || 0}</span>
                <span className="sadmin-invoice-amount">₹{((stats?.invoices?.notPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-partial"></span>
                <span className="sadmin-invoice-label">In Progress</span>
                <span className="sadmin-invoice-count">{stats?.invoices?.partiallyPaid || 0}</span>
                <span className="sadmin-invoice-amount">₹{((stats?.invoices?.partiallyPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-paid"></span>
                <span className="sadmin-invoice-label">Completed</span>
                <span className="sadmin-invoice-count">{stats?.invoices?.fullyPaid || 0}</span>
                <span className="sadmin-invoice-amount">₹{(stats?.invoices?.totalInvoiced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-draft"></span>
                <span className="sadmin-invoice-label">Cancelled</span>
                <span className="sadmin-invoice-count">{stats?.invoices?.draft || 0}</span>
                <span className="sadmin-invoice-amount">₹{((stats?.invoices?.draft || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="sadmin-invoice-totals">
              <div className="sadmin-invoice-total-item">
                <span className="sadmin-invoice-total-label">Total Revenue</span>
                <span className="sadmin-invoice-total-amount">₹{(stats?.invoices?.totalInvoiced || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-total-item sadmin-last-months">
                <span className="sadmin-invoice-total-label">Yearly Revenue</span>
                <span className="sadmin-invoice-total-amount">₹{(stats?.invoices?.last12Months || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                <span className="sadmin-invoice-period">Last 12 months</span>
              </div>
            </div>
          </div>

          {/* Revenue Analytics */}
          <div className="sadmin-widget sadmin-income-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">Revenue Analytics</h3>
            </div>
            <div className="sadmin-income-chart">
              <div className="sadmin-donut-chart">
                <svg viewBox="0 0 200 200">
                  <circle cx="100" cy="100" r="80" fill="none" stroke="#E5E7EB" strokeWidth="30" />
                  <circle 
                    cx="100" 
                    cy="100" 
                    r="80" 
                    fill="none" 
                    stroke="#10B981" 
                    strokeWidth="30"
                    strokeDasharray="502.65"
                    strokeDashoffset={502.65 - (502.65 * 0.75)}
                    transform="rotate(-90 100 100)"
                  />
                </svg>
              </div>
            </div>
            <div className="sadmin-income-legend">
              <div className="sadmin-income-item">
                <span className="sadmin-income-indicator sadmin-income-positive"></span>
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">This Year Income</div>
                  <div className="sadmin-income-value">₹{(stats?.income?.thisYear || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <span className="sadmin-income-indicator sadmin-income-negative"></span>
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Expenses</div>
                  <div className="sadmin-income-value">₹{(stats?.income?.thisYearExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Last Year Income</div>
                  <div className="sadmin-income-value">₹{(stats?.income?.lastYear || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Last Year Expenses</div>
                  <div className="sadmin-income-value">₹{(stats?.income?.lastYearExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Reminders */}
          <div className="sadmin-widget sadmin-reminders-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">Reminder Today</h3>
            </div>
            <div className="sadmin-reminders-empty">
              <div className="sadmin-reminders-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="sadmin-reminders-text">Next reminder</div>
              <div className="sadmin-reminders-subtext">No reminder</div>
            </div>
          </div>

          {/* System Tasks Overview */}
          <div className="sadmin-widget sadmin-tasks-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">System Tasks</h3>
            </div>
            <div className="sadmin-tasks-donut">
              <svg viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="80" fill="none" stroke="#E5E7EB" strokeWidth="30" />
                <circle 
                  cx="100" 
                  cy="100" 
                  r="80" 
                  fill="none" 
                  stroke="#F59E0B" 
                  strokeWidth="30"
                  strokeDasharray="502.65"
                  strokeDashoffset={502.65 - (502.65 * ((stats?.tasks?.todo || 0) / ((stats?.tasks?.total || 0) || 1)))}
                  transform="rotate(-90 100 100)"
                />
                <circle 
                  cx="100" 
                  cy="100" 
                  r="80" 
                  fill="none" 
                  stroke="#3B82F6" 
                  strokeWidth="30"
                  strokeDasharray="502.65"
                  strokeDashoffset={502.65 - (502.65 * ((stats?.tasks?.inProgress || 0) / ((stats?.tasks?.total || 0) || 1)))}
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>
            <div className="sadmin-tasks-legend">
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-todo"></span>
                <span className="sadmin-task-label">Setup Needed</span>
                <span className="sadmin-task-count">{stats?.tasks?.todo || 0}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-progress"></span>
                <span className="sadmin-task-label">In progress</span>
                <span className="sadmin-task-count">{stats?.tasks?.inProgress || 0}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-review"></span>
                <span className="sadmin-task-label">Review</span>
                <span className="sadmin-task-count">{stats?.tasks?.review || 0}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-done"></span>
                <span className="sadmin-task-label">Completed</span>
                <span className="sadmin-task-count">{stats?.tasks?.done || 0}</span>
              </div>
            </div>
          </div>

          {/* Theater Users Overview */}
          <div className="sadmin-widget sadmin-team-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">Theater Users</h3>
            </div>
            <div className="sadmin-team-stats">
              <div className="sadmin-team-stat">
                <div className="sadmin-team-number">{stats?.team?.totalMembers || 0}</div>
                <div className="sadmin-team-label">Total Users</div>
              </div>
              <div className="sadmin-team-stat sadmin-team-separator"></div>
              <div className="sadmin-team-stat">
                <div className="sadmin-team-number">{stats?.team?.membersOnLeave || 0}</div>
                <div className="sadmin-team-label">Inactive</div>
              </div>
            </div>
            <div className="sadmin-team-attendance">
              <div className="sadmin-attendance-item">
                <div className="sadmin-attendance-icon sadmin-attendance-in">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="sadmin-attendance-info">
                  <div className="sadmin-attendance-number">{stats?.team?.activeMembers || 0}</div>
                  <div className="sadmin-attendance-label">Active Users</div>
                </div>
              </div>
              <div className="sadmin-attendance-item">
                <div className="sadmin-attendance-icon sadmin-attendance-out">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="sadmin-attendance-info">
                  <div className="sadmin-attendance-number">{stats?.team?.inactiveMembers || 0}</div>
                  <div className="sadmin-attendance-label">Inactive Users</div>
                </div>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="sadmin-widget sadmin-ticket-widget">
            <div className="sadmin-widget-header">
              <div className="sadmin-widget-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <h3 className="sadmin-widget-title">System Status</h3>
            </div>
            <div className="sadmin-ticket-list">
              <div className="sadmin-ticket-row">
                <div className="sadmin-ticket-status">
                  <span className="sadmin-ticket-indicator sadmin-ticket-new"></span>
                  <span className="sadmin-ticket-name">QR Codes</span>
                  <span className="sadmin-ticket-count">{stats?.system?.totalQRCodes || 0}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">Active</span>
                  <span className="sadmin-ticket-badge">{stats?.system?.qrCodeStats?.active || 0}</span>
                </div>
              </div>
              <div className="sadmin-ticket-row">
                <div className="sadmin-ticket-status">
                  <span className="sadmin-ticket-indicator sadmin-ticket-open"></span>
                  <span className="sadmin-ticket-name">Products</span>
                  <span className="sadmin-ticket-count">{stats?.system?.totalProducts || 0}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">In Stock</span>
                  <span className="sadmin-ticket-badge">{stats?.system?.activeProducts || 0}</span>
                </div>
              </div>
              <div className="sadmin-ticket-row">
                <div className="sadmin-ticket-status">
                  <span className="sadmin-ticket-indicator sadmin-ticket-closed"></span>
                  <span className="sadmin-ticket-name">Roles</span>
                  <span className="sadmin-ticket-count">{stats?.system?.totalRoles || 0}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">Page Access</span>
                  <span className="sadmin-ticket-badge">{stats?.system?.totalPageAccess || 0}</span>
                </div>
              </div>
            </div>
            <div className="sadmin-ticket-footer">
              <span className="sadmin-ticket-footer-text">System components overview</span>
            </div>
          </div>
        </div>
      </div>
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default Dashboard;
