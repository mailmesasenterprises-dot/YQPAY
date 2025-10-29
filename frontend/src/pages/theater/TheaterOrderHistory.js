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

const TheaterOrderHistory = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterOrderHistory');
  
  // Data state
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]); // Store all orders for pagination
  const [loading, setLoading] = useState(true);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    confirmedOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Date filtering state - Default to current date
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    type: 'date', // Default to current date instead of 'all'
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    selectedDate: (() => {
      // Fix: Use local date formatting to avoid timezone issues
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(), // Today's date in YYYY-MM-DD format
    startDate: null,
    endDate: null
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal states  
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Refs for cleanup and performance
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Ensure mounted ref is set on component mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
      // Removed error modal - access denied logged to console only
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load orders data
  const loadOrdersData = useCallback(async (page = 1, limit = 10, search = '', status = 'all', dateFilterParam = null) => {
    const currentDateFilter = dateFilterParam || dateFilter;
    
    if (!isMountedRef.current || !theaterId) {
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        theaterId: theaterId, // Add theater ID to the request
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      // Add search parameter if provided
      if (search.trim()) {
        params.append('search', search.trim());
      }

      // Add status filter if not 'all'
      if (status !== 'all') {
        params.append('status', status);
      }

      // Add date filter parameters
      if (currentDateFilter.type === 'month') {
        params.append('month', currentDateFilter.month);
        params.append('year', currentDateFilter.year);
      } else if (currentDateFilter.type === 'date') {
        params.append('date', currentDateFilter.selectedDate);
      }

      const baseUrl = `${config.api.baseUrl}/orders/theater-nested?${params.toString()}`;
      
      console.log('🎬 Fetching theater orders from:', baseUrl);
      
      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log('📊 Order History API Response:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ API Error:', errorText);
        
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 404) {
          // 404 means no orders found - handle gracefully without error
          console.log('ℹ️ No orders found for this theater (404)');
          if (!isMountedRef.current) return;
          setAllOrders([]);
          setOrders([]);
          setTotalItems(0);
          setTotalPages(0);
          setCurrentPage(1);
          setSummary({ totalOrders: 0, confirmedOrders: 0, completedOrders: 0, totalRevenue: 0 });
          setLoading(false);
          return; // Exit early without throwing error
        } else {
          throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('📦 Order History Data:', data);
      
      
      if (!isMountedRef.current) return;

      if (data.success) {
        // Handle the new simplified response format
        const ordersData = data.data || [];
        const summaryData = data.summary || {
          totalOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          totalRevenue: 0
        };
        
        console.log('📊 Orders data processed:', {
          ordersCount: ordersData.length,
          summary: summaryData,
          pagination: data.pagination
        });
        
        // Store all orders
        setAllOrders(ordersData);
        
        // Set current page orders (already paginated from backend)
        setOrders(ordersData);
        
        // Update summary
        setSummary(summaryData);
        
        // Update pagination
        if (data.pagination) {
          setTotalItems(data.pagination.total);
          setTotalPages(data.pagination.pages);
          setCurrentPage(data.pagination.current);
        }
      } else {
        // Handle case where API returns success but no data
        console.log('⚠️ API returned success but no orders found');
        setAllOrders([]);
        setOrders([]);
        setTotalItems(0);
        setTotalPages(0);
        setCurrentPage(1);
        setSummary({ totalOrders: 0, confirmedOrders: 0, completedOrders: 0, totalRevenue: 0 });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        console.error('❌ Order History Error:', error);
        // Removed error modal - just show empty state
        setOrders([]);
        setAllOrders([]);
        setSummary({ totalOrders: 0, confirmedOrders: 0, completedOrders: 0, totalRevenue: 0 });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, showError, dateFilter]);

  // Debounced search functionality
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadOrdersData(1, itemsPerPage, query, statusFilter); // Reset to first page
    }, 500);
  }, [itemsPerPage, statusFilter, loadOrdersData]);

  // Search handler
  const handleSearch = useCallback((e) => {
    const query = e.target.value;
    setSearchTerm(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Status filter handler
  const handleStatusFilter = useCallback((e) => {
    const status = e.target.value;
    setStatusFilter(status);
    loadOrdersData(1, itemsPerPage, searchTerm, status);
  }, [itemsPerPage, searchTerm, loadOrdersData]);

  // Date filter handler
  const handleDateFilterApply = useCallback((newDateFilter) => {
    setDateFilter(newDateFilter);
    loadOrdersData(1, itemsPerPage, searchTerm, statusFilter, newDateFilter);
  }, [itemsPerPage, searchTerm, statusFilter, loadOrdersData]);

  // Excel Download Handler
  const handleDownloadExcel = useCallback(async () => {
    console.log('🔵 Excel download button clicked');
    console.log('🔵 Theater ID:', theaterId);
    
    if (!theaterId) {
      console.error('❌ No theater ID available');
      showError('Theater ID is missing');
      return;
    }
    
    // Check if user is authenticated - try both token keys
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    console.log('🔑 Token found:', !!token);
    
    if (!token) {
      console.error('❌ No authentication token found');
      showError('Please login again to download reports');
      return;
    }
    
    setDownloadingExcel(true);
    try {
      // Build query parameters based on current filters
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
      
      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const apiUrl = `${config.api.baseUrl}/orders/excel/${theaterId}?${params.toString()}`;
      console.log('📊 Downloading Excel from:', apiUrl);
      console.log('📊 Token exists:', !!token);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Response status:', response.status);

      if (response.status === 401 || response.status === 403) {
        console.error('❌ Authentication failed');
        showError('Session expired. Please login again.');
        // Optionally redirect to login
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        // Download Excel file
        const blob = await response.blob();
        console.log('📊 Blob size:', blob.size, 'bytes');
        
        if (blob.size === 0) {
          showError('No data available to export');
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
        a.download = `Theater_Orders${dateStr}_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('✅ Excel downloaded successfully');
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          console.error('❌ Error response:', errorData);
          showError(errorData.error || `Failed to download Excel report (${response.status})`);
        } else {
          showError(`Failed to download Excel report (${response.status})`);
        }
      }
    } catch (error) {
      console.error('❌ Error downloading Excel report:', error);
      showError('Network error. Please check your connection and try again.');
    } finally {
      setDownloadingExcel(false);
    }
  }, [theaterId, statusFilter, dateFilter, showError]);

  // Pagination handlers
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    
    // Recalculate pagination with new items per page
    const totalPages = Math.ceil(allOrders.length / newLimit);
    setTotalPages(totalPages);
    
    // Reset to page 1 and update displayed orders
    const startIndex = 0;
    const endIndex = newLimit;
    const paginatedOrders = allOrders.slice(startIndex, endIndex);
    setOrders(paginatedOrders);
    setCurrentPage(1);
  }, [allOrders]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      
      // Update displayed orders for new page
      const startIndex = (newPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const paginatedOrders = allOrders.slice(startIndex, endIndex);
      setOrders(paginatedOrders);
    }
  }, [totalPages, itemsPerPage, allOrders]);

  // View order details
  const viewOrder = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
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

  // Download order as PDF
  const downloadOrderPDF = (order) => {
    try {
      // Create PDF content as HTML
      const pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Order ${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #8B5CF6; padding-bottom: 20px; }
            .header h1 { color: #8B5CF6; margin: 0; font-size: 28px; }
            .header p { margin: 5px 0; color: #666; }
            .section { margin-bottom: 25px; }
            .section h2 { color: #8B5CF6; border-bottom: 1px solid #ddd; padding-bottom: 8px; font-size: 18px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .info-item { padding: 10px; background: #f8f9fa; border-radius: 6px; }
            .info-label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
            .info-value { font-size: 16px; color: #333; }
            .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .items-table th, .items-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .items-table th { background: #8B5CF6; color: white; font-weight: bold; }
            .items-table tr:nth-child(even) { background: #f8f9fa; }
            .total-section { margin-top: 25px; text-align: right; }
            .total-amount { font-size: 24px; font-weight: bold; color: #8B5CF6; }
            .status-badge { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            .status-confirmed { background: #d4edda; color: #155724; }
            .status-completed { background: #d1ecf1; color: #0c5460; }
            .status-pending { background: #fff3cd; color: #856404; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order Receipt</h1>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
          </div>

          <div class="section">
            <h2>Order Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Order Number</div>
                <div class="info-value">${order.orderNumber}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="status-badge status-${order.status}">
                    ${order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Payment Method</div>
                <div class="info-value">${order.paymentMethod || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Order Date</div>
                <div class="info-value">${formatDate(order.createdAt)}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Customer Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Customer Name</div>
                <div class="info-value">${order.customerName || order.customerInfo?.name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Phone Number</div>
                <div class="info-value">${order.customerPhone || order.customerInfo?.phone || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${order.customerEmail || order.customerInfo?.email || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Order Items</h2>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${(order.products || order.items) && (order.products || order.items).length > 0 ? 
                  (order.products || order.items).map(item => `
                    <tr>
                      <td>${item.productName || item.menuItem?.name || 'Unknown Item'}</td>
                      <td>${item.quantity}</td>
                      <td>${formatCurrency(item.unitPrice || item.price)}</td>
                      <td>${formatCurrency(item.totalPrice || (item.quantity * (item.unitPrice || item.price)))}</td>
                    </tr>
                  `).join('') : 
                  '<tr><td colspan="4">No items found</td></tr>'
                }
              </tbody>
            </table>
            
            <div class="total-section">
              <div class="total-amount">
                Total Amount: ${formatCurrency(order.totalAmount)}
              </div>
            </div>
          </div>

          ${order.notes ? `
            <div class="section">
              <h2>Order Notes</h2>
              <p style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 0;">${order.notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Thank you for your order!</p>
            <p>Generated on ${new Date().toLocaleString('en-IN')}</p>
          </div>
        </body>
        </html>
      `;

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.print();
        // Close window after printing (optional)
        setTimeout(() => {
          printWindow.close();
        }, 1000);
      };
      
    } catch (error) {
      // Removed error modal - PDF generation failure logged to console only
    }
  };

  // Initial load
  useEffect(() => {
    if (theaterId) {
      loadOrdersData(1, 10, '', 'all');
    }
  }, [theaterId, loadOrdersData]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Memoized skeleton component for loading states
  const TableRowSkeleton = useMemo(() => () => (
    <tr className="skeleton-row">
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  ), []);

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
      <TheaterLayout pageTitle="Order History" currentPage="order-history">
        <PageContainer
          title="Order History"
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
              type="button"
              className="submit-btn excel-download-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🟢 EXCEL BUTTON CLICKED!', { 
                  downloadingExcel, 
                  loading, 
                  theaterId,
                  disabled: downloadingExcel || loading 
                });
                handleDownloadExcel();
              }}
              disabled={downloadingExcel || loading}
              style={{
                backgroundColor: downloadingExcel ? '#9ca3af' : '#10b981',
                cursor: downloadingExcel || loading ? 'not-allowed' : 'pointer',
                opacity: downloadingExcel || loading ? 0.6 : 1,
                pointerEvents: downloadingExcel || loading ? 'none' : 'auto',
                minWidth: '100px',
                padding: '8px 16px',
                whiteSpace: 'nowrap'
              }}
            >
              <span className="btn-icon">{downloadingExcel ? '⏳' : '📊'}</span>
              {downloadingExcel ? 'Downloading...' : 'Excel'}
            </button>
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
                <th>Items</th>
                <th>Amount</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : orders.length > 0 ? (
                orders.map((order, index) => {
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
                      <td className="items-count">
                        {(order.products?.length || order.items?.length || 0)} items
                      </td>
                      <td className="amount-cell">
                        <div className="amount">{formatCurrency(order.pricing?.total ?? order.totalAmount ?? 0)}</div>
                      </td>
                      <td className="payment-mode-cell">
                        <div className="payment-mode">{order.payment?.method ? order.payment.method.charAt(0).toUpperCase() + order.payment.method.slice(1) : 'N/A'}</div>
                      </td>
                      <td className="status-cell">
                        <span className={getStatusBadgeClass(order.status)}>
                          {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                        </span>
                      </td>
                      <td className="date-cell">
                        <div className="order-date">{formatDate(order.orderDate || order.createdAt)}</div>
                      </td>
                      <td className="action-cell">
                        <div className="action-buttons">
                          <button 
                            className="action-btn view-btn"
                            onClick={() => viewOrder(order)}
                            title="View Details"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn download-btn"
                            onClick={() => downloadOrderPDF(order)}
                            title="Download PDF"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="no-data" style={{ padding: '0', border: 'none' }}>
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
                      <h3 style={{ fontSize: '24px', marginBottom: '12px', color: '#1f2937' }}>No orders found</h3>
                      <p style={{fontSize: '16px', color: '#6b7280', margin: '0'}}>
                        Orders will appear here once customers start placing them
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Professional Pagination - Always Show */}
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          itemType="orders"
        />

        {/* View Modal */}
        {showViewModal && selectedOrder && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Order Details</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowViewModal(false)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="order-details">
                  <div className="detail-section">
                    <h3>Order Information</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Order Number:</label>
                        <span>{selectedOrder.orderNumber}</span>
                      </div>
                      <div className="detail-item">
                        <label>Status:</label>
                        <span className={getStatusBadgeClass(selectedOrder.status)}>
                          {selectedOrder.status ? selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1) : 'Unknown'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <label>Date:</label>
                        <span>{formatDate(selectedOrder.createdAt)}</span>
                      </div>
                      <div className="detail-item">
                        <label>Payment Mode:</label>
                        <span>{selectedOrder.payment?.method ? selectedOrder.payment.method.charAt(0).toUpperCase() + selectedOrder.payment.method.slice(1) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Customer Information</h3>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <label>Name:</label>
                        <span>{selectedOrder.customerName || selectedOrder.customerInfo?.name || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Phone:</label>
                        <span>{selectedOrder.customerPhone || selectedOrder.customerInfo?.phone || 'N/A'}</span>
                      </div>
                      <div className="detail-item">
                        <label>Email:</label>
                        <span>{selectedOrder.customerEmail || selectedOrder.customerInfo?.email || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Order Items</h3>
                    <div className="items-list">
                      {(selectedOrder.products || selectedOrder.items) && (selectedOrder.products || selectedOrder.items).length > 0 ? (
                        (selectedOrder.products || selectedOrder.items).map((item, index) => (
                          <div key={index} className="item-row">
                            <div className="item-info">
                              <span className="item-name">
                                {item.productName || item.menuItem?.name || 'Unknown Item'}
                              </span>
                              <span className="item-details">
                                Qty: {item.quantity} × {formatCurrency(item.unitPrice || item.price)}
                              </span>
                            </div>
                            <div className="item-total">
                              {formatCurrency(item.totalPrice || (item.quantity * (item.unitPrice || item.price)))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>No items found</p>
                      )}
                    </div>
                    <div className="order-total">
                      <div className="total-row">
                        <strong>Total Amount: {formatCurrency(selectedOrder.pricing?.total ?? selectedOrder.totalAmount ?? 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="detail-section">
                      <h3>Order Notes</h3>
                      <p>{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter Modal */}
        <DateFilter 
          isOpen={showDateFilterModal}
          onClose={() => setShowDateFilterModal(false)}
          initialFilter={dateFilter}
          onApply={handleDateFilterApply}
        />

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterOrderHistory;