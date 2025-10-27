import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import PageContainer from '../components/PageContainer';
import VerticalPageHeader from '../components/VerticalPageHeader';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import config from '../config';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';

// Lazy Loading Image Component
const LazyImage = React.memo(({ src, alt, className, style, fallback = '/placeholder-theater.png' }) => {
  const [imageSrc, setImageSrc] = useState(fallback);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && src && src !== fallback) {
          const img = new Image();
          img.onload = () => {
            setImageSrc(src);
            setIsLoading(false);
            setHasError(false);
          };
          img.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
          img.src = src;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, fallback]);

  return (
    <div className="lazy-image-container" style={style}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
        style={style}
      />
      {isLoading && <div className="image-loading-spinner"></div>}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Skeleton components for loading state
const TableSkeleton = ({ count = 10 }) => (
  <tbody>
    {Array.from({ length: count }, (_, index) => (
      <TableSkeletonRow key={`skeleton-${index}`} />
    ))}
  </tbody>
);

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

// Skeleton component matching Role Access Management style
const TableRowSkeleton = () => (
  <tr className="skeleton-row">
    <td className="sno-cell"><div className="skeleton-text"></div></td>
    <td className="photo-cell"><div className="skeleton-text"></div></td>
    <td className="name-cell"><div className="skeleton-text"></div></td>
    <td className="owner-cell"><div className="skeleton-text"></div></td>
    <td className="contact-cell"><div className="skeleton-text"></div></td>
    <td className="actions-cell"><div className="skeleton-text"></div></td>
  </tr>
);

const PageAccessManagementList = () => {
  const navigate = useNavigate();
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('PageAccessManagementList');
  
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
      
      console.log('🌐 Fetching theaters for page access from:', `${config.api.baseUrl}/theaters?${params.toString()}`);
      
      const response = await fetch(`${config.api.baseUrl}/theaters?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch theaters');
      }
      const result = await response.json();
      
      const activeTheaters = result.data || [];
      console.log('🎭 Theater data received:', activeTheaters.length);
      setTheaters(activeTheaters);
      
      const paginationData = result.pagination || {};
      setTotalPages(paginationData.totalPages || 0);
      setTotalItems(paginationData.totalItems || 0);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        return;
      }
      console.error('Error fetching theaters:', error);
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
      <AdminLayout 
        pageTitle="Page Access Management" 
        currentPage="page-access"
      >
        <div className="page-access-list-page qr-management-page">
          <PageContainer
            hasHeader={false}
            className="page-access-vertical"
          >
            {/* Global Vertical Header Component */}
            <VerticalPageHeader
              title="Page Access Management"
              showBackButton={false}
              actionButton={null}
            />

            {/* Statistics */}
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-info">
                  <div className="stat-number">{totalItems || 0}</div>
                  <div className="stat-label">Total Active Theaters</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-info">
                  <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(t => t && t.isActive).length : 0}</div>
                  <div className="stat-label">Currently Active</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-info">
                  <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(t => t && (t.contactInfo || t.contact)).length : 0}</div>
                  <div className="stat-label">With Contact Info</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-info">
                  <div className="stat-number">{Array.isArray(theaters) ? theaters.length : 0}</div>
                  <div className="stat-label">Displayed on Page</div>
                </div>
              </div>
            </div>

            {/* Enhanced Filters Section */}
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
                  Showing {sortedTheaters.length} of {totalItems} theaters (Page {currentPage} of {totalPages || 1})
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
                    <th className="photo-col">Logo</th>
                    <th className="name-col">Theater Name</th>
                    <th className="owner-col">Owner Name</th>
                    <th className="contact-col">Contact Number</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }, (_, index) => (
                      <TableRowSkeleton key={`skeleton-${index}`} />
                    ))
                  ) : sortedTheaters.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="no-data">
                        <div className="empty-state">
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          <p>No theaters found</p>
                          {debouncedSearchTerm && (
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
                    sortedTheaters.map((theater, index) => (
                      <tr key={theater._id} className="theater-row">
                        <td className="sno-cell">
                          <div className="sno-number">{((currentPage - 1) * itemsPerPage) + index + 1}</div>
                        </td>
                        <td className="photo-cell">
                          <LazyImage
                            src={theater.documents?.logo || theater.branding?.logo || theater.logo || theater.photoUrl || '/placeholder-theater.png'}
                            alt={theater.name}
                            className="theater-photo-thumb"
                            fallback="/placeholder-theater.png"
                          />
                        </td>
                        <td className="name-cell">
                          <div className="theater-name-container">
                            <div className="theater-name">{theater.name || 'N/A'}</div>
                            <div className="theater-location">
                              {theater.location?.city && theater.location?.state 
                                ? `${theater.location.city}, ${theater.location.state}`
                                : theater.address?.city && theater.address?.state
                                ? `${theater.address.city}, ${theater.address.state}`
                                : 'Location not available'}
                            </div>
                          </div>
                        </td>
                        <td className="owner-cell">
                          {theater.ownerDetails?.name || theater.owner?.name || theater.ownerName || 'N/A'}
                        </td>
                        <td className="contact-cell">
                          {theater.ownerDetails?.contactNumber || theater.contact || theater.contactInfo?.phone || theater.phone || 'N/A'}
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
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                itemType="theaters"
              />
            )}
          </PageContainer>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default PageAccessManagementList;
