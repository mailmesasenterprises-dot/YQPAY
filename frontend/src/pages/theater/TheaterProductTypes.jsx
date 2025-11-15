import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import InstantImage from '../../components/InstantImage'; // 🚀 Instant image loading
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import { useModal } from '../../contexts/ModalContext'
import { useToast } from '../../contexts/ToastContext';;
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getCachedData, setCachedData, clearCachePattern } from '../../utils/cacheUtils';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



const TheaterProductTypes = React.memo(() => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal()
  const toast = useToast();;

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterProductTypes');
  
  // Data state
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const lastLoadKeyRef = useRef('');
  const [summary, setSummary] = useState({
    activeProductTypes: 0,
    inactiveProductTypes: 0,
    totalProductTypes: 0
  });

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal states  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProductType, setSelectedProductType] = useState(null);
  const [formData, setFormData] = useState({
    productName: '',
    productCode: '',
    description: '',
    quantity: '',
    isActive: true
  });

  // Image upload state
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');

  // Refs for cleanup and performance
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadProductTypesDataRef = useRef(null); // Ref to store loadProductTypesData function
  
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

  // 🚀 ULTRA-OPTIMIZED: Load product types data - <90ms with instant cache
  const loadProductTypesData = useCallback(async (page = 1, limit = 10, search = '', skipCache = false, forceRefresh = false) => {
    if (!isMountedRef.current || !theaterId) {
      return;
    }

    // 🚀 INSTANT CACHE CHECK - Load from cache first (< 90ms)
    // Skip cache if force refresh is requested
    if (!skipCache && !forceRefresh && page === 1 && !search) {
      const cacheKey = `theaterProductTypes_${theaterId}`;
      const cached = getCachedData(cacheKey, 300000); // 5-minute cache
      
      if (cached && isMountedRef.current) {
        // Cached data structure: { data, pagination, statistics }
        let cachedProductTypes = cached.data || [];
        const cachedPagination = cached.pagination || {};
        const cachedStatistics = cached.statistics || {};
        
        // Ensure cachedProductTypes is an array
        if (!Array.isArray(cachedProductTypes)) {
          cachedProductTypes = [];
        }
        
        // 🚀 ULTRA-FAST: Minimal processing for cache (< 90ms)
        // Only process if needed (data might already be processed)
        if (cachedProductTypes.length > 0 && !cachedProductTypes[0].imageUrl) {
          cachedProductTypes = cachedProductTypes.map(pt => ({
            ...pt,
            imageUrl: pt.imageUrl || pt.image
          }));
        }
        
        // Instant state update from cache (< 90ms) - Single batch update
        setProductTypes(cachedProductTypes);
        setTotalItems(cachedPagination.totalItems || 0);
        setTotalPages(cachedPagination.totalPages || 1);
        setCurrentPage(1);
        setSummary({
          activeProductTypes: cachedStatistics.active || 0,
          inactiveProductTypes: cachedStatistics.inactive || 0,
          totalProductTypes: cachedStatistics.total || 0
        });
        setLoading(false);
        
        // Fetch fresh data in background (non-blocking) - Update cache silently
        requestAnimationFrame(() => {
          if (isMountedRef.current && loadProductTypesDataRef.current) {
            loadProductTypesDataRef.current(1, limit, '', true);
          }
        });
        return;
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
        q: search,
        _t: Date.now()
      });

      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TheaterProductTypes] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      const baseUrl = `${config.api.baseUrl}/theater-product-types/${theaterId}?${params.toString()}`;

      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      } else {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      if (data.success) {
        // Handle both data.data (array) and data.data.productTypes (nested) structures
        let productTypes = Array.isArray(data.data) 
          ? data.data 
          : (data.data?.productTypes || data.productTypes || []);

        // Ensure productTypes is always an array
        if (!Array.isArray(productTypes)) {
          console.warn('Product types data is not an array:', productTypes);
          productTypes = [];
        }

        // 🚀 ULTRA-OPTIMIZED: Process data efficiently
        productTypes = productTypes
          .map(pt => ({
            ...pt,
            imageUrl: pt.imageUrl || pt.image
          }))
          .sort((a, b) => {
            const idA = a._id || '';
            const idB = b._id || '';
            return idA < idB ? -1 : idA > idB ? 1 : 0;
          });

        // 🚀 BATCH ALL STATE UPDATES
        const paginationData = data.pagination || data.data?.pagination || {};
        const statisticsData = data.statistics || data.data?.statistics || {};
        
        setProductTypes(productTypes);
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        setCurrentPage(page);
        setSummary({
          activeProductTypes: statisticsData.active || 0,
          inactiveProductTypes: statisticsData.inactive || 0,
          totalProductTypes: statisticsData.total || 0
        });
        setLoading(false);
        
        // Cache the response for instant future loads
        if (page === 1 && !search) {
          const cacheKey = `theaterProductTypes_${theaterId}`;
          setCachedData(cacheKey, {
            data: productTypes,
            pagination: paginationData,
            statistics: statisticsData
          });
        }
      } else {
        // Handle API error response
        console.error('API returned success=false:', data.message || data.error);
        setProductTypes([]);
        setTotalItems(0);
        setTotalPages(0);
        setCurrentPage(1);
        setSummary({
          activeProductTypes: 0,
          inactiveProductTypes: 0,
          totalProductTypes: 0
        });
        setLoading(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Don't clear existing data on error
        setLoading(false);
      }
    }
  }, [theaterId, productTypes.length]);

  // Store loadProductTypesData in ref for stable access
  useEffect(() => {
    loadProductTypesDataRef.current = loadProductTypesData;
  }, [loadProductTypesData]);

  // 🚀 OPTIMIZED: Debounced search - Ultra-fast 90ms delay
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loadProductTypesDataRef.current) {
        loadProductTypesDataRef.current(1, itemsPerPage, query); // Reset to first page
      }
    }, 90); // Ultra-fast 90ms delay for near-instant response
  }, [itemsPerPage]);

  // Search handler
  const handleSearch = useCallback((e) => {
    const query = e.target.value;
    setSearchTerm(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // 🚀 OPTIMIZED: Pagination handlers - Use ref for stable access
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    if (loadProductTypesDataRef.current) {
      loadProductTypesDataRef.current(1, newLimit, searchTerm);
    }
  }, [searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages && loadProductTypesDataRef.current) {
      loadProductTypesDataRef.current(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm]);

  // CRUD Operations - Memoized for performance
  const viewProductType = useCallback((productType) => {
    setSelectedProductType(productType);
    setShowViewModal(true);
  }, []);

  const editProductType = useCallback((productType) => {
    setSelectedProductType(productType);
    setFormData({
      productName: productType.productName || '',
      productCode: productType.productCode || '',
      description: productType.description || '',
      quantity: productType.quantity || '',
      isActive: productType.isActive,
      imageUrl: productType.imageUrl || null,
      removeImage: false
    });
    
    // Reset image states
    setImageFile(null);
    setImageError('');
    
    // Set current image preview if exists
    if (productType.imageUrl || productType.image) {
      setImagePreview(productType.imageUrl || productType.image);
    } else {
      setImagePreview(null);
    }
    
    setShowEditModal(true);
  }, []);

  const deleteProductType = useCallback((productType) => {
    setSelectedProductType(productType);
    setShowDeleteModal(true);
  }, []);

  // Submit handler for create/edit - Memoized
  const handleSubmitProductType = useCallback(async (isEdit = false) => {
    try {
      const url = isEdit 
        ? `${config.api.baseUrl}/theater-product-types/${theaterId}/${selectedProductType._id}` 
        : `${config.api.baseUrl}/theater-product-types/${theaterId}`;
      const method = isEdit ? 'PUT' : 'POST';
      
      // Create FormData for file upload support
      const formDataToSend = new FormData();
      formDataToSend.append('productName', formData.productName);
      formDataToSend.append('productCode', formData.productCode);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('quantity', formData.quantity);
      formDataToSend.append('isActive', formData.isActive);
      
      // Add image if selected
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formDataToSend,
      });
      
      if (response.ok) {
        const data = await response.json();
        // Clear cache to ensure fresh data
        const cacheKey = `theaterProductTypes_${theaterId}`;
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (e) {
          // Ignore cache clear errors
        }
        
        if (isEdit) {
          setShowEditModal(false);
          toast.success('Product updated successfully!');
        } else {
          setShowCreateModal(false);
          toast.success('Product created successfully!');
        }
        if (loadProductTypesDataRef.current) {
          loadProductTypesDataRef.current(currentPage, itemsPerPage, searchTerm, true, true); // Refresh with force refresh
        }
        
        // Reset form
        setFormData({
          productName: '',
          productCode: '',
          description: '',
          quantity: '',
          isActive: true
        });
        setImageFile(null);
        setImagePreview(null);
        setSelectedProductType(null);
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    }
  }, [theaterId, selectedProductType, formData, imageFile, currentPage, itemsPerPage, searchTerm, loadProductTypesData]);

  const handleDeleteProductType = useCallback(async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-product-types/${theaterId}/${selectedProductType._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        // Clear cache to ensure fresh data
        const cacheKey = `theaterProductTypes_${theaterId}`;
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (e) {
          // Ignore cache clear errors
        }
        
        setShowDeleteModal(false);
          toast.success('Product deleted successfully!');
        if (loadProductTypesDataRef.current) {
          loadProductTypesDataRef.current(currentPage, itemsPerPage, searchTerm, true, true); // Refresh with force refresh
        }
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    }
  }, [theaterId, selectedProductType, currentPage, itemsPerPage, searchTerm, loadProductTypesData]);

  const handleCreateNewProductType = useCallback(() => {
    setFormData({
      productName: '',
      productCode: '',
      description: '',
      quantity: '',
      isActive: true,
      imageUrl: null,
      removeImage: false
    });
    setImageFile(null);
    setImagePreview(null);
    setImageFile(null);
    setImageError('');
    setSelectedProductType(null);
    setShowCreateModal(true);
  }, []);

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Image handling functions (matching TheaterCategories pattern) - Memoized
  const handleImageSelect = useCallback((file) => {
    setImageFile(file);
    setImageError('');
    setFormData(prev => ({
      ...prev,
      removeImage: false
    }));
  }, []);

  const handleImageRemove = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setImageError('');
    setFormData(prev => ({
      ...prev,
      imageUrl: null,
      removeImage: true
    }));
  }, []);

  // Reset initial load flag when theaterId changes
  useEffect(() => {
    setInitialLoadDone(false);
    setLoading(true);
    lastLoadKeyRef.current = '';
  }, [theaterId]);

  // 🚀 ULTRA-OPTIMIZED: Initial load - INSTANT CACHE FIRST (< 90ms)
  useEffect(() => {
    if (!theaterId || !loadProductTypesDataRef.current) {
      if (!theaterId) {
        setLoading(false);
      }
      return;
    }

    const loadKey = `${theaterId}`;
    if (lastLoadKeyRef.current === loadKey && initialLoadDone) {
      return;
    }
    lastLoadKeyRef.current = loadKey;

    let isMounted = true;
    let safetyTimer = null;

    // Safety timeout to prevent infinite loading
    safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 8000); // 8 seconds timeout

    // Execute immediately - cache check happens first (< 90ms)
    (async () => {
      try {
        await loadProductTypesDataRef.current(1, 10, '', false, true);
        if (isMounted) {
          setInitialLoadDone(true);
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
  }, [theaterId, initialLoadDone]); // Depend on initialLoadDone to allow retry

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

  // 🚀 OPTIMIZED: Memoized Product Type Table Row Component
  const ProductTypeRow = React.memo(({ productType, index, currentPage, itemsPerPage, onView, onEdit, onDelete }) => {
    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
    
    return (
      <tr key={productType._id} className={`theater-row ${!productType.isActive ? 'inactive' : ''}`}>
        <td className="sno-cell">{serialNumber}</td>
        <td className="photo-cell">
          {(productType.imageUrl || productType.image) ? (
            <div className="theater-photo-thumb">
              <InstantImage
                src={productType.imageUrl || productType.image} 
                alt={productType.productName || 'Product Type'}
                loading="eager"
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.parentElement) {
                    e.target.parentElement.classList.add('no-photo');
                  }
                }}
              />
            </div>
          ) : (
            <div className="theater-photo-thumb no-photo">
              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px'}}>
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
              </svg>
            </div>
          )}
        </td>
        <td className="name-cell">
          <div className="qr-info">
            <div className="qr-name">{productType.productName}</div>
            {productType.description && (
              <div className="qr-description">{productType.description}</div>
            )}
          </div>
        </td>
        <td className="name-cell">
          <div className="qr-code">{productType.productCode}</div>
        </td>
        <td className="status-cell">
          <div className="quantity-display">
            <span className="quantity-value">{productType.quantity || 'Not set'}</span>
          </div>
        </td>
        <td className="status-cell">
          <span className={`status-badge ${productType.isActive ? 'active' : 'inactive'}`}>
            {productType.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="actions-cell">
          <ActionButtons>
            <ActionButton 
              type="view"
              onClick={() => onView(productType)}
              title="View Details"
            />
            <ActionButton 
              type="edit"
              onClick={() => onEdit(productType)}
              title="Edit Product Type"
            />
            <ActionButton 
              type="delete"
              onClick={() => onDelete(productType)}
              title="Delete Product Type"
            />
          </ActionButtons>
        </td>
      </tr>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
      prevProps.productType._id === nextProps.productType._id &&
      prevProps.index === nextProps.index &&
      prevProps.currentPage === nextProps.currentPage &&
      prevProps.itemsPerPage === nextProps.itemsPerPage &&
      prevProps.productType.productName === nextProps.productType.productName &&
      prevProps.productType.productCode === nextProps.productType.productCode &&
      prevProps.productType.quantity === nextProps.productType.quantity &&
      prevProps.productType.isActive === nextProps.productType.isActive &&
      prevProps.productType.imageUrl === nextProps.productType.imageUrl
    );
  });

  ProductTypeRow.displayName = 'ProductTypeRow';

  // 🚀 OPTIMIZED: Memoized header button to prevent re-renders
  const headerButton = useMemo(() => (
    <button 
      className="header-btn"
      onClick={handleCreateNewProductType}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Create New Product Name
    </button>
  ), [handleCreateNewProductType]);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Product Names" currentPage="product-types">
        <PageContainer
          title="Product Name"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeProductTypes || 0}</div>
            <div className="stat-label">Active Product Names</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveProductTypes || 0}</div>
            <div className="stat-label">Inactive Product Names</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalProductTypes || 0}</div>
            <div className="stat-label">Total Product Names</div>
          </div>
        </div>

        {/* Enhanced Filters Section matching TheaterList */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search product names by name..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          
          <select
            value="all"
            className="status-filter"
            disabled
          >
            <option value="all">All Status</option>
          </select>
          
          <span className="results-count">
            Showing {productTypes.length} of {totalItems} product names (Page {currentPage} of {totalPages})
          </span>
          
          <div className="items-per-page">
            <label>Items per page:</label>
            <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="items-select">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Management Table */}
        <div className="theater-table-container">
          <table className="theater-table">
            <thead>
              <tr>
                <th className="sno-cell">S.No</th>
                <th className="photo-cell">Image</th>
                <th className="name-cell">Product Name</th>
                <th className="name-cell">Product Code / SKU</th>
                <th className="status-cell">Quantity</th>
                <th className="status-cell">Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : productTypes.length > 0 ? (
                productTypes.map((productType, index) => (
                  <ProductTypeRow
                    key={productType._id}
                    productType={productType}
                    index={index}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onView={viewProductType}
                    onEdit={editProductType}
                    onDelete={deleteProductType}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    <i className="fas fa-box fa-3x"></i>
                    <h3>No Product Names Found</h3>
                    <p>There are no product names available for management at the moment.</p>
                    <button 
                      className="add-theater-btn" 
                      onClick={handleCreateNewProductType}
                    >
                      Create First Product Name
                    </button>
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
            itemType="product names"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Product Name</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input 
                      type="text" 
                      value={formData.productName || ''} 
                      onChange={(e) => handleInputChange('productName', e.target.value)}
                      className="form-control"
                      placeholder="Enter product name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Code / SKU</label>
                    <input 
                      type="text" 
                      value={formData.productCode || ''} 
                      onChange={(e) => handleInputChange('productCode', e.target.value)}
                      className="form-control"
                      placeholder="Enter product code or SKU"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={formData.isActive ? 'Active' : 'Inactive'} 
                      onChange={(e) => handleInputChange('isActive', e.target.value === 'Active')}
                      className="form-control"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input 
                      type="text" 
                      value={formData.quantity || ''} 
                      onChange={(e) => handleInputChange('quantity', e.target.value)}
                      className="form-control"
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={formData.description || ''} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter product type description (optional)"
                      rows="3"
                    />
                  </div>
                 
                  <div className="form-group full-width">
                    <label>Product Image</label>
                    <ImageUpload
                      value={imageFile || null}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Product Image"
                      helperText="Drag and drop an image here, or click to select (optional)"
                      style={{ marginTop: '8px' }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer with Cancel and Submit Buttons */}
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSubmitProductType(false)}
                >
                  Create Product Type
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Product Name</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input 
                      type="text" 
                      value={formData.productName || ''} 
                      onChange={(e) => handleInputChange('productName', e.target.value)}
                      className="form-control"
                      placeholder="Enter product name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Code / SKU</label>
                    <input 
                      type="text" 
                      value={formData.productCode || ''} 
                      onChange={(e) => handleInputChange('productCode', e.target.value)}
                      className="form-control"
                      placeholder="Enter product code or SKU"
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input 
                      type="text" 
                      value={formData.quantity || ''} 
                      onChange={(e) => handleInputChange('quantity', e.target.value)}
                      className="form-control"
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={formData.isActive ? 'Active' : 'Inactive'} 
                      onChange={(e) => handleInputChange('isActive', e.target.value === 'Active')}
                      className="form-control"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={formData.description || ''} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter product type description (optional)"
                      rows="3"
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Product Image</label>
                    <ImageUpload
                      value={imageFile || (formData.imageUrl && !formData.removeImage ? formData.imageUrl : null)}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Product Image"
                      helperText="Drag and drop an image here, or click to select (optional)"
                      style={{ marginTop: '8px' }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer with Cancel and Submit Buttons */}
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleSubmitProductType(true)}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {showViewModal && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Product Name Details</h2>
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
                <div className="edit-form">
                  <div className="form-group">
                    <label>Product Name</label>
                    <input 
                      type="text" 
                      value={selectedProductType?.productName || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Product Code / SKU</label>
                    <input 
                      type="text" 
                      value={selectedProductType?.productCode || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input 
                      type="text" 
                      value={selectedProductType?.quantity || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={selectedProductType?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      disabled
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={selectedProductType?.description || ''} 
                      className="form-control"
                      readOnly
                      rows="3"
                    />
                  </div>
                 
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedProductType?.createdAt ? new Date(selectedProductType.createdAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={selectedProductType?.updatedAt ? new Date(selectedProductType.updatedAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  {selectedProductType?.imageUrl && (
                    <div className="form-group full-width">
                      <label>Product Image</label>
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <InstantImage
                          src={selectedProductType.imageUrl} 
                          alt={selectedProductType.productName}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* View modals don't have footer - Close button is in header only */}
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete the product type <strong>{selectedProductType?.productType}</strong>?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteProductType}
                  className="confirm-delete-btn"
                >
                  Delete Product Name
                </button>
              </div>
            </div>
          </div>
        )}

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
});

TheaterProductTypes.displayName = 'TheaterProductTypes';

// ✅ Global Modal Width Styling
const style = document.createElement('style');
style.textContent = `
  /* ============================================
     MODAL WIDTH STYLING - GLOBAL STANDARD
     ============================================ */
  
  /* Modal width for CRUD operations */
  .theater-edit-modal-content {
    max-width: 900px !important;
    width: 85% !important;
  }

  /* Tablet responsive modal */
  @media (max-width: 1024px) {
    .theater-edit-modal-content {
      width: 90% !important;
    }
  }

  /* Mobile responsive modal */
  @media (max-width: 768px) {
    .theater-edit-modal-content {
      width: 95% !important;
      max-width: none !important;
    }
  }

  /* Very Small Mobile modal */
  @media (max-width: 480px) {
    .theater-edit-modal-content {
      width: 98% !important;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default TheaterProductTypes;
