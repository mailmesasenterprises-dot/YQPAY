import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import InstantImage from '../../components/InstantImage'; // 🚀 Instant image loading
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { getCachedData, setCachedData, clearCachePattern } from '../../utils/cacheUtils';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

const TheaterCategories = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterCategories');
  
  // ⚡ INSTANT LOAD: Check cache synchronously before first render
  const initialCache = useMemo(() => {
    if (theaterId) {
      const cacheKey = `theaterCategoriesPage_${theaterId}_p1_l10_s`;
      return getCachedData(cacheKey, 120000);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterId]); // Only depend on theaterId
  
  // Data state - Initialize with cache if available
  const [categories, setCategories] = useState(initialCache?.categories || []);
  const [loading, setLoading] = useState(!initialCache);
  const [summary, setSummary] = useState(initialCache?.summary || {
    activeCategories: 0,
    inactiveCategories: 0,
    totalCategories: 0
  });

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(initialCache?.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(initialCache?.totalItems || 0);
  const [totalPages, setTotalPages] = useState(initialCache?.totalPages || 0);

  // Modal states  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
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

  // Load categories data
  const loadCategoriesData = useCallback(async (page = 1, limit = 10, search = '') => {
    console.log('🔄 [loadCategoriesData] Called with:', { page, limit, search, theaterId, isMounted: isMountedRef.current });
    
    if (!isMountedRef.current || !theaterId) {
      console.log('❌ [loadCategoriesData] Skipped - not mounted or no theaterId');
      return;
    }

    const cacheKey = `theaterCategoriesPage_${theaterId}_p${page}_l${limit}_s${search}`;
    
    // ⚡ PERFORMANCE FIX: Show cached data immediately - NO DELAY!
    const cached = getCachedData(cacheKey, 120000); // 2-minute cache
    if (cached && isMountedRef.current) {
      console.log('⚡ [TheaterCategories] Loading from cache - INSTANT display');
      // Update UI immediately - no transition delay
      setCategories(cached.categories);
      setTotalItems(cached.totalItems);
      setTotalPages(cached.totalPages);
      setCurrentPage(page);
      setSummary(cached.summary);
      setLoading(false);
      
      // Don't fetch fresh data if we have recent cache
      return;
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
        q: search
      });

      const baseUrl = `${config.api.baseUrl}/theater-categories/${theaterId}?${params.toString()}`;
      console.log('📡 [loadCategoriesData] Fetching from:', baseUrl);

      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ [loadCategoriesData] Response data:', data);
      
      if (!isMountedRef.current) return;

      if (data.success) {
        const categories = data.data?.categories || [];
        
        // Sort categories by _id in ascending order
        const sortedCategories = categories.sort((a, b) => {
          const idA = a._id || '';
          const idB = b._id || '';
          return idA.localeCompare(idB);
        });
        
        // Batch pagination state updates
        const paginationData = data.data?.pagination || {};
        const totalItemsCount = paginationData.totalItems || 0;
        const totalPagesCount = paginationData.totalPages || 1;
        
        // Calculate summary statistics
        const statisticsData = data.data?.statistics || {};
        const summaryData = {
          activeCategories: statisticsData.active || 0,
          inactiveCategories: statisticsData.inactive || 0,
          totalCategories: statisticsData.total || 0
        };

        // ⚡ Update UI with fresh data
        setCategories(sortedCategories);
        setTotalItems(totalItemsCount);
        setTotalPages(totalPagesCount);
        setCurrentPage(page);
        setSummary(summaryData);

        // Cache the fresh data for next time
        setCachedData(cacheKey, {
          categories: sortedCategories,
          totalItems: totalItemsCount,
          totalPages: totalPagesCount,
          summary: summaryData
        });
      } else {
        throw new Error(data.message || 'Failed to load categories');
      }
    } catch (error) {
      console.error('❌ [loadCategoriesData] Error:', error);
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Removed error modal - just show empty state
        setCategories([]);
        setSummary({ activeCategories: 0, inactiveCategories: 0, totalCategories: 0 });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, showError]);

  // Debounced search functionality
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadCategoriesData(1, itemsPerPage, query); // Reset to first page
    }, 500);
  }, [itemsPerPage, loadCategoriesData]);

  // Search handler
  const handleSearch = useCallback((e) => {
    const query = e.target.value;
    setSearchTerm(query);
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Pagination handlers
  const handleItemsPerPageChange = useCallback((e) => {
    const newLimit = parseInt(e.target.value);
    setItemsPerPage(newLimit);
    loadCategoriesData(1, newLimit, searchTerm);
  }, [loadCategoriesData, searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadCategoriesData(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm, loadCategoriesData]);

  // CRUD Operations
  const viewCategory = (category) => {
    setSelectedCategory(category);
    setShowViewModal(true);
  };

  const editCategory = (category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.categoryName || category.name || '',  // Backend now uses 'categoryName'
      isActive: category.isActive,
      image: category.imageUrl || null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setShowEditModal(true);
  };

  const deleteCategory = (category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  // Submit handler for create/edit
  const handleSubmitCategory = async (isEdit = false) => {
    try {
      setImageError('');
      
      // Validate required fields
      if (!formData.name || !formData.name.trim()) {
        setImageError('Category name is required');
        return;
      }
      
      const url = isEdit 
        ? `${config.api.baseUrl}/theater-categories/${theaterId}/${selectedCategory._id}` 
        : `${config.api.baseUrl}/theater-categories/${theaterId}`;
      const method = isEdit ? 'PUT' : 'POST';
      

      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('categoryName', formData.name);  // Backend expects 'categoryName'
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
        loadCategoriesData(currentPage, itemsPerPage, searchTerm); // Refresh the list
        
        // Reset form
        setFormData({
          name: '',
          isActive: true,
          image: null,
          removeImage: false
        });
        setImageFile(null);
        setImageError('');
        setSelectedCategory(null);
      } else {
        const errorData = await response.json();

        // Removed error modal - errors logged to console only
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    }
  };

  const handleDeleteCategory = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-categories/${theaterId}/${selectedCategory._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        loadCategoriesData(currentPage, itemsPerPage, searchTerm); // Refresh the list
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {
      // Removed error modal - errors logged to console only
    }
  };

  const handleCreateNewCategory = () => {
    setFormData({
      name: '',
      isActive: true,
      image: null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setSelectedCategory(null);
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

  // Initial load - Only depend on theaterId to prevent unnecessary re-renders
  useEffect(() => {
    if (theaterId) {
      loadCategoriesData(1, 10, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theaterId]);

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
    </tr>
  ), []);

  // Header button (matching QR Names structure)
  const headerButton = (
    <button 
      className="header-btn"
      onClick={handleCreateNewCategory}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Create New Category
    </button>
  );

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Categories" currentPage="categories">
        <PageContainer
          title="Category Management"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeCategories || 0}</div>
            <div className="stat-label">Active Categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveCategories || 0}</div>
            <div className="stat-label">Inactive Categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalCategories || 0}</div>
            <div className="stat-label">Total Categories</div>
          </div>
        </div>

        {/* Enhanced Filters Section matching TheaterList */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search categories by name..."
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
              Showing {categories.length} of {totalItems} categories (Page {currentPage} of {totalPages})
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
                <th style={{textAlign: 'center'}}>Category Name</th>
                <th style={{textAlign: 'center'}}>Status</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : categories.length > 0 ? (
                categories.map((category, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={category._id}>
                      <td style={{textAlign: 'center'}}>{serialNumber}</td>
                      <td style={{textAlign: 'center'}}>
                        <div className="category-image" style={{display: 'flex', justifyContent: 'center'}}>
                          {(category.imageUrl || category.image) ? (
                            <InstantImage
                              src={category.imageUrl || category.image} 
                              alt={category.name || category.categoryName || 'Category'}
                              loading="eager"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '2px solid #e0e0e0',
                                imageRendering: 'auto'
                              }}
                              onError={(e) => {

                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div 
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: '#f5f5f5',
                              display: (category.imageUrl || category.image) ? 'none' : 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px solid #e0e0e0'
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="#ccc" style={{width: '24px', height: '24px'}}>
                              <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
                            </svg>
                          </div>
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="qr-info" style={{textAlign: 'center'}}>
                          <div className="qr-name">{category.categoryName || category.name}</div>
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${category.isActive ? 'active' : 'inactive'}`}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="action-buttons" style={{justifyContent: 'center'}}>
                          <button 
                            className="action-btn view-btn"
                            onClick={() => viewCategory(category)}
                            title="View Details"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => editCategory(category)}
                            title="Edit Category"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => deleteCategory(category)}
                            title="Delete Category"
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
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
                      </svg>
                      <p>No categories found</p>
                      <button 
                        className="btn-primary" 
                        onClick={handleCreateNewCategory}
                      >
                        Create Your First Category
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
            itemType="categories"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Category</h2>
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
                    <label>Category Name</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter category name"
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
                    <label>Category Image</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Category Image"
                      helperText="Drag and drop an image here, or click to select (optional)"
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
                    onClick={() => handleSubmitCategory(false)}
                  >
                    Create Category
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
                <h2>Edit Category</h2>
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
                    <label>Category Name</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter category name"
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
                    <label>Category Image</label>
                    <ImageUpload
                      value={getCurrentImageValue()}
                      onChange={handleImageSelect}
                      onRemove={handleImageRemove}
                      error={imageError}
                      label="Upload Category Image"
                      helperText="Drag and drop an image here, or click to select (optional)"
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
                    onClick={() => handleSubmitCategory(true)}
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
                <h2>Category Details</h2>
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
                    <label>Category Name</label>
                    <input 
                      type="text" 
                      value={selectedCategory?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={selectedCategory?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      disabled
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  {(selectedCategory?.imageUrl || selectedCategory?.image) && (
                    <div className="form-group">
                      <label>Category Image</label>
                      <div style={{ marginTop: '8px' }}>
                        <InstantImage
                          src={selectedCategory.imageUrl || selectedCategory.image}
                          alt={selectedCategory.name}
                          loading="eager"
                          style={{
                            maxWidth: '100%',
                            height: 'auto',
                            maxHeight: '200px',
                            borderRadius: '8px',
                            border: '2px solid #e0e0e0',
                            objectFit: 'cover',
                            imageRendering: 'auto'
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
                      value={selectedCategory?.createdAt ? new Date(selectedCategory.createdAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={selectedCategory?.updatedAt ? new Date(selectedCategory.updatedAt).toLocaleString() : ''} 
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
                <p>Are you sure you want to delete the category <strong>{selectedCategory?.name}</strong>?</p>
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
                  onClick={handleDeleteCategory}
                  className="confirm-delete-btn"
                >
                  Delete Category
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

export default TheaterCategories;
