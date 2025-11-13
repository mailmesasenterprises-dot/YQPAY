import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import InstantImage from '../../components/InstantImage';
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



const TheaterKioskTypes = React.memo(() => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal()
  const toast = useToast();;

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterKioskTypes');
  
  // Data state
  const [kioskTypes, setKioskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const lastLoadKeyRef = useRef('');
  const [summary, setSummary] = useState({
    activeKioskTypes: 0,
    inactiveKioskTypes: 0,
    totalKioskTypes: 0
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
  const [selectedKioskType, setSelectedKioskType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
    image: null,
    removeImage: false
  });

  // Image upload states
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs for cleanup and performance
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadKioskTypesDataRef = useRef(null); // Ref to store loadKioskTypesData function
  
  // Ensure mounted ref is set on component mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🚀 ULTRA-OPTIMIZED: Load kiosk types data - <90ms with instant cache
  const loadKioskTypesData = useCallback(async (page = 1, limit = 10, search = '', skipCache = false, forceRefresh = false) => {
    if (!isMountedRef.current || !theaterId) {
      return;
    }

    // 🚀 INSTANT CACHE CHECK - Load from cache first (< 90ms)
    // Skip cache if force refresh is requested
    if (!skipCache && !forceRefresh && page === 1 && !search) {
      const cacheKey = `theaterKioskTypes_${theaterId}`;
      const cached = getCachedData(cacheKey, 300000); // 5-minute cache
      
      if (cached && isMountedRef.current) {
        // Cached data structure: { data, pagination, statistics }
        let cachedKioskTypes = cached.data || [];
        const cachedPagination = cached.pagination || {};
        const cachedStatistics = cached.statistics || {};
        
        // Ensure cachedKioskTypes is an array
        if (!Array.isArray(cachedKioskTypes)) {
          cachedKioskTypes = [];
        }
        
        // 🚀 ULTRA-FAST: Minimal processing for cache (< 90ms)
        // Only process if needed (data might already be processed)
        if (cachedKioskTypes.length > 0 && !cachedKioskTypes[0].imageUrl) {
          cachedKioskTypes = cachedKioskTypes.map(kt => ({
            ...kt,
            imageUrl: kt.imageUrl || kt.image
          }));
        }
        
        // Instant state update from cache (< 90ms) - Single batch update
        setKioskTypes(cachedKioskTypes);
        setTotalItems(cachedPagination.totalItems || 0);
        setTotalPages(cachedPagination.totalPages || 1);
        setCurrentPage(1);
        setSummary({
          activeKioskTypes: cachedStatistics.active || 0,
          inactiveKioskTypes: cachedStatistics.inactive || 0,
          totalKioskTypes: cachedStatistics.total || 0
        });
        setLoading(false);
        
        // Fetch fresh data in background (non-blocking) - Update cache silently
        requestAnimationFrame(() => {
          if (isMountedRef.current && loadKioskTypesDataRef.current) {
            loadKioskTypesDataRef.current(1, limit, '', true);
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
        search: search || '',
        _t: Date.now()
      });

      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TheaterKioskTypes] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const baseUrl = `${config.api.baseUrl}/theater-kiosk-types/${theaterId}?${params}`;

      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
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
        method: 'GET',
        headers,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error('Failed to fetch kiosk types');
      }

      const data = await response.json();
      
      if (data.success && isMountedRef.current) {
        // Handle multiple possible response structures
        let items = Array.isArray(data.data?.kioskTypes)
          ? data.data.kioskTypes
          : (Array.isArray(data.data) ? data.data : (Array.isArray(data.kioskTypes) ? data.kioskTypes : []));

        // Ensure items is always an array
        if (!Array.isArray(items)) {
          console.warn('Kiosk types data is not an array:', items);
          items = [];
        }

        // 🚀 ULTRA-OPTIMIZED: Process data efficiently
        items = items
          .map(kt => ({
            ...kt,
            imageUrl: kt.imageUrl || kt.image
          }))
          .sort((a, b) => {
            const idA = a._id || '';
            const idB = b._id || '';
            return idA < idB ? -1 : idA > idB ? 1 : 0;
          });

        // 🚀 BATCH ALL STATE UPDATES
        const paginationData = data.data?.pagination || data.pagination || {};
        const statisticsData = data.data?.statistics || data.statistics || {};
        
        setKioskTypes(items);
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        setCurrentPage(page);
        setSummary({
          activeKioskTypes: statisticsData.active || 0,
          inactiveKioskTypes: statisticsData.inactive || 0,
          totalKioskTypes: statisticsData.total || 0
        });
        setLoading(false);
        
        // Cache the response for instant future loads
        if (page === 1 && !search) {
          const cacheKey = `theaterKioskTypes_${theaterId}`;
          setCachedData(cacheKey, {
            data: items,
            pagination: paginationData,
            statistics: statisticsData
          });
        }
      } else {
        // Handle API error response
        if (isMountedRef.current) {
          console.error('API returned success=false:', data.message || data.error);
          setKioskTypes([]);
          setTotalItems(0);
          setTotalPages(0);
          setCurrentPage(1);
          setSummary({
            activeKioskTypes: 0,
            inactiveKioskTypes: 0,
            totalKioskTypes: 0
          });
          setLoading(false);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Don't clear existing data on error
        setLoading(false);
      }
    }
  }, [theaterId, kioskTypes.length]);

  // Store loadKioskTypesData in ref for stable access - Set immediately
  loadKioskTypesDataRef.current = loadKioskTypesData;
  
  useEffect(() => {
    loadKioskTypesDataRef.current = loadKioskTypesData;
  }, [loadKioskTypesData]);

  // 🚀 OPTIMIZED: Debounced search - Ultra-fast 90ms delay
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loadKioskTypesDataRef.current) {
        loadKioskTypesDataRef.current(1, itemsPerPage, query);
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
    if (loadKioskTypesDataRef.current) {
      loadKioskTypesDataRef.current(1, newLimit, searchTerm);
    }
  }, [searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages && loadKioskTypesDataRef.current) {
      loadKioskTypesDataRef.current(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm]);

  // CRUD Operations - Memoized for performance
  const viewKioskType = useCallback((kioskType) => {
    setSelectedKioskType(kioskType);
    setShowViewModal(true);
  }, []);

  const editKioskType = useCallback((kioskType) => {
    setSelectedKioskType(kioskType);
    setFormData({
      name: kioskType.name || '',
      description: kioskType.description || '',
      isActive: kioskType.isActive,
      image: kioskType.imageUrl || null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setShowEditModal(true);
  }, []);

  const deleteKioskType = useCallback((kioskType) => {
    setSelectedKioskType(kioskType);
    setShowDeleteModal(true);
  }, []);

  // Submit handler for create/edit - Memoized
  const handleSubmitKioskType = useCallback(async (isEdit = false) => {
    try {
      setImageError('');
      
      const url = isEdit 
        ? `${config.api.baseUrl}/theater-kiosk-types/${theaterId}/${selectedKioskType._id}` 
        : `${config.api.baseUrl}/theater-kiosk-types/${theaterId}`;
      const method = isEdit ? 'PUT' : 'POST';
      

      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('isActive', formData.isActive);
      
      // Add image file if selected
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      
      // Add description if provided
      if (formData.description) {
        formDataToSend.append('description', formData.description);
      }
      
      // Handle image removal
      if (formData.removeImage && !imageFile) {
        formDataToSend.append('removeImage', 'true');
      }

      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formDataToSend
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Close modal and reload data
        if (isEditMode) {
          setShowEditModal(false);
          toast.success('Kiosk type updated successfully!');
        } else {
          setShowCreateModal(false);
          toast.success('Kiosk type created successfully!');
        }
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          isActive: true,
          image: null,
          removeImage: false
        });
        setImageFile(null);
        setImageError('');
        
        // Clear cache to ensure fresh data
        const cacheKey = `theaterKioskTypes_${theaterId}`;
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (e) {
          // Ignore cache clear errors
        }
        
        // Reload kiosk types
        if (loadKioskTypesDataRef.current) {
          loadKioskTypesDataRef.current(currentPage, itemsPerPage, searchTerm, true, true);
        }
      } else {
        throw new Error(data.message || 'Failed to save kiosk type');
      }
    } catch (error) {
      setImageError(error.message);
    }
  }, [theaterId, selectedKioskType, formData, imageFile, currentPage, itemsPerPage, searchTerm]);

  // Handle delete - Memoized
  const handleDeleteKioskType = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(
        `${config.api.baseUrl}/theater-kiosk-types/${theaterId}/${selectedKioskType._id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        }
      );

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Clear cache to ensure fresh data
        const cacheKey = `theaterKioskTypes_${theaterId}`;
        try {
          sessionStorage.removeItem(cacheKey);
        } catch (e) {
          // Ignore cache clear errors
        }
        
        setShowDeleteModal(false);
          toast.success('Kiosk type deleted successfully!');
        setSelectedKioskType(null);
        if (loadKioskTypesDataRef.current) {
          loadKioskTypesDataRef.current(currentPage, itemsPerPage, searchTerm, true, true);
        }
      } else {
        throw new Error(data.message || 'Failed to delete kiosk type');
      }
    } catch (error) {
      showError(error.message);
    }
  }, [theaterId, selectedKioskType, currentPage, itemsPerPage, searchTerm, showError]);

  // Form input handlers - Memoized
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

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
    setFormData(prev => ({
      ...prev,
      image: null,
      removeImage: true
    }));
  }, []);

  const getCurrentImageValue = () => {
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
    if (formData.removeImage) {
      return null;
    }
    return formData.image;
  };

  // Handle create new kiosk type - Memoized
  const handleCreateNewKioskType = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      isActive: true,
      image: null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setShowCreateModal(true);
  }, []);

  // Reset initial load flag when theaterId changes
  useEffect(() => {
    setInitialLoadDone(false);
    setLoading(true);
    lastLoadKeyRef.current = '';
  }, [theaterId]);

  // 🚀 ULTRA-OPTIMIZED: Initial load - INSTANT CACHE FIRST (< 90ms)
  useEffect(() => {
    if (!theaterId) {
      setLoading(false);
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
    // Use the function directly if ref is not set yet
    const loadFunction = loadKioskTypesDataRef.current || loadKioskTypesData;
    
    (async () => {
      try {
        await loadFunction(1, 10, '', false, true);
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
  }, [theaterId, initialLoadDone, loadKioskTypesData]); // Include loadKioskTypesData as fallback

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
      <td><div className="skeleton-image"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  ), []);

  // 🚀 OPTIMIZED: Memoized Kiosk Type Table Row Component
  const KioskTypeRow = React.memo(({ kioskType, index, currentPage, itemsPerPage, onView, onEdit, onDelete }) => {
    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
    
    return (
      <tr className={`theater-row ${!kioskType.isActive ? 'inactive' : ''}`}>
        <td className="sno-cell">{serialNumber}</td>
        <td className="photo-cell">
          {(kioskType.imageUrl || kioskType.image) ? (
            <div className="theater-photo-thumb">
              <InstantImage
                src={kioskType.imageUrl || kioskType.image} 
                alt={kioskType.name || 'Kiosk Type'}
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
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
          )}
        </td>
        <td className="name-cell">
          <div className="qr-info">
            <div className="qr-name">{kioskType.name}</div>
          </div>
        </td>
        <td className="status-cell">
          <span className={`status-badge ${kioskType.isActive ? 'active' : 'inactive'}`}>
            {kioskType.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="actions-cell">
          <ActionButtons>
            <ActionButton 
              type="view"
              onClick={() => onView(kioskType)}
              title="View Details"
            />
            <ActionButton 
              type="edit"
              onClick={() => onEdit(kioskType)}
              title="Edit Kiosk Type"
            />
            <ActionButton 
              type="delete"
              onClick={() => onDelete(kioskType)}
              title="Delete Kiosk Type"
            />
          </ActionButtons>
        </td>
      </tr>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
      prevProps.kioskType._id === nextProps.kioskType._id &&
      prevProps.index === nextProps.index &&
      prevProps.currentPage === nextProps.currentPage &&
      prevProps.itemsPerPage === nextProps.itemsPerPage &&
      prevProps.kioskType.name === nextProps.kioskType.name &&
      prevProps.kioskType.isActive === nextProps.kioskType.isActive &&
      prevProps.kioskType.imageUrl === nextProps.kioskType.imageUrl
    );
  });

  KioskTypeRow.displayName = 'KioskTypeRow';

  // 🚀 OPTIMIZED: Memoized header button to prevent re-renders
  const headerButton = useMemo(() => (
    <button 
      className="header-btn"
      onClick={handleCreateNewKioskType}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Create New Kiosk Type
    </button>
  ), [handleCreateNewKioskType]);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Kiosk Types" currentPage="kiosk-types">
        <PageContainer
          title="Kiosk Type Management"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeKioskTypes || 0}</div>
            <div className="stat-label">Active Kiosk Types</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveKioskTypes || 0}</div>
            <div className="stat-label">Inactive Kiosk Types</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalKioskTypes || 0}</div>
            <div className="stat-label">Total Kiosk Types</div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search kiosk types by name or description..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select
              value="all"
              className="status-filter"
              disabled
            >
              <option value="all">All Status</option>
            </select>
            <div className="results-count">
              Showing {kioskTypes.length} of {totalItems} kiosk types (Page {currentPage} of {totalPages})
            </div>
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
                <th className="photo-cell">Image</th>
                <th className="name-cell">Kiosk Type Name</th>
                <th className="status-cell">Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="loading-cell">
                    <div className="loading-spinner"></div>
                    <span>Loading kiosk types...</span>
                  </td>
                </tr>
              ) : kioskTypes.length > 0 ? (
                kioskTypes.map((kioskType, index) => (
                  <KioskTypeRow
                    key={kioskType._id}
                    kioskType={kioskType}
                    index={index}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onView={viewKioskType}
                    onEdit={editKioskType}
                    onDelete={deleteKioskType}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <i className="fas fa-desktop fa-3x"></i>
                    <h3>No Kiosk Types Found</h3>
                    <p>There are no kiosk types available for management at the moment.</p>
                    <button className="add-theater-btn" onClick={handleCreateNewKioskType}>
                      Create First Kiosk Type
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
            itemType="kiosk types"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Kiosk Type</h2>
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
                    <label>Kiosk Type Name <span style={{color: 'red'}}>*</span></label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter kiosk type name"
                      required
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
                      placeholder="Enter kiosk type description (optional)"
                      rows="3"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Kiosk Type Image</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Kiosk Type Image"
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
                  onClick={() => handleSubmitKioskType(false)}
                  disabled={!formData.name?.trim()}
                >
                  Create Kiosk Type
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
                <h2>Edit Kiosk Type</h2>
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
                    <label>Kiosk Type Name</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter kiosk type name"
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
                      placeholder="Enter kiosk type description (optional)"
                      rows="3"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Kiosk Type Image</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Kiosk Type Image"
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
                  onClick={() => handleSubmitKioskType(true)}
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
                <h2>Kiosk Type Details</h2>
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
                    <label>Kiosk Type Name</label>
                    <input 
                      type="text" 
                      value={selectedKioskType?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={selectedKioskType?.isActive ? 'Active' : 'Inactive'} 
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
                      value={selectedKioskType?.description || ''} 
                      className="form-control"
                      readOnly
                      rows="3"
                    />
                  </div>
                  {(selectedKioskType?.imageUrl || selectedKioskType?.image) && (
                    <div className="form-group full-width">
                      <label>Kiosk Type Image</label>
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <img
                          src={selectedKioskType.imageUrl || selectedKioskType.image}
                          alt={selectedKioskType.name}
                          loading="eager"
                          decoding="async"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            maxHeight: '400px',
                            width: 'auto',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            objectFit: 'contain',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedKioskType?.createdAt ? new Date(selectedKioskType.createdAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={selectedKioskType?.updatedAt ? new Date(selectedKioskType.updatedAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
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
                <p>Are you sure you want to delete the kiosk type <strong>{selectedKioskType?.name}</strong>?</p>
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
                  onClick={handleDeleteKioskType}
                  className="confirm-delete-btn"
                >
                  Delete Kiosk Type
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

TheaterKioskTypes.displayName = 'TheaterKioskTypes';

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

export default TheaterKioskTypes;
