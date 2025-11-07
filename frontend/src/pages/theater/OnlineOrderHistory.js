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
import { clearCachePattern } from '../../utils/cacheUtils'; // 🚀 Clear cache for fresh data
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
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [theaterInfo, setTheaterInfo] = useState(null); // Theater information for receipts
  const [summary, setSummary] = useState({
    totalOrders: 0,
    confirmedOrders: 0,
    completedOrders: 0,
    totalRevenue: 0
  });

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch theater information for receipts
  const fetchTheaterInfo = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setTheaterInfo(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching theater info:', error);
    }
  }, [theaterId]);

  // Load theater info on mount
  useEffect(() => {
    fetchTheaterInfo();
  }, [fetchTheaterInfo]);

  // Fetch orders from backend
  const fetchOrders = useCallback(async () => {
    if (!theaterId) return;

    try {
      // 🚀 CLEAR CACHE: Force fresh fetch to get updated filtered data
      clearCachePattern(`/orders/theater/${theaterId}`);
      console.log('🧹 Cache cleared for theater orders');
      
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Fetch ALL orders first, then filter on frontend for online QR code orders only
      const response = await fetch(
        `${config.api.baseUrl}/orders/theater/${theaterId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {

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

      if (data.success && data.orders) {
        console.log('🔍 DEBUG: Raw data received:', data.orders);
        
        // Filter to show ONLY online QR code orders (source=qr_code)
        // EXCLUDE ALL kiosk POS orders (source=pos, source=kiosk, or any POS-related source)
        const onlineOrders = data.orders.filter(order => {
          const source = order.source?.toLowerCase() || '';
          const qrName = order.qrName?.toLowerCase() || '';
          const seatNumber = order.seatNumber?.toLowerCase() || '';
          const customerName = order.customerName?.toLowerCase() || '';
          
          // EXCLUDE if source is NOT qr_code
          if (source !== 'qr_code') {
            return false;
          }
          
          // ADDITIONAL CHECK: Even if source=qr_code, exclude if it looks like a kiosk order
          // Check for kiosk-related keywords in qrName, seatNumber, or customerName
          const kioskKeywords = ['kiosk', 'pos', 'counter', 'walk-in', 'walk in'];
          const hasKioskKeyword = kioskKeywords.some(keyword => 
            qrName.includes(keyword) || 
            seatNumber.includes(keyword) || 
            customerName.includes(keyword)
          );
          
          if (hasKioskKeyword) {
            console.log(`� EXCLUDED: Order ${order.orderNumber} has source=qr_code but contains kiosk keywords`);
            return false;
          }
          
          const isQRCode = true;
          
          // Log each order's source for debugging
          console.log(`📋 Order ${order.orderNumber}: source="${order.source}" (${typeof order.source}), isQRCode=${isQRCode}`);
          
          return isQRCode;
        });

        console.log('📊 Total orders fetched:', data.orders.length);
        console.log('📱 Online QR code orders:', onlineOrders.length);
        console.log('🖥️ Filtered out (non-QR):', data.orders.length - onlineOrders.length);
        
        // Log all unique source values to debug
        const uniqueSources = [...new Set(data.orders.map(o => o.source || 'undefined'))];
        console.log('📋 All source values in data:', uniqueSources);
        
        // Log which orders were kept
        console.log('✅ Orders kept:', onlineOrders.map(o => ({ orderNumber: o.orderNumber, source: o.source })));

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
  } else {

        setOrders([]);
        setAllOrders([]);
      }
    } catch (error) {

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
        return orderDate === dateFilter.selectedDate;
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

  // Excel Download Handler
  const handleDownloadExcel = useCallback(async () => {

    if (!theaterId) {

      showError('Theater ID is missing');
      return;
    }
    
    // Check if user is authenticated
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    if (!token) {

      showError('Please login again to download reports');
      return;
    }
    
    setDownloadingExcel(true);
    try {
      // Build query parameters based on current filters
      const params = new URLSearchParams();
      
      // Add source filter for online orders
      params.append('source', 'qr_code');
      
      // Add date filter params
      if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        params.append('date', dateFilter.selectedDate);
      } else if (dateFilter.type === 'month' && dateFilter.month && dateFilter.year) {
        params.append('month', dateFilter.month);
        params.append('year', dateFilter.year);
      }
      
      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
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

        showError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        // Download Excel file
        const blob = await response.blob();

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
        a.download = `Online_Orders${dateStr}_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
  } else {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();

          showError(errorData.error || `Failed to download Excel report (${response.status})`);
        } else {
          showError(`Failed to download Excel report (${response.status})`);
        }
      }
    } catch (error) {

      showError('Network error. Please check your connection and try again.');
    } finally {
      setDownloadingExcel(false);
    }
  }, [theaterId, statusFilter, dateFilter, showError]);

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

  // View order details
  const viewOrder = (order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  // Download order as PDF
  const downloadOrderPDF = (order) => {
    try {
      // Format theater address
      const formatTheaterAddress = () => {
        if (!theaterInfo || !theaterInfo.address) return 'N/A';
        const addr = theaterInfo.address;
        const parts = [
          addr.street,
          addr.city,
          addr.state,
          addr.zipCode,
          addr.country
        ].filter(Boolean);
        return parts.join(', ') || 'N/A';
      };

      // Create PDF content as HTML - Thermal Receipt Style
      const pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Bill - ${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              max-width: 300px; 
              margin: 0 auto; 
              padding: 10px;
              font-size: 12px;
              line-height: 1.4;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .business-info {
              font-size: 11px;
              line-height: 1.5;
            }
            .bill-details {
              border-bottom: 1px dashed #000;
              padding: 8px 0;
              margin-bottom: 8px;
            }
            .bill-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
              font-size: 11px;
            }
            .bill-row strong {
              font-weight: bold;
            }
            .items-header {
              display: flex;
              justify-content: space-between;
              font-weight: bold;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
              margin-bottom: 5px;
            }
            .item-name { flex: 2; }
            .item-qty { flex: 0.5; text-align: center; }
            .item-rate { flex: 1; text-align: right; }
            .item-total { flex: 1; text-align: right; }
            .item-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 11px;
            }
            .totals-section {
              border-top: 1px dashed #000;
              padding-top: 8px;
              margin-top: 8px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 12px;
            }
            .total-row.grand-total {
              font-weight: bold;
              font-size: 14px;
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <!-- Business Header -->
          <div class="receipt-header">
            <div class="business-name">${theaterInfo?.name || 'Theater Name'}</div>
            <div class="business-info">
              ${theaterInfo?.address ? formatTheaterAddress() : 'Address'}<br>
              ${theaterInfo?.phone ? 'Phone: ' + theaterInfo.phone : ''}<br>
              ${theaterInfo?.email ? 'Email: ' + theaterInfo.email : ''}<br>
              ${theaterInfo?.gstNumber ? 'GST: ' + theaterInfo.gstNumber : ''}
            </div>
          </div>

          <!-- Bill Details -->
          <div class="bill-details">
            <div class="bill-row">
              <span><strong>Invoice ID:</strong> ${order.orderNumber || 'N/A'}</span>
            </div>
            <div class="bill-row">
              <span><strong>Date:</strong> ${formatDate(order.createdAt)}</span>
            </div>
            <div class="bill-row">
              <span><strong>Bill To:</strong> ${order.customerName || order.customerInfo?.name || 'Customer'}</span>
            </div>
            <div class="bill-row">
              <span><strong>QR/Seat:</strong> ${order.qrName || order.seat || 'N/A'}</span>
            </div>
          </div>

          <!-- Items Header -->
          <div class="items-header">
            <div class="item-name">Item Name</div>
            <div class="item-qty">Qty</div>
            <div class="item-rate">Rate</div>
            <div class="item-total">Total</div>
          </div>

          <!-- Items List -->
          ${(order.products || order.items || []).map(item => {
            const qty = item.quantity || 1;
            const rate = item.unitPrice || item.price || 0;
            const total = item.totalPrice || (qty * rate);
            return `
            <div class="item-row">
              <div class="item-name">${item.productName || item.menuItem?.name || item.name || 'Item'}</div>
              <div class="item-qty">${qty}</div>
              <div class="item-rate">${rate.toFixed(2)}</div>
              <div class="item-total">${total.toFixed(2)}</div>
            </div>
            `;
          }).join('')}

          <!-- Totals Section -->
          <div class="totals-section">
            ${order.pricing?.subtotal || order.subtotal ? `
            <div class="total-row">
              <span>Subtotal:</span>
              <span>₹${(order.pricing?.subtotal || order.subtotal).toFixed(2)}</span>
            </div>
            ` : ''}
            
            ${(order.pricing?.tax || order.tax || order.pricing?.gst || order.gst) ? `
            <div class="total-row">
              <span>GST/Tax:</span>
              <span>₹${(order.pricing?.tax || order.tax || order.pricing?.gst || order.gst).toFixed(2)}</span>
            </div>
            ` : ''}
            
            ${(order.pricing?.discount || order.discount) ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-₹${(order.pricing?.discount || order.discount).toFixed(2)}</span>
            </div>
            ` : ''}
            
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${(order.pricing?.total || order.totalAmount || order.total || 0).toFixed(2)}</span>
            </div>
          </div>

          <!-- Footer -->
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
      console.error('PDF generation error:', error);
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
          title="📱 Online Order History (QR Code Orders Only)"
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
                <th>QR Name / Seat</th>
                <th>Items</th>
                <th>Amount</th>
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
                      <td className="action-cell">
                        <div className="action-buttons" style={{ gap: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <button 
                            className="action-btn view-btn"
                            onClick={() => viewOrder(order)}
                            title="View Details"
                            style={{ margin: '0' }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn download-btn"
                            onClick={() => downloadOrderPDF(order)}
                            title="Download PDF"
                            style={{ margin: '0' }}
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

        {/* View Modal - Thermal Receipt Style */}
        {showViewModal && selectedOrder && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
              maxWidth: '400px',
              fontFamily: "'Courier New', monospace",
              backgroundColor: '#fff',
              padding: '0'
            }}>
              <div className="modal-header" style={{
                background: '#8B5CF6',
                color: 'white',
                padding: '15px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '8px 8px 0 0'
              }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Bill - {selectedOrder.orderNumber}</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowViewModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body" style={{
                padding: '20px',
                fontSize: '13px',
                lineHeight: '1.5'
              }}>
                {/* Business Header */}
                <div style={{
                  textAlign: 'center',
                  borderBottom: '2px dashed #000',
                  paddingBottom: '15px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: '#8B5CF6'
                  }}>{theaterInfo?.name || 'Theater Name'}</div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.6' }}>
                    {theaterInfo?.address ? (() => {
                      const addr = theaterInfo.address;
                      const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
                      return parts.join(', ') || 'Address';
                    })() : 'Address'}<br/>
                    {theaterInfo?.phone ? `Phone: ${theaterInfo.phone}` : ''}<br/>
                    {theaterInfo?.email ? `Email: ${theaterInfo.email}` : ''}<br/>
                    {theaterInfo?.gstNumber ? `GST: ${theaterInfo.gstNumber}` : ''}
                  </div>
                </div>

                {/* Bill Details */}
                <div style={{
                  borderBottom: '2px dashed #000',
                  paddingBottom: '12px',
                  marginBottom: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>Invoice ID:</span>
                    <span>{selectedOrder.orderNumber || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>Date:</span>
                    <span>{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>Bill To:</span>
                    <span>{selectedOrder.customerName || selectedOrder.customerInfo?.name || 'Customer'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold' }}>QR/Seat:</span>
                    <span>{selectedOrder.qrName || selectedOrder.seat || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold' }}>Payment:</span>
                    <span>{selectedOrder.payment?.method ? selectedOrder.payment.method.toUpperCase() : 'N/A'}</span>
                  </div>
                </div>

                {/* Items Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.7fr 1fr 1fr',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #000',
                  paddingBottom: '8px',
                  marginBottom: '8px',
                  fontSize: '12px'
                }}>
                  <div>Item Name</div>
                  <div style={{ textAlign: 'center' }}>Qty</div>
                  <div style={{ textAlign: 'right' }}>Rate</div>
                  <div style={{ textAlign: 'right' }}>Total</div>
                </div>

                {/* Items List */}
                {(selectedOrder.products || selectedOrder.items || []).map((item, index) => {
                  const qty = item.quantity || 1;
                  const rate = item.unitPrice || item.price || 0;
                  const total = item.totalPrice || (qty * rate);
                  return (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 0.7fr 1fr 1fr',
                      marginBottom: '6px',
                      fontSize: '12px'
                    }}>
                      <div style={{ wordBreak: 'break-word' }}>{item.productName || item.menuItem?.name || item.name || 'Item'}</div>
                      <div style={{ textAlign: 'center' }}>{qty}</div>
                      <div style={{ textAlign: 'right' }}>₹{rate.toFixed(2)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{total.toFixed(2)}</div>
                    </div>
                  );
                })}

                {/* Totals Section */}
                <div style={{
                  borderTop: '2px dashed #000',
                  paddingTop: '12px',
                  marginTop: '12px'
                }}>
                  {(selectedOrder.pricing?.subtotal || selectedOrder.subtotal) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Subtotal:</span>
                      <span>₹{(selectedOrder.pricing?.subtotal || selectedOrder.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {(selectedOrder.pricing?.tax || selectedOrder.tax || selectedOrder.pricing?.gst || selectedOrder.gst) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>GST/Tax:</span>
                      <span>₹{(selectedOrder.pricing?.tax || selectedOrder.tax || selectedOrder.pricing?.gst || selectedOrder.gst).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {(selectedOrder.pricing?.discount || selectedOrder.discount) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span>Discount:</span>
                      <span>-₹{(selectedOrder.pricing?.discount || selectedOrder.discount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    borderTop: '2px solid #000',
                    paddingTop: '8px',
                    marginTop: '8px',
                    color: '#8B5CF6'
                  }}>
                    <span>Grand Total:</span>
                    <span>₹{(selectedOrder.pricing?.total || selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  textAlign: 'center',
                  marginTop: '15px',
                  paddingTop: '15px',
                  borderTop: '2px dashed #000',
                  fontSize: '11px',
                  color: '#666'
                }}>
                  <p style={{ margin: '5px 0', fontWeight: 'bold' }}>Thank you for your order!</p>
                  <p style={{ margin: '5px 0' }}>Generated on {new Date().toLocaleString('en-IN')}</p>
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
          onApply={(newDateFilter) => setDateFilter(newDateFilter)}
        />

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default OnlineOrderHistory;
