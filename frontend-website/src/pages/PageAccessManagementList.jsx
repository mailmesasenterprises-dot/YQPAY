import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import config from '../config';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';

// Skeleton components for loading state
const TableSkeletonRow = React.memo(() => (
  <tr className="theater-row skeleton-row">
    <td className="sno-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="photo-cell">
      <div className="theater-photo-thumb skeleton-image"></div>
    </td>
    <td className="name-cell">
      <div className="skeleton-line skeleton-medium"></div>
    </td>
    <td className="owner-cell">
      <div className="skeleton-line skeleton-medium"></div>
    </td>
    <td className="contact-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="actions-cell">
      <div className="skeleton-buttons">
        <div className="skeleton-button skeleton-small"></div>
      </div>
    </td>
  </tr>
));

TableSkeletonRow.displayName = 'TableSkeletonRow';


const PageAccessManagementList = () => {
  const navigate = useNavigate();
  
  // State management
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Performance refs
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sort theaters by ID in ascending order
  const sortedTheaters = useMemo(() => {
    return [...theaters].sort((a, b) => {
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
      setCurrentPage(1);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch theaters function
  const fetchTheaters = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Build query parameters for active theaters only
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        isActive: 'true'
      });

      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }

      // PERFORMANCE OPTIMIZATION: Enable caching for faster loads
      const response = await fetch(`${config.api.baseUrl}/theaters?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'max-age=60', // Cache for 1 minute
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch theaters');
      }
      const result = await response.json();
      
      const activeTheaters = result.data || [];

      setTheaters(activeTheaters);
      
      const paginationData = result.pagination || {};
      setTotalPages(paginationData.totalPages || 0);
      setTotalItems(paginationData.totalItems || 0);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      setError('Failed to load theaters');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm]);

  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters]);

  // Handle navigate to page access for specific theater
  const handlePageAccessClick = (theater) => {
    navigate(`/page-access/${theater._id}`);
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
      <AdminLayout pageTitle="Page Access Management" currentPage="page-access">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchTheaters} className="retry-btn">
            Try Again
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Page Access Management" currentPage="page-access">
        <div className="theater-list-container role-management-list-page qr-management-page">
          {/* Main Theater Management Container */}
          <div className="theater-main-container">
            {/* Header */}
            <div className="theater-list-header">
              <div className="header-content">
                <h1>Page Access Management</h1>
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
                <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(theater => theater && (theater.contactInfo || theater.contact)).length : 0}</div>
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
                  <p>There are no theaters available for page access management at the moment.</p>
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
                    {loading ? (
                      <tbody>
                        {Array.from({ length: 5 }, (_, index) => (
                          <TableSkeletonRow key={`skeleton-${index}`} />
                        ))}
                      </tbody>
                    ) : (
                      <tbody>
                        {Array.isArray(sortedTheaters) && sortedTheaters.map((theater, index) => {
                          if (!theater || !theater._id) return null;
                          
                          const theaterName = String(theater.name || 'Unnamed Theater');
                          const theaterCity = String(theater.location?.city || '');
                          const theaterState = String(theater.location?.state || '');
                          // Fixed: Use ownerDetails.name like in RoleManagementList
                          const theaterOwner = theater.ownerDetails?.name || 'Not specified';
                          // Fixed: Use ownerDetails.contactNumber like in RoleManagementList
                          const theaterPhone = theater.ownerDetails?.contactNumber || 'Not provided';
                          
                          return (
                            <tr key={theater._id} className="theater-row">
                              <td className="sno-cell">
                                <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                              </td>
                              
                              <td className="photo-cell">
                                {/* Fixed: Use branding.logoUrl like in RoleManagementList (not media.logoUrl) */}
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
                                    {/* Fixed: Check both address and city for location display */}
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
                              <ActionButtons>
                                <ActionButton 
                                  type="view"
                                  onClick={() => handlePageAccessClick(theater)}
                                  title="Manage Page Access"
                                />
                              </ActionButtons>
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    )}
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
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default PageAccessManagementList;


