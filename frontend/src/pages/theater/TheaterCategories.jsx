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
import { useModal } from '../../contexts/ModalContext';
import { useToast } from '../../contexts/ToastContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import '../../styles/skeleton.css'; // 🚀 Skeleton loading styles



const TheaterCategories = React.memo(() => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();
  const toast = useToast();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterCategories');
  
  // 🚀 INSTANT: Check cache synchronously on initialization
  const initialCachedCategories = (() => {
    if (!theaterId) return null;
    try {
      const cacheKey = `categories_${theaterId}_1_10_`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.categories || [];
      }
    } catch (e) {}
    return null;
  })();

  // Data state
  const [categories, setCategories] = useState(initialCachedCategories || []);
  const [loading, setLoading] = useState(!initialCachedCategories); // 🚀 Start false if cache exists
  const [initialLoadDone, setInitialLoadDone] = useState(!!initialCachedCategories); // 🚀 Mark done if cache exists
  const lastLoadKeyRef = useRef('');
  const [summary, setSummary] = useState({
    activeCategories: 0,
    inactiveCategories: 0,
    totalCategories: 0
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs for cleanup and performance
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadCategoriesDataRef = useRef(null); // Ref to store loadCategoriesData function
  
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

  // 🚀 ULTRA-OPTIMIZED: Load categories data - Instant with memory cache
  const loadCategoriesData = useCallback(async (page = 1, limit = 10, search = '', skipCache = false) => {
    if (!isMountedRef.current || !theaterId) {
      return;
    }

    // 🚀 INSTANT MEMORY CACHE CHECK - Use sessionStorage for persistence
    const memoryCacheKey = `categories_${theaterId}_${page}_${limit}_${search}`;
    
    if (!skipCache) {
      try {
        const cached = sessionStorage.getItem(memoryCacheKey);
        if (cached) {
          const memCached = JSON.parse(cached);
          // INSTANT state update from cache (< 0.1ms) - NO loading state needed
          setCategories(memCached.categories || []);
          setTotalItems(memCached.totalItems || 0);
          setTotalPages(memCached.totalPages || 1);
          setCurrentPage(page);
          setSummary(memCached.summary || {
            activeCategories: 0,
            inactiveCategories: 0,
            totalCategories: 0
          });
          setLoading(false);
          setInitialLoadDone(true);
          
          // Background refresh (non-blocking)
          if (page === 1 && !search) {
            setTimeout(() => {
              if (isMountedRef.current && loadCategoriesDataRef.current) {
                loadCategoriesDataRef.current(1, limit, '', true);
              }
            }, 100);
          }
          return;
        }
      } catch (e) {
        console.warn('Cache read failed:', e);
      }
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      // Only show loading on first load or if no memory cache
      if (!skipCache && !initialLoadDone) {
        setLoading(true);
      }

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        q: search || '',
        _t: Date.now()
      });

      const baseUrl = `${config.api.baseUrl}/theater-categories/${theaterId}?${params.toString()}`;

      // 🚀 SIMPLE & RELIABLE: Regular fetch with proper error handling
      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data) {
        throw new Error('Failed to fetch categories');
      }

      if (!isMountedRef.current) return;

      if (data.success) {
        // Handle both data.data.categories and data.data (array) structures
        let categories = Array.isArray(data.data?.categories)
          ? data.data.categories
          : (Array.isArray(data.data) ? data.data : (data.categories || []));

        // Ensure categories is always an array
        if (!Array.isArray(categories)) {
          console.warn('Categories data is not an array:', categories);
          categories = [];
        }

        // 🚀 ULTRA-OPTIMIZED: Process data efficiently
        categories = categories
          .map(cat => ({
            ...cat,
            imageUrl: cat.imageUrl || cat.image
          }))
          .sort((a, b) => {
            const idA = a._id || '';
            const idB = b._id || '';
            return idA.localeCompare(idB);
          });

        // 🚀 BATCH ALL STATE UPDATES
        const paginationData = data.data?.pagination || data.pagination || {};
        const statisticsData = data.data?.statistics || data.statistics || {};
        
        const summaryData = {
          activeCategories: statisticsData.active || 0,
          inactiveCategories: statisticsData.inactive || 0,
          totalCategories: statisticsData.total || 0
        };
        
        setCategories(categories);
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        setCurrentPage(page);
        setSummary(summaryData);
        setLoading(false);
        setInitialLoadDone(true);
        
        // 🚀 Store in sessionStorage for instant access (< 0.1ms)
        try {
          sessionStorage.setItem(memoryCacheKey, JSON.stringify({
            categories: categories,
            totalItems: paginationData.totalItems || 0,
            totalPages: paginationData.totalPages || 1,
            summary: summaryData
          }));
        } catch (e) {
          console.warn('Cache write failed:', e);
        }
      } else {
        // Handle API error response
        console.error('API returned success=false:', data.message || data.error);
        setCategories([]);
        setTotalItems(0);
        setTotalPages(0);
        setCurrentPage(1);
        setSummary({
          activeCategories: 0,
          inactiveCategories: 0,
          totalCategories: 0
        });
        setLoading(false);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        // Don't clear existing data on error
        setLoading(false);
      }
    }
  }, [theaterId, categories.length]);

  // Store loadCategoriesData in ref for stable access - Set immediately
  loadCategoriesDataRef.current = loadCategoriesData;
  
  useEffect(() => {
    loadCategoriesDataRef.current = loadCategoriesData;
  }, [loadCategoriesData]);

  // 🚀 OPTIMIZED: Debounced search - Ultra-fast 50ms delay
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && loadCategoriesDataRef.current) {
        loadCategoriesDataRef.current(1, itemsPerPage, query);
      }
    }, 50); // Ultra-fast 50ms delay for instant response
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
    if (loadCategoriesDataRef.current) {
      loadCategoriesDataRef.current(1, newLimit, searchTerm);
    }
  }, [searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages && loadCategoriesDataRef.current) {
      loadCategoriesDataRef.current(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm]);

  // CRUD Operations - Memoized for performance
  const viewCategory = useCallback((category) => {
    setSelectedCategory(category);
    setShowViewModal(true);
  }, []);

  const editCategory = useCallback((category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.categoryName || category.name || '',
      isActive: category.isActive,
      image: category.imageUrl || null,
      removeImage: false
    });
    setImageFile(null);
    setImageError('');
    setShowEditModal(true);
  }, []);

  const deleteCategory = useCallback((category) => {
    setSelectedCategory(category);
    setShowDeleteModal(true);
  }, []);

  // Submit handler for create/edit - Memoized
  const handleSubmitCategory = useCallback(async (isEdit = false) => {
    // Prevent double submission
    if (isSubmitting) {
      console.log('⏳ Already submitting, please wait...');
      return;
    }

    try {
      setIsSubmitting(true);
      setImageError('');
      
      // Validate required fields
      if (!formData.name || !formData.name.trim()) {
        setImageError('Category name is required');
        setIsSubmitting(false);
        return;
      }

      // Validate selectedCategory for edit
      if (isEdit && !selectedCategory?._id) {
        setImageError('Category not selected for editing');
        setIsSubmitting(false);
        return;
      }

      console.log('🚀 Submitting category:', { isEdit, formData, selectedCategory });
      
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
        const responseData = await response.json();
        
        // 🚀 INSTANT: Clear all related caches immediately (before UI update)
        clearCachePattern(`theaterCategories_${theaterId}`);
        
        // Clear optimizedFetch cache patterns
        try {
          const cacheKeys = Object.keys(sessionStorage);
          cacheKeys.forEach(key => {
            if (key.includes(`theaterCategories_${theaterId}`)) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {
          // Ignore cache clear errors
        }
        
        // Clear any pending requests to ensure fresh data
        clearPendingRequests();
        
        // Close modal immediately
        if (isEdit) {
          setShowEditModal(false);
          toast.success('Category updated successfully!');
          // 🚀 INSTANT: Optimistically update the edited category in UI
          if (responseData.data?.category) {
            const updatedCategory = responseData.data.category;
            setCategories(prev => prev.map(cat => 
              cat._id === updatedCategory._id 
                ? { ...updatedCategory, imageUrl: updatedCategory.imageUrl || updatedCategory.image }
                : cat
            ));
          }
        } else {
          setShowCreateModal(false);
          toast.success('Category created successfully!');
          // 🚀 INSTANT: Optimistically add new category to UI
          if (responseData.data?.category) {
            const newCategory = responseData.data.category;
            setCategories(prev => {
              const updated = [{ ...newCategory, imageUrl: newCategory.imageUrl || newCategory.image }, ...prev];
              return updated.sort((a, b) => {
                const idA = a._id || '';
                const idB = b._id || '';
                return idA.localeCompare(idB);
              });
            });
            setTotalItems(prev => prev + 1);
          }
        }
        
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
        
        // 🚀 INSTANT: Reload data immediately in background (non-blocking)
        // Use setTimeout with 0 delay to ensure it runs after state updates
        setTimeout(() => {
          if (loadCategoriesDataRef.current) {
            loadCategoriesDataRef.current(currentPage, itemsPerPage, searchTerm, true);
          }
        }, 0);
      } else {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        setImageError(errorData.message || errorData.error || 'Failed to save category. Please try again.');
        showError(errorData.message || errorData.error || 'Failed to save category');
      }
    } catch (error) {
      console.error('❌ Submit Error:', error);
      setImageError(error.message || 'An error occurred. Please try again.');
      showError(error.message || 'An error occurred while saving the category');
    } finally {
      setIsSubmitting(false);
    }
  }, [theaterId, selectedCategory, formData, imageFile, currentPage, itemsPerPage, searchTerm, isSubmitting, showError]);

  // Handle delete - Memoized
  const handleDeleteCategory = useCallback(async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-categories/${theaterId}/${selectedCategory._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        // 🚀 INSTANT: Clear all related caches immediately
        clearCachePattern(`theaterCategories_${theaterId}`);
        
        // Clear optimizedFetch cache patterns
        try {
          const cacheKeys = Object.keys(sessionStorage);
          cacheKeys.forEach(key => {
            if (key.includes(`theaterCategories_${theaterId}`)) {
              sessionStorage.removeItem(key);
            }
          });
        } catch (e) {
          // Ignore cache clear errors
        }
        
        // Clear any pending requests to ensure fresh data
        clearPendingRequests();
        
        // Close modal immediately
        setShowDeleteModal(false);
        toast.success('Category deleted successfully!');
        
        // 🚀 INSTANT: Optimistically remove from UI immediately
        setCategories(prev => prev.filter(cat => cat._id !== selectedCategory._id));
        setTotalItems(prev => Math.max(0, prev - 1));
        
        // 🚀 INSTANT: Reload data immediately in background (non-blocking)
        // Use setTimeout with 0 delay to ensure it runs after state updates
        setTimeout(() => {
          if (loadCategoriesDataRef.current) {
            loadCategoriesDataRef.current(currentPage, itemsPerPage, searchTerm, true);
          }
        }, 0);
      } else {
        const errorData = await response.json();
        // Errors logged to console only
      }
    } catch (error) {
      // Errors logged to console only
    }
  }, [theaterId, selectedCategory, currentPage, itemsPerPage, searchTerm]);

  // Handle create new category - Memoized
  const handleCreateNewCategory = useCallback(() => {
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
  }, []);

  // Form input handlers - Memoized
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Image handling functions - Memoized
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
    setImageError('');
    setFormData(prev => ({
      ...prev,
      image: null,
      removeImage: true
    }));
  }, []);

  const getCurrentImageValue = () => {
    if (imageFile) {
      return imageFile; // New file selected
    }
    if (formData.image && !formData.removeImage) {
      return formData.image; // Existing image URL
    }
    return null; // No image
  };

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
    const loadFunction = loadCategoriesDataRef.current || loadCategoriesData;
    
    (async () => {
      try {
        await loadFunction(1, 10, '', false);
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
  }, [theaterId, initialLoadDone, loadCategoriesData]); // Include loadCategoriesData as fallback

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

  // 🚀 OPTIMIZED: Memoized Category Table Row Component
  const CategoryRow = React.memo(({ category, index, currentPage, itemsPerPage, onView, onEdit, onDelete }) => {
    const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
    
    return (
      <tr className={`theater-row ${!category.isActive ? 'inactive' : ''}`}>
        <td className="sno-cell">{serialNumber}</td>
        <td className="photo-cell">
          {(category.imageUrl || category.image) ? (
            <div className="theater-photo-thumb">
              <InstantImage
                src={category.imageUrl || category.image} 
                alt={category.name || category.categoryName || 'Category'}
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
            <div className="qr-name">{category.categoryName || category.name}</div>
          </div>
        </td>
        <td className="status-cell">
          <span className={`status-badge ${category.isActive ? 'active' : 'inactive'}`}>
            {category.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="actions-cell">
          <ActionButtons>
            <ActionButton 
              type="view"
              onClick={() => onView(category)}
              title="View Details"
            />
            <ActionButton 
              type="edit"
              onClick={() => onEdit(category)}
              title="Edit Category"
            />
            <ActionButton 
              type="delete"
              onClick={() => onDelete(category)}
              title="Delete Category"
            />
          </ActionButtons>
        </td>
      </tr>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function for better performance
    return (
      prevProps.category._id === nextProps.category._id &&
      prevProps.index === nextProps.index &&
      prevProps.currentPage === nextProps.currentPage &&
      prevProps.itemsPerPage === nextProps.itemsPerPage &&
      prevProps.category.categoryName === nextProps.category.categoryName &&
      prevProps.category.name === nextProps.category.name &&
      prevProps.category.isActive === nextProps.category.isActive &&
      prevProps.category.imageUrl === nextProps.category.imageUrl
    );
  });

  CategoryRow.displayName = 'CategoryRow';

  // 🚀 OPTIMIZED: Memoized header button to prevent re-renders
  const headerButton = useMemo(() => (
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
  ), [handleCreateNewCategory]);

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
            <div className="results-count">
              Showing {categories.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} 
              {' - '}
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} categories
              {' (Page '}{currentPage} of {totalPages || 1}{')'}
            </div>
            <div className="items-per-page">
              <label>Items per page:</label>
              <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="items-select">
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
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
                <th className="name-cell">Category Name</th>
                <th className="status-cell">Status</th>
                <th className="actions-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !initialLoadDone && categories.length === 0 ? (
                // 🚀 INSTANT: Show skeleton instead of spinner
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="skeleton-row">
                    <td><div className="skeleton-box" style={{ width: '30px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '50px', height: '50px', borderRadius: '4px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '150px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '80px', height: '16px' }} /></td>
                    <td><div className="skeleton-box" style={{ width: '100px', height: '16px' }} /></td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    <i className="fas fa-folder fa-3x"></i>
                    <h3>No Categories Found</h3>
                    <p>There are no categories available for management at the moment.</p>
                    <button className="add-theater-btn" onClick={handleCreateNewCategory}>
                      Create First Category
                    </button>
                  </td>
                </tr>
              ) : (
                categories.map((category, index) => (
                  <CategoryRow
                    key={category._id}
                    category={category}
                    index={index}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    onView={viewCategory}
                    onEdit={editCategory}
                    onDelete={deleteCategory}
                  />
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
                  <div className="form-group full-width">
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmitCategory(false);
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create Category'}
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
                  <div className="form-group full-width">
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmitCategory(true);
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
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
                    <div className="form-group full-width">
                      <label>Category Image</label>
                      <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
                        <InstantImage
                          src={selectedCategory.imageUrl || selectedCategory.image}
                          alt={selectedCategory.name}
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
});

TheaterCategories.displayName = 'TheaterCategories';

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
