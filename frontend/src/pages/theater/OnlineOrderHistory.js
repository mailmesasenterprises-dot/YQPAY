import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import DateFilter from '../../components/DateFilter';
import Pagination from '../../components/Pagination';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import '../../styles/AddTheater.css';

const OnlineOrderHistory = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('OnlineOrderHistory');
  
  // Data state
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Store all orders for pagination
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    confirmedOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    type: 'all', // 'all', 'date', 'month'
    date: new Date().toISOString().split('T')[0],
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch orders from backend
  const fetchOrders = useCallback(async () => {
    if (!theaterId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Fetch only online orders (source=qr_code)
      const response = await fetch(
        `${config.api.baseUrl}/orders/theater/${theaterId}?source=qr_code`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        console.log('ℹ️ No online orders found for this theater (404)');
        setOrders([]);
        setAllOrders([]);
        setSummary({
          totalOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          totalRevenue: 0
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Online Orders API Response:', data);

      if (data.success && data.orders) {
        const onlineOrders = data.orders;
        console.log(`✅ Loaded ${onlineOrders.length} online orders`);
        
        setAllOrders(onlineOrders);
        setOrders(onlineOrders);

        // Calculate summary
        const summary = {
          totalOrders: onlineOrders.length,
          confirmedOrders: onlineOrders.filter(o => o.status === 'confirmed').length,
          completedOrders: onlineOrders.filter(o => o.status === 'completed').length,
          totalRevenue: onlineOrders.reduce((sum, o) => sum + (o.pricing?.total ?? o.totalAmount ?? 0), 0)
        };
        setSummary(summary);
        console.log('📊 Summary:', summary);
      } else {
        console.log('⚠️ API returned success but no orders found');
        setOrders([]);
        setAllOrders([]);
      }
    } catch (error) {
      console.error('❌ Error fetching online orders:', error);
      showError('Failed to load online orders: ' + error.message);
      setOrders([]);
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  }, [theaterId, showError]);

  // Load orders on mount
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Filter orders based on search, status, and date
  const filteredOrders = useMemo(() => {
    let filtered = [...allOrders];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search) ||
        order.customerInfo?.name?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter.type === 'date') {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
        return orderDate === dateFilter.date;
      });
    } else if (dateFilter.type === 'month') {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getMonth() + 1 === dateFilter.month && 
               orderDate.getFullYear() === dateFilter.year;
      });
    }

    return filtered;
  }, [allOrders, searchTerm, statusFilter, dateFilter]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Handlers
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'confirmed': return 'status-badge active';
      case 'completed': return 'status-badge completed';
      case 'cancelled': return 'status-badge inactive';
      case 'pending': return 'status-badge pending';
      default: return 'status-badge';
    }
  };

  // Table skeleton loader
  const TableRowSkeleton = () => (
    <tr className="skeleton-row">
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  );

  return (
    <ErrorBoundary>
      <style>
        {`
          .calendar-container { margin: 20px 0; }
          .calendar-header { text-align: center; margin-bottom: 15px; color: #8B5CF6; }
          .calendar-grid { max-width: 300px; margin: 0 auto; }
          .calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin-bottom: 10px; font-weight: bold; color: #666; text-align: center; }
          .calendar-weekdays > div { padding: 5px; }
          .calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
          .calendar-day { padding: 8px; text-align: center; border-radius: 4px; cursor: pointer; border: 1px solid #e0e0e0; background: #fff; }
          .calendar-day.empty { cursor: default; border: none; background: transparent; }
          .calendar-day.clickable:hover { background: #f3f0ff; border-color: #8B5CF6; }
          .calendar-day.selected { background: #8B5CF6; color: white; border-color: #8B5CF6; }
        `}
      </style>
      <TheaterLayout pageTitle="Online Orders" currentPage="online-orders">
        <PageContainer
          title="Online Orders"
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.totalOrders || 0}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.confirmedOrders || 0}</div>
            <div className="stat-label">Confirmed Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.completedOrders || 0}</div>
            <div className="stat-label">Completed Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{formatCurrency(summary.totalRevenue || 0)}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>

        {/* Enhanced Filters Section matching TheaterList */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search orders by order number or customer name..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select
              value={statusFilter}
              onChange={handleStatusFilter}
              className="status-filter"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button 
              className="submit-btn date-filter-btn"
              onClick={() => setShowDateFilterModal(true)}
            >
              <span className="btn-icon">📅</span>
              {dateFilter.type === 'all' ? 'Date Filter' : 
               dateFilter.type === 'date' ? `Today (${new Date().toLocaleDateString()})` :
               dateFilter.type === 'month' ? `${new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
               'Date Filter'}
            </button>
            <div className="items-per-page">
              <label>Items per page:</label>
              <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="items-select">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Management Table */}
        <div className="page-table-container">
          <table className="qr-management-table order-history-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Order Number</th>
                <th>Customer</th>
                <th>QR Name / Seat</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={order._id}>
                      <td className="serial-number">{serialNumber}</td>
                      <td className="order-number-cell">
                        <div className="order-info">
                          <div className="order-number">{order.orderNumber}</div>
                        </div>
                      </td>
                      <td className="customer-cell">
                        <div className="customer-info">
                          <div className="customer-name">{order.customerName || order.customerInfo?.name || 'N/A'}</div>
                          <div className="customer-phone">{order.customerPhone || order.customerInfo?.phone || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="qr-info-cell">
                        <div className="qr-info">
                          <div className="qr-name">{order.qrName || 'N/A'}</div>
                          <div className="seat-number">{order.seat || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="items-count">
                        {(order.products?.length || order.items?.length || 0)} items
                      </td>
                      <td className="amount-cell">
                        <div className="amount">{formatCurrency(order.pricing?.total ?? order.totalAmount ?? 0)}</div>
                      </td>
                      <td className="status-cell">
                        <span className={getStatusBadgeClass(order.status)}>
                          {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                        </span>
                      </td>
                      <td className="date-cell">
                        <div className="date-info">{formatDate(order.createdAt)}</div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="no-data" style={{ padding: '0', border: 'none' }}>
                    <div className="empty-state" style={{ 
                      margin: '20px auto',
                      maxWidth: '600px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '400px',
                      padding: '60px 40px',
                      textAlign: 'center'
                    }}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '64px', height: '64px', opacity: 0.3, marginBottom: '24px', color: '#8B5CF6'}}>
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                      </svg>
                      <h3 style={{ fontSize: '24px', marginBottom: '12px', color: '#1f2937' }}>No online orders found</h3>
                      <p style={{fontSize: '16px', color: '#6b7280', margin: '0'}}>
                        Online orders from QR code scans will appear here
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredOrders.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={filteredOrders.length}
            itemsPerPage={itemsPerPage}
          />
        )}

        {/* Date Filter Modal */}
        {showDateFilterModal && (
          <DateFilter
            dateFilter={dateFilter}
            onFilterChange={setDateFilter}
            onClose={() => setShowDateFilterModal(false)}
          />
        )}

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default OnlineOrderHistory;
