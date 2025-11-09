
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

const TheaterRoles = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterRoles');
  
  // Data state
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    activeRoles: 0,
    inactiveRoles: 0,
    totalRoles: 0
  });

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Theater data
  const [theater, setTheater] = useState(null);

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
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true
  });

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

  // Load theater data
  useEffect(() => {
    if (theaterId) {
      loadTheaterData();
    }
  }, [theaterId]);

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {

      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load theater data
  const loadTheaterData = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch theater data: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const theaterData = result.theater || result.data;
        setTheater(theaterData);
      }
    } catch (error) {
  }
  }, [theaterId]);

  // Load roles data
  const loadRolesData = useCallback(async (page = 1, limit = 10, search = '') => {

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
        search: search,
        _cacheBuster: Date.now(),
        _random: Math.random()
      });

      // Add status filter
      if (filterStatus && filterStatus !== 'all') {
        params.append('isActive', filterStatus === 'active' ? 'true' : 'false');
      }

      const baseUrl = `${config.api.baseUrl}/roles?${params.toString()}`;
      

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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      

      if (!isMountedRef.current) return;

      if (data.success && data.data) {
        let roles = data.data.roles || [];

        // Sort roles by ID in ascending order
        const sortedRoles = roles.sort((a, b) => {
          // Convert IDs to strings for consistent comparison
          const idA = a._id ? a._id.toString() : '';
          const idB = b._id ? b._id.toString() : '';
          return idA.localeCompare(idB);
        });
        
        setRoles(sortedRoles);
        
        // Batch pagination state updates
        const paginationData = data.pagination || {};
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        
        // Calculate summary
        const activeCount = roles.filter(r => r.isActive).length;
        const inactiveCount = roles.filter(r => !r.isActive).length;
        
        setSummary({
          activeRoles: activeCount,
          inactiveRoles: inactiveCount,
          totalRoles: roles.length
        });
        
  }
      
    } catch (error) {
      if (error.name === 'AbortError') {

        return;
      }
  } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, filterStatus]);

  // Initial load
  useEffect(() => {
    loadRolesData(currentPage, itemsPerPage, debouncedSearchTerm);
  }, [loadRolesData, currentPage, itemsPerPage, debouncedSearchTerm, filterStatus]);

  // Removed duplicate debounced search effect (already added above)

  // Handle search input
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle filter change
  const handleFilterChange = useCallback((e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1);
  }, []);

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = parseInt(e.target.value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // View role
  const viewRole = (role) => {
    setSelectedRole(role);
    setShowViewModal(true);
  };

  // Edit role
  const editRole = (role) => {
    if (role.isDefault && !role.canEdit) {
      alert('This is a default Theater Admin role and cannot be edited.');
      return;
    }
    setSelectedRole(role);
    setFormData({
      name: role.name || '',
      description: role.description || '',
      isActive: role.isActive !== undefined ? role.isActive : true
    });
    setShowEditModal(true);
  };

  // Delete role
  const deleteRole = (role) => {
    if (role.isDefault && !role.canDelete) {
      alert('This is a default Theater Admin role and cannot be deleted.');
      return;
    }
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  // Create new role
  const handleCreateNewRole = () => {
    setFormData({
      name: '',
      description: '',
      isActive: true
    });
    setSelectedRole(null);
    setShowCreateModal(true);
  };

  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle role status (Access Status toggle)
  const toggleRoleStatus = async (roleId, currentStatus) => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    
    try {
      const response = await fetch(`${config.api.baseUrl}/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (response.ok) {
        await loadRolesData(currentPage, itemsPerPage, debouncedSearchTerm);
      } else {
        const errorData = await response.json();
        showError(errorData.message || 'Failed to update role status');
      }
    } catch (error) {

      showError('Failed to update role status');
    }
  };

  // Submit role (Create or Update)
  const handleSubmitRole = async (isEdit) => {
    try {
      const url = isEdit 
        ? `${config.api.baseUrl}/roles/${selectedRole._id}`
        : `${config.api.baseUrl}/roles`;
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(url, {
        method: method,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          theaterId: theaterId
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (isEdit) {
          setShowEditModal(false);
        } else {
          setShowCreateModal(false);
        }
        loadRolesData(currentPage, itemsPerPage, searchTerm);
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          isActive: true
        });
        setSelectedRole(null);
      } else {
        const errorData = await response.json();
  }
    } catch (error) {
  }
  };

  // Confirm delete
  const handleDeleteRole = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/roles/${selectedRole._id}?permanent=true`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        loadRolesData(currentPage, itemsPerPage, searchTerm);
      } else {
        const errorData = await response.json();
  }
    } catch (error) {
  }
  };

  // Memoized skeleton component for loading states
  const TableRowSkeleton = useMemo(() => () => (
    <tr className="skeleton-row">
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
      onClick={handleCreateNewRole}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </span>
      Create New Role
    </button>
  );

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Role Management" currentPage="theater-roles">
        <PageContainer
          title="Role Management"
          headerButton={headerButton}
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeRoles || 0}</div>
            <div className="stat-label">Active Roles</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveRoles || 0}</div>
            <div className="stat-label">Inactive Roles</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalRoles || 0}</div>
            <div className="stat-label">Total Roles</div>
          </div>
        </div>

        {/* Enhanced Filters Section matching TheaterList */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search roles by name or description..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <select
              value={filterStatus}
              onChange={handleFilterChange}
              className="status-filter"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <div className="results-count">
              Showing {roles.length} of {totalItems} roles (Page {currentPage} of {totalPages})
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
                <th style={{textAlign: 'center'}}>Icon</th>
                <th style={{textAlign: 'center'}}>Role Name</th>
                <th style={{textAlign: 'center'}}>Status</th>
                <th style={{textAlign: 'center'}}>Access Status</th>
                <th style={{textAlign: 'center'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : roles.length > 0 ? (
                roles.map((role, index) => {
                  const serialNumber = (currentPage - 1) * itemsPerPage + index + 1;
                  return (
                    <tr key={role._id}>
                      <td style={{textAlign: 'center'}}>{serialNumber}</td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}>
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
                            <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 4V6L19 8V9H21ZM15 10C16.1 10 17 10.9 17 12S16.1 14 15 14 13 13.1 13 12 13.9 10 15 10ZM5 16C6.1 16 7 16.9 7 18S6.1 20 5 20 3 19.1 3 18 3.9 16 5 16ZM12 7C8.14 7 5 8.79 5 11V12H10V14H5V22H7V19H10V22H12V14H9V12H15V11C15 8.79 11.86 7 12 7Z"/>
                          </svg>
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="role-name-container">
                          <div className="role-name">{role.name || 'No Name'}</div>
                          {role.isDefault && (
                            <span className="default-badge" style={{
                              fontSize: '10px',
                              padding: '3px 8px',
                              background: '#ffa726',
                              color: 'white',
                              borderRadius: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: '600',
                              marginTop: '4px'
                            }} title="This is a default role with limited editing">
                              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '12px', height: '12px'}}>
                                <path d="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1Z"/>
                              </svg>
                              DEFAULT
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <span className={`status-badge ${role.isActive ? 'active-badge' : 'inactive-badge'}`}>
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div className="toggle-wrapper">
                          <label className="switch" style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '50px',
                            height: '24px'
                          }}>
                            <input
                              type="checkbox"
                              checked={role.isActive !== false}
                              onChange={() => toggleRoleStatus(role._id, role.isActive)}
                              style={{
                                opacity: 0,
                                width: 0,
                                height: 0
                              }}
                            />
                            <span className="slider" style={{
                              position: 'absolute',
                              cursor: 'pointer',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              backgroundColor: (role.isActive !== false) ? 'var(--primary-dark, #6D28D9)' : '#ccc',
                              transition: '.4s',
                              borderRadius: '24px'
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '18px',
                                width: '18px',
                                left: (role.isActive !== false) ? '26px' : '3px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                transition: '.4s',
                                borderRadius: '50%',
                                display: 'block'
                              }}></span>
                            </span>
                          </label>
                        </div>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <ActionButtons>
                          <ActionButton 
                            type="view"
                            onClick={() => viewRole(role)}
                            title="View Details"
                          />
                          <ActionButton 
                            type="edit"
                            onClick={() => editRole(role)}
                            title="Edit Role"
                            disabled={role.isDefault && !role.canEdit}
                          />
                          <ActionButton 
                            type="delete"
                            onClick={() => deleteRole(role)}
                            title="Delete Role"
                            disabled={role.isDefault && !role.canDelete}
                          />
                        </ActionButtons>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                      <p>No roles found</p>
                      <button 
                        className="btn-primary" 
                        onClick={handleCreateNewRole}
                      >
                        Create Your First Role
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
            itemType="roles"
          />
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content theater-role-create-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                </div>
                
                <div className="modal-title-section">
                  <h2>Create New Role</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn"
                    onClick={() => setShowCreateModal(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Role Name</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter role name"
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
                      placeholder="Enter role description (optional)"
                      rows="3"
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
                    onClick={() => handleSubmitRole(false)}
                  >
                    Create Role
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content theater-role-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                </div>
                
                <div className="modal-title-section">
                  <h2>Edit Role</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn"
                    onClick={() => setShowEditModal(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Role Name</label>
                    <input 
                      type="text" 
                      value={formData.name || ''} 
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="form-control"
                      placeholder="Enter role name"
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
                      placeholder="Enter role description (optional)"
                      rows="3"
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
                    onClick={() => handleSubmitRole(true)}
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
            <div className="modal-content theater-role-view-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                </div>
                
                <div className="modal-title-section">
                  <h2>Role Details</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn"
                    onClick={() => setShowViewModal(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-group">
                    <label>Role Name</label>
                    <input 
                      type="text" 
                      value={selectedRole?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={selectedRole?.isActive ? 'Active' : 'Inactive'} 
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
                      value={selectedRole?.description || ''} 
                      className="form-control"
                      readOnly
                      rows="3"
                    />
                  </div>
                  <div className="form-group">
                    <label>Permissions Count</label>
                    <input 
                      type="text" 
                      value={selectedRole?.permissions ? selectedRole.permissions.length : 0} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  {selectedRole?.isDefault && (
                    <div className="form-group">
                      <label>Role Type</label>
                      <input 
                        type="text" 
                        value="Default Role" 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedRole?.createdAt ? new Date(selectedRole.createdAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Updated At</label>
                    <input 
                      type="text" 
                      value={selectedRole?.updatedAt ? new Date(selectedRole.updatedAt).toLocaleString() : ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                </div>
                
                <div className="modal-actions">
                  <button 
                    className="cancel-btn" 
                    onClick={() => setShowViewModal(false)}
                  >
                    Close
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={() => {
                      setShowViewModal(false);
                      editRole(selectedRole);
                    }}
                  >
                    Edit Role
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
                <p>Are you sure you want to delete the role <strong>{selectedRole?.name}</strong>?</p>
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
                  onClick={handleDeleteRole}
                  className="confirm-delete-btn"
                >
                  Delete Role
                </button>
              </div>
            </div>
          </div>
        )}

        </PageContainer>

    {/* Custom CSS for TheaterRoles modals only */}
    <style dangerouslySetInnerHTML={{
      __html: `
        .theater-role-view-modal-content,
        .theater-role-edit-modal-content,
        .theater-role-create-modal-content {
          max-width: 900px !important;
          width: 85% !important;
        }

        @media (max-width: 768px) {
          .theater-role-view-modal-content,
          .theater-role-edit-modal-content,
          .theater-role-create-modal-content {
            width: 95% !important;
            max-width: none !important;
          }
        }
      `
    }} />
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterRoles;
