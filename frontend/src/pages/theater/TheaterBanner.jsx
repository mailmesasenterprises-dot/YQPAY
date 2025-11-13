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
import { optimisticCreate, optimisticUpdate, optimisticDelete, invalidateRelatedCaches } from '../../utils/crudOptimizer';
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



const TheaterBanner = () => {
  const { theaterId} = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal()
  const toast = useToast();;

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
  const loadBannersData = useCallback(async (page = 1, limit = 10, forceRefresh = false) => {
    console.log('🔄 loadBannersData called:', { theaterId, page, limit, forceRefresh, isMounted: isMountedRef.current });
    
    if (!isMountedRef.current || !theaterId) {
      console.warn('⚠️ Skipping load - isMounted:', isMountedRef.current, 'theaterId:', theaterId);
      return;
    }

    const cacheKey = `theaterBanners_${theaterId}_p${page}_l${limit}`;
    
    // Check cache first (skip if force refresh)
    if (!forceRefresh) {
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
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      if (!forceRefresh) {
        const cached = getCachedData(cacheKey, 120000);
        if (!cached) setLoading(true);
      } else {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        _cacheBuster: Date.now()
      });

      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TheaterBanner] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      const baseUrl = `${config.api.baseUrl}/theater-banners/${theaterId}?${params.toString()}`;
      console.log('📡 GET Request:', baseUrl);
      
      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      } else {
        headers['Cache-Control'] = 'no-cache';
      }

      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📦 Response data:', data);
      
      
      if (!isMountedRef.current) return;

      if (data.success) {
        // Handle multiple possible response structures
        let banners = Array.isArray(data.data?.banners)
          ? data.data.banners
          : (Array.isArray(data.data) ? data.data : (Array.isArray(data.banners) ? data.banners : []));

        // Ensure banners is always an array
        if (!Array.isArray(banners)) {
          console.warn('Banners data is not an array:', banners);
          banners = [];
        }
        
        setBanners(banners);
        
        // Batch pagination state updates
        const paginationData = data.data?.pagination || data.pagination || {};
        const totalItemsCount = paginationData.totalItems || 0;
        const totalPagesCount = paginationData.totalPages || 1;
        setTotalItems(totalItemsCount);
        setTotalPages(totalPagesCount);
        setCurrentPage(page);
        
        // Calculate summary statistics
        const statisticsData = data.data?.statistics || data.statistics || {};
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
        // Handle API error response
        console.error('API returned success=false:', data.message || data.error);
        setBanners([]);
        setTotalItems(0);
        setTotalPages(0);
        setCurrentPage(1);
        setSummary({
          activeBanners: 0,
          inactiveBanners: 0,
          totalBanners: 0
        });
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

  // Submit handler for create/edit with OPTIMISTIC UPDATES
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

      const apiCall = () => fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formDataToSend,
      });

      if (isEdit) {
        // 🚀 OPTIMISTIC UPDATE - Update UI immediately
        await optimisticUpdate({
          apiCall,
          itemId: selectedBanner._id,
          updates: {
            isActive: formData.isActive,
            imageUrl: imageFile ? URL.createObjectURL(imageFile) : selectedBanner.imageUrl,
            updatedAt: new Date().toISOString()
          },
          onOptimisticUpdate: (id, updates) => {
            const previousBanner = banners.find(b => b._id === id);
            setBanners(prev => prev.map(b => 
              b._id === id ? { ...b, ...updates, _updating: true } : b
            ));
            return previousBanner;
          },
          onSuccess: (realItem) => {
            setBanners(prev => prev.map(b => 
              b._id === selectedBanner._id ? { ...realItem, _updating: false } : b
            ));
            setShowEditModal(false);
          toast.success('Banner updated successfully!');
            console.log('✅ Banner updated successfully');
            // Force refresh to get latest data
            loadBannersData(currentPage, itemsPerPage, true);
          },
          onError: (error, previousState) => {
            if (previousState) {
              setBanners(prev => prev.map(b => 
                b._id === selectedBanner._id ? previousState : b
              ));
            }
            setImageError(error.message || 'Failed to update banner');
          },
          cachePatterns: [`theaterBanners_${theaterId}`]
        });
      } else {
        // 🚀 OPTIMISTIC CREATE - Add to UI immediately
        await optimisticCreate({
          apiCall,
          tempItem: {
            imageUrl: imageFile ? URL.createObjectURL(imageFile) : '',
            isActive: formData.isActive,
            sortOrder: banners.length,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          onOptimisticUpdate: (optimisticItem) => {
            setBanners(prev => [...prev, optimisticItem]);
            setTotalItems(prev => prev + 1);
          },
          onSuccess: (realItem, tempId) => {
            setBanners(prev => prev.map(b => 
              b._id === tempId ? realItem : b
            ));
            setShowCreateModal(false);
          toast.success('Banner created successfully!');
            console.log('✅ Banner created successfully');
            // Force refresh to get latest data
            loadBannersData(currentPage, itemsPerPage, true);
          },
          onError: (error) => {
            setBanners(prev => prev.filter(b => !b._optimistic));
            setTotalItems(prev => prev - 1);
            setImageError(error.message || 'Failed to create banner');
          },
          cachePatterns: [`theaterBanners_${theaterId}`]
        });
      }
      
      // Reset form
      setFormData({
        isActive: true,
        image: null,
        removeImage: false
      });
      setImageFile(null);
      setImageError('');
      setSelectedBanner(null);
      
    } catch (error) {
      console.error('Banner operation error:', error);
      // Error already handled in optimistic functions
    }
  };

  const handleDeleteBanner = async () => {
    try {
      const bannerId = selectedBanner._id;
      const apiCall = () => fetch(`${config.api.baseUrl}/theater-banners/${theaterId}/${bannerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      // 🚀 OPTIMISTIC DELETE - Remove from UI immediately
      await optimisticDelete({
        apiCall,
        itemId: bannerId,
        onOptimisticUpdate: (id) => {
          const removedBanner = banners.find(b => b._id === id);
          setBanners(prev => prev.filter(b => b._id !== id));
          setTotalItems(prev => prev - 1);
          return removedBanner;
        },
        onSuccess: () => {
          setShowDeleteModal(false);
          toast.success('Banner deleted successfully!');
          console.log('✅ Banner deleted successfully');
          // Force refresh to get latest data
          loadBannersData(currentPage, itemsPerPage, true);
        },
        onError: (error, removedBanner) => {
          if (removedBanner) {
            setBanners(prev => [...prev, removedBanner]);
            setTotalItems(prev => prev + 1);
          }
          showError(error.message || 'Failed to delete banner');
        },
        cachePatterns: [`theaterBanners_${theaterId}`]
      });
      
    } catch (error) {
      console.error('Delete banner error:', error);
      // Error already handled in optimistic function
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
      loadBannersData(1, 10, true);
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
        <div className="theater-table-container">
          <table className="theater-table">
            <thead>
              <tr>
                <th className="sno-cell">S.No</th>
                <th className="photo-cell">Image</th>
                <th className="status-cell">Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="loading-cell">
                    <div className="loading-spinner"></div>
                    <span>Loading banners...</span>
                  </td>
                </tr>
              ) : banners.length > 0 ? (
                banners.map((banner, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={banner._id} className={`theater-row ${!banner.isActive ? 'inactive' : ''}`}>
                      <td className="sno-cell">{serialNumber}</td>
                      <td className="photo-cell">
                        {banner.imageUrl ? (
                          <div className="theater-photo-thumb" style={{width: '80px', height: '40px'}}>
                            <InstantImage 
                              src={banner.imageUrl} 
                              alt={`Banner ${serialNumber}`}
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
                          <div className="theater-photo-thumb no-photo" style={{width: '80px', height: '40px'}}>
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px'}}>
                              <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-9-1l2.5-3.21 1.79 2.15 2.5-3.22L21 19H3l3-3.86z"/>
                            </svg>
                          </div>
                        )}
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${banner.isActive ? 'active' : 'inactive'}`}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <ActionButtons>
                          <ActionButton 
                            type="view"
                            onClick={() => viewBanner(banner)}
                            title="View Details"
                          />
                          <ActionButton 
                            type="edit"
                            onClick={() => editBanner(banner)}
                            title="Edit Banner"
                          />
                          <ActionButton 
                            type="delete"
                            onClick={() => deleteBanner(banner)}
                            title="Delete Banner"
                          />
                        </ActionButtons>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    <i className="fas fa-image fa-3x"></i>
                    <h3>No Banners Found</h3>
                    <p>There are no banners available for management at the moment.</p>
                    <button 
                      className="add-theater-btn" 
                      onClick={handleCreateNewBanner}
                    >
                      Create First Banner
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
                  <div className="form-group full-width">
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
                  onClick={() => handleSubmitBanner(false)}
                >
                  Create Banner
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
                  <div className="form-group full-width">
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
                  onClick={() => handleSubmitBanner(true)}
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
                    <div className="form-group full-width">
                      <label>Banner Image</label>
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <InstantImage
                          src={selectedBanner.imageUrl}
                          alt="Banner"
                          loading="eager"
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
