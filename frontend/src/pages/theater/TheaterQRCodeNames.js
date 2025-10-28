import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import config from '../../config';
import { useParams, useNavigate } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import ErrorBoundary from '../../components/ErrorBoundary';
import Pagination from '../../components/Pagination';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

// Table Row Skeleton Component
const TableRowSkeleton = React.memo(() => (
  <tr className="skeleton-row">
    <td><div className="skeleton-text"></div></td>
    <td><div className="skeleton-text"></div></td>
    <td><div className="skeleton-text wide"></div></td>
    <td><div className="skeleton-text"></div></td>
    <td><div className="skeleton-text"></div></td>
  </tr>
));

const TheaterQRCodeNames = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showSuccess, showError } = useModal();
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterQRCodeNames');
  
  // Data state
  const [qrCodeNames, setQRCodeNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    activeQRNames: 0,
    inactiveQRNames: 0,
    totalQRNames: 0
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter state with debounced search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Performance refs
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Ensure mounted ref is set
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
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Sort QR Code Names by ID in ascending order
  const sortedQRCodeNames = useMemo(() => {
    return [...qrCodeNames].sort((a, b) => {
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [qrCodeNames]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Load QR Code Name data
  const loadQRCodeNameData = useCallback(async () => {
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
        theaterId: theaterId,
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearchTerm,
        _cacheBuster: Date.now()
      });

      const baseUrl = `${config.api.baseUrl}/qrcodenames?${params.toString()}`;
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(baseUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR code name data');
      }
      
      const data = await response.json();
      
      if (!isMountedRef.current) return;
      
      if (data.success) {
        const newData = data.data?.qrCodeNames || [];
        setQRCodeNames(newData);
        
        // Batch pagination state updates
        const paginationData = data.data?.pagination || {};
        setTotalPages(paginationData.totalPages || 0);
        setTotalItems(paginationData.totalItems || 0);
        
        // Calculate summary statistics
        const activeQRNames = newData.filter(qr => qr.isActive).length;
        const inactiveQRNames = newData.filter(qr => !qr.isActive).length;
        
        setSummary({
          activeQRNames,
          inactiveQRNames,
          totalQRNames: newData.length
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error loading QR code names:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [currentPage, debouncedSearchTerm, itemsPerPage, theaterId]);

  // Initial load
  useEffect(() => {
    loadQRCodeNameData();
  }, [loadQRCodeNameData]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedQRCodeName, setSelectedQRCodeName] = useState(null);
  const [formData, setFormData] = useState({
    qrName: '',
    seatClass: '',
    description: '',
    isActive: true
  });

  // Pagination handlers
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  }, []);

  // Handle search input
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // View QR Code Name
  const viewQRCodeName = (qrCodeName) => {
    setSelectedQRCodeName(qrCodeName);
    setShowViewModal(true);
  };

  // Edit QR Code Name
  const editQRCodeName = (qrCodeName) => {
    setSelectedQRCodeName(qrCodeName);
    setFormData({
      qrName: qrCodeName.qrName || '',
      seatClass: qrCodeName.seatClass || 'GENERAL',
      description: qrCodeName.description || '',
      isActive: qrCodeName.isActive
    });
    setShowEditModal(true);
  };

  // Delete QR Code Name
  const deleteQRCodeName = (qrCodeName) => {
    setSelectedQRCodeName(qrCodeName);
    setShowDeleteModal(true);
  };

  // Handle delete
  const handleDeleteQRCodeName = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('🗑️ Deleting QR Code Name:', selectedQRCodeName._id);
      console.log('🔗 DELETE URL:', `${config.api.baseUrl}/qrcodenames/${selectedQRCodeName._id}?permanent=true`);
      
      const response = await fetch(`${config.api.baseUrl}/qrcodenames/${selectedQRCodeName._id}?permanent=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      console.log('📡 DELETE response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Delete successful:', data);
        setShowDeleteModal(false);
        showSuccess('QR Code Name deleted successfully!');
        loadQRCodeNameData();
        setSelectedQRCodeName(null);
      } else {
        const errorData = await response.json();
        console.error('❌ Delete failed:', errorData);
        
        // Enhanced error handling
        if (errorData.message && errorData.message.includes('Theater QR names not found')) {
          showError('Theater not found. Please refresh the page and try again.');
        } else if (errorData.message && errorData.message.includes('QR name not found')) {
          showError('QR code name not found. It may have been already deleted.');
          loadQRCodeNameData(); // Refresh to show current state
        } else {
          showError(errorData.message || 'Failed to delete QR Code Name');
        }
      }
    } catch (error) {
      console.error('❌ Error deleting QR code name:', error);
      showError('Failed to delete QR Code Name. Please try again.');
    }
  };

  // Handle save (create/update)
  const handleSaveQRCodeName = async (isEdit) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const url = isEdit 
        ? `${config.api.baseUrl}/qrcodenames/${selectedQRCodeName._id}`
        : `${config.api.baseUrl}/qrcodenames`;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const payload = {
        ...formData,
        theaterId: theaterId
      };
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        showSuccess(isEdit ? 'QR Code Name updated successfully!' : 'QR Code Name created successfully!');
        setShowCreateModal(false);
        setShowEditModal(false);
        loadQRCodeNameData();
        setFormData({
          qrName: '',
          seatClass: 'GENERAL',
          description: '',
          isActive: true
        });
      } else {
        const errorData = await response.json().catch(() => ({ message: 'No error details available' }));
        
        if (errorData.message && errorData.message.includes('already exists')) {
          showError('A QR code name with this name already exists in this theater.');
        } else {
          showError(errorData.message || 'Failed to save QR Code Name');
        }
      }
    } catch (error) {
      console.error('Error saving QR code name:', error);
      showError('An error occurred while saving the QR Code Name.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateNewQRName = () => {
    setFormData({
      qrName: '',
      seatClass: '',
      description: '',
      isActive: true
    });
    setShowCreateModal(true);
  };

  const headerButton = (
    <button 
      className="header-btn"
      onClick={handleCreateNewQRName}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      CREATE NEW QR NAME
    </button>
  );

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="QR Code Names" currentPage="qr-code-names">
        <PageContainer
          title="QR Code Names"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeQRNames || 0}</div>
            <div className="stat-label">Active QR Names</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveQRNames || 0}</div>
            <div className="stat-label">Inactive QR Names</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalQRNames || 0}</div>
            <div className="stat-label">Total QR Names</div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search QR code names..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <div className="results-count">
              Showing {sortedQRCodeNames.length} of {totalItems} QR names (Page {currentPage} of {totalPages || 1})
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
                <th className="sno-col">S.No</th>
                <th className="name-col">QR Name</th>
                <th className="name-col">Seat Class</th>
                <th className="status-col">Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : sortedQRCodeNames.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM19 13h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM15 19h2v2h-2z"/>
                      </svg>
                      <p>No QR code names found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedQRCodeNames.map((qrCodeName, index) => (
                  <tr key={qrCodeName._id} className="theater-row">
                    <td className="sno-cell">
                      <div className="sno-number">{((currentPage - 1) * itemsPerPage) + index + 1}</div>
                    </td>
                    <td className="name-cell">
                      <div className="theater-name-container">
                        <div className="theater-name">{qrCodeName.qrName || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="name-cell">
                      <div className="theater-name-container">
                        <div className="theater-name">{qrCodeName.seatClass || 'GENERAL'}</div>
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${qrCodeName.isActive ? 'active' : 'inactive'}`}>
                        {qrCodeName.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <ActionButtons>
                        <ActionButton 
                          type="view"
                          onClick={() => viewQRCodeName(qrCodeName)}
                          title="View QR Code Name Details"
                        />
                        <ActionButton 
                          type="edit"
                          onClick={() => editQRCodeName(qrCodeName)}
                          title="Edit QR Code Name"
                        />
                        <ActionButton 
                          type="delete"
                          onClick={() => deleteQRCodeName(qrCodeName)}
                          title="Delete QR Code Name"
                        />
                      </ActionButtons>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && (
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemType="QR names"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New QR Code Name</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>QR Code Name</label>
                    <input 
                      type="text" 
                      value={formData.qrName} 
                      onChange={(e) => handleInputChange('qrName', e.target.value)}
                      className="form-control"
                      placeholder="Enter QR code name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Seat Class</label>
                    <input 
                      type="text"
                      value={formData.seatClass} 
                      onChange={(e) => handleInputChange('seatClass', e.target.value)}
                      className="form-control"
                      placeholder="Enter seat class (e.g., General, VIP, Premium)"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter description"
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={formData.isActive} 
                      onChange={(e) => handleInputChange('isActive', e.target.value === 'true')}
                      className="form-control"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
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
                    onClick={() => handleSaveQRCodeName(false)}
                  >
                    Create QR Name
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit QR Code Name</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowEditModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>QR Code Name</label>
                    <input 
                      type="text" 
                      value={formData.qrName} 
                      onChange={(e) => handleInputChange('qrName', e.target.value)}
                      className="form-control"
                      placeholder="Enter QR code name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Seat Class</label>
                    <input 
                      type="text"
                      value={formData.seatClass} 
                      onChange={(e) => handleInputChange('seatClass', e.target.value)}
                      className="form-control"
                      placeholder="Enter seat class"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={formData.description} 
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="form-control"
                      placeholder="Enter description"
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={formData.isActive} 
                      onChange={(e) => handleInputChange('isActive', e.target.value === 'true')}
                      className="form-control"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
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
                    onClick={() => handleSaveQRCodeName(true)}
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>QR Code Name Details</h2>
                <button 
                  className="close-btn"
                  onClick={() => setShowViewModal(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>QR Code Name</label>
                    <input 
                      type="text" 
                      value={selectedQRCodeName?.qrName || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Seat Class</label>
                    <input 
                      type="text"
                      value={selectedQRCodeName?.seatClass || 'GENERAL'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={selectedQRCodeName?.description || 'No description'} 
                      className="form-control"
                      readOnly
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <input 
                      type="text" 
                      value={selectedQRCodeName?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedQRCodeName?.createdAt ? new Date(selectedQRCodeName.createdAt).toLocaleString() : ''} 
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
                <p>Are you sure you want to delete QR code name <strong>{selectedQRCodeName?.qrName}</strong>?</p>
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
                  onClick={handleDeleteQRCodeName}
                  className="confirm-delete-btn"
                >
                  Delete QR Name
                </button>
              </div>
            </div>
          </div>
        )}

        </PageContainer>
      </TheaterLayout>

      {/* Custom CSS for modal width */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .modal-content {
            max-width: 900px !important;
            width: 85% !important;
          }

          @media (max-width: 768px) {
            .modal-content {
              width: 95% !important;
              max-width: none !important;
            }
          }
        `
      }} />
    </ErrorBoundary>
  );
};

export default TheaterQRCodeNames;
