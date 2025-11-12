import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { optimizedFetch } from '../utils/apiOptimizer';
import config from '../config';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';
import '../styles/RoleCreate.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



const RolesList = () => {
  const navigate = useNavigate();
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

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    try {
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
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const cacheKey = `roles_${theaterId || 'all'}_page_${currentPage}_limit_${itemsPerPage}_search_${debouncedSearchTerm || 'none'}`;
      const result = await optimizedFetch(
        `${config.api.baseUrl}/roles?${params.toString()}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Accept': 'application/json'
          }
        },
        cacheKey,
        120000 // 2-minute cache
      );
      
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
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {

        return;
      }

      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm, theaterId]);

  useEffect(() => {
    fetchTheater();
  }, [fetchTheater]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

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
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok) {
        alert('Role deleted successfully');
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
    
    navigate(`/roles/edit/${role._id}`);
  };

  // Handle create role
  const handleCreateRole = () => {
    if (theaterId) {
      navigate(`/roles/create?theaterId=${theaterId}`);
    } else {
      navigate('/roles/create');
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
