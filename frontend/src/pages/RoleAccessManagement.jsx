import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import PageContainer from '../components/PageContainer';
import VerticalPageHeader from '../components/VerticalPageHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { useToast } from '../contexts/ToastContext';
import { optimizedFetch } from '../utils/apiOptimizer';
import config from '../config';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../styles/QRManagementPage.css';
import '../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



const RoleAccessManagement = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams(); // Get theaterId from URL
  const toast = useToast();

  // Theater state
  const [theater, setTheater] = useState(null);
  const [theaterLoading, setTheaterLoading] = useState(true);

  // State management
  const [rolePermissions, setRolePermissions] = useState([]);
  const [activeRoles, setActiveRoles] = useState([]);
  const [activePages, setActivePages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [summary, setSummary] = useState({
    activeRolePermissions: 0,
    inactiveRolePermissions: 0,
    totalRolePermissions: 0
  });

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRolePermission, setSelectedRolePermission] = useState(null);

  // Form data
  const [formData, setFormData] = useState({
    roleId: '',
    permissions: []
  });

  // Sort role permissions by ID in ascending order
  const sortedRolePermissions = useMemo(() => {
    return [...rolePermissions].sort((a, b) => {
      // Sort by MongoDB ObjectId in ascending order (chronological creation order)
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [rolePermissions]);

  // Load active pages from pageaccesses collection database for specific theater
  const loadActivePages = useCallback(async () => {
    if (!theaterId) {
      console.log('⚠️ [loadActivePages] No theaterId provided');
      setActivePages([]);
      return [];
    }
    
    try {
      console.log('🔄 [loadActivePages] Fetching pages for theater:', theaterId);
      
      // ✅ FIX: Use fresh fetch with cache-busting to get latest page list
      const cacheBuster = `_t=${Date.now()}`;
      const url = `${config.api.baseUrl}/page-access?theaterId=${theaterId}&${cacheBuster}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('authToken') && {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          })
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch pages`);
      }
      
      const data = await response.json();
      
      console.log('🔄 [loadActivePages] Response received:', data);

      // ✅ NEW: Backend returns data.data.pageAccessList (array-based structure per theater)
      if (data.success && data.data && data.data.pageAccessList && Array.isArray(data.data.pageAccessList)) {
        const pages = data.data.pageAccessList
          .filter(pageAccess => pageAccess.isActive !== false) // Only show active pages
          .map(pageAccess => ({
            page: pageAccess.page,
            pageName: pageAccess.pageName,
            description: pageAccess.description || `Access to ${pageAccess.pageName}`,
            route: pageAccess.route
          }));

        console.log('✅ [loadActivePages] Loaded', pages.length, 'active pages');
        setActivePages(pages);
        return pages;
      } else {
        console.warn('⚠️ [loadActivePages] No page access list found in response');
        setActivePages([]);
        return [];
      }
    } catch (error) {
      console.error('❌ [loadActivePages] Error loading pages:', error);
      setActivePages([]);
      return [];
    }
  }, [theaterId]);

  // Fetch theater details for theater-specific context
  const fetchTheater = useCallback(async () => {
    if (!theaterId) {
      setTheater(null);
      setTheaterLoading(false);
      return;
    }

    try {
      setTheaterLoading(true);
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const data = await optimizedFetch(
        `${config.api.baseUrl}/theaters/${theaterId}`,
        {
          headers: {
            'Accept': 'application/json',
            // Add auth token if it exists
            ...(localStorage.getItem('authToken') && {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            })
          }
        },
        `theater_${theaterId}`,
        120000 // 2-minute cache
      );
      
      if (!data) {
        throw new Error('Failed to fetch theater details');
      }

      // ✅ FIX: Backend returns data.data, not data.theater
      if (data.success && data.data) {

        setTheater(data.data);
      } else {
        throw new Error('Theater not found');
      }
    } catch (error) {

      toast.error(`Failed to load theater details: ${error.message}`);
      setTheater(null);
    } finally {
      setTheaterLoading(false);
    }
  }, [theaterId, toast]);

  // Refs
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load role permissions data
  const loadRolePermissionsData = useCallback(async (page = 1, limit = 10, search = '', forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search })
      });

      // Add theater filter if theaterId is present
      if (theaterId) {
        params.append('theaterId', theaterId);
      }

      // � FORCE REFRESH: Add cache-busting timestamp when forceRefresh is true
      if (forceRefresh) {
        params.append('_t', Date.now().toString());
        console.log('🔄 RoleAccessManagement FORCE REFRESHING from server (bypassing ALL caches)');
      }
      
      // 🔄 FORCE REFRESH: Add no-cache headers when forceRefresh is true
      const headers = {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('authToken') && {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        })
      };
      
      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      // �🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const cacheKey = `roles_theater_${theaterId || 'all'}_page_${page}_limit_${limit}_search_${search || 'none'}`;
      const data = await optimizedFetch(
        `${config.api.baseUrl}/roles?${params}`,
        {
          signal: abortController.signal,
          headers
        },
        forceRefresh ? null : cacheKey, // 🔄 FORCE REFRESH: Skip cache key when forceRefresh is true
        120000 // 2-minute cache
      );

      if (!data) {
        throw new Error('Failed to fetch roles');
      }

      if (isMountedRef.current && data.success) {
        const rolesData = data.data?.roles || [];
        const paginationData = data.data?.pagination || {};

        setRolePermissions(rolesData);
        setCurrentPage(paginationData.page || 1);
        setTotalPages(paginationData.pages || 1);
        setTotalItems(paginationData.total || 0);

        // Calculate summary
        const activeCount = rolesData.filter(role => role.isActive).length;
        const inactiveCount = rolesData.filter(role => !role.isActive).length;
        
        const newSummary = {
          activeRolePermissions: activeCount,
          inactiveRolePermissions: inactiveCount,
          totalRolePermissions: paginationData.total || 0
        };
        
        setSummary(newSummary);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        if (isMountedRef.current) {
          toast.error('Failed to load role permissions. Please try again.');
          setRolePermissions([]);
          setSummary({ activeRolePermissions: 0, inactiveRolePermissions: 0, totalRolePermissions: 0 });
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterId, toast]);

  // Load active roles
  const loadActiveRoles = useCallback(async () => {
    try {
      
      // SECURITY: Build URL with theater isolation
      let url = `${config.api.baseUrl}/roles?limit=100&isActive=true`;
      if (theaterId && theaterId !== 'null' && theaterId !== 'undefined') {
        url += `&theaterId=${theaterId}`;
      } else {
  }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          // Add auth token if it exists
          ...(localStorage.getItem('authToken') && {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          })
        }
      });
      
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.data?.roles) {
          const activeRoles = data.data.roles.filter(role => role.isActive !== false);
          setActiveRoles(activeRoles);
        } else {
          toast.error('Failed to load roles: Invalid response format');
        }
      } else {
        const errorText = await response.text();
        toast.error(`Failed to load roles: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      toast.error(`Error loading roles: ${error.message}`);
    }
  }, [theaterId, toast]);  // Debounced search
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadRolePermissionsData(1, itemsPerPage, query);
    }, 500);
  }, [itemsPerPage, loadRolePermissionsData]);

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
    loadRolePermissionsData(1, newLimit, searchTerm);
  }, [loadRolePermissionsData, searchTerm]);

  const handlePageChange = useCallback((newPage) => {
    loadRolePermissionsData(newPage, itemsPerPage, searchTerm);
  }, [itemsPerPage, searchTerm, loadRolePermissionsData]);

  // Debug: Track modal state changes
  useEffect(() => {
    console.log('🔵 [Modal State] showEditModal changed:', showEditModal);
  }, [showEditModal]);

  // CRUD Operations
  const viewRolePermission = (rolePermission) => {
    setSelectedRolePermission(rolePermission);
    setShowViewModal(true);
  };

  const editRolePermission = async (role) => {
    console.log('🔵 [editRolePermission] Called with role:', role);
    
    // ✅ FIX: Reload active pages to get the latest list (in case pages were deleted)
    console.log('🔄 [editRolePermission] Reloading active pages to get fresh data...');
    const freshPages = await loadActivePages();
    console.log('🔵 [editRolePermission] Fresh active pages:', freshPages);
    
    setSelectedRolePermission(role);
    
    // ✅ FIX: Only include permissions for pages that still exist in active pages
    const activePageIds = new Set(freshPages.map(p => p.page));
    const savedPermissions = role.permissions || [];
    
    console.log('🔵 [editRolePermission] Active page IDs:', Array.from(activePageIds));
    console.log('🔵 [editRolePermission] Saved permissions:', savedPermissions);
    
    // Filter out deleted pages from saved permissions
    const validSavedPermissions = savedPermissions.filter(p => activePageIds.has(p.page));
    console.log('✅ [editRolePermission] Valid saved permissions (deleted pages removed):', validSavedPermissions);
    
    // Prepare form data with all active pages (include saved state only for existing pages)
    const permissions = freshPages.map(page => {
      const existingPermission = validSavedPermissions.find(p => p.page === page.page);
      return {
        page: page.page,
        pageName: page.pageName,
        hasAccess: existingPermission ? existingPermission.hasAccess : false
      };
    });
    
    console.log('🔵 [editRolePermission] Final prepared permissions:', permissions);

    setFormData({
      roleId: role._id,
      permissions: permissions
    });
    
    console.log('🔵 [editRolePermission] Opening edit modal...');
    setShowEditModal(true);
  };

  const deleteRolePermission = (rolePermission) => {
    setSelectedRolePermission(rolePermission);
    setShowDeleteModal(true);
  };

  const handleCreateNewRolePermission = async () => {
    // ✅ FIX: Reload active pages to get the latest list
    console.log('🔄 [handleCreateNewRolePermission] Reloading active pages...');
    const freshPages = await loadActivePages();
    
    // Check if there are active pages available from database
    if (freshPages.length === 0) {
      toast.error('No active pages available for role access management. Please activate pages in Page Access Management first.');
      return;
    }
    
    // Reset form for new role permission
    const defaultPermissions = freshPages.map(page => ({
      page: page.page,
      pageName: page.pageName,
      hasAccess: false
    }));
    
    setFormData({
      roleId: '',
      permissions: defaultPermissions
    });
    setSelectedRolePermission(null);
    setShowCreateModal(true);
  };

  // Submit handler for create/edit
  const handleSubmitRolePermission = async (isEdit = false) => {
    const startTime = Date.now();

    try {
      // For editing role permissions, we update the role's permissions array
      if (isEdit && selectedRolePermission) {
        const url = `${config.api.baseUrl}/roles/${selectedRolePermission._id}`;
        
        // ✅ Only send permissions field (critical for default roles)
        const payload = {
          permissions: formData.permissions
        };
        

        const fetchStartTime = Date.now();
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            // Add auth token if it exists
            ...(localStorage.getItem('authToken') && {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            })
          },
          body: JSON.stringify(payload),
        });
        const fetchDuration = Date.now() - fetchStartTime;
        

        if (response.ok) {
          const data = await response.json();
          

          // Update local state immediately with the updated role from response
          if (data.success && data.data?.role) {
            setRolePermissions(prevRoles => 
              prevRoles.map(role => 
                role._id === selectedRolePermission._id 
                  ? { ...role, permissions: data.data.role.permissions }
                  : role
              )
            );
          }
          
          // Close modal
          setShowEditModal(false);
          toast.success('Record updated successfully!');
          
          // 🔄 FORCE REFRESH: Reload from server with cache bypass to ensure consistency
          setTimeout(async () => {
            await loadRolePermissionsData(currentPage, itemsPerPage, searchTerm, true);
          }, 100);
          
          // ✅ Better success message for default roles
          if (selectedRolePermission.isDefault) {
            toast.success('Theater Admin permissions updated successfully! Page access has been modified.');
          } else {
            toast.success('Role permissions updated successfully');
          }
          
          // Reset form
          setFormData({
            roleId: '',
            permissions: activePages.map(page => ({
              page: page.page,
              pageName: page.pageName,
              hasAccess: false
            }))
          });
          setSelectedRolePermission(null);
        } else {
          const errorData = await response.json();
          

          // ✅ Enhanced error messages based on status code
          if (response.status === 401) {
            toast.error('Authentication required. Please login again.');
          } else if (response.status === 403) {
            if (errorData.code === 'TOKEN_INVALID') {
              toast.error('Your session has expired. Please login again.');
            } else if (errorData.code === 'DEFAULT_ROLE_PROTECTED') {
              toast.error(
                'Theater Admin role is protected. ' +
                'You can update page access permissions, but role properties like name and description cannot be changed.'
              );
            } else {
              toast.error(errorData.error || 'Insufficient permissions to update this role.');
            }
          } else if (errorData.code === 'DEFAULT_ROLE_PROTECTED') {
            toast.error(
              'Theater Admin role is protected. ' +
              'You can update page access permissions, but role properties like name and description cannot be changed.'
            );
          } else if (errorData.error) {
            toast.error(errorData.error);
          } else {
            toast.error(errorData.message || 'Failed to update role permissions');
          }
        }
      } else {
        // For creating, we don't create new roles here - role creation is in RoleCreate page
        toast.error('Please use the Role Create page to create new roles. This page is for managing existing role permissions.');
        setShowCreateModal(false);
          toast.success('Record created successfully!');
      }
    } catch (error) {

      toast.error(`Failed to save role permissions: ${error.message}. Please check your internet connection and try again.`);
    }
  };

  const handleDeleteRolePermission = async () => {
    try {
      const response = await fetch(`${config.api.baseUrl}/roles/${selectedRolePermission._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          // Add auth token if it exists
          ...(localStorage.getItem('authToken') && {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          })
        }
      });
      
      if (response.ok) {
        setShowDeleteModal(false);
          toast.success('Role deleted successfully!');
        toast.success('Role deleted successfully');
        loadRolePermissionsData(currentPage, itemsPerPage, searchTerm);
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to delete role');
      }
    } catch (error) {
      toast.error('Failed to delete role. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePermissionChange = (pageIndex, hasAccess) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.map((perm, index) => 
        index === pageIndex ? { ...perm, hasAccess } : perm
      )
    }));
  };

  // Component mount effect
  useEffect(() => {
    isMountedRef.current = true;
    
    fetchTheater();
    // 🔄 FORCE REFRESH: Always force refresh on component mount to ensure fresh data
    loadRolePermissionsData(1, 10, '', true);
    loadActiveRoles();
    loadActivePages();
    
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [fetchTheater, loadRolePermissionsData, loadActiveRoles, loadActivePages]);

  // Skeleton component
  const TableRowSkeleton = () => (
    <tr className="skeleton-row">
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
      <td><div className="skeleton-text"></div></td>
    </tr>
  );

  // Header button - Removed as requested
  const headerButton = null;


  return (
    <ErrorBoundary>
      <AdminLayout 
        pageTitle={theaterId ? `Role Access Management` : "Role Access Management"} 
        currentPage="role-access"
      >
        <div className="role-access-details-page qr-management-page">
        <PageContainer
          hasHeader={false}
          className="role-access-vertical"
        >
          {/* Global Vertical Header Component */}
          <VerticalPageHeader
            title={theaterLoading ? 'Loading Theater...' : (theater?.name || 'Role Access Management')}
            backButtonText="Back to Theater List"
            backButtonPath="/role-access"
            actionButton={headerButton}
          />

          {/* Statistics */}
          <div className="qr-stats">
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-number">{summary.activeRolePermissions || 0}</div>
                <div className="stat-label">Active Role Access</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-number">{summary.inactiveRolePermissions || 0}</div>
                <div className="stat-label">Inactive Role Access</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-info">
                <div className="stat-number">{summary.totalRolePermissions || 0}</div>
                <div className="stat-label">Total Role Access</div>
              </div>
            </div>
          </div>

        {/* Enhanced Filters Section matching RoleCreate */}
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
            <div className="results-count">
              Showing {sortedRolePermissions.length} of {totalItems} role access (Page {currentPage} of {totalPages || 1})
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
                      <button 
                        className="btn-primary" 
                        onClick={handleCreateNewRolePermission}
                      >
                        CREATE YOUR FIRST ROLE ACCESS
                      </button>
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
                        {rolePermission.name !== 'Kiosk Screen' && (
                          <ActionButton 
                            type="edit"
                            onClick={() => editRolePermission(rolePermission)}
                            title="Edit Role Access"
                          />
                        )}
                      </ActionButtons>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* End theater-table-container */}

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

        {/* End PageContainer - Modals are inside AdminLayout but outside PageContainer */}
        </PageContainer>
        </div>

        {/* Modals are outside PageContainer but inside AdminLayout */}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create Role Access</h2>
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
                    <label>Select Role</label>
                    <select 
                      value={formData.roleId} 
                      onChange={(e) => handleInputChange('roleId', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select a role...</option>
                      {activeRoles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    {activeRoles.length === 0 && (
                      <small className="text-muted">No active roles found. Check console for errors.</small>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Page Permissions</label>
                    <div className="permissions-grid" style={{maxHeight: '300px', overflowY: 'auto'}}>
                      {formData.permissions.length === 0 ? (
                        <div style={{padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic'}}>
                          No active pages available. Please activate pages in Page Access Management first.
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
                  onClick={() => handleSubmitRolePermission(false)}
                  disabled={!formData.roleId}
                >
                  Create Role Access
                </button>
              </div>
            </div>
          </div>
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
                  onClick={() => handleSubmitRolePermission(true)}
                >
                  Save Changes
                </button>
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
              </div>
              
              {/* Footer with Close Button */}
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
        )}

        {/* Delete Modal */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete role access for <strong>{selectedRolePermission?.roleName || selectedRolePermission?.role?.name}</strong>?</p>
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

      </AdminLayout>

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
        `
      }} />
    </ErrorBoundary>
  );
};

export default RoleAccessManagement;
