import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { optimizedFetch } from '../utils/apiOptimizer';
import { clearCachePattern } from '../utils/cacheUtils';
import config from '../config';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';
import '../styles/RoleCreate.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



const RolesList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theaterId } = useParams();
  
  // State management
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [theater, setTheater] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Modal state
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    roleId: null,
    roleName: ''
  });
  
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch theater details
  const fetchTheater = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const result = await optimizedFetch(
        `${config.api.baseUrl}/theaters/${theaterId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        },
        `theater_${theaterId}`,
        120000 // 2-minute cache
      );
      if (result && result.data) {
        setTheater(result.data);
      }
    } catch (error) {
  }
  }, [theaterId]);

  // Fetch roles - ALWAYS bypass cache to ensure fresh data
  const fetchRoles = useCallback(async () => {
    try {
      console.log('🔄 fetchRoles called - fetching fresh data from API');
      setLoading(true);
      setError('');
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (theaterId) {
        params.append('theaterId', theaterId);
      }

      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }
      
      // ALWAYS clear cache before fetching to ensure fresh data
      clearCachePattern('roles_');
      if (theaterId) {
        clearCachePattern(`theater_${theaterId}`);
      }
      
      // ALWAYS use regular fetch (bypass all caching) to ensure fresh data
      // Add timestamp to prevent any browser-level caching
      const apiUrl = `${config.api.baseUrl}/roles?${params.toString()}&_t=${Date.now()}`;
      console.log('📡 Fetching from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Roles fetched:', result?.data?.roles?.length || 0, 'roles');
      
      if (!result) {
        throw new Error('Failed to fetch roles');
      }

      if (result.success && result.data) {
        setRoles(result.data.roles || []);
        const paginationData = result.data.pagination || {};
        setTotalPages(paginationData.totalPages || 0);
        setTotalItems(paginationData.totalItems || 0);
        
        // Update theater info from response if available
        if (result.data.theater) {
          setTheater(result.data.theater);
        }
      } else {
        console.warn('⚠️ Unexpected response format:', result);
        setRoles([]);
        setTotalPages(0);
        setTotalItems(0);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏹️ Request aborted');
        return;
      }

      console.error('❌ Error fetching roles:', error);
      setError(`Failed to load roles: ${error.message}`);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm, theaterId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]); 

  useEffect(() => {
    fetchTheater();
  }, [fetchTheater]);

  // Refresh when component mounts (check if coming from create/edit)
  useEffect(() => {
    // Check if we're returning from create/edit page
    const lastRoleAction = sessionStorage.getItem('last_role_action');
    const now = Date.now();
    
    if (lastRoleAction && now - parseInt(lastRoleAction) < 60000) { // Within last 60 seconds
      console.log('🔄 Detected recent role action, forcing refresh on mount');
      clearCachePattern('roles_');
      if (theaterId) {
        clearCachePattern(`theater_${theaterId}`);
      }
      // Force refresh - fetchRoles always bypasses cache now
      setTimeout(() => {
        fetchRoles();
      }, 200);
      sessionStorage.removeItem('last_role_action');
    }
  }, [theaterId, fetchRoles]);

  // Refresh when location changes (navigating back from create/edit)
  useEffect(() => {
    const currentPath = location.pathname;
    // Check if we're on a roles page (could be /roles or /roles/:theaterId)
    const isRolesListPage = currentPath.match(/^\/roles(\/|$)/) && 
                           !currentPath.includes('/create') && 
                           !currentPath.includes('/edit');
    
    if (isRolesListPage) {
      const navigationState = sessionStorage.getItem('roles_navigation_state');
      if (navigationState === 'from_create_or_edit') {
        console.log('🔄 Navigation from create/edit detected, forcing refresh');
        sessionStorage.removeItem('roles_navigation_state');
        clearCachePattern('roles_');
        if (theaterId) {
          clearCachePattern(`theater_${theaterId}`);
        }
        // Small delay to ensure component is ready
        setTimeout(() => {
          fetchRoles();
        }, 200);
      }
    }
  }, [location.pathname, theaterId, fetchRoles]);
  
  // Also refresh when page becomes visible (user switches tabs/windows)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const lastRoleAction = sessionStorage.getItem('last_role_action');
        const now = Date.now();
        if (lastRoleAction && now - parseInt(lastRoleAction) < 60000) {
          console.log('📱 Page became visible, refreshing roles');
          clearCachePattern('roles_');
          if (theaterId) {
            clearCachePattern(`theater_${theaterId}`);
          }
          fetchRoles();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [theaterId, fetchRoles]);



  // Handle delete role
  const handleDeleteClick = (role) => {
    if (role.isDefault && !role.canDelete) {
      alert('This is a default Theater Admin role and cannot be deleted.');
      return;
    }
    
    setConfirmModal({
      show: true,
      roleId: role._id,
      roleName: role.name
    });
  };

  const confirmDelete = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/roles/${confirmModal.roleId}?permanent=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok) {
        // Clear cache and force refresh
        clearCachePattern('roles_');
        if (theaterId) {
          clearCachePattern(`theater_${theaterId}`);
        }
        alert('Role deleted successfully');
        // fetchRoles always bypasses cache now
        fetchRoles();
      } else {
        alert(result.message || result.error || 'Failed to delete role');
      }
    } catch (error) {

      alert('Failed to delete role');
    } finally {
      setConfirmModal({ show: false, roleId: null, roleName: '' });
    }
  };

  // Handle edit role
  const handleEditClick = (role) => {
    if (role.isDefault && !role.canEdit) {
      alert('This is a default Theater Admin role and cannot be edited.');
      return;
    }
    
    // Mark navigation state for refresh detection
    sessionStorage.setItem('roles_navigation_state', 'from_create_or_edit');
    sessionStorage.setItem('last_role_action', Date.now().toString());
    
    // Navigate to RoleCreate page with theaterId and roleId in query params for editing
    if (theaterId) {
      navigate(`/roles/${theaterId}?editRoleId=${role._id}`);
    } else {
      // If no theaterId, try to get it from role
      const roleTheaterId = role.theater?._id || role.theater;
      if (roleTheaterId) {
        navigate(`/roles/${roleTheaterId}?editRoleId=${role._id}`);
      } else {
        alert('Cannot edit role: Theater ID not found');
      }
    }
  };

  // Handle create role
  const handleCreateRole = () => {
    // Mark navigation state for refresh detection
    sessionStorage.setItem('roles_navigation_state', 'from_create_or_edit');
    sessionStorage.setItem('last_role_action', Date.now().toString());
    
    // Navigate to RoleCreate page - the route is /roles/:theaterId
    if (theaterId) {
      navigate(`/roles/${theaterId}`);
    } else {
      // If no theaterId, navigate to roles list to select a theater first
      navigate('/roles');
    }
  };

  return (
    <ErrorBoundary>
      <AdminLayout>
        <div className="theater-list-page qr-management-page">
          {/* Header */}
          <div className="page-header-section">
            <div className="header-content">
              <h1 className="page-title">
                {theater ? `${theater.name} - Role Management` : 'Role Management'}
              </h1>
              <button className="add-theater-btn" onClick={handleCreateRole}>
                <i className="fas fa-plus"></i>
                Create New Role
              </button>
            </div>
          </div>

          {/* Statistics - Enhanced with QR Stats Design */}
          <div className="qr-stats">
            <div className="stat-card">
              <div className="stat-number">{totalItems}</div>
              <div className="stat-label">Total Roles</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{roles.filter(r => r.isActive).length}</div>
              <div className="stat-label">Active Roles</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{roles.filter(r => !r.isActive).length}</div>
              <div className="stat-label">Inactive Roles</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{roles.filter(r => r.isDefault).length}</div>
              <div className="stat-label">Default Roles</div>
            </div>
          </div>

          {/* Filters */}
          <div className="theater-list-section">
            <div className="filters-section">
              <div className="theater-filters">
                <div className="search-box">
                  <i className="fas fa-search search-icon"></i>
                  <input
                    type="text"
                    placeholder="Search roles by name or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="pagination-info">
                Showing {roles.length > 0 ? ((currentPage - 1) * itemsPerPage + 1) : 0} 
                {' - '}
                {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} roles
                {' (Page '}{currentPage} of {totalPages || 1}{')'}
              </div>

              <div className="items-per-page">
                <label>Items per page:</label>
                <select value={itemsPerPage} onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="error-message">
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            )}

            {/* Roles Table */}
            <div className="theater-table-container">
              <table className="theater-table">
                <thead>
                  <tr>
                    <th className="sno-cell">S.No</th>
                    <th className="name-cell">Role Name</th>
                    <th className="description-cell">Description</th>
                    <th className="permissions-cell">Permissions</th>
                    <th className="status-cell">Status</th>
                    <th className="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="loading-cell">
                        <div className="loading-spinner"></div>
                        <span>Loading roles...</span>
                      </td>
                    </tr>
                  ) : roles.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-cell">
                        <i className="fas fa-user-shield fa-3x"></i>
                        <p>No roles found</p>
                        <button className="add-theater-btn" onClick={handleCreateRole}>
                          Create First Role
                        </button>
                      </td>
                    </tr>
                  ) : (
                    roles.map((role, index) => (
                      <tr key={role._id} className="theater-row">
                        <td className="sno-cell">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="name-cell">
                          <div className="role-name-wrapper">
                            <strong>{role.name}</strong>
                            {role.isDefault && (
                              <span className="default-role-badge" title="Default role - Cannot be edited or deleted">
                                <i className="fas fa-shield-alt"></i> Default
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="description-cell">
                          {role.description || 'No description'}
                        </td>
                        <td className="permissions-cell">
                          {role.permissions ? role.permissions.length : 0} permissions
                        </td>
                        <td className="status-cell">
                          <span className={`status-badge ${role.isActive ? 'active' : 'inactive'}`}>
                            {role.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="actions-cell">
                          <ActionButtons>
                            <ActionButton
                              icon="edit"
                              onClick={() => handleEditClick(role)}
                              disabled={role.isDefault && !role.canEdit}
                              title={role.isDefault && !role.canEdit ? "Cannot edit default role" : "Edit role"}
                            />
                            <ActionButton
                              icon="trash"
                              onClick={() => handleDeleteClick(role)}
                              disabled={role.isDefault && !role.canDelete}
                              title={role.isDefault && !role.canDelete ? "Cannot delete default role" : "Delete role"}
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
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {confirmModal.show && (
          <div className="modal-overlay" onClick={() => setConfirmModal({ show: false, roleId: null, roleName: '' })}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete the role "<strong>{confirmModal.roleName}</strong>"?</p>
              <p className="warning-text">This action cannot be undone.</p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setConfirmModal({ show: false, roleId: null, roleName: '' })}>
                  Cancel
                </button>
                <button className="btn-delete" onClick={confirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default RolesList;
