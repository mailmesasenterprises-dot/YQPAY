import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useModal } from '../../contexts/ModalContext';
// import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring'; // Temporarily disabled
import DateFilter from '../../components/DateFilter';
import Pagination from '../../components/Pagination';
import config from '../../config';
import { clearCachePattern } from '../../utils/cacheUtils'; // 🚀 Clear cache for fresh data
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import '../../styles/AddTheater.css';
// import { useDeepMemo, useComputed } from '../../utils/ultraPerformance'; // Unused
// import { ultraFetch } from '../../utils/ultraFetch'; // Unused



// Main component
const OnlineOrderHistory = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // Debug logging - Log immediately to verify component loads
  console.log('🚀 OnlineOrderHistory component loaded!');
  console.log('📍 theaterId from params:', theaterId);
  console.log('👤 user:', user);
  console.log('🎭 userTheaterId:', userTheaterId);

  // Early return for testing - show a simple message
  if (!theaterId) {
    console.error('❌ OnlineOrderHistory: theaterId is MISSING!');
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: 'white', 
        background: '#8B5CF6',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️ Theater ID Missing</h1>
        <p style={{ fontSize: '20px', marginBottom: '10px' }}>Current URL: {window.location.href}</p>
        <p style={{ fontSize: '20px', marginBottom: '10px' }}>Params: {JSON.stringify(useParams())}</p>
        <p style={{ fontSize: '16px', opacity: 0.8 }}>Please navigate from the theaters list.</p>
      </div>
    );
  }

  console.log('✅ OnlineOrderHistory: theaterId found:', theaterId);

  // PERFORMANCE MONITORING: Track page performance metrics
  // usePerformanceMonitoring('OnlineOrderHistory'); // Temporarily disabled for debugging
  
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterId]); // Only re-fetch when theaterId changes

  // Fetch orders from backend
  const fetchOrders = useCallback(async (forceRefresh = false) => {
    if (!theaterId) return;

    try {
      // 🚀 CLEAR CACHE: Force fresh fetch to get updated filtered data when force refreshing
      if (forceRefresh) {
        clearCachePattern(`/orders/theater/${theaterId}`);
        console.log('🔄 [OnlineOrderHistory] FORCE REFRESHING from server (bypassing ALL caches)');
      }
      
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Build URL with optional cache-busting parameter
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
      }
      const queryString = params.toString();
      const url = `${config.api.baseUrl}/orders/theater/${theaterId}${queryString ? `?${queryString}` : ''}`;
      
      // Fetch ALL orders first, then filter on frontend for online QR code orders only
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(forceRefresh && {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          })
        }
      });

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

      // Handle multiple possible response structures
      const ordersArray = Array.isArray(data.orders)
        ? data.orders
        : (Array.isArray(data.data) ? data.data : (Array.isArray(data.data?.orders) ? data.data.orders : []));

      if (data.success && ordersArray.length >= 0) {
        console.log('🔍 DEBUG: Raw data received:', ordersArray);
        
        // Filter to show ONLY online QR code orders (source=qr_code)
        // EXCLUDE ALL kiosk POS orders (source=pos, source=kiosk, or any POS-related source)
        const onlineOrders = ordersArray.filter(order => {
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

        console.log('📊 Total orders fetched:', ordersArray.length);
        console.log('📱 Online QR code orders:', onlineOrders.length);
        console.log('🖥️ Filtered out (non-QR):', ordersArray.length - onlineOrders.length);
        
        // Log all unique source values to debug
        const uniqueSources = [...new Set(ordersArray.map(o => o.source || 'undefined'))];
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
      console.error('Error fetching online orders:', error);
      showError('Failed to load online orders: ' + error.message);
      setOrders([]);
      setAllOrders([]);
      setSummary({
        totalOrders: 0,
        confirmedOrders: 0,
        completedOrders: 0,
        totalRevenue: 0
      });
    } finally {
      setLoading(false);
    }
  }, [theaterId, showError]);

  // Load orders on mount with force refresh
  useEffect(() => {
    fetchOrders(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterId]); // Only re-fetch when theaterId changes

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
        const orderDate = new Date(order.createdAt);
        const year = orderDate.getFullYear();
        const month = String(orderDate.getMonth() + 1).padStart(2, '0');
        const day = String(orderDate.getDate()).padStart(2, '0');
        const localDateString = `${year}-${month}-${day}`;
        return localDateString === dateFilter.selectedDate;
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
              <span><strong>Phone:</strong> ${order.customerPhone || order.customerInfo?.phoneNumber || order.customerInfo?.phone || order.customerInfo?.name || 'N/A'}</span>
            </div>
            <div class="bill-row">
              <span><strong>Screen:</strong> ${order.qrName || order.screenName || order.tableNumber || 'N/A'}</span>
            </div>
            <div class="bill-row">
              <span><strong>Seat:</strong> ${order.seat || order.seatNumber || order.customerInfo?.seat || 'N/A'}</span>
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
            <p>By YQPayNow</p>
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

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const url = `${config.api.baseUrl}/orders/${orderId}/status`;
      console.log('🔄 Updating order status:',{ orderId, newStatus, token: token ? 'exists' : 'missing', fullUrl: url });
      
      const response = await fetch(
        url,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Response data:', data);

      if (data.success) {
        // Update local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        setAllOrders(prevOrders =>
          prevOrders.map(order =>
            order._id === orderId ? { ...order, status: newStatus } : order
          )
        );
        
        console.log(`✅ Order ${orderId} status updated to ${newStatus}`);
      }
    } catch (error) {
      console.error('Update order status error:', error);
      showError('Failed to update order status');
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
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  );

  // Guard: Show error if theaterId is missing
  if (!theaterId) {
    console.error('OnlineOrderHistory: theaterId is missing!');
    return (
      <ErrorBoundary>
        <TheaterLayout pageTitle="Online Orders" currentPage="online-orders">
          <PageContainer title="Online Order History">
            <div style={{ padding: '40px', textAlign: 'center', color: '#e74c3c', background: 'white' }}>
              <h3>Error: Theater ID is missing</h3>
              <p>Unable to load online order history. Please navigate from the theaters list.</p>
              <p>URL: {window.location.href}</p>
            </div>
          </PageContainer>
        </TheaterLayout>
      </ErrorBoundary>
    );
  }

  console.log('OnlineOrderHistory: Rendering main content with theaterId:', theaterId);

  // TEMPORARY: Simple test render to verify component works
  return (
    <div style={{ 
      padding: '40px', 
      background: 'white', 
      minHeight: '100vh',
      color: '#333'
    }}>
      <h1 style={{ color: '#8B5CF6', marginBottom: '20px' }}>🎉 Component Works!</h1>
      <h2>Theater ID: {theaterId}</h2>
      <p>Loading: {loading ? 'Yes' : 'No'}</p>
      <p>Orders Count: {orders.length}</p>
      <p>User: {user?.email || 'Not logged in'}</p>
      <button 
        onClick={() => fetchOrders(true)}
        style={{
          padding: '10px 20px',
          background: '#8B5CF6',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Fetch Orders
      </button>
    </div>
  );
};

export default OnlineOrderHistory;
