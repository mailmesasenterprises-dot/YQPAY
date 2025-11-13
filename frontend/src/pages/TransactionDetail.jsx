import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import Pagination from '../components/Pagination';
import DateFilter from '../components/DateFilter/DateFilter';
import PageContainer from '../components/PageContainer';
import VerticalPageHeader from '../components/VerticalPageHeader';
import { useToast } from '../contexts/ToastContext';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { optimizedFetch } from '../utils/apiOptimizer';
import config from '../config';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../styles/QRManagementPage.css';
import '../styles/TheaterList.css';
import '../styles/components/VerticalPageHeader.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



const TransactionDetail = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  // PERFORMANCE MONITORING
  usePerformanceMonitoring('TransactionDetail');
  
  // Data state
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theater, setTheater] = useState(null);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    posOrders: 0,
    kioskOrders: 0,
    onlineOrders: 0
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Filter state
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'pos', 'kiosk', 'online'
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'month',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    selectedDate: null,
    startDate: null,
    endDate: null
  });
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Refs
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch theater info
  const fetchTheater = useCallback(async (forceRefresh = false) => {
    if (!theaterId) return;
    
    try {
      // � FORCE REFRESH: Add cache-busting parameter when force refreshing
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TransactionDetail] FORCE REFRESHING theater data from server (bypassing ALL caches)');
      }

      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const data = await optimizedFetch(
        `${config.api.baseUrl}/theaters/${theaterId}${params.toString() ? '?' + params.toString() : ''}`,
        {
          headers
        },
        forceRefresh ? null : `theater_${theaterId}`,
        120000 // 2-minute cache
      );
      
      if (data && data.success && data.data) {
        setTheater(data.data);
      }
    } catch (error) {
      console.error('Error fetching theater info:', error);
    }
  }, [theaterId]);

  // Fetch all orders with filters (POS, KIOSK, ONLINE)
  const fetchOrders = useCallback(async (forceRefresh = false) => {
    if (!theaterId || !isMountedRef.current) return;

    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError('');

      // Build query parameters
      const params = new URLSearchParams({
        theaterId: theaterId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        _cacheBuster: Date.now()
      });

      // Add date filter params
      if (dateFilter.type === 'month' && dateFilter.month && dateFilter.year) {
        params.append('month', dateFilter.month.toString());
        params.append('year', dateFilter.year.toString());
      } else if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        params.append('date', dateFilter.selectedDate);
      } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
        params.append('startDate', dateFilter.startDate);
        params.append('endDate', dateFilter.endDate);
      }

      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }

      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TransactionDetail] FORCE REFRESHING transactions from server (bypassing ALL caches)');
      }

      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading (shorter TTL for orders)
      // 🔄 FORCE REFRESH: Skip cache by passing null as cacheKey when force refreshing
      const cacheKey = `orders_theater_${theaterId}_page_${currentPage}_limit_${itemsPerPage}_date_${JSON.stringify(dateFilter)}_search_${debouncedSearchTerm || 'none'}`;
      const data = await optimizedFetch(
        `${config.api.baseUrl}/orders/theater-nested?${params.toString()}`,
        {
          signal: abortControllerRef.current.signal,
          headers
        },
        forceRefresh ? null : cacheKey,
        60000 // 1-minute cache for orders (fresher data)
      );

      if (!data) {
        // No orders found - handle gracefully
        setOrders([]);
        setTotalItems(0);
        setTotalPages(0);
        setSummary({
          totalOrders: 0,
          totalRevenue: 0,
          posOrders: 0,
          kioskOrders: 0,
          onlineOrders: 0
        });
        setLoading(false);
        return;
      }

      if (!isMountedRef.current) return;

      if (data.success && data.data) {
        // Get all orders from API
        let allOrders = Array.isArray(data.data) ? data.data : [];
        
        // Apply source filter on frontend
        if (sourceFilter !== 'all') {
          allOrders = allOrders.filter(order => {
            const source = order.source?.toLowerCase() || '';
            if (sourceFilter === 'pos') {
              return source === 'pos';
            } else if (sourceFilter === 'kiosk') {
              return source === 'kiosk';
            } else if (sourceFilter === 'online') {
              return source === 'qr_code' || source === 'online';
            }
            return true;
          });
        }
        
        // Calculate summary statistics
        const posOrders = allOrders.filter(order => {
          const source = order.source?.toLowerCase() || '';
          return source === 'pos' || source === 'kiosk';
        });
        
        const onlineOrders = allOrders.filter(order => {
          const source = order.source?.toLowerCase() || '';
          return source === 'qr_code' || source === 'online';
        });

        const totalRevenue = allOrders.reduce((sum, order) => {
          return sum + (order.pricing?.total || order.totalAmount || order.total || 0);
        }, 0);

        setOrders(allOrders);
        setSummary({
          totalOrders: allOrders.length,
          totalRevenue: totalRevenue,
          posOrders: posOrders.length,
          kioskOrders: posOrders.length, // Kiosk and POS are grouped together
          onlineOrders: onlineOrders.length
        });

        // Set pagination if provided
        if (data.pagination) {
          setTotalItems(data.pagination.total || allOrders.length);
          setTotalPages(data.pagination.pages || 1);
          setCurrentPage(data.pagination.current || currentPage);
        } else {
          setTotalItems(allOrders.length);
          setTotalPages(Math.ceil(allOrders.length / itemsPerPage));
        }
      } else {
        setOrders([]);
        setTotalItems(0);
        setTotalPages(0);
        setSummary({
          totalOrders: 0,
          totalRevenue: 0,
          posOrders: 0,
          kioskOrders: 0,
          onlineOrders: 0
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        console.error('Error fetching orders:', error);
        setError('Failed to load transactions');
        setOrders([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, dateFilter, sourceFilter, currentPage, itemsPerPage, debouncedSearchTerm]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    isMountedRef.current = true;
    // 🔄 FORCE REFRESH: Always force refresh on mount to ensure fresh data
    fetchTheater(true);
    fetchOrders(true);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchTheater, fetchOrders]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get order type badge
  const getOrderTypeBadge = (order) => {
    const source = order.source?.toLowerCase() || '';
    if (source === 'pos' || source === 'kiosk') {
      return <span className="order-type-badge pos">POS/KIOSK</span>;
    } else if (source === 'qr_code' || source === 'online') {
      return <span className="order-type-badge online">ONLINE</span>;
    }
    return <span className="order-type-badge other">{source.toUpperCase() || 'OTHER'}</span>;
  };

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'status-badge active';
      case 'completed': return 'status-badge completed';
      case 'cancelled': return 'status-badge inactive';
      case 'pending': return 'status-badge pending';
      default: return 'status-badge';
    }
  };

  // Orders are already paginated from backend
  const paginatedOrders = orders;

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle search
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Get month name from date filter
  const monthName = dateFilter.type === 'month' 
    ? new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : dateFilter.type === 'date' && dateFilter.selectedDate
    ? new Date(dateFilter.selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'All Time';

  // Handle source filter change
  const handleSourceFilterChange = (e) => {
    setSourceFilter(e.target.value);
    setCurrentPage(1);
  };

  // Handle date filter apply
  const handleDateFilterApply = useCallback((newDateFilter) => {
    setDateFilter(newDateFilter);
    setCurrentPage(1);
  }, []);

  // Excel Download Handler
  const handleDownloadExcel = useCallback(async () => {
    if (!theaterId) {
      toast.error('Theater ID is missing');
      return;
    }
    
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again to download reports');
      return;
    }
    
    setDownloadingExcel(true);
    try {
      const params = new URLSearchParams();
      
      // Add date filter params
      if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        params.append('date', dateFilter.selectedDate);
      } else if (dateFilter.type === 'month' && dateFilter.month && dateFilter.year) {
        params.append('month', dateFilter.month);
        params.append('year', dateFilter.year);
      } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
        params.append('startDate', dateFilter.startDate);
        params.append('endDate', dateFilter.endDate);
      }
      
      // Add source filter if not 'all'
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'pos') {
          params.append('source', 'pos');
        } else if (sourceFilter === 'kiosk') {
          params.append('source', 'kiosk');
        } else if (sourceFilter === 'online') {
          params.append('source', 'qr_code');
        }
      }

      const apiUrl = `${config.api.baseUrl}/orders/excel/${theaterId}?${params.toString()}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        toast.error('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        const blob = await response.blob();
        if (blob.size === 0) {
          toast.error('No data available to export');
          return;
        }
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = dateFilter.type === 'date' && dateFilter.selectedDate 
          ? `_${dateFilter.selectedDate}` 
          : dateFilter.type === 'month' 
          ? `_${dateFilter.year}-${String(dateFilter.month).padStart(2, '0')}`
          : '';
        const sourceStr = sourceFilter !== 'all' ? `_${sourceFilter.toUpperCase()}` : '';
        a.download = `Transactions${sourceStr}${dateStr}_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Excel file downloaded successfully');
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          toast.error(errorData.error || `Failed to download Excel report (${response.status})`);
        } else {
          toast.error(`Failed to download Excel report (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Excel download error:', error);
      toast.error('Network error. Please check your connection and try again.');
    } finally {
      setDownloadingExcel(false);
    }
  }, [theaterId, dateFilter, sourceFilter, showError, toast]);

  // Header button for date filter
  const headerButton = (
    <button 
      className="header-btn"
      onClick={() => setShowDateFilterModal(true)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
        </svg>
      </span>
      {dateFilter.type === 'all' ? 'Date Filter' : 
       dateFilter.type === 'date' ? `Today (${new Date(dateFilter.selectedDate).toLocaleDateString('en-GB')})` :
       dateFilter.type === 'month' ? `${new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
       'Date Filter'}
    </button>
  );

  return (
    <ErrorBoundary>
      <AdminLayout 
        pageTitle={theater ? `${theater.name} - Transactions` : 'Transaction Detail'} 
        currentPage="transactions"
      >
        <div className="theater-list-container role-management-list-page qr-management-page">
          <PageContainer
            hasHeader={false}
            className="transaction-detail-vertical"
          >
            {/* Global Vertical Header Component */}
            <VerticalPageHeader
              title={theater ? `${theater.name} - Transactions` : 'Transaction Detail'}
              backButtonText="Back to Theater List"
              backButtonPath="/transactions"
              actionButton={headerButton}
            />

            {/* Statistics Section */}
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-number">{summary.totalOrders || 0}</div>
                <div className="stat-label">Total Orders</div>
                <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Current Month
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.posOrders || 0}</div>
                <div className="stat-label">POS/KIOSK Orders</div>
                <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Offline Orders
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.onlineOrders || 0}</div>
                <div className="stat-label">Online Orders</div>
                <div className="stat-sublabel" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  QR Code Orders
                </div>
              </div>
              <div className="stat-card" style={{ 
                background: '#F3E8FF',
                border: '3px solid #8B5CF6'
              }}>
                <div className="stat-number" style={{ color: '#8B5CF6' }}>
                  {formatCurrency(summary.totalRevenue)}
                </div>
                <div className="stat-label" style={{ color: '#8B5CF6' }}>Total Revenue</div>
                <div className="stat-sublabel" style={{ fontSize: '12px', color: '#8B5CF6', marginTop: '4px' }}>
                  Current Month
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="theater-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search by order number or customer..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>
              <div className="filter-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Source Filter Dropdown */}
                <select
                  value={sourceFilter}
                  onChange={handleSourceFilterChange}
                  className="status-filter"
                  style={{
                    padding: '8px 12px',
                    border: '2px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    background: 'white'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="pos">POS</option>
                  <option value="kiosk">KIOSK</option>
                  <option value="online">ONLINE</option>
                </select>

                {/* Excel Download Button */}
                <button 
                  className="submit-btn excel-download-btn"
                  onClick={handleDownloadExcel}
                  disabled={downloadingExcel || loading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: downloadingExcel ? '#9ca3af' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: downloadingExcel || loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: downloadingExcel || loading ? 0.6 : 1,
                    pointerEvents: downloadingExcel || loading ? 'none' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{downloadingExcel ? '⏳' : '📊'}</span>
                  {downloadingExcel ? 'Downloading...' : 'Excel'}
                </button>

                <div className="results-count">
                  Showing {paginatedOrders.length} of {totalItems} orders (Page {currentPage} of {totalPages})
                </div>
                <div className="items-per-page">
                  <label>Items per page:</label>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }} 
                    className="items-select"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            {loading ? (
              <div className="theater-table-container">
                <table className="theater-table">
                  <thead>
                    <tr>
                      <th>S.NO</th>
                      <th>ORDER NUMBER</th>
                      <th>DATE & TIME</th>
                      <th>ORDER TYPE</th>
                      <th>CUSTOMER</th>
                      <th>STATUS</th>
                      <th>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: itemsPerPage }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="skeleton-row">
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                        <td><div className="skeleton-line"></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: 'var(--text-gray)'}}>
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                  </svg>
                </div>
                <h3>No Transactions Found</h3>
                <p>No orders found for {monthName}.</p>
              </div>
            ) : (
              <div className="theater-table-container" style={{ overflowX: 'auto', width: '100%' }}>
                <table className="theater-table" style={{ width: '100%', tableLayout: 'auto' }}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '60px' }}>S.NO</th>
                      <th style={{ minWidth: '150px' }}>ORDER NUMBER</th>
                      <th style={{ minWidth: '180px' }}>DATE & TIME</th>
                      <th style={{ minWidth: '120px' }}>ORDER TYPE</th>
                      <th style={{ minWidth: '150px' }}>CUSTOMER</th>
                      <th style={{ minWidth: '120px' }}>STATUS</th>
                      <th style={{ minWidth: '120px' }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order, index) => (
                      <tr key={order._id || `order-${index}`} className="theater-row">
                        <td className="sno-cell">
                          <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                        </td>
                        <td className="name-cell">
                          <div style={{ fontWeight: '600', color: '#1F2937' }}>
                            {order.orderNumber || 'N/A'}
                          </div>
                        </td>
                        <td className="owner-cell">
                          {formatDate(order.createdAt || order.orderDate)}
                        </td>
                        <td className="contact-cell">
                          {getOrderTypeBadge(order)}
                        </td>
                        <td className="name-cell">
                          {order.customerName || order.customerInfo?.name || 'Walk-in Customer'}
                        </td>
                        <td className="actions-cell">
                          <span className={getStatusBadgeClass(order.status)}>
                            {order.status?.toUpperCase() || 'PENDING'}
                          </span>
                        </td>
                        <td className="name-cell" style={{ fontWeight: '600', color: '#059669' }}>
                          {formatCurrency(order.pricing?.total || order.totalAmount || order.total || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                itemType="transactions"
              />
            )}
          </PageContainer>
        </div>

        {/* Date Filter Modal */}
        {showDateFilterModal && (
          <DateFilter
            isOpen={showDateFilterModal}
            onClose={() => setShowDateFilterModal(false)}
            initialFilter={dateFilter}
            onApply={handleDateFilterApply}
          />
        )}

        {/* Custom CSS for order type badges */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .order-type-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .order-type-badge.pos {
              background: #FEF3C7;
              color: #92400E;
            }
            .order-type-badge.online {
              background: #DBEAFE;
              color: #1E40AF;
            }
            .order-type-badge.other {
              background: #F3F4F6;
              color: #374151;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
            }
            .status-badge.active {
              background: #D1FAE5;
              color: #065F46;
            }
            .status-badge.completed {
              background: #DBEAFE;
              color: #1E40AF;
            }
            .status-badge.inactive {
              background: #FEE2E2;
              color: #991B1B;
            }
            .status-badge.pending {
              background: #FEF3C7;
              color: #92400E;
            }
          `
        }} />
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default TransactionDetail;

