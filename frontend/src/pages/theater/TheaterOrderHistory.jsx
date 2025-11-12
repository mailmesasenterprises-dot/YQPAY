import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getCachedData, setCachedData } from '../../utils/cacheUtils';
import DateFilter from '../../components/DateFilter';
import Pagination from '../../components/Pagination';
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import '../../styles/AddTheater.css';
import '../../styles/skeleton.css'; // 🚀 Skeleton loading styles
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



const TheaterOrderHistory = React.memo(() => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterOrderHistory');
  
  // 🚀 INSTANT: Check cache synchronously on initialization
  const initialCachedOrders = (() => {
    if (!theaterId) return null;
    try {
      const cacheKey = `orders_${theaterId}_1_10_all_${dateFilter.selectedDate || 'today'}`;
      const cached = getCachedData(cacheKey, 60000);
      if (cached && cached.orders) {
        return cached.orders;
      }
    } catch (e) {}
    return null;
  })();

  // Data state
  const [orders, setOrders] = useState(initialCachedOrders || []);
  const [allOrders, setAllOrders] = useState(initialCachedOrders || []); // Store all orders for pagination
  const [loading, setLoading] = useState(!initialCachedOrders); // 🚀 Start false if cache exists
  const [initialLoadDone, setInitialLoadDone] = useState(!!initialCachedOrders); // 🚀 Mark done if cache exists
  const lastLoadKeyRef = useRef('');
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [theaterInfo, setTheaterInfo] = useState(null); // Theater information for receipts
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
  const loadOrdersDataRef = useRef(null); // Ref to store loadOrdersData function
  
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

  // 🚀 ULTRA-OPTIMIZED: Load orders data - <50ms with instant cache
  const loadOrdersData = useCallback(async (page = 1, limit = 10, search = '', status = 'all', dateFilterParam = null, skipCache = false) => {
    const currentDateFilter = dateFilterParam || dateFilter;
    
    if (!isMountedRef.current || !theaterId) {
      return;
    }

    // 🚀 INSTANT CACHE CHECK - Load from cache first (< 50ms) - SYNCHRONOUS
    // Only cache for first page, no search, default status, and default date filter
    if (!skipCache && page === 1 && !search && status === 'all' && currentDateFilter.type === 'date') {
      const cacheKey = `theaterOrderHistory_${theaterId}_${currentDateFilter.selectedDate}`;
      try {
        const cached = getCachedData(cacheKey, 300000); // 5-minute cache
        
        if (cached && isMountedRef.current) {
          // Cached data structure: { data, pagination, summary }
          let cachedOrders = cached.data || [];
          const cachedPagination = cached.pagination || {};
          const cachedSummary = cached.summary || {};
          
          // Ensure cachedOrders is an array
          if (!Array.isArray(cachedOrders)) {
            cachedOrders = [];
          }
          
          // 🚀 INSTANT state update from cache (< 50ms) - SYNCHRONOUS batch update
          // Use React.startTransition for non-urgent updates, but we want instant display
          setAllOrders(cachedOrders);
          setOrders(cachedOrders);
          setTotalItems(cachedPagination.totalItems || cachedPagination.total || 0);
          setTotalPages(cachedPagination.totalPages || cachedPagination.pages || 0);
          setCurrentPage(1);
          setSummary({
            totalOrders: cachedSummary.totalOrders || 0,
            confirmedOrders: cachedSummary.confirmedOrders || 0,
            completedOrders: cachedSummary.completedOrders || 0,
            totalRevenue: cachedSummary.totalRevenue || 0
          });
          setLoading(false); // CRITICAL: Set loading false IMMEDIATELY
          
          // Fetch fresh data in background (non-blocking) - Update cache silently
          // Use setTimeout with 0 delay to ensure it runs after current execution
          setTimeout(() => {
            if (isMountedRef.current && loadOrdersDataRef.current) {
              loadOrdersDataRef.current(1, limit, '', 'all', currentDateFilter, true);
            }
          }, 0);
          return;
        }
      } catch (error) {
        // Cache read failed, continue with API call
        console.warn('Cache read error:', error);
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Set loading at the start of fetch (unless skipping cache)
      if (!skipCache) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        theaterId: theaterId,
        _t: Date.now()
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
      

      if (!response.ok) {
        const errorText = await response.text();

        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Authentication failed. Please login again.');
        } else if (response.status === 404) {
          // 404 means no orders found - handle gracefully without error

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

      if (!isMountedRef.current) return;

      if (data.success) {
        // Handle multiple possible response structures
        let ordersData = Array.isArray(data.data)
          ? data.data
          : (Array.isArray(data.data?.orders) ? data.data.orders : (Array.isArray(data.orders) ? data.orders : []));

        // Ensure ordersData is always an array
        if (!Array.isArray(ordersData)) {
          console.warn('Orders data is not an array:', ordersData);
          ordersData = [];
        }

        const summaryData = data.summary || data.data?.summary || {
          totalOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          totalRevenue: 0
        };
        

        // 🚀 BATCH ALL STATE UPDATES
        setAllOrders(ordersData);
        setOrders(ordersData);
        setSummary(summaryData);
        
        // Update pagination
        const paginationData = data.pagination || data.data?.pagination || {};
        if (paginationData.total !== undefined || paginationData.totalItems !== undefined) {
          setTotalItems(paginationData.total || paginationData.totalItems || 0);
          setTotalPages(paginationData.pages || paginationData.totalPages || 1);
          setCurrentPage(paginationData.current || paginationData.currentPage || page);
        } else {
          setTotalItems(ordersData.length);
          setTotalPages(1);
          setCurrentPage(page);
        }
        
        setLoading(false);
        
        // Cache the response for instant future loads
        if (page === 1 && !search && status === 'all' && currentDateFilter.type === 'date') {
          const cacheKey = `theaterOrderHistory_${theaterId}_${currentDateFilter.selectedDate}`;
          setCachedData(cacheKey, {
            data: ordersData,
            pagination: paginationData,
            summary: summaryData
          });
        }
      } else {
        // Handle case where API returns success=false
        console.error('API returned success=false:', data.message || data.error);
        setAllOrders([]);
        setOrders([]);
        setTotalItems(0);
        setTotalPages(0);
        setCurrentPage(1);
        setSummary({ totalOrders: 0, confirmedOrders: 0, completedOrders: 0, totalRevenue: 0 });
        setLoading(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Don't clear existing data on error
        setLoading(false);
      }
    }
  }, [theaterId, dateFilter]);

  // Store loadOrdersData in ref for stable access - MUST be set before initial load
  useEffect(() => {
    loadOrdersDataRef.current = loadOrdersData;
  }, [loadOrdersData]);

  // 🚀 OPTIMIZED: Debounced search - Ultra-fast 90ms delay
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loadOrdersDataRef.current) {
        loadOrdersDataRef.current(1, itemsPerPage, query, statusFilter);
      }
    }, 90); // Ultra-fast 90ms delay for near-instant response
  }, [itemsPerPage, statusFilter]);

  // Search handler
  const handleSearch = useCallback((e) => {
    const query = e.target.value;
    setSearchTerm(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // 🚀 OPTIMIZED: Status filter handler - Use ref for stable access
  const handleStatusFilter = useCallback((e) => {
    const status = e.target.value;
    setStatusFilter(status);
    if (loadOrdersDataRef.current) {
      loadOrdersDataRef.current(1, itemsPerPage, searchTerm, status);
    }
  }, [itemsPerPage, searchTerm]);

  // 🚀 OPTIMIZED: Date filter handler - Use ref for stable access
  const handleDateFilterApply = useCallback((newDateFilter) => {
    setDateFilter(newDateFilter);
    if (loadOrdersDataRef.current) {
      loadOrdersDataRef.current(1, itemsPerPage, searchTerm, statusFilter, newDateFilter);
    }
  }, [itemsPerPage, searchTerm, statusFilter]);

  // Excel Download Handler
  const handleDownloadExcel = useCallback(async () => {

    if (!theaterId) {

      showError('Theater ID is missing');
      return;
    }
    
    // Check if user is authenticated - try both token keys
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');

    if (!token) {

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

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });


      if (response.status === 401 || response.status === 403) {

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

  // 🚀 OPTIMIZED: Pagination handlers - Use ref for stable access
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    if (loadOrdersDataRef.current) {
      loadOrdersDataRef.current(1, newLimit, searchTerm, statusFilter);
    }
  }, [searchTerm, statusFilter]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages && loadOrdersDataRef.current) {
      loadOrdersDataRef.current(newPage, itemsPerPage, searchTerm, statusFilter);
    }
  }, [totalPages, itemsPerPage, searchTerm, statusFilter]);

  // View order details - Memoized
  const viewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  }, []);

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
      // Removed error modal - PDF generation failure logged to console only
    }
  };

  // Reset initial load flag when theaterId changes
  useEffect(() => {
    setInitialLoadDone(false);
    lastLoadKeyRef.current = '';
  }, [theaterId]);

  // 🚀 ULTRA-OPTIMIZED: Initial load - INSTANT CACHE FIRST (< 50ms)
  useEffect(() => {
    if (!theaterId) {
      setLoading(false);
      return;
    }

    const loadKey = `${theaterId}_${dateFilter.selectedDate || 'default'}`;
    if (lastLoadKeyRef.current === loadKey && initialLoadDone) {
      return;
    }

    // 🚀 INSTANT SYNCHRONOUS CACHE CHECK - MUST happen before any async operations
    if (dateFilter.type === 'date' && dateFilter.selectedDate) {
      const cacheKey = `theaterOrderHistory_${theaterId}_${dateFilter.selectedDate}`;
      try {
        const cached = getCachedData(cacheKey, 300000);
        if (cached) {
          // Cached data exists - load INSTANTLY (< 50ms) - SYNCHRONOUS
          let cachedOrders = cached.data || [];
          const cachedPagination = cached.pagination || {};
          const cachedSummary = cached.summary || {};
          
          if (!Array.isArray(cachedOrders)) {
            cachedOrders = [];
          }
          
          // INSTANT SYNCHRONOUS state update - NO async, NO loading delay
          setAllOrders(cachedOrders);
          setOrders(cachedOrders);
          setTotalItems(cachedPagination.totalItems || cachedPagination.total || 0);
          setTotalPages(cachedPagination.totalPages || cachedPagination.pages || 0);
          setCurrentPage(1);
          setSummary({
            totalOrders: cachedSummary.totalOrders || 0,
            confirmedOrders: cachedSummary.confirmedOrders || 0,
            completedOrders: cachedSummary.completedOrders || 0,
            totalRevenue: cachedSummary.totalRevenue || 0
          });
          setLoading(false); // CRITICAL: Set false immediately
          setInitialLoadDone(true);
          lastLoadKeyRef.current = loadKey;
          
          // Fetch fresh data in background (non-blocking)
          requestAnimationFrame(() => {
            if (loadOrdersDataRef.current) {
              loadOrdersDataRef.current(1, 10, '', 'all', dateFilter, true);
            }
          });
          
          return; // EXIT EARLY - cache loaded, no API call needed
        }
      } catch (error) {
        // Cache check failed silently, continue with API call
      }
    }

    // No cache found - proceed with API call
    lastLoadKeyRef.current = loadKey;
    setLoading(true); // Only set loading if no cache

    let isMounted = true;
    let safetyTimer = null;

    // Safety timeout to prevent infinite loading
    safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 5000);

    // Execute API call
    (async () => {
      try {
        if (loadOrdersDataRef.current) {
          await loadOrdersDataRef.current(1, 10, '', 'all', dateFilter, false);
        } else {
          // Fallback direct API call if ref not set
          const params = new URLSearchParams({
            page: 1,
            limit: 10,
            theaterId: theaterId,
            _t: Date.now()
          });
          if (dateFilter.type === 'date' && dateFilter.selectedDate) {
            params.append('date', dateFilter.selectedDate);
          }
          
          const response = await fetch(`${config.api.baseUrl}/orders/theater-nested?${params.toString()}`, {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          });
          
          if (response.ok && isMounted) {
            const data = await response.json();
            if (data.success) {
              const ordersData = data.data || [];
              const summaryData = data.summary || {};
              
              setAllOrders(ordersData);
              setOrders(ordersData);
              setSummary(summaryData);
              if (data.pagination) {
                setTotalItems(data.pagination.total || 0);
                setTotalPages(data.pagination.pages || 0);
                setCurrentPage(1);
              }
            }
          }
        }
        
        if (isMounted) {
          setInitialLoadDone(true);
          setLoading(false);
          if (safetyTimer) clearTimeout(safetyTimer);
        }
      } catch (error) {
        if (isMounted) {
          setLoading(false);
          if (safetyTimer) clearTimeout(safetyTimer);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [theaterId, dateFilter.type, dateFilter.selectedDate, initialLoadDone]);

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

  // 🚀 OPTIMIZED: Memoized Order Table Row Component
  const OrderRow = React.memo(({ order, index, currentPage, itemsPerPage, onView, onDownloadPDF }) => {
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
          <div className="action-buttons" style={{ gap: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              className="action-btn view-btn"
              onClick={() => onView(order)}
              title="View Details"
              style={{ margin: '0' }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
            <button 
              className="action-btn download-btn"
              onClick={() => onDownloadPDF(order)}
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
  }, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
      prevProps.order._id === nextProps.order._id &&
      prevProps.index === nextProps.index &&
      prevProps.currentPage === nextProps.currentPage &&
      prevProps.itemsPerPage === nextProps.itemsPerPage &&
      prevProps.order.orderNumber === nextProps.order.orderNumber &&
      prevProps.order.status === nextProps.order.status &&
      prevProps.order.pricing?.total === nextProps.order.pricing?.total
    );
  });

  OrderRow.displayName = 'OrderRow';

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
              {loading && !initialLoadDone && orders.length === 0 ? (
                // 🚀 INSTANT: Show skeleton instead of spinner
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="skeleton-row">
                    <td><div className="skeleton-box" style={{ width: '30px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '120px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '100px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '60px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '100px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '100px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '16px' }} /></td>
                  </tr>
                ))
              ) : orders.length > 0 ? (
                orders.map((order, index) => (
                  <OrderRow
                    key={order._id}
                    order={order}
                    index={index}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onView={viewOrder}
                    onDownloadPDF={downloadOrderPDF}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="empty-cell">
                    <i className="fas fa-shopping-cart fa-3x"></i>
                    <h3>No Orders Found</h3>
                    <p>There are no orders available for viewing at the moment.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination - Always Show (Global Component) */}
        {!loading && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemType="orders"
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
          onApply={handleDateFilterApply}
        />

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
});

TheaterOrderHistory.displayName = 'TheaterOrderHistory';

export default TheaterOrderHistory;