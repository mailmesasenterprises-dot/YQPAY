import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import config from '../config';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import PageContainer from '../components/PageContainer';
import VerticalPageHeader from '../components/VerticalPageHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import Pagination from '../components/Pagination';
import { useModal } from '../contexts/ModalContext';
import { clearTheaterCache, addCacheBuster } from '../utils/cacheManager';
import { usePerformanceMonitoring, preventLayoutShift } from '../hooks/usePerformanceMonitoring';
import { extractPagesFromAppJS, getPagesByRole } from '../utils/pageExtractor';
import { optimizedFetch } from '../utils/apiOptimizer';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import '../styles/QRManagementPage.css'; // Using same CSS as QR Code Types
import '../styles/TheaterList.css'; // Theater List design styling
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



// Table Row Skeleton Component (matching QR Code Types)
const TableRowSkeleton = React.memo(() => (
  <tr className="theater-row skeleton">
    <td><div className="skeleton-text short"></div></td>
    <td><div className="skeleton-text medium"></div></td>
    <td><div className="skeleton-text short"></div></td>
    <td><div className="skeleton-buttons"></div></td>
  </tr>
));

const PageAccessManagement = () => {
  // Get theaterId from URL params
  const { theaterId } = useParams();
  const navigate = useNavigate();
  
  // State management (identical to Role Access Management)
  const [pageAccessConfigs, setPageAccessConfigs] = useState([]);
  const [activeRoles, setActiveRoles] = useState([]);
  const [theater, setTheater] = useState(null);
  const [theaterLoading, setTheaterLoading] = useState(!!theaterId);
  
  // Filter pages to show only theater admin related pages
  const theaterAdminPages = useMemo(() => {
    const allPages = extractPagesFromAppJS();
    return allPages.filter(page => {
      // Include pages that have theater-admin or theater_user roles (theater admin related)
      return page.roles && (
        page.roles.includes('theater-admin') || 
        page.roles.includes('theater_user')
      );
    });
  }, []);
  
  const [frontendPages, setFrontendPages] = useState(theaterAdminPages);
  const [loading, setLoading] = useState(true);
  const [selectedPageAccess, setSelectedPageAccess] = useState(null);
  const [pageToggleStates, setPageToggleStates] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [summary, setSummary] = useState({
    activePageAccess: 0,
    inactivePageAccess: 0,
    totalPageAccess: 0
  });

  // Modal states (identical structure)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form data for page access - initialized with theater admin pages only
  const [formData, setFormData] = useState({
    roleId: '',
    pages: theaterAdminPages.map(page => ({
      page: page.page,
      pageName: page.pageName,
      route: page.route,
      hasAccess: false
    }))
  });

  // Refs and timeouts
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const { showError, showSuccess } = useModal();

  // Performance monitoring
  usePerformanceMonitoring('PageAccessManagement');

  // Load existing page access states from database
  const loadExistingPageAccess = useCallback(async () => {
    try {
      // ✅ FIX: Add authentication token
      const token = config.helpers.getAuthToken();
      
      // ✅ FIX: Fetch theater-specific page access data
      const url = theaterId 
        ? `${config.api.baseUrl}/page-access?theaterId=${theaterId}&limit=1000`
        : `${config.api.baseUrl}/page-access?limit=1000`;
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const cacheKey = `page_access_${theaterId || 'all'}_limit_1000`;
      const data = await optimizedFetch(
        url,
        {
          headers: {
            ...token ? { 'Authorization': `Bearer ${token}` } : {}
          }
        },
        cacheKey,
        120000 // 2-minute cache
      );
      

      if (data) {

        if (data.success && data.data) {
          // ✅ FIX: Backend returns data.data.pageAccessList as array for theater-specific query
          let existingPages = [];
          
          if (data.data.pageAccessList && Array.isArray(data.data.pageAccessList)) {
            // Theater-specific response: data.data.pageAccessList
            existingPages = data.data.pageAccessList;
  } else if (Array.isArray(data.data)) {
            // Global response: data.data (array directly)
            existingPages = data.data;
  }
          

          const toggleStates = {};
          
          existingPages.forEach(pageAccess => {

            toggleStates[pageAccess.page] = pageAccess.isActive;
          });
          
          setPageToggleStates(toggleStates);

          // Update summary counts
          const activeCount = existingPages.filter(p => p.isActive).length;
          const inactiveCount = existingPages.filter(p => !p.isActive).length;
          setSummary({
            activePageAccess: activeCount,
            inactivePageAccess: inactiveCount,
            totalPageAccess: theaterAdminPages.length
          });
          

          return true; // Successfully loaded
        }
      }
    } catch (error) {

      // If backend is not available, initialize with empty states
      setPageToggleStates({});
      return false; // Failed to load
    }
    return false;
  }, [theaterAdminPages.length, theaterId]);

  // Fetch theater details
  const fetchTheaterDetails = useCallback(async () => {
    if (!theaterId) {
      setTheaterLoading(false);
      return;
    }

    try {
      const token = config.helpers.getAuthToken();
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const result = await optimizedFetch(
        `${config.api.baseUrl}/theaters/${theaterId}`,
        {
          headers: {
            ...token ? { 'Authorization': `Bearer ${token}` } : {}
          }
        },
        `theater_${theaterId}`,
        120000 // 2-minute cache
      );

      if (result) {
        setTheater(result.success ? result.data : result);
      }
    } catch (error) {
  } finally {
      setTheaterLoading(false);
    }
  }, [theaterId]);

  // Load page data - mirror frontend pages and load existing toggle states
  const loadPageAccessData = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);

    try {
      // Always set the theater admin pages from App.js immediately - don't wait for backend
      setFrontendPages(theaterAdminPages);
      
      // Try to load existing page access states (don't block on this)
      loadExistingPageAccess().then(backendAvailable => {
        if (!backendAvailable) {
  }
      }).catch(err => {
  });
      
    } catch (error) {

      // Even if there's an error, still show the theater admin pages
      setFrontendPages(theaterAdminPages);
    } finally {
      // Always set loading to false

      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [theaterAdminPages, loadExistingPageAccess]);

  // Load active roles - just use static data for now
  const loadActiveRoles = useCallback(() => {
    // Static roles data - no backend calls
    const staticRoles = [
      { _id: '1', name: 'admin', description: 'Super Administrator' },
      { _id: '2', name: 'theater-admin', description: 'Theater Administrator' },
      { _id: '3', name: 'user', description: 'Regular User' }
    ];
    
    setActiveRoles(staticRoles);
  }, []);

  // Handle page toggle - POST to backend when toggled ON, DELETE when toggled OFF
  const handlePageToggleChange = useCallback(async (page, isEnabled) => {
    console.log('🔘 [handlePageToggleChange] Called with:', { page: page.pageName, isEnabled, theaterId });
    
    try {

      // ✅ FIX: Get authentication token
      const token = config.helpers.getAuthToken();
      console.log('🔘 [handlePageToggleChange] Token:', token ? 'Present' : 'Missing');

      if (!token) {
        showError('Authentication required. Please login again.');
        return;
      }
      
      if (isEnabled) {
        console.log('🔘 [handlePageToggleChange] Enabling page - POST to:', `${config.api.baseUrl}/page-access`);
        // POST to backend to save page access
        const response = await fetch(`${config.api.baseUrl}/page-access`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // ✅ FIX: Added auth header
          },
          body: JSON.stringify({
            page: page.page,
            pageName: page.pageName,
            route: page.route,
            description: page.description,
            allowedRoles: page.roles || [],
            isActive: true,
            theaterId: theaterId // ✅ FIX: Include theaterId for theater-specific page access
          })
        });

        console.log('🔘 [handlePageToggleChange] POST Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setPageToggleStates(prev => ({
              ...prev,
              [page.page]: true
            }));
            showSuccess(`Page "${page.pageName}" access enabled and saved to database`);
          } else {
            throw new Error(data.message || 'Failed to save page access');
          }
        } else if (response.status === 401) {
          throw new Error('Unauthorized: Please login as super admin');
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to save page access`);
        }
      } else {
        // ✅ FIX: DELETE - Need to find the page's MongoDB _id first, then delete by ID
        // First, fetch the page list to find the _id
        const fetchUrl = theaterId 
          ? `${config.api.baseUrl}/page-access?theaterId=${theaterId}`
          : `${config.api.baseUrl}/page-access`;
        
        const fetchResponse = await fetch(fetchUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!fetchResponse.ok) {
          throw new Error('Failed to fetch page list');
        }
        
        const fetchData = await fetchResponse.json();
        
        // Find the page to delete
        let pageToDelete = null;
        if (fetchData.success && fetchData.data) {
          const pageList = fetchData.data.pageAccessList || fetchData.data;
          pageToDelete = pageList.find(p => p.page === page.page);
        }
        
        if (!pageToDelete || !pageToDelete._id) {
          // Page doesn't exist in database, just toggle locally
          setPageToggleStates(prev => ({
            ...prev,
            [page.page]: false
          }));
          showSuccess(`Page "${page.pageName}" was already disabled`);
          return;
        }
        

        // Now delete by ID
        const response = await fetch(`${config.api.baseUrl}/page-access/${pageToDelete._id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });


        if (response.ok) {
          setPageToggleStates(prev => ({
            ...prev,
            [page.page]: false
          }));
          showSuccess(`Page "${page.pageName}" access disabled and removed from database`);
        } else if (response.status === 401) {
          throw new Error('Unauthorized: Please login as super admin');
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to remove page access`);
        }
      }
    } catch (error) {
      console.error('❌ [handlePageToggleChange] Error:', error);

      // If backend is not available, allow local toggle but show warning
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        setPageToggleStates(prev => ({
          ...prev,
          [page.page]: isEnabled
        }));
        showError(`Backend server not available. Page "${page.pageName}" toggled locally but not saved to database.`);
      } else {
        showError(`Failed to ${isEnabled ? 'enable' : 'disable'} page access: ${error.message}`);
      }
    }
  }, [showSuccess, showError, theaterId]);

  // Debounced search functionality - filter pages client-side
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Search handler
  const handleSearch = useCallback((e) => {
    const query = e.target.value;
    setSearchTerm(query);
  }, []);

  // Page change handler
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  // Items per page change
  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  }, []);

  // Create new page access configuration
  const handleCreateNewPageAccess = () => {

    // Ensure roles are loaded before opening modal
    if (activeRoles.length === 0) {

      loadActiveRoles();
    }
    
    const formPages = frontendPages.map(page => ({
      page: page.page,
      pageName: page.pageName,
      route: page.route,
      hasAccess: false
    }));
    
    
    setFormData({
      roleId: '',
      pages: formPages
    });
    setSelectedPageAccess(null);
    setShowCreateModal(true);
  };

  // Handle role selection in form
  const handleRoleChange = (roleId) => {
    setFormData(prev => ({
      ...prev,
      roleId
    }));
  };

  // Handle page access toggle
  const handlePageToggle = (pageKey, hasAccess) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.map(p => 
        p.page === pageKey ? { ...p, hasAccess } : p
      )
    }));
  };

  // Delete page access configuration
  const deletePageAccess = (pageAccess) => {
    setSelectedPageAccess(pageAccess);
    setShowDeleteModal(true);
  };

  const handleSubmitPageAccess = async () => {
    try {
      const selectedPages = formData.pages.filter(page => page.hasAccess);
      
      if (selectedPages.length === 0) {
        showError('Please select at least one page');
        return;
      }
      
      // ✅ FIX: Get authentication token
      const token = config.helpers.getAuthToken();
      
      if (!token) {
        showError('Authentication required. Please login again.');
        return;
      }

      setLoading(true);

      // ✅ FIX: Actually save to backend using batch endpoint
      const response = await fetch(`${config.api.baseUrl}/page-access/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // ✅ FIX: Added auth header
        },
        body: JSON.stringify({
          pages: selectedPages.map(page => ({
            page: page.page,
            pageName: page.pageName,
            route: page.route,
            description: frontendPages.find(p => p.page === page.page)?.description || '',
            allowedRoles: [formData.roleId],
            isActive: true
          }))
        })
      });


      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowCreateModal(false);
          toast.success('Record created successfully!');
          showSuccess(`✅ Page access saved to database! ${selectedPages.length} pages configured for role: ${activeRoles.find(r => r._id === formData.roleId)?.name || 'Unknown'}`);
          
          // Refresh page access data
          loadPageAccessData();
          
          // Reset form
          setFormData({
            roleId: '',
            pages: theaterAdminPages.map(page => ({
              page: page.page,
              pageName: page.pageName,
              route: page.route,
              hasAccess: false
            }))
          });
        } else {
          throw new Error(data.message || 'Failed to save page access');
        }
      } else if (response.status === 401) {
        throw new Error('Unauthorized: Please login as super admin');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save page access configuration`);
      }
    } catch (error) {

      showError(`Failed to save page access: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePageAccess = async () => {
    try {
      // ✅ FIX: Get authentication token
      const token = config.helpers.getAuthToken();
      
      if (!token) {
        showError('Authentication required. Please login again.');
        return;
      }

      if (!selectedPageAccess) {
        showError('No page access selected for deletion');
        return;
      }

      setLoading(true);

      // ✅ FIX: Actually delete from backend
      const response = await fetch(`${config.api.baseUrl}/page-access/${selectedPageAccess._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}` // ✅ FIX: Added auth header
        }
      });


      if (response.ok) {
        const data = await response.json();
        setShowDeleteModal(false);
          toast.success('Record deleted successfully!');
        showSuccess(`✅ Page access deleted successfully from database: ${selectedPageAccess.pageName || 'Unknown'}`);
        
        // Refresh page access data
        loadPageAccessData();
      } else if (response.status === 401) {
        throw new Error('Unauthorized: Please login as super admin');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete page access');
      }
    } catch (error) {

      showError(`Failed to delete page access: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Initial load - just mirror App.js pages
  useEffect(() => {
    // Fetch theater details if theaterId is present
    fetchTheaterDetails();
    
    // Load roles immediately
    loadActiveRoles();
    
    // Load page data
    loadPageAccessData();
  }, [fetchTheaterDetails, loadActiveRoles, loadPageAccessData]);

  // Update summary when toggle states change
  useEffect(() => {
    const totalAvailablePages = theaterAdminPages.length;
    const enabledPages = Object.values(pageToggleStates).filter(Boolean).length;
    
    setSummary({
      activePageAccess: enabledPages,
      inactivePageAccess: totalAvailablePages - enabledPages,
      totalPageAccess: totalAvailablePages
    });
  }, [pageToggleStates, theaterAdminPages.length]);

  // Sort and filter pages by search term
  const sortedPages = useMemo(() => {
    let filtered = [...frontendPages];
    
    // Apply search filter if search term exists
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(page => {
        const pageName = (page.pageName || '').toLowerCase();
        const route = (page.route || '').toLowerCase();
        const description = (page.description || '').toLowerCase();
        const pageKey = (page.page || '').toLowerCase();
        
        return pageName.includes(searchLower) || 
               route.includes(searchLower) || 
               description.includes(searchLower) ||
               pageKey.includes(searchLower);
      });
    }
    
    // Sort by page property in ascending order (alphabetical)
    return filtered.sort((a, b) => {
      const pageA = (a.page || '').toLowerCase();
      const pageB = (b.page || '').toLowerCase();
      return pageA.localeCompare(pageB);
    });
  }, [frontendPages, debouncedSearchTerm]);

  // Set up pagination data when sorted pages change
  useEffect(() => {
    if (sortedPages.length > 0) {
      setTotalItems(sortedPages.length);
      setTotalPages(Math.ceil(sortedPages.length / itemsPerPage));
    } else {
      setTotalItems(0);
      setTotalPages(0);
    }
  }, [sortedPages.length, itemsPerPage]);

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

  // Get paginated pages for current view
  const paginatedPages = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedPages.slice(startIndex, endIndex);
  }, [sortedPages, currentPage, itemsPerPage]);

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Page Access Management" currentPage="page-access">
        <div className="role-access-details-page qr-management-page">
        <PageContainer
          hasHeader={false}
          className="role-access-vertical"
        >
          {/* Global Vertical Header Component */}
          <VerticalPageHeader
            title={theaterLoading ? 'Loading Theater...' : (theater?.name || 'Page Access Management')}
            backButtonText="Back to Theater List"
            backButtonPath="/page-access"
          />

          {/* Stats Section */}
          <div className="qr-stats">
            <div className="stat-card">
              <div className="stat-number">{summary.activePageAccess}</div>
              <div className="stat-label">Enabled in Database</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{summary.inactivePageAccess}</div>
              <div className="stat-label">Disabled Pages</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{summary.totalPageAccess}</div>
              <div className="stat-label">Total Pages in App.js</div>
            </div>
          </div>

        {/* Theater Content Container */}
        <div className="theater-content">
          {/* Filters and Search (identical structure) */}
          <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search page access by role or page name..."
              className="search-input"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>

          <div className="filter-controls">
            <div className="results-count">
              Showing {paginatedPages.length} of {totalItems} pages (Page {currentPage} of {totalPages})
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

          {/* All Pages Table - Shows all available pages dynamically */}
          <div className="table-container">
            <div className="table-wrapper">
              <table className="theater-table">
            <thead>
              <tr>
                <th className="sno-col">S.NO</th>
                <th className="page-name-col">PAGE NAME</th>
                <th className="route-col">ROUTE</th>
                <th className="description-col">DESCRIPTION</th>
                <th className="access-status-col">ACCESS STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, index) => (
                  <tr key={index} className="theater-row skeleton">
                    <td className="sno-cell"><div className="skeleton-text short"></div></td>
                    <td className="page-name-cell"><div className="skeleton-text medium"></div></td>
                    <td className="route-cell"><div className="skeleton-text medium"></div></td>
                    <td className="description-cell"><div className="skeleton-text long"></div></td>
                    <td className="access-status-cell"><div className="skeleton-text short"></div></td>
                  </tr>
                ))
              ) : paginatedPages && paginatedPages.length > 0 ? (
                paginatedPages.map((page, index) => (
                  <tr key={page.page} className="theater-row">
                    <td className="sno-cell">
                      <div className="sno-number">{((currentPage - 1) * itemsPerPage) + index + 1}</div>
                    </td>
                    <td className="page-name-cell">
                      <div className="page-name">
                        {page.pageName}
                      </div>
                    </td>
                    <td className="route-cell">
                      <code className="route-code">
                        {page.route}
                      </code>
                    </td>
                    <td className="description-cell">
                      <div className="page-description">
                        {page.description}
                      </div>
                    </td>
                    <td className="access-status-cell">
                      <div className="access-status">
                        <label className="toggle-switch" style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: '50px',
                          height: '24px'
                        }}>
                          <input
                            type="checkbox"
                            checked={pageToggleStates[page.page] || false}
                            onChange={(e) => handlePageToggleChange(page, e.target.checked)}
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
                            backgroundColor: pageToggleStates[page.page] ? 'var(--primary-dark, #6D28D9)' : '#ccc',
                            transition: '.4s',
                            borderRadius: '24px'
                          }}>
                            <span style={{
                              position: 'absolute',
                              content: '""',
                              height: '18px',
                              width: '18px',
                              left: pageToggleStates[page.page] ? '26px' : '3px',
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      <p>No roles found</p>
                      <button 
                        className="btn-primary" 
                        onClick={() => setShowCreateModal(true)}
                      >
                        CREATE YOUR FIRST ROLE
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - Global Component */}
          {!loading && (
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={handlePageChange}
              itemType="pages"
            />
          )}
          </div> {/* End theater-content */}
        </PageContainer>
        </div> {/* End role-access-details-page */}

        {/* Modal components (identical structure to Role Access Management) */}

        {/* Create Modal - Following Global Design System */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                </div>
                
                <div className="modal-title-section">
                  <h2>Create Page Access</h2>
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
                    <label>Role *</label>
                    <select
                      value={formData.roleId}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="form-control"
                      required
                    >
                      <option value="">Select Role</option>
                      {activeRoles.map(role => (
                        <option key={role._id} value={role._id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Frontend Pages</label>
                    <div className="permissions-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px', marginTop: '10px'}}>
                      {formData.pages.map((page, index) => (
                        <div key={page.page} className="permission-item" style={{
                          padding: '10px', 
                          border: '1px solid #e0e0e0', 
                          borderRadius: '6px',
                          backgroundColor: page.hasAccess ? '#f0f9ff' : '#f9f9f9'
                        }}>
                          <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer'}}>
                            <input
                              type="checkbox"
                              checked={page.hasAccess}
                              onChange={(e) => handlePageToggle(page.page, e.target.checked)}
                              style={{marginRight: '8px'}}
                            />
                            <div>
                              <div style={{fontWeight: '500'}}>{page.pageName}</div>
                              <div style={{fontSize: '12px', color: '#666'}}>{page.route}</div>
                            </div>
                          </label>
                        </div>
                      ))}
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
                  onClick={handleSubmitPageAccess}
                  disabled={!formData.roleId}
                >
                  Create Page Access
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal - Following Global Design System */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                </div>
                
                <div className="modal-title-section">
                  <h2>Delete Page Access</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <p>Are you sure you want to delete page access for <strong>{selectedPageAccess?.pageName}</strong>?</p>
                  <p style={{color: '#ef4444', fontSize: '14px', marginTop: '10px'}}>
                    This action will remove access to this page for the assigned role and cannot be undone.
                  </p>
                </div>
              </div>
              
              {/* Fixed Footer with Cancel and Delete Buttons */}
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="delete-btn" 
                  onClick={handleDeletePageAccess}
                >
                  Delete Page Access
                </button>
              </div>
            </div>
          </div>
        )}

      </AdminLayout>

      {/* Custom CSS for modal width - matches TheaterList */}
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

export default PageAccessManagement;
