import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import ActionButton from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { useModal } from '../contexts/ModalContext';
import config from '../config';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';

// Table Row Skeleton for loading state
const TableRowSkeleton = () => (
  <tr className="theater-row skeleton">
    <td className="sno-cell"><div className="skeleton-text short"></div></td>
    <td className="photo-cell"><div className="theater-photo-thumb skeleton-image"></div></td>
    <td className="name-cell"><div className="skeleton-text medium"></div></td>
    <td className="owner-cell"><div className="skeleton-text medium"></div></td>
    <td className="contact-cell"><div className="skeleton-text medium"></div></td>
    <td className="actions-cell"><div className="skeleton-buttons"><div className="skeleton-button skeleton-small"></div></div></td>
  </tr>
);

// Define TableRowSkeleton.displayName for debugging
TableRowSkeleton.displayName = 'TableRowSkeleton';

const RoleAccessManagementList = () => {
  const navigate = useNavigate();
  const { showError } = useModal();
  
  // PERFORMANCE MONITORING: Track component performance
  usePerformanceMonitoring('RoleAccessManagementList');

  // Data state
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination state (matching TheaterList)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState({});

  // Search and filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Refs for performance optimization
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Sort theaters by ID in ascending order
  const sortedTheaters = useMemo(() => {
    return [...theaters].sort((a, b) => {
      // Sort by MongoDB ObjectId in ascending order (chronological creation order)
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [theaters]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch theaters data with pagination and search
  const fetchTheaters = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setLoading(true);
      setError('');
      
      // Build query parameters with pagination and search
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        isActive: 'true' // Only fetch active theaters
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }
      
      // PERFORMANCE OPTIMIZATION: Use optimized API endpoint with caching
      console.log('🌐 Fetching theaters for role access management from:', `${config.api.baseUrl}/theaters?${params.toString()}`);
      
      const response = await fetch(`${config.api.baseUrl}/theaters?${params.toString()}`, {
        signal: abortController.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch theaters for role access management');
      }
      
      const data = await response.json();
      console.log('🌐 Theater response for role access management:', data);
      
      if (data.success) {
        // PERFORMANCE OPTIMIZATION: Direct state updates
        const theaterData = data.data || [];
        setTheaters(theaterData);
        
        // Handle pagination data
        const paginationData = data.pagination || {};
        setPagination(paginationData);
        setTotalPages(paginationData.totalPages || 0);
        setTotalItems(paginationData.totalItems || 0);
      } else {
        throw new Error(data.message || 'Failed to fetch theaters for role access management');
      }
    } catch (error) {
      // Handle AbortError gracefully
      if (error.name === 'AbortError') {
        console.log('🌐 Theater fetch for role access management was cancelled');
        return;
      }
      
      console.error('Error fetching theaters for role access management:', error);
      setError('Failed to load theaters for role access management');
      setTheaters([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm]);

  // Effect to trigger data fetching when dependencies change
  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters, debouncedSearchTerm]);

  // Handle view theater role access management - navigate to role access management page for specific theater
  const handleRoleAccessManagementClick = (theater) => {
    navigate(`/role-access/${theater._id}`);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleItemsPerPageChange = (e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1);
  };

  // Handle search
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Error state
  if (error) {
    return (
      <AdminLayout pageTitle="Role Access Management" currentPage="role-access">
        <div className="error-container">
          <div className="error-message">
            <h2>Error Loading Theaters</h2>
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchTheaters}>
              Try Again
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Main component render
  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Role Access Management" currentPage="role-access">
        <div className="theater-list-container role-access-management-list-page qr-management-page">
          {/* Main Theater Management Container */}
          <div className="theater-main-container">
            {/* Header */}
            <div className="theater-list-header">
              <div className="header-content">
                <h1>Role Access Management</h1>
              </div>
            </div>

            {/* Statistics Section */}
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-number">{totalItems || 0}</div>
                <div className="stat-label">Total Active Theaters</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(theater => theater && theater.isActive).length : 0}</div>
                <div className="stat-label">Currently Active</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(theater => theater && theater.contact).length : 0}</div>
                <div className="stat-label">With Contact Info</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{Array.isArray(theaters) ? theaters.length : 0}</div>
                <div className="stat-label">Displayed on Page</div>
              </div>
            </div>

            {/* Theater Content Container */}
            <div className="theater-content">
              {/* Filters and Search */}
              <div className="theater-filters">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search theaters by name, city, or owner..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                </div>
                <div className="filter-controls">
                  <div className="results-count">
                    Showing {Array.isArray(sortedTheaters) ? sortedTheaters.length : 0} of {totalItems || 0} theaters (Page {currentPage || 1} of {totalPages || 1})
                  </div>
                  <div className="items-per-page">
                    <label>Items per page:</label>
                    <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="items-select">
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                      <option value="50">50</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Theater Table */}
              {sortedTheaters.length === 0 && !loading ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: 'var(--text-gray)'}}>
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1V3H9V1L3 7V9H1V11H3V19C3 20.1 3.9 21 5 21H11V19H5V11H3V9H21M16 12C14.9 12 14 12.9 14 14S14.9 16 16 16 18 15.1 18 14 17.1 12 16 12M24 20V18H18V20C18 21.1 18.9 22 20 22H22C23.1 22 24 21.1 24 20Z"/>
                  </svg>
                </div>
                <h3>No Theaters Found</h3>
                <p>There are no theaters available for role access management at the moment.</p>
                {debouncedSearchTerm && (
                  <p className="search-hint">
                    Try adjusting your search terms or <button type="button" onClick={() => setSearchTerm('')} className="clear-search-btn">clear the search</button>.
                  </p>
                )}
              </div>
            ) : (
              <div className="theater-table-container">
                <table className="theater-table">
                    <thead>
                      <tr>
                        <th className="sno-col">S NO</th>
                        <th className="photo-col">LOGO</th>
                        <th className="name-col">THEATER NAME</th>
                        <th className="owner-col">OWNER NAME</th>
                        <th className="contact-col">CONTACT NUMBER</th>
                        <th className="actions-col">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        // Loading skeleton (exact copy from Role Management)
                        Array.from({ length: itemsPerPage }, (_, index) => (
                          <TableRowSkeleton key={index} />
                        ))
                      ) : (
                        // Theater rows (EXACT copy from Role Management structure)
                        sortedTheaters.map((theater, index) => {
                          // Copy the exact data extraction from QR Names (corrected structure)
                          const theaterName = String(theater.name || 'Unnamed Theater');
                          const theaterCity = String(theater.location?.city || '');
                          const theaterState = String(theater.location?.state || '');
                          // Fixed: Use ownerDetails.name like in TheaterList
                          const theaterOwner = theater.ownerDetails?.name || 'Not specified';
                          // Fixed: Use ownerDetails.contactNumber like in TheaterList
                          const theaterPhone = theater.ownerDetails?.contactNumber || 'Not provided';
                          
                          return (
                            <tr key={theater._id} className="theater-row">
                              <td className="sno-cell">
                                <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                              </td>
                              
                              <td className="photo-cell">
                                {/* Fixed: Use branding.logoUrl like in TheaterList (not media.logoUrl) */}
                                {(theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl) ? (
                                  <img
                                    src={theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl}
                                    alt={theater.name}
                                    className="theater-logo"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="no-logo" style={{display: (theater.documents?.logo || theater.branding?.logo || theater.branding?.logoUrl) ? 'none' : 'flex'}}>
                                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
                                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                                  </svg>
                                </div>
                              </td>
                              
                              <td className="name-cell">
                                <div className="theater-name-container">
                                  <div className="theater-name">
                                    {theaterName}
                                  </div>
                                  <div className="theater-location">
                                    {/* Fixed: Check both address and city for better location display */}
                                    {(theater.location?.address || theater.location?.city) ? `${theaterCity}, ${theaterState}` : 'Location not specified'}
                                  </div>
                                </div>
                              </td>
                              
                              <td className="owner-cell">
                                {theaterOwner}
                              </td>
                              
                              <td className="contact-cell">
                                {theaterPhone}
                              </td>
                              
                              <td className="actions-cell">
                                <div className="action-buttons">
                                  <ActionButton 
                                    type="view"
                                    onClick={() => handleRoleAccessManagementClick(theater)}
                                    title="Manage Role Access for this Theater"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loading && (
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  itemType="theaters"
                />
              )}
          </div>
          {/* End theater-content */}
        </div>
        {/* End theater-main-container */}
        </div>
        {/* End theater-list-container */}
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default RoleAccessManagementList;