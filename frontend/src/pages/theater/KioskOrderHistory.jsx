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
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import '../../styles/AddTheater.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



const KioskOrderHistory = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('KioskOrderHistory');
  
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

  // Abort controller ref for cleanup
  const abortControllerRef = useRef(null);

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
  const fetchOrders = useCallback(async (forceRefresh = false) => {
    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // 🚀 CLEAR CACHE: Force fresh fetch to get updated filtered data
      if (forceRefresh) {
        clearCachePattern(`/orders/theater/${theaterId}`);
        console.log('🔄 [KioskOrderHistory] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      setLoading(true);

      // Build URL with optional cache-busting parameter
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
      }
      const queryString = params.toString();
      const url = `${config.api.baseUrl}/orders/theater/${theaterId}${queryString ? `?${queryString}` : ''}`;

      // Fetch ALL orders first, then filter on frontend for kiosk orders only
      const response = await fetch(url, {
        signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(localStorage.getItem('authToken') && {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }),
          ...(forceRefresh && {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          })
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No orders found - this is OK
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Handle multiple possible response structures
      const ordersArray = Array.isArray(data.orders)
        ? data.orders
        : (Array.isArray(data.data) ? data.data : (Array.isArray(data.data?.orders) ? data.data.orders : []));

      if (data.success && ordersArray.length >= 0) {
        console.log('🔍 DEBUG: Raw data received for kiosk orders:', ordersArray);
        
        // Filter to show ONLY kiosk orders (source="kiosk")
        // EXCLUDE POS orders (source="pos") and QR code orders (source="qr_code")
        const kioskOrders = ordersArray.filter(order => {
          const source = order.source?.toLowerCase() || '';
          const qrName = order.qrName?.toLowerCase() || '';
          const seatNumber = order.seatNumber?.toLowerCase() || '';
          const customerName = order.customerName?.toLowerCase() || '';
          
          // PRIMARY CHECK: Include if source is "kiosk" OR "pos" (both are offline orders)
          if (source === 'kiosk' || source === 'pos') {
            console.log(`✅ INCLUDED: Order ${order.orderNumber} has source=kiosk`);
            return true;
          }
          
          // SECONDARY CHECK: If source is qr_code or pos, check for kiosk keywords
          // (catches misclassified kiosk orders)
          const kioskKeywords = ['kiosk'];
          const hasKioskKeyword = kioskKeywords.some(keyword => 
            qrName.includes(keyword) || 
            seatNumber.includes(keyword) || 
            customerName.includes(keyword)
          );
          
          if (hasKioskKeyword && source !== 'qr_code') {
            console.log(`✅ INCLUDED: Order ${order.orderNumber} has source=${source} but contains kiosk keywords`);
            return true;
          }
          
          // Exclude everything else (pos, qr_code, undefined, etc.)
          console.log(`� EXCLUDED: Order ${order.orderNumber} has source=${source}, not a kiosk order`);
          return false;
        });

        console.log('📊 Total orders fetched:', ordersArray.length);
        console.log('🖥️ Kiosk orders only:', kioskOrders.length);
        console.log('📱 Filtered out (non-kiosk):', ordersArray.length - kioskOrders.length);
        
        // Log all unique source values to debug
        const uniqueSources = [...new Set(ordersArray.map(o => o.source || 'undefined'))];
        console.log('📋 All source values in data:', uniqueSources);

        setAllOrders(kioskOrders);
        setOrders(kioskOrders);

        // Calculate summary statistics
        setSummary({
          totalOrders: kioskOrders.length,
          confirmedOrders: kioskOrders.filter(o => o.status === 'confirmed').length,
          completedOrders: kioskOrders.filter(o => o.status === 'completed').length,
          totalRevenue: kioskOrders.reduce((sum, o) => sum + (o.pricing?.total ?? o.totalAmount ?? 0), 0)
        });
        setLoading(false);
      } else {
        // Handle API error response or empty data
        console.warn('API returned success=false or no orders:', data.message || data.error);
        setOrders([]);
        setAllOrders([]);
        setSummary({
          totalOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          totalRevenue: 0
        });
        setLoading(false);
      }

    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching kiosk orders:', error);
      showError('Failed to load kiosk orders: ' + error.message);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [theaterId, showError]);

  // Load orders on component mount
  useEffect(() => {
    if (!theaterId) return;
    fetchOrders(true);
  }, [fetchOrders]);

  // Format currency helper
  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  }, []);

  // Format date helper
  const formatDateTime = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  }, []);

  // Get status badge class
  const getStatusBadgeClass = useCallback((status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'confirmed':
        return 'status-confirmed';
      case 'pending':
        return 'status-pending';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-pending';
    }
  }, []);

  // View order details
  const viewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  }, []);

  // Download order as PDF
  const downloadOrderPDF = useCallback((order) => {
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
              <span><strong>Date:</strong> ${formatDateTime(order.createdAt)}</span>
            </div>
            <div class="bill-row">
              <span><strong>Bill To:</strong> ${order.customerName || order.customerInfo?.name || 'Kiosk Customer'}</span>
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
  }, [theaterInfo, formatDateTime]);

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(allOrders)) return [];

    return allOrders.filter(order => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerPhone?.includes(searchTerm);

      // Status filter
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      // Date filter
      let matchesDate = true;
      if (dateFilter.type === 'date') {
        const orderDate = new Date(order.createdAt);
        const year = orderDate.getFullYear();
        const month = String(orderDate.getMonth() + 1).padStart(2, '0');
        const day = String(orderDate.getDate()).padStart(2, '0');
        const localDateString = `${year}-${month}-${day}`;
        matchesDate = localDateString === dateFilter.selectedDate;
      } else if (dateFilter.type === 'month') {
        const orderDate = new Date(order.createdAt);
        matchesDate = orderDate.getMonth() + 1 === dateFilter.month && 
                     orderDate.getFullYear() === dateFilter.year;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [allOrders, searchTerm, statusFilter, dateFilter]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Page change handler
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Download Excel functionality
  const handleDownloadExcel = useCallback(async () => {
    try {
      setDownloadingExcel(true);

      // Build query parameters
      const params = new URLSearchParams();
      
      // Add source filter for BOTH POS and Kiosk orders (comma-separated)
      params.append('source', 'pos,kiosk');

      console.log('📊 Excel Download - Date Filter:', dateFilter);
      console.log('📊 Excel Download - Status Filter:', statusFilter);
      console.log('📊 Excel Download - Source Filter: pos,kiosk');

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      // Add date filters based on current selection
      if (dateFilter.type === 'date' && dateFilter.selectedDate) {
        params.append('date', dateFilter.selectedDate);
        console.log('📊 Excel Download - Adding date filter:', dateFilter.selectedDate);
      } else if (dateFilter.type === 'month') {
        params.append('month', dateFilter.month.toString());
        params.append('year', dateFilter.year.toString());
        console.log('📊 Excel Download - Adding month filter:', dateFilter.month, dateFilter.year);
      } else {
        console.log('📊 Excel Download - No date filter (showing all time)');
      }

      const apiUrl = `${config.api.baseUrl}/orders/excel/${theaterId}?${params.toString()}`;
      console.log('📊 Excel Download - API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ...(localStorage.getItem('authToken') && {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to download Excel: ${response.status}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with date
      const today = new Date().toISOString().split('T')[0];
      link.download = `kiosk-orders-${today}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Excel download error:', error);
      showError('Failed to download Excel file: ' + error.message);
    } finally {
      setDownloadingExcel(false);
    }
  }, [theaterId, searchTerm, statusFilter, dateFilter, showError]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter]);

  // Render loading state
  if (loading) {
    return (
      <ErrorBoundary>
        <TheaterLayout currentPage="kiosk-order-history">
          <PageContainer title="Kiosk Order History" showBackButton={false}>
            <div className="theater-user-loading" style={{ 
              padding: '60px 20px', 
              textAlign: 'center',
              fontSize: '1.1rem',
              color: '#666'
            }}>
              Loading kiosk orders...
            </div>
          </PageContainer>
        </TheaterLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <TheaterLayout currentPage="kiosk-order-history" pageTitle="Kiosk Order History">
        <PageContainer title="Kiosk Order History" showBackButton={false}>
          <div className="qr-management-page">
            
           

            {/* Summary Statistics */}
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-number">{summary.totalOrders}</div>
                <div className="stat-label">Total Orders</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.confirmedOrders}</div>
                <div className="stat-label">Confirmed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.completedOrders}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{formatCurrency(summary.totalRevenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
            </div>

            {/* Filters and Controls */}
            <div className="theater-filters">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search by order number, customer name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="filter-controls">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                   dateFilter.type === 'date' ? `TODAY (${new Date(dateFilter.selectedDate).toLocaleDateString('en-GB')})` :
                   dateFilter.type === 'month' ? `${new Date(dateFilter.year, dateFilter.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` :
                   'Date Filter'}
                </button>
                <div className="items-per-page">
                  <label>Items per page:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="items-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="theater-table-container">
              <table className="theater-table">
                <thead>
                  <tr>
                    <th className="sno-cell">S.No</th>
                    <th className="name-cell">Order Number</th>
                    <th className="name-cell">Customer</th>
                    <th className="status-cell">Items</th>
                    <th className="status-cell">Amount</th>
                    <th className="status-cell">Payment Mode</th>
                    <th className="status-cell">Status</th>
                    <th className="status-cell">Date</th>
                    <th className="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="loading-cell">
                        <div className="loading-spinner"></div>
                        <span>Loading kiosk orders...</span>
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-cell">
                        <i className="fas fa-desktop fa-3x"></i>
                        <h3>No Kiosk Orders Found</h3>
                        <p>There are no kiosk orders available for viewing at the moment.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order, index) => (
                      <tr key={order._id} className="theater-row">
                        <td className="sno-cell">
                          <div className="sno-number">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </div>
                        </td>
                        
                        <td className="order-number-cell">
                          <div className="order-number">
                            {order.orderNumber || 'N/A'}
                          </div>
                        </td>
                        
                        <td className="customer-cell">
                          <div className="customer-info">
                            <div className="customer-name">
                              {order.customerName || order.customer?.name || 'Kiosk Customer'}
                            </div>
                            {(order.customerPhone || order.customer?.phone) && (
                              <div className="customer-phone">
                                {order.customerPhone || order.customer?.phone}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="items-cell">
                          <div className="items-count">
                            {order.items?.length || 0} items
                          </div>
                        </td>
                        
                        <td className="amount-cell" style={{ textAlign: 'center' }}>
                          <div className="amount">
                            {formatCurrency(order.pricing?.total ?? order.totalAmount ?? 0)}
                          </div>
                        </td>
                        
                        <td className="payment-mode-cell">
                          <div className="payment-mode">
                            {order.payment?.method || order.paymentMode || order.paymentMethod || 'UPI'}
                          </div>
                        </td>
                        
                        <td className="status-cell">
                          <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                            {order.status || 'pending'}
                          </span>
                        </td>
                        
                        <td className="date-cell">
                          <div className="order-date">
                            {formatDateTime(order.createdAt)}
                          </div>
                        </td>
                        
                        <td className="action-cell">
                          <div className="action-buttons" style={{ gap: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <button 
                              className="action-btn view-btn"
                              title="View Details"
                              onClick={() => viewOrder(order)}
                              style={{ margin: '0' }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                              </svg>
                            </button>
                            <button 
                              className="action-btn download-btn"
                              title="Download Receipt"
                              onClick={() => downloadOrderPDF(order)}
                              style={{ margin: '0' }}
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - Always Show (Global Component) */}
            {!loading && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredOrders.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                itemType="orders"
              />
            )}

          </div>

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
                      <span>{formatDateTime(selectedOrder.createdAt)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold' }}>Bill To:</span>
                      <span>{selectedOrder.customerName || selectedOrder.customerInfo?.name || 'Kiosk Customer'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold' }}>Payment:</span>
                      <span>{selectedOrder.payment?.method ? selectedOrder.payment.method.toUpperCase() : (selectedOrder.paymentMode || selectedOrder.paymentMethod || 'UPI').toUpperCase()}</span>
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

export default KioskOrderHistory;