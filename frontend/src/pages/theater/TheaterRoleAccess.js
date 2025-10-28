import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const TheaterRoleAccess = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError, showSuccess } = useModal();

  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterRoleAccess');
  
  // Data state
  const [rolePermissions, setRolePermissions] = useState([]);
  const [activeRoles, setActiveRoles] = useState([]);
  const [activePages, setActivePages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    activeRoleAccess: 0,
    inactiveRoleAccess: 0,
    totalRoleAccess: 0
  });

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRolePermission, setSelectedRolePermission] = useState(null);
  const [formData, setFormData] = useState({
    roleId: '',
    permissions: []
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

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
      console.error('Theater access denied: User can only access their own theater');
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Sort role permissions by ID in ascending order
  const sortedRolePermissions = useMemo(() => {
    return [...rolePermissions].sort((a, b) => {
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [rolePermissions]);

  // Load active pages from database
  const loadActivePages = useCallback(async () => {
    if (!theaterId) {
      console.warn('⚠️ No theaterId provided, cannot load pages');
      setActivePages([]);
      return [];
    }
    
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/page-access?theaterId=${theaterId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Page access response:', data);
        
        // Backend returns data.data.pageAccessList (array-based structure per theater)
        if (data.success && data.data && data.data.pageAccessList && Array.isArray(data.data.pageAccessList)) {
          const pages = data.data.pageAccessList
            .filter(pageAccess => pageAccess.isActive !== false) // Only show active pages
            .map(pageAccess => ({
              page: pageAccess.page,
              pageName: pageAccess.pageName,
              description: pageAccess.description || `Access to ${pageAccess.pageName}`,
              route: pageAccess.route
            }));
          console.log('✅ Active pages loaded:', pages.length);
          setActivePages(pages);
          return pages;
        } else {
          console.warn('⚠️ No page access data found:', data);
          setActivePages([]);
          return [];
        }
      } else {
        throw new Error(`HTTP ${response.status}: Failed to fetch pages from database`);
      }
    } catch (error) {
      console.error('❌ Error loading active pages:', error);
      setActivePages([]);
      return [];
    }
  }, [theaterId]);

  // Load role permissions data
  const loadRolePermissionsData = useCallback(async (page = 1, limit = 10, search = '') => {
    console.log('🔥 DEBUGGING: loadRolePermissionsData called with params:', { theaterId, page, limit, search });
    
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
        theaterId: theaterId,
        search: search,
        _cacheBuster: Date.now()
      });

      const baseUrl = `${config.api.baseUrl}/roles?${params.toString()}`;
      
      console.log('🔥 DEBUGGING: Fetching from', baseUrl);
      
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
      
      console.log('🔥 DEBUGGING: Response status', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🔥 DEBUGGING: Raw API response', data);
      
      if (!isMountedRef.current) return;

      if (data.success && data.data) {
        let roles = data.data.roles || [];
        console.log('🔥 DEBUGGING: Roles extracted', roles);
        console.log('🔥 DEBUGGING: Roles count', roles.length);
        
        setRolePermissions(roles);
        
        // Batch pagination state updates
        const paginationData = data.pagination || {};
        setTotalItems(paginationData.totalItems || 0);
        setTotalPages(paginationData.totalPages || 1);
        setCurrentPage(page);
        
        // Calculate summary
        const activeCount = roles.filter(r => r.isActive).length;
        const inactiveCount = roles.filter(r => !r.isActive).length;
        
        setSummary({
          activeRoleAccess: activeCount,
          inactiveRoleAccess: inactiveCount,
          totalRoleAccess: roles.length
        });
        
        console.log('🔥 DEBUGGING: Summary calculated', { activeCount, inactiveCount, total: roles.length });
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🔥 DEBUGGING: Request cancelled');
        return;
      }
      console.error('Error loading role permissions:', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await loadActivePages();
      await loadRolePermissionsData(currentPage, itemsPerPage, searchTerm);
    };
    init();
  }, [loadActivePages, loadRolePermissionsData, currentPage, itemsPerPage]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      loadRolePermissionsData(1, itemsPerPage, searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, itemsPerPage, loadRolePermissionsData]);

  // Handle search input
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

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

  // View role permissions
  const viewRolePermission = (role) => {
    setSelectedRolePermission(role);
    setShowViewModal(true);
  };

  // Edit role permissions
  const editRolePermission = (role) => {
    console.log('🔧 Edit role permission called');
    console.log('📝 Role:', role.name, 'ID:', role._id);
    console.log('📊 Active pages available:', activePages.length);
    console.log('🔒 Role permissions:', role.permissions?.length || 0);
    console.log('🎯 Full role object:', role);
    
    if (activePages.length === 0) {
      console.error('❌ No active pages available!');
      showError('Page permissions are still loading. Please wait a moment and try again.');
      return;
    }
    
    setSelectedRolePermission(role);
    
    // Prepare form data with all active pages
    const permissions = activePages.map(page => {
      const existingPermission = (role.permissions || []).find(p => p.page === page.page);
      return {
        page: page.page,
        pageName: page.pageName,
        hasAccess: existingPermission ? existingPermission.hasAccess : false
      };
    });
    
    console.log('✅ Prepared permissions:', permissions.length);
    console.log('📋 Permissions data:', permissions);
    console.log('🚀 Opening edit modal...');
    
    setFormData({
      roleId: role._id,
      permissions: permissions
    });
    setShowEditModal(true);
    console.log('✅ Modal should be visible now');
  };

  // Delete role permission
  const deleteRolePermission = (role) => {
    setSelectedRolePermission(role);
    setShowDeleteModal(true);
  };

  // Handle permission change
  const handlePermissionChange = (pageIndex, hasAccess) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.map((perm, index) => 
        index === pageIndex ? { ...perm, hasAccess } : perm
      )
    }));
  };

  // Submit role permissions update
  const handleSubmitRolePermission = async () => {
    try {
      const url = `${config.api.baseUrl}/roles/${selectedRolePermission._id}`;
      
      const payload = {
        permissions: formData.permissions
      };
      
      console.log('📤 Updating role permissions:', {
        roleId: selectedRolePermission._id,
        roleName: selectedRolePermission.name,
        permissionsCount: formData.permissions.length
      });
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Reload the role permissions data to get the latest state from server
        await loadRolePermissionsData(currentPage, itemsPerPage, searchTerm);
        
        setShowEditModal(false);
        showSuccess('Role permissions updated successfully');
        
        // Reset form
        setFormData({
          roleId: '',
          permissions: []
        });
        setSelectedRolePermission(null);
      } else {
        const errorData = await response.json();
        showError(errorData.message || 'Failed to update role permissions');
      }
    } catch (error) {
      console.error('Error updating role permissions:', error);
      showError('Failed to update role permissions');
    }
  };

  // Handle delete role permission
  const handleDeleteRolePermission = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/roles/${selectedRolePermission._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
        showSuccess('Role deleted successfully');
        loadRolePermissionsData(currentPage, itemsPerPage, searchTerm);
        setSelectedRolePermission(null);
      } else {
        const errorData = await response.json();
        showError(errorData.message || 'Failed to delete role');
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      showError('Failed to delete role. Please try again.');
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
    </tr>
  ), []);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Role Access Management" currentPage="theater-role-access">
        <PageContainer
          title="Role Access Management"
        >
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-number">{summary.activeRoleAccess || 0}</div>
            <div className="stat-label">Active Role Access</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.inactiveRoleAccess || 0}</div>
            <div className="stat-label">Inactive Role Access</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{summary.totalRoleAccess || 0}</div>
            <div className="stat-label">Total Role Access</div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search role access by role name..."
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
              Showing {sortedRolePermissions.length} of {totalItems} role access (Page {currentPage} of {totalPages})
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
                <th className="photo-col">Icon</th>
                <th className="name-col">Role Name</th>
                <th className="status-col">Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : sortedRolePermissions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM15.1 8H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                      </svg>
                      <p>No role access found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRolePermissions
                  .filter(rolePermission => rolePermission.isActive !== false)
                  .map((rolePermission, index) => (
                  <tr key={rolePermission._id} className="theater-row">
                    <td className="sno-cell">
                      <div className="sno-number">{((currentPage - 1) * itemsPerPage) + index + 1}</div>
                    </td>
                    <td className="photo-cell">
                      <div className="role-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                      </div>
                    </td>
                    <td className="name-cell">
                      <div className="theater-name-container">
                        <div className="theater-name">{rolePermission.name || 'No Role'}</div>
                        <div className="theater-location">
                          {(rolePermission.permissions?.filter(p => p.hasAccess).length || 0)} permissions granted
                        </div>
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${rolePermission.isActive ? 'active' : 'inactive'}`}>
                        {rolePermission.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <ActionButtons>
                        <ActionButton 
                          type="view"
                          onClick={() => viewRolePermission(rolePermission)}
                          title="View Role Access Details"
                        />
                        <ActionButton 
                          type="edit"
                          onClick={() => editRolePermission(rolePermission)}
                          title="Edit Role Access"
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
            itemType="role access"
          />
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Edit Role Access</h2>
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
                    <label>Role</label>
                    <input 
                      type="text" 
                      value={selectedRolePermission?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label>Page Permissions</label>
                    <div className="permissions-grid" style={{maxHeight: '300px', overflowY: 'auto'}}>
                      {formData.permissions.length === 0 ? (
                        <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                          <p>No page permissions available.</p>
                          <p style={{fontSize: '12px', marginTop: '8px'}}>
                            Please ensure pages are active in Page Access Management.
                          </p>
                        </div>
                      ) : (
                        formData.permissions.map((permission, index) => (
                          <div key={permission.page} className="permission-item" style={{display: 'flex', alignItems: 'center', padding: '8px', borderBottom: '1px solid #eee'}}>
                            <input
                              type="checkbox"
                              checked={permission.hasAccess}
                              onChange={(e) => handlePermissionChange(index, e.target.checked)}
                              style={{marginRight: '10px'}}
                            />
                            <div>
                              <div style={{fontWeight: '500'}}>{permission.pageName}</div>
                              <div style={{fontSize: '12px', color: '#666'}}>{permission.page}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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
                    onClick={handleSubmitRolePermission}
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
                <h2>Role Access Details</h2>
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
                    <label>Role Name</label>
                    <input 
                      type="text" 
                      value={selectedRolePermission?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <input 
                      type="text" 
                      value={selectedRolePermission?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      readOnly
                    />
                  </div>

                  <div className="form-group">
                    <label>Granted Permissions</label>
                    <div className="permissions-list" style={{maxHeight: '300px', overflowY: 'auto'}}>
                      {(selectedRolePermission?.permissions || []).map((permission) => (
                        <div key={permission.page} className="permission-item" style={{
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '8px', 
                          borderBottom: '1px solid #eee',
                          backgroundColor: permission.hasAccess ? '#f0f9ff' : '#f9fafb'
                        }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: permission.hasAccess ? '#10b981' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: '10px'
                          }}>
                            <span style={{color: 'white', fontSize: '12px'}}>
                              {permission.hasAccess ? '✓' : '✗'}
                            </span>
                          </div>
                          <div>
                            <div style={{fontWeight: '500'}}>{permission.pageName}</div>
                            <div style={{fontSize: '12px', color: '#666'}}>{permission.page}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Created At</label>
                    <input 
                      type="text" 
                      value={selectedRolePermission?.createdAt ? new Date(selectedRolePermission.createdAt).toLocaleString() : ''} 
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
                <p>Are you sure you want to delete role access for <strong>{selectedRolePermission?.name}</strong>?</p>
                <p className="warning-text">This action will remove all page permissions for this role and cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteRolePermission}
                  className="confirm-delete-btn"
                >
                  Delete Role Access
                </button>
              </div>
            </div>
          </div>
        )}

        </PageContainer>
      </TheaterLayout>

      {/* Custom CSS for modal width - matches admin design */}
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

export default TheaterRoleAccess;
