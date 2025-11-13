import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import Pagination from '../../components/Pagination';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import { useModal } from '../../contexts/ModalContext'
import { useToast } from '../../contexts/ToastContext';;
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



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

          setActivePages(pages);
          return pages;
        } else {

          setActivePages([]);
          return [];
        }
      } else {
        throw new Error(`HTTP ${response.status}: Failed to fetch pages from database`);
      }
    } catch (error) {

      setActivePages([]);
      return [];
    }
  }, [theaterId]);

  // Load role permissions data
  const loadRolePermissionsData = useCallback(async (page = 1, limit = 10, search = '', forceRefresh = false) => {

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
        _cacheBuster: Date.now()
      });

      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 [TheaterRoleAccess] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      const baseUrl = `${config.api.baseUrl}/roles?${params.toString()}`;
      

      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
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
        signal: abortControllerRef.current.signal,
        headers
      });
      

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      

      if (!isMountedRef.current) return;

      if (data.success && data.data) {
        let roles = data.data.roles || [];

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
  }, [theaterId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      await loadActivePages();
      await loadRolePermissionsData(currentPage, itemsPerPage, searchTerm, true);
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

    if (activePages.length === 0) {

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
    

    setFormData({
      roleId: role._id,
      permissions: permissions
    });
    setShowEditModal(true);
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
        await loadRolePermissionsData(currentPage, itemsPerPage, searchTerm, true);
        
        setShowEditModal(false);
          toast.success('Role updated successfully!');
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
          toast.success('Role deleted successfully!');
        showSuccess('Role deleted successfully');
        loadRolePermissionsData(currentPage, itemsPerPage, searchTerm, true);
        setSelectedRolePermission(null);
      } else {
        const errorData = await response.json();
        showError(errorData.message || 'Failed to delete role');
      }
    } catch (error) {

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
                <div className="edit-form role-access-modal-form">
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
                    <div className="role-access-permissions-container">
                      {formData.permissions.length === 0 ? (
                        <div className="role-access-empty-state">
                          <p>No page permissions available.</p>
                          <p className="role-access-empty-hint">
                            Please ensure pages are active in Page Access Management.
                          </p>
                        </div>
                      ) : (
                        <div className="role-access-permissions-grid">
                          {formData.permissions.map((permission, index) => (
                            <div key={permission.page} className={`role-access-permission-card ${permission.hasAccess ? 'granted' : 'denied'}`}>
                              <div className="role-access-permission-name">{permission.pageName}</div>
                              <label className="role-access-checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  checked={permission.hasAccess}
                                  onChange={(e) => handlePermissionChange(index, e.target.checked)}
                                  className="role-access-checkbox"
                                />
                                <span className="role-access-checkbox-label">
                                  {permission.hasAccess ? 'Granted' : 'Denied'}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
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
                <div className="edit-form role-access-modal-form">
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
                    <div className="role-access-permissions-container">
                      <div className="role-access-permissions-grid">
                        {(selectedRolePermission?.permissions || []).map((permission) => (
                          <div key={permission.page} className={`role-access-permission-card ${permission.hasAccess ? 'granted' : 'denied'}`}>
                            <div className="role-access-permission-name">{permission.pageName}</div>
                            <div className="role-access-permission-status">
                              <span className={`role-access-status-badge ${permission.hasAccess ? 'status-granted' : 'status-denied'}`}>
                                {permission.hasAccess ? '✓ Granted' : '✗ Denied'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
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

      {/* Custom CSS for modal width and Role Access Modal Forms */}
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

          /* Role Access Modal Form - Professional Corporate Design */
          .role-access-modal-form {
            padding: 0;
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
          }

          .role-access-modal-form .form-group {
            margin-bottom: 24px;
            width: 100% !important;
            grid-column: 1 / -1 !important;
          }

          .role-access-modal-form .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .role-access-permissions-container {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            max-height: 450px;
            overflow-y: auto;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            padding: 20px;
          }

          .role-access-permissions-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
          }

          .role-access-permission-card {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 20px;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            background: #ffffff;
            transition: all 0.2s ease;
            min-height: 120px;
            position: relative;
          }

          .role-access-permission-card:hover {
            border-color: #8b5cf6;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
            transform: translateY(-2px);
          }

          .role-access-permission-card.granted {
            border-color: #10b981;
            background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%);
          }

          .role-access-permission-card.granted:hover {
            border-color: #059669;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
          }

          .role-access-permission-card.denied {
            border-color: #e5e7eb;
            background: #ffffff;
          }

          .role-access-permission-card.denied:hover {
            border-color: #d1d5db;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          }

          .role-access-permission-name {
            font-size: 14px;
            font-weight: 600;
            color: #111827;
            line-height: 1.5;
            letter-spacing: -0.01em;
            margin-bottom: 16px;
            flex: 1;
          }

          /* Checkbox Wrapper for Edit Modal */
          .role-access-checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            user-select: none;
            padding: 0;
            margin-top: auto;
          }

          .role-access-checkbox {
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #8b5cf6;
            margin: 0;
            border-radius: 4px;
            border: 2px solid #d1d5db;
            transition: all 0.15s ease;
            flex-shrink: 0;
          }

          .role-access-checkbox:checked {
            border-color: #8b5cf6;
            background-color: #8b5cf6;
          }

          .role-access-checkbox-label {
            font-size: 12px;
            font-weight: 600;
            color: #4b5563;
            text-align: left;
            flex: 1;
            transition: all 0.15s ease;
          }

          .role-access-checkbox:checked ~ .role-access-checkbox-label {
            color: #7c3aed;
          }

          /* Status Badge for View Modal */
          .role-access-permission-status {
            margin-top: auto;
            display: flex;
            align-items: center;
          }

          .role-access-status-badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            width: 100%;
            justify-content: center;
            text-transform: uppercase;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }

          .role-access-status-badge.status-granted {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            color: #065f46;
            border: 1px solid #10b981;
          }

          .role-access-status-badge.status-denied {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            color: #991b1b;
            border: 1px solid #ef4444;
          }

          /* Empty State */
          .role-access-empty-state {
            padding: 60px 20px;
            text-align: center;
            color: #6b7280;
          }

          .role-access-empty-state p {
            margin: 0;
            font-size: 15px;
            font-weight: 500;
          }

          .role-access-empty-hint {
            font-size: 13px;
            margin-top: 12px;
            color: #9ca3af;
            font-weight: 400;
          }

          /* Scrollbar Styling - Professional */
          .role-access-permissions-container::-webkit-scrollbar {
            width: 10px;
          }

          .role-access-permissions-container::-webkit-scrollbar-track {
            background: #f9fafb;
            border-radius: 5px;
          }

          .role-access-permissions-container::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 5px;
            border: 2px solid #f9fafb;
          }

          .role-access-permissions-container::-webkit-scrollbar-thumb:hover {
            background: #9ca3af;
          }

          /* Form Control Styling */
          .role-access-modal-form .form-control {
            background: #ffffff;
            border: 1.5px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 14px;
            transition: all 0.15s ease;
          }

          .role-access-modal-form .form-control:focus {
            outline: none;
            border-color: #8b5cf6;
            box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
          }

          .role-access-modal-form .form-control[readonly] {
            background: #f9fafb;
            color: #374151;
            cursor: not-allowed;
          }

          /* Responsive Grid */
          @media (max-width: 1200px) {
            .role-access-permissions-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 768px) {
            .role-access-permissions-grid {
              grid-template-columns: 1fr;
            }
          }
        `
      }} />
    </ErrorBoundary>
  );
};

export default TheaterRoleAccess;
