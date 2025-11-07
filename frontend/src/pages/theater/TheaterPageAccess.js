import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import config from '../../config';
import AdminLayout from '../../components/AdminLayout';
import PageContainer from '../../components/PageContainer';
import VerticalPageHeader from '../../components/VerticalPageHeader';
import ErrorBoundary from '../../components/ErrorBoundary';
import Pagination from '../../components/Pagination';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { extractPagesFromAppJS } from '../../utils/pageExtractor';
import '../../styles/QRManagementPage.css';
import '../../styles/TheaterList.css';

// Table Row Skeleton Component
const TableRowSkeleton = () => (
  <tr className="skeleton-row">
    <td className="sno-cell"><div className="skeleton-text"></div></td>
    <td className="name-cell"><div className="skeleton-text"></div></td>
    <td className="route-cell"><div className="skeleton-text"></div></td>
    <td className="status-cell"><div className="skeleton-text"></div></td>
  </tr>
);

const TheaterPageAccess = () => {
  const { theaterId } = useParams();
  const navigate = useNavigate();
  const { showError, showSuccess } = useModal();
  
  // Get all theater-related pages from App.js
  const theaterAdminPages = useMemo(() => {
    const allPages = extractPagesFromAppJS();
    return allPages.filter(page => {
      return page.roles && (
        page.roles.includes('theater-admin') || 
        page.roles.includes('theater_user')
      );
    });
  }, []);
  
  // State management
  const [theater, setTheater] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageToggleStates, setPageToggleStates] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [summary, setSummary] = useState({
    activePages: 0,
    inactivePages: 0,
    totalPages: 0
  });

  const isMountedRef = useRef(true);

  usePerformanceMonitoring('TheaterPageAccess');

  // Debug: Log toggle states whenever they change
  useEffect(() => {
  }, [pageToggleStates]);

  // Load theater data
  const loadTheaterData = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setTheater(result.theater || result.data);
      }
    } catch (error) {
  }
  }, [theaterId]);

  // Load existing page access for this theater
  const loadPageAccess = useCallback(async (skipLoadingState = false) => {
    try {
      if (!skipLoadingState) {
        setLoading(true);
      }
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      

      // Use the new array-based API endpoint
      const response = await fetch(`${config.api.baseUrl}/page-access?theaterId=${theaterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      

      if (response.ok) {
        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data.pageAccessList)) {
          const existingPages = data.data.pageAccessList;

          // Build toggle states from existing pages
          const toggleStates = {};
          existingPages.forEach(p => {
            // If page exists in database, it should be ON (true)
            toggleStates[p.page] = true;
  });
          

          setPageToggleStates(toggleStates);

          // Update summary
          setSummary({
            activePages: existingPages.length,
            inactivePages: theaterAdminPages.length - existingPages.length,
            totalPages: theaterAdminPages.length
          });
        } else {
          // No pages yet - all toggles OFF

          setPageToggleStates({});
          setSummary({
            activePages: 0,
            inactivePages: theaterAdminPages.length,
            totalPages: theaterAdminPages.length
          });
        }
      } else {
  }
    } catch (error) {

      setPageToggleStates({});
      setSummary({
        activePages: 0,
        inactivePages: theaterAdminPages.length,
        totalPages: theaterAdminPages.length
      });
    } finally {
      if (!skipLoadingState) {
        setLoading(false);
      }
    }
  }, [theaterId, theaterAdminPages.length]);

  useEffect(() => {
    isMountedRef.current = true;
    loadTheaterData();
    loadPageAccess();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadTheaterData, loadPageAccess]);

  // Handle page toggle
  const handlePageToggleChange = useCallback(async (page, isEnabled) => {
    try {

      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      
      if (!token) {
        showError('Authentication required. Please login again.');
        return;
      }
      
      if (isEnabled) {
        // POST to add page to theater's array
        const response = await fetch(`${config.api.baseUrl}/page-access`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            theaterId: theaterId,
            page: page.page,
            pageName: page.pageName,
            route: page.route,
            description: page.description || `Access to ${page.pageName}`,
            category: 'admin'
          })
        });
        
        if (response.ok) {
          const responseData = await response.json();

          showSuccess(`Page "${page.pageName}" activated successfully`);
          
          // Immediately update local state - CRITICAL: Do this synchronously
          const updatedStates = {
            ...pageToggleStates,
            [page.page]: true
          };

          setPageToggleStates(updatedStates);
          
          // Update summary
          setSummary(prev => ({
            activePages: prev.activePages + 1,
            inactivePages: prev.inactivePages - 1,
            totalPages: prev.totalPages
          }));
          
          // Don't reload immediately - let the user see the change
          // Reload after a longer delay to sync with backend
          setTimeout(() => {

            loadPageAccess(true); // Skip loading state to prevent UI flash
          }, 1500);
        } else {
          const errorData = await response.json();

          showError(errorData.message || 'Failed to activate page');
        }
      } else {
        // DELETE to remove page from theater's array
        // First we need to get the pages document to find the page's _id
        const getResponse = await fetch(`${config.api.baseUrl}/page-access?theaterId=${theaterId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (getResponse.ok) {
          const getData = await getResponse.json();
          if (getData.success && getData.data && Array.isArray(getData.data.pageAccessList)) {
            const pageToRemove = getData.data.pageAccessList.find(p => p.page === page.page);
            
            if (pageToRemove && pageToRemove._id) {
              // DELETE the page from the array
              const deleteResponse = await fetch(`${config.api.baseUrl}/page-access/${pageToRemove._id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (deleteResponse.ok) {

                showSuccess(`Page "${page.pageName}" deactivated successfully`);
                
                // Immediately update local state
                const updatedStates = { ...pageToggleStates };
                delete updatedStates[page.page];

                setPageToggleStates(updatedStates);
                
                // Update summary
                setSummary(prev => ({
                  activePages: prev.activePages - 1,
                  inactivePages: prev.inactivePages + 1,
                  totalPages: prev.totalPages
                }));
                
                // Reload to get updated metadata (but state should already be correct)
                setTimeout(() => {

                  loadPageAccess(true); // Skip loading state to prevent UI flash
                }, 1500);
              } else {
                const errorData = await deleteResponse.json();

                showError(errorData.message || 'Failed to deactivate page');
              }
            }
          }
        }
      }
      
    } catch (error) {

      showError('Failed to update page access');
    }
  }, [theaterId, showError, showSuccess, loadPageAccess]);

  // Filter and paginate pages
  const filteredPages = useMemo(() => {
    if (!searchTerm.trim()) {
      return theaterAdminPages;
    }
    
    const search = searchTerm.toLowerCase();
    return theaterAdminPages.filter(page =>
      page.pageName.toLowerCase().includes(search) ||
      page.page.toLowerCase().includes(search) ||
      (page.route && page.route.toLowerCase().includes(search))
    );
  }, [theaterAdminPages, searchTerm]);

  const paginatedPages = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPages.slice(startIndex, endIndex);
  }, [filteredPages, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredPages.length / itemsPerPage);

  return (
    <ErrorBoundary>
      <AdminLayout 
        pageTitle="Page Access Management" 
        currentPage="page-access"
      >
        <div className="page-access-details-page qr-management-page">
        <PageContainer
          hasHeader={false}
          className="page-access-vertical"
        >
          {/* Global Vertical Header Component */}
          <VerticalPageHeader
            title={theater?.name || 'Loading Theater...'}
            backButtonText="Back to Theater List"
            backButtonPath="/page-access"
            actionButton={null}
          />
        
        {/* Stats Section */}
        <div className="qr-stats">
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-number">{summary.totalPages || 0}</div>
              <div className="stat-label">Total Pages</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-number">{summary.activePages || 0}</div>
              <div className="stat-label">Active Pages</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-info">
              <div className="stat-number">{summary.inactivePages || 0}</div>
              <div className="stat-label">Inactive Pages</div>
            </div>
          </div>
        </div>

        {/* Enhanced Filters Section */}
        <div className="theater-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search pages by name or route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-controls">
            <div className="results-count">
              Showing {paginatedPages.length} of {filteredPages.length} pages (Page {currentPage} of {totalPages || 1})
            </div>
            <div className="items-per-page">
              <label>Items per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="items-select"
              >
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
                <th className="name-col">Page Name</th>
                <th className="route-col">Route</th>
                <th className="status-col">Access Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={`skeleton-${index}`} />
                ))
              ) : paginatedPages.length === 0 ? (
                <tr>
                  <td colSpan="4" className="no-data">
                    <div className="empty-state">
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                      </svg>
                      <p>No pages found</p>
                      {searchTerm && (
                        <button 
                          className="btn-primary" 
                          onClick={() => setSearchTerm('')}
                        >
                          Clear Search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPages.map((page, index) => (
                  <tr key={page.page} className="theater-row">
                    <td className="sno-cell">
                      <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                    </td>
                    <td className="name-cell">
                      <div className="theater-name-container">
                        <div className="theater-name">{page.pageName}</div>
                        <div className="theater-location">{page.page}</div>
                      </div>
                    </td>
                    <td className="route-cell">
                      <code style={{backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px'}}>
                        {page.route}
                      </code>
                    </td>
                    <td className="status-cell">
                      <div className="toggle-wrapper">
                        <label className="switch" style={{
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
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages >= 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPages.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            itemType="pages"
          />
        )}

        </PageContainer>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default TheaterPageAccess;
