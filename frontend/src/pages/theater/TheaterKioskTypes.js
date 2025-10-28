import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import ImageUpload from '../../components/common/ImageUpload';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

const TheaterKioskTypes = () => {
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterKioskTypes');
  
  // Data state
  const [kioskTypes, setKioskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
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
  
  // Ensure mounted ref is set on component mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load kiosk types data
  const loadKioskTypesData = useCallback(async (page = 1, limit = 10, search = '') => {
    
    if (!isMountedRef.current || !theaterId) {
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
        theaterId: theaterId,
        isActive: '',
        search: search || ''
      });

      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(
        `${config.api.baseUrl}/theater-kiosk-types/${theaterId}?${params}`, 
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch kiosk types');
      }

      const data = await response.json();
      
      if (data.success && isMountedRef.current) {
        console.log('🔥 DEBUGGING: Received kiosk types data', data);
        const items = data.data?.kioskTypes || data.kioskTypes || [];
        setKioskTypes(items);
        setCurrentPage(data.data?.pagination?.page || 1);
        setTotalPages(data.data?.pagination?.totalPages || 1);
        setTotalItems(data.data?.pagination?.total || items.length);
        
        const statisticsData = data.data?.statistics || {};
        const summary = {
          activeKioskTypes: statisticsData.active || 0,
          inactiveKioskTypes: statisticsData.inactive || 0,
          totalKioskTypes: statisticsData.total || 0
        };
        console.log('🔥 DEBUGGING: Setting summary', summary);
        setSummary(summary);
      } else {
        throw new Error(data.message || 'Failed to load kiosk types');
      }
    } catch (error) {
      if (error.name !== 'AbortError' && isMountedRef.current) {
        setKioskTypes([]);
        setSummary({ activeKioskTypes: 0, inactiveKioskTypes: 0, totalKioskTypes: 0 });
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
      loadKioskTypesData(1, itemsPerPage, query);
    }, 500);
  }, [itemsPerPage, loadKioskTypesData]);

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
    loadKioskTypesData(1, newLimit, searchTerm);
  }, [loadKioskTypesData, searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadKioskTypesData(newPage, itemsPerPage, searchTerm);
    }
  }, [totalPages, itemsPerPage, searchTerm, loadKioskTypesData]);

  // CRUD Operations
  const viewKioskType = (kioskType) => {
    setSelectedKioskType(kioskType);
    setShowViewModal(true);
  };

  const editKioskType = (kioskType) => {
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
  };

  const deleteKioskType = (kioskType) => {
    setSelectedKioskType(kioskType);
    setShowDeleteModal(true);
  };

  // Submit handler for create/edit
  const handleSubmitKioskType = async (isEdit = false) => {
    try {
      setImageError('');
      
      const url = isEdit 
        ? `${config.api.baseUrl}/theater-kiosk-types/${theaterId}/${selectedKioskType._id}` 
        : `${config.api.baseUrl}/theater-kiosk-types/${theaterId}`;
      const method = isEdit ? 'PUT' : 'POST';
      
      console.log('🔥 DEBUGGING: Submitting kiosk type to', url, 'Method:', method);
      
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
        setShowCreateModal(false);
        setShowEditModal(false);
        
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
        
        // Reload kiosk types
        loadKioskTypesData(currentPage, itemsPerPage, searchTerm);
      } else {
        throw new Error(data.message || 'Failed to save kiosk type');
      }
    } catch (error) {
      console.error('Error submitting kiosk type:', error);
      setImageError(error.message);
    }
  };

  // Handle delete
  const handleDeleteKioskType = async () => {
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
        setShowDeleteModal(false);
        setSelectedKioskType(null);
        loadKioskTypesData(currentPage, itemsPerPage, searchTerm);
      } else {
        throw new Error(data.message || 'Failed to delete kiosk type');
      }
    } catch (error) {
      console.error('Error deleting kiosk type:', error);
      showError(error.message);
    }
  };

  // Form input handlers
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
    setFormData(prev => ({
      ...prev,
      image: null,
      removeImage: true
    }));
  };

  const getCurrentImageValue = () => {
    if (imageFile) {
      return URL.createObjectURL(imageFile);
    }
    if (formData.removeImage) {
      return null;
    }
    return formData.image;
  };

  // Handle create new kiosk type
  const handleCreateNewKioskType = () => {
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
  };

  // Initial load
  useEffect(() => {
    loadKioskTypesData(currentPage, itemsPerPage, searchTerm);
    
    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [theaterId]); // Only reload when theaterId changes

  // Skeleton loader
  const TableRowSkeleton = useCallback(() => (
    <tr className="skeleton-row">
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-image"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  ), []);

  // Header button
  const headerButton = (
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
  );

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
        <div className="page-table-container">
          <table className="qr-management-table">
            <thead>
              <tr>
                <th style={{textAlign: 'center'}}>S.No</th>
                <th style={{textAlign: 'center'}}>Image</th>
                <th style={{textAlign: 'center'}}>Kiosk Type Name</th>
                <th style={{textAlign: 'center'}}>Status</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : kioskTypes.length > 0 ? (
                kioskTypes.map((kioskType, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={kioskType._id}>
                      <td style={{textAlign: 'center', fontWeight: '500'}}>{serialNumber}</td>
                      <td style={{textAlign: 'center'}}>
                        {(kioskType.imageUrl || kioskType.image) ? (
                          <img
                            src={kioskType.imageUrl || kioskType.image}
                            alt={kioskType.name || 'Kiosk Type'}
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '2px solid #e0e0e0',
                              display: 'block',
                              margin: '0 auto',
                              imageRendering: 'auto'
                            }}
                            onError={(e) => {
                              console.log('Image load error:', kioskType.imageUrl || kioskType.image);
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '8px',
                            backgroundColor: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto',
                            color: '#999'
                          }}>
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px'}}>
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                            </svg>
                          </div>
                        )}
                      </td>
                      <td style={{textAlign: 'center', fontWeight: '500'}}>{kioskType.name}</td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${kioskType.isActive ? 'active' : 'inactive'}`}>
                          {kioskType.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="action-buttons">
                          <button
                            onClick={() => viewKioskType(kioskType)}
                            className="action-btn view-btn"
                            title="View"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '18px', height: '18px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => editKioskType(kioskType)}
                            className="action-btn edit-btn"
                            title="Edit"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '18px', height: '18px'}}>
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteKioskType(kioskType)}
                            className="action-btn delete-btn"
                            title="Delete"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '18px', height: '18px'}}>
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
                  <td colSpan="5" style={{textAlign: 'center', padding: '40px', color: '#666'}}>
                    <div style={{fontSize: '16px', marginBottom: '8px'}}>No kiosk types found</div>
                    <div style={{fontSize: '14px', color: '#999'}}>
                      {searchTerm ? 'Try adjusting your search criteria' : 'Click "Create New Kiosk Type" to add your first kiosk type'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
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
                  <div className="form-group">
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
                  <div className="form-group">
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
                    <div className="form-group">
                      <label>Kiosk Type Image</label>
                      <div style={{ marginTop: '8px' }}>
                        <img
                          src={selectedKioskType.imageUrl || selectedKioskType.image}
                          alt={selectedKioskType.name}
                          loading="eager"
                          decoding="async"
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
                            console.log('Modal image load error:', selectedKioskType.imageUrl || selectedKioskType.image);
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

export default TheaterKioskTypes;
