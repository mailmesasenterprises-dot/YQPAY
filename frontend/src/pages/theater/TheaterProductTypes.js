import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

const TheaterProductTypes = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterProductTypes');
  
  // Data state
  const [productTypes, setProductTypes] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState('');

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

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
      console.error('Theater access denied: User can only access their own theater');
      // Removed error modal - access denied logged to console only
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load product types data
  const loadProductTypesData = useCallback(async (page = 1, limit = 10, search = '') => {
    console.log('🔥 DEBUGGING: loadProductTypesData called with params:', { theaterId, page, limit, search });
    
    if (!isMountedRef.current || !theaterId) {
      console.log('🔥 DEBUGGING: Component not mounted or no theaterId, returning');
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page,
        limit: limit,
        q: search,
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      const baseUrl = `${config.api.baseUrl}/theater-product-types/${theaterId}?${params.toString()}`;
      
      console.log('🔥 DEBUGGING: Fetching from', baseUrl);
      
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
      
      console.log('🔥 DEBUGGING: Response status', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🔥 DEBUGGING: Raw API response', data);
      
      if (!isMountedRef.current) return;

      if (data.success) {
        let productTypes = data.data || [];
        console.log('🔥 DEBUGGING: Product types extracted', productTypes);
        console.log('🔥 DEBUGGING: Product types count', productTypes.length);
        
        // Sort by _id ascending (important: match Category page behavior)
        productTypes = productTypes.sort((a, b) => a._id.localeCompare(b._id));
        console.log('🔥 DEBUGGING: Product types sorted by _id ascending');
        
        setProductTypes(productTypes);
        
        // Batch pagination state updates
        const paginationData = data.pagination || {};
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        setCurrentPage(page);
        
        // Calculate summary statistics
        const statisticsData = data.statistics || {};
        const summary = {
          activeProductTypes: statisticsData.active || 0,
          inactiveProductTypes: statisticsData.inactive || 0,
          totalProductTypes: statisticsData.total || 0
        };
        console.log('🔥 DEBUGGING: Setting summary', summary);
        setSummary(summary);
      } else {
        throw new Error(data.message || 'Failed to load product types');
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        console.error('🔥 DEBUGGING: ERROR loading product types:', error);
        console.error('🔥 DEBUGGING: ERROR stack:', error.stack);
        // Removed error modal - just show empty state
        setProductTypes([]);
        setSummary({ activeProductTypes: 0, inactiveProductTypes: 0, totalProductTypes: 0 });
      }
    } finally{
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
      loadProductTypesData(1, itemsPerPage, query); // Reset to first page
    }, 500);
  }, [itemsPerPage, loadProductTypesData]);

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
    loadProductTypesData(1, newLimit, searchTerm);
  }, [loadProductTypesData, searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadProductTypesData(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm, loadProductTypesData]);

  // CRUD Operations
  const viewProductType = (productType) => {
    setSelectedProductType(productType);
    setShowViewModal(true);
  };

  const editProductType = (productType) => {
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
    if (productType.imageUrl) {
      setImagePreview(productType.imageUrl);
    } else {
      setImagePreview(null);
    }
    setSelectedImage(null); // Reset selected image for upload
    
    setShowEditModal(true);
  };

  const deleteProductType = (productType) => {
    setSelectedProductType(productType);
    setShowDeleteModal(true);
  };

  // Submit handler for create/edit
  const handleSubmitProductType = async (isEdit = false) => {
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
      if (selectedImage) {
        formDataToSend.append('image', selectedImage);
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
        if (isEdit) {
          setShowEditModal(false);
        } else {
          setShowCreateModal(false);
        }
        loadProductTypesData(currentPage, itemsPerPage, searchTerm); // Refresh the list
        
        // Reset form
        setFormData({
          productName: '',
          productCode: '',
          description: '',
          quantity: '',
          isActive: true
        });
        setSelectedImage(null);
        setImagePreview(null);
        setSelectedProductType(null);
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {
      console.error('Error saving product type:', error);
      // Removed error modal - errors logged to console only
    }
  };

  const handleDeleteProductType = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/theater-product-types/${theaterId}/${selectedProductType._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        loadProductTypesData(currentPage, itemsPerPage, searchTerm); // Refresh the list
      } else {
        const errorData = await response.json();
        // Removed error modal - errors logged to console only
      }
    } catch (error) {
      console.error('Error deleting product type:', error);
      // Removed error modal - errors logged to console only
    }
  };

  const handleCreateNewProductType = () => {
    setFormData({
      productName: '',
      productCode: '',
      description: '',
      quantity: '',
      isActive: true,
      imageUrl: null,
      removeImage: false
    });
    setSelectedImage(null);
    setImagePreview(null);
    setImageFile(null);
    setImageError('');
    setSelectedProductType(null);
    setShowCreateModal(true);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Image handling functions (matching TheaterCategories pattern)
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
    setSelectedImage(null);
    setImagePreview(null);
    setImageError('');
    setFormData(prev => ({
      ...prev,
      imageUrl: null,
      removeImage: true
    }));
    console.log('🗑️ Image removed');
  };

  // Initial load
  useEffect(() => {
    if (theaterId) {
      console.log('🔥 DEBUGGING: Component mounted, calling loadProductTypesData directly');
      loadProductTypesData(1, 10, '');
    }
  }, [theaterId, loadProductTypesData]);

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

  // Header button (matching QR Names structure)
  const headerButton = (
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
  );

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
              placeholder="Search product names by name, code or description..."
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
              Showing {productTypes.length} of {totalItems} product names (Page {currentPage} of {totalPages})
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
          <table className="qr-management-table product-types-table">
            <thead>
              <tr>
                <th style={{textAlign: 'center'}}>S.No</th>
                <th style={{textAlign: 'center'}}>Image</th>
                <th style={{textAlign: 'center'}}>Product Name</th>
                <th style={{textAlign: 'center'}}>Product Code / SKU</th>
                <th style={{textAlign: 'center'}}>Quantity</th>
                <th style={{textAlign: 'center'}}>Status</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : productTypes.length > 0 ? (
                productTypes.map((productType, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={productType._id}>
                      <td style={{textAlign: 'center'}}>{serialNumber}</td>
                      <td style={{textAlign: 'center'}}>
                        <div className="category-image">
                          {(productType.imageUrl || productType.image) ? (
                            <img 
                              src={productType.imageUrl || productType.image} 
                              alt={productType.productName}
                              loading="eager"
                              decoding="async"
                              width="40"
                              height="40"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '2px solid #e0e0e0',
                                imageRendering: 'auto'
                              }}
                              onError={(e) => {
                                console.log('Image load error for:', productType.productName, productType.imageUrl || productType.image);
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
                              display: (productType.imageUrl || productType.image) ? 'none' : 'flex',
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
                        <div className="qr-info">
                          <div className="qr-name">{productType.productName}</div>
                          {productType.description && (
                            <div className="qr-description">{productType.description}</div>
                          )}
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="qr-code">{productType.productCode}</div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="quantity-display">
                          <span className="quantity-value">{productType.quantity || 'Not set'}</span>
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${productType.isActive ? 'active' : 'inactive'}`}>
                          {productType.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <ActionButtons>
                          <ActionButton 
                            type="view"
                            onClick={() => viewProductType(productType)}
                            title="View Details"
                          />
                          <ActionButton 
                            type="edit"
                            onClick={() => editProductType(productType)}
                            title="Edit Product Type"
                          />
                          <ActionButton 
                            type="delete"
                            onClick={() => deleteProductType(productType)}
                            title="Delete Product Type"
                          />
                        </ActionButtons>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V5h10v6z"/>
                      </svg>
                      <p>No product types found</p>
                      <button 
                        className="btn-primary" 
                        onClick={handleCreateNewProductType}
                      >
                        Create Your First Product Type
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
                    <label>Description</label>
                    <textarea 
                      value={formData.description || ''} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter product type description (optional)"
                      rows="3"
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
                  {selectedProductType?.imageUrl && (
                    <div className="form-group">
                      <label>Product Image</label>
                      <div style={{ textAlign: 'center', padding: '10px' }}>
                        <img 
                          src={selectedProductType.imageUrl} 
                          alt={selectedProductType.productName}
                          style={{
                            maxWidth: '200px',
                            maxHeight: '200px',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            border: '1px solid #ddd'
                          }}
                        />
                      </div>
                    </div>
                  )}
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

export default TheaterProductTypes;
