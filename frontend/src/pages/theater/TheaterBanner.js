import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import InstantImage from '../../components/InstantImage';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getCachedData, setCachedData, clearCachePattern } from '../../utils/cacheUtils';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

const TheaterBanner = () => {
  const { theaterId} = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterBanner');
  
  // Data state
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    activeBanners: 0,
    inactiveBanners: 0,
    totalBanners: 0
  });

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
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [formData, setFormData] = useState({
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
  
  // Ensure mounted ref is set on component mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Validate theater access - removed client-side check, backend handles access control
  // useEffect(() => {
  //   if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
  //     showError('Access denied: You can only manage categories for your assigned theater');
  //     return;
  //   }
  // }, [theaterId, userTheaterId, userType, showError]);

  // Load banners data with caching
  const loadBannersData = useCallback(async (page = 1, limit = 10) => {
    console.log('🔄 loadBannersData called:', { theaterId, page, limit, isMounted: isMountedRef.current });
    
    if (!isMountedRef.current || !theaterId) {
      console.warn('⚠️ Skipping load - isMounted:', isMountedRef.current, 'theaterId:', theaterId);
      return;
    }

    const cacheKey = `theaterBanners_${theaterId}_p${page}_l${limit}`;
    
    // Check cache first
    const cached = getCachedData(cacheKey, 120000); // 2-minute cache
    if (cached && isMountedRef.current) {
      console.log('⚡ [TheaterBanner] Loading from cache');
      setBanners(cached.banners);
      setTotalItems(cached.totalItems);
      setTotalPages(cached.totalPages);
      setCurrentPage(page);
      setSummary(cached.summary);
      setLoading(false);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      if (!cached) setLoading(true);

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        _cacheBuster: Date.now()
      });

      const baseUrl = `${config.api.baseUrl}/theater-banners/${theaterId}?${params.toString()}`;
      console.log('📡 GET Request:', baseUrl);
      

      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Response data:', data);
      
      
      if (!isMountedRef.current) return;

      if (data.success) {
        const banners = data.data?.banners || [];
        
        setBanners(banners);
        
        // Batch pagination state updates
        const paginationData = data.data?.pagination || {};
        const totalItemsCount = paginationData.totalItems || 0;
        const totalPagesCount = paginationData.totalPages || 1;
        setTotalItems(totalItemsCount);
        setTotalPages(totalPagesCount);
        setCurrentPage(page);
        
        // Calculate summary statistics
        const statisticsData = data.data?.statistics || {};
        const summary = {
          activeBanners: statisticsData.active || 0,
          inactiveBanners: statisticsData.inactive || 0,
          totalBanners: statisticsData.total || 0
        };

        setSummary(summary);
        
        // Cache the data
        setCachedData(cacheKey, {
          banners,
          totalItems: totalItemsCount,
          totalPages: totalPagesCount,
          summary
        });
      } else {
        throw new Error(data.message || 'Failed to load banners');
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Removed error modal - just show empty state
        setBanners([]);
        setSummary({ activeBanners: 0, inactiveBanners: 0, totalBanners: 0 });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, showError]);

  // Pagination handlers
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    loadBannersData(1, newLimit);
  }, [loadBannersData]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadBannersData(newPage, itemsPerPage);
    }
  }, [totalPages, itemsPerPage, loadBannersData]);

  // CRUD Operations
  const viewBanner = (banner) => {
    setSelectedBanner(banner);
    setShowViewModal(true);
  };

  const editBanner = (banner) => {
    setSelectedBanner(banner);
    setFormData({
      isActive: banner.isActive,
      image: banner.imageUrl || null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setShowEditModal(true);
  };

  const deleteBanner = (banner) => {
    setSelectedBanner(banner);
    setShowDeleteModal(true);
  };

  // Submit handler for create/edit
  const handleSubmitBanner = async (isEdit = false) => {
    try {
      setImageError('');
      
      // Validate required fields for create
      if (!isEdit && !imageFile) {
        setImageError('Banner image is required');
        return;
      }
      
      const url = isEdit 
        ? `${config.api.baseUrl}/theater-banners/${theaterId}/${selectedBanner._id}` 
        : `${config.api.baseUrl}/theater-banners/${theaterId}`;
      const method = isEdit ? 'PUT' : 'POST';
      

      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('isActive', formData.isActive);
      
      // Add image file if selected
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }
      
      // Add remove image flag for edit operations
      if (isEdit && formData.removeImage) {
        formDataToSend.append('removeImage', 'true');
      }
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          // Note: Don't set Content-Type header when using FormData
        },
        body: formDataToSend,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (isEdit) {
          setShowEditModal(false);
        } else {
          setShowCreateModal(false);
        }
        loadBannersData(currentPage, itemsPerPage); // Refresh the list
        
        // Reset form
        setFormData({
          isActive: true,
          image: null,
          removeImage: false
        });
        setImageFile(null);
        setImageError('');
        setSelectedBanner(null);
      } else {
        const errorData = await response.json();

        // Removed error modal - errors logged to console only
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    }
  };

  const handleDeleteBanner = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-banners/${theaterId}/${selectedBanner._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        clearCachePattern(`theaterBanners_${theaterId}`); // Clear banner caches
        loadBannersData(currentPage, itemsPerPage); // Refresh the list
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {
      // Removed error modal - errors logged to console only
    }
  };

  const handleCreateNewBanner = () => {
    setFormData({
      isActive: true,
      image: null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setSelectedBanner(null);
    setShowCreateModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Image handling functions
  const handleImageSelect = (file) => {
    setImageFile(file);
    setImageError('');
    setFormData(prev => ({
      ...prev,
      removeImage: false
    }));
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImageError('');
    setFormData(prev => ({
      ...prev,
      image: null,
      removeImage: true
    }));
  };

  const getCurrentImageValue = () => {
    if (imageFile) {
      return imageFile; // New file selected
    }
    if (formData.image && !formData.removeImage) {
      return formData.image; // Existing image URL
    }
    return null; // No image
  };

  // Initial load
  useEffect(() => {
    if (theaterId) {
      loadBannersData(1, 10);
    }
  }, [theaterId, loadBannersData]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
    </tr>
  ), []);

  // Header button
  const headerButton = (
    <button 
      className="header-btn"
      onClick={handleCreateNewBanner}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Create New Banner
    </button>
  );

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Banners" currentPage="banner">
        <PageContainer
          title="Banner Management"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeBanners || 0}</div>
            <div className="stat-label">Active Banners</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveBanners || 0}</div>
            <div className="stat-label">Inactive Banners</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalBanners || 0}</div>
            <div className="stat-label">Total Banners</div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="theater-filters">
          <div className="filter-controls">
            <div className="results-count">
              Showing {banners.length} of {totalItems} banners (Page {currentPage} of {totalPages})
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
        <div className="page-table-container">
          <table className="qr-management-table">
            <thead>
              <tr>
                <th style={{textAlign: 'center'}}>S.No</th>
                <th style={{textAlign: 'center'}}>Image</th>
                <th style={{textAlign: 'center'}}>Status</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : banners.length > 0 ? (
                banners.map((banner, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={banner._id}>
                      <td style={{textAlign: 'center'}}>{serialNumber}</td>
                      <td style={{textAlign: 'center'}}>
                        <div className="category-image" style={{display: 'flex', justifyContent: 'center'}}>
                          {banner.imageUrl ? (
                            <div style={{position: 'relative', width: '80px', height: '40px'}}>
                              <InstantImage 
                                src={banner.imageUrl} 
                                alt={`Banner ${serialNumber}`}
                                loading="eager"
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '8px',
                                  objectFit: 'cover',
                                  border: '2px solid #e0e0e0',
                                  imageRendering: 'auto'
                                }}
                                onError={(e) => {
                                  // Show placeholder if image fails to load
                                  e.target.style.display = 'none';
                                  const placeholder = e.target.parentElement.querySelector('.img-placeholder');
                                  if (placeholder) {
                                    placeholder.style.display = 'flex';
                                  }
                                }}
                              />
                              <div 
                                className="img-placeholder"
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  borderRadius: '8px',
                                  backgroundColor: '#f5f5f5',
                                  display: 'none',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '2px solid #e0e0e0'
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="#9c27b0" style={{width: '24px', height: '24px'}}>
                                  <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-1l2.5-3.21 1.79 2.15 2.5-3.22L21 19H3l3-3.86z"/>
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <div 
                              style={{
                                width: '80px',
                                height: '40px',
                                borderRadius: '8px',
                                backgroundColor: '#f5f5f5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid #e0e0e0'
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="#ccc" style={{width: '24px', height: '24px'}}>
                                <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-1l2.5-3.21 1.79 2.15 2.5-3.22L21 19H3l3-3.86z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${banner.isActive ? 'active' : 'inactive'}`}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="action-buttons" style={{justifyContent: 'center'}}>
                          <button 
                            className="action-btn view-btn"
                            onClick={() => viewBanner(banner)}
                            title="View Details"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => editBanner(banner)}
                            title="Edit Banner"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => deleteBanner(banner)}
                            title="Delete Banner"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-1l2.5-3.21 1.79 2.15 2.5-3.22L21 19H3l3-3.86z"/>
                      </svg>
                      <p>No banners found</p>
                      <button 
                        className="btn-primary" 
                        onClick={handleCreateNewBanner}
                      >
                        Create Your First Banner
                      </button>
                    </div>
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
            itemType="banners"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Banner</h2>
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
                    <label>Banner Image (Required)</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Banner Image"
                      helperText="Drag and drop an image here, or click to select (required)"
                      style={{ marginTop: '8px' }}
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={() => handleSubmitBanner(false)}
                  >
                    Create Banner
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Banner</h2>
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
                    <label>Banner Image</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Banner Image"
                      helperText="Drag and drop an image here, or click to select (optional - leave empty to keep existing)"
                      style={{ marginTop: '8px' }}
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={() => handleSubmitBanner(true)}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Modal */}
        {showViewModal && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Banner Details</h2>
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
                    <label>Status</label>
                    <select 
                      value={selectedBanner?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      disabled
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  {selectedBanner?.imageUrl && (
                    <div className="form-group">
                      <label>Banner Image</label>
                      <div style={{ marginTop: '8px' }}>
                        <InstantImage
                          src={selectedBanner.imageUrl}
                          alt="Banner"
                          loading="eager"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            maxHeight: '300px',
                            borderRadius: '8px',
                            border: '2px solid #e0e0e0',
                            objectFit: 'cover',
                            imageRendering: 'auto'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedBanner?.createdAt ? new Date(selectedBanner.createdAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={selectedBanner?.updatedAt ? new Date(selectedBanner.updatedAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="btn-primary" 
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
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
                <p>Are you sure you want to delete this banner?</p>
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
                  onClick={handleDeleteBanner}
                  className="confirm-delete-btn"
                >
                  Delete Banner
                </button>
              </div>
            </div>
          </div>
        )}

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterBanner;
