import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/AdminLayout';
import config from '../config';
import '../styles/SuperAdminDashboard.css';

const Dashboard = () => {

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {

    loadDashboardData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      

      if (!token) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const response = await fetch(`${config.api.baseUrl}/dashboard/super-admin-stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });


      if (!response.ok) {
        const errorData = await response.text();

        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }

      const result = await response.json();
      

      if (result.success) {
        setStats(result.data);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to load dashboard data');
      }
    } catch (err) {

      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {

    return (
      <AdminLayout pageTitle="Dashboard" currentPage="dashboard">
        <div className="sadmin-wrapper">
          <div className="sadmin-loading">
            <div className="sadmin-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
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
            <div className="sadmin-error-icon">⚠️</div>
            <h3>Error Loading Dashboard</h3>
            <p>{error}</p>
            <button onClick={loadDashboardData} className="sadmin-retry-btn">
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
            <button onClick={loadDashboardData} className="sadmin-retry-btn">
              Reload
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }


  return (
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
              <div className="sadmin-stat-value">{stats.summary.totalTheaters}</div>
              <div className="sadmin-stat-label">Total Theaters</div>
              <div className="sadmin-stat-sublabel">{stats.summary.activeTheaters} active</div>
            </div>
          </div>

          <div className="sadmin-stat-card sadmin-card-tasks">
            <div className="sadmin-stat-icon sadmin-icon-tasks">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="sadmin-stat-content">
              <div className="sadmin-stat-value">{stats.summary.totalOrders}</div>
              <div className="sadmin-stat-label">Total Orders</div>
              <div className="sadmin-stat-sublabel">{stats.summary.todayOrders} today</div>
            </div>
          </div>

          <div className="sadmin-stat-card sadmin-card-events">
            <div className="sadmin-stat-icon sadmin-icon-events">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="sadmin-stat-content">
              <div className="sadmin-stat-value">₹{(stats.summary.monthlyRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
              <div className="sadmin-stat-value">{stats.summary.pendingOrders}</div>
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
                <div className="sadmin-project-number">{stats.projects.open}</div>
                <div className="sadmin-project-label">Active</div>
              </div>
              <div className="sadmin-project-stat">
                <div className="sadmin-project-number">{stats.projects.completed}</div>
                <div className="sadmin-project-label">Setup Complete</div>
              </div>
              <div className="sadmin-project-stat">
                <div className="sadmin-project-number">{stats.projects.hold}</div>
                <div className="sadmin-project-label">Inactive</div>
              </div>
            </div>
            <div className="sadmin-progress-bar">
              <div className="sadmin-progress-fill" style={{ width: `${stats.projects.progression}%` }}></div>
              <div className="sadmin-progress-label">Active Rate {stats.projects.progression}%</div>
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
                <span className="sadmin-invoice-count">{stats.invoices.overdue}</span>
                <span className="sadmin-invoice-amount">₹{(stats.invoices.overdue * 100).toFixed(2)}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-notpaid"></span>
                <span className="sadmin-invoice-label">Pending</span>
                <span className="sadmin-invoice-count">{stats.invoices.notPaid}</span>
                <span className="sadmin-invoice-amount">₹{(stats.invoices.notPaid * 150).toFixed(2)}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-partial"></span>
                <span className="sadmin-invoice-label">In Progress</span>
                <span className="sadmin-invoice-count">{stats.invoices.partiallyPaid}</span>
                <span className="sadmin-invoice-amount">₹{(stats.invoices.partiallyPaid * 200).toFixed(2)}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-paid"></span>
                <span className="sadmin-invoice-label">Completed</span>
                <span className="sadmin-invoice-count">{stats.invoices.fullyPaid}</span>
                <span className="sadmin-invoice-amount">₹{stats.invoices.totalInvoiced.toFixed(2)}</span>
              </div>
              <div className="sadmin-invoice-item">
                <span className="sadmin-invoice-dot sadmin-dot-draft"></span>
                <span className="sadmin-invoice-label">Cancelled</span>
                <span className="sadmin-invoice-count">{stats.invoices.draft}</span>
                <span className="sadmin-invoice-amount">₹{(stats.invoices.draft * 50).toFixed(2)}</span>
              </div>
            </div>
            <div className="sadmin-invoice-totals">
              <div className="sadmin-invoice-total-item">
                <span className="sadmin-invoice-total-label">Total Revenue</span>
                <span className="sadmin-invoice-total-amount">₹{stats.invoices.totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="sadmin-invoice-total-item sadmin-last-months">
                <span className="sadmin-invoice-total-label">Yearly Revenue</span>
                <span className="sadmin-invoice-total-amount">₹{stats.invoices.last12Months.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
                  <div className="sadmin-income-value">₹{stats.income.thisYear.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <span className="sadmin-income-indicator sadmin-income-negative"></span>
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Expenses</div>
                  <div className="sadmin-income-value">₹{stats.income.thisYearExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Last Year Income</div>
                  <div className="sadmin-income-value">₹{stats.income.lastYear.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="sadmin-income-item">
                <div className="sadmin-income-details">
                  <div className="sadmin-income-label">Last Year Expenses</div>
                  <div className="sadmin-income-value">₹{stats.income.lastYearExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
                  strokeDashoffset={502.65 - (502.65 * (stats.tasks.todo / (stats.tasks.total || 1)))}
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
                  strokeDashoffset={502.65 - (502.65 * (stats.tasks.inProgress / (stats.tasks.total || 1)))}
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>
            <div className="sadmin-tasks-legend">
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-todo"></span>
                <span className="sadmin-task-label">Setup Needed</span>
                <span className="sadmin-task-count">{stats.tasks.todo}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-progress"></span>
                <span className="sadmin-task-label">In progress</span>
                <span className="sadmin-task-count">{stats.tasks.inProgress}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-review"></span>
                <span className="sadmin-task-label">Review</span>
                <span className="sadmin-task-count">{stats.tasks.review}</span>
              </div>
              <div className="sadmin-task-item">
                <span className="sadmin-task-dot sadmin-task-done"></span>
                <span className="sadmin-task-label">Completed</span>
                <span className="sadmin-task-count">{stats.tasks.done}</span>
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
                <div className="sadmin-team-number">{stats.team.totalMembers}</div>
                <div className="sadmin-team-label">Total Users</div>
              </div>
              <div className="sadmin-team-stat sadmin-team-separator"></div>
              <div className="sadmin-team-stat">
                <div className="sadmin-team-number">{stats.team.membersOnLeave}</div>
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
                  <div className="sadmin-attendance-number">{stats.team.activeMembers}</div>
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
                  <div className="sadmin-attendance-number">{stats.team.inactiveMembers}</div>
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
                  <span className="sadmin-ticket-count">{stats.system.totalQRCodes}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">Active</span>
                  <span className="sadmin-ticket-badge">{stats.system.qrCodeStats.active}</span>
                </div>
              </div>
              <div className="sadmin-ticket-row">
                <div className="sadmin-ticket-status">
                  <span className="sadmin-ticket-indicator sadmin-ticket-open"></span>
                  <span className="sadmin-ticket-name">Products</span>
                  <span className="sadmin-ticket-count">{stats.system.totalProducts}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">In Stock</span>
                  <span className="sadmin-ticket-badge">{stats.system.activeProducts}</span>
                </div>
              </div>
              <div className="sadmin-ticket-row">
                <div className="sadmin-ticket-status">
                  <span className="sadmin-ticket-indicator sadmin-ticket-closed"></span>
                  <span className="sadmin-ticket-name">Roles</span>
                  <span className="sadmin-ticket-count">{stats.system.totalRoles}</span>
                </div>
                <div className="sadmin-ticket-tags">
                  <span className="sadmin-ticket-tag">Page Access</span>
                  <span className="sadmin-ticket-badge">{stats.system.totalPageAccess}</span>
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
  );
};

export default Dashboard;
