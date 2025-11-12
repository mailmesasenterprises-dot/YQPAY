import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { optimizedFetch } from '../utils/apiOptimizer';
import { getCachedData } from '../utils/cacheUtils';
import config from '../config';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';


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
    <div className="lazy-theater-container" style={style}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
        style={style}
      />
      {isLoading && <div className="theater-loading-spinner"></div>}
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

const QRCodeNameList = () => {
  const navigate = useNavigate();
  
  // Performance monitoring
  usePerformanceMonitoring('QRCodeNameList');
  
  // Cache key helper
  const getCacheKey = (page, limit, search) => 
    `theaters_qr_names_page_${page}_limit_${limit}_search_${search || 'none'}_active`;
  
  // 🚀 OPTIMIZED: Check cache synchronously on mount for instant loading
  const initialCacheKey = getCacheKey(1, 10, '');
  const initialCache = typeof window !== 'undefined' 
    ? getCachedData(initialCacheKey, 120000) 
    : null;
  const initialTheaters = (initialCache && initialCache.success) 
    ? (initialCache.data || []) 
    : [];
  const initialPagination = (initialCache && initialCache.pagination) 
    ? initialCache.pagination 
    : { totalPages: 0, totalItems: 0 };
  
  const [theaters, setTheaters] = useState(initialTheaters);
  const [loading, setLoading] = useState(initialTheaters.length === 0); // Only show loading if no cache
  const [error, setError] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialPagination.totalPages || 0);
  const [totalItems, setTotalItems] = useState(initialPagination.totalItems || 0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Performance optimization refs
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const hasInitialCache = useRef(initialTheaters.length > 0); // Track if we had cache on mount

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
      setCurrentPage(1);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Fetch theaters with error handling and caching - OPTIMIZED: optimizedFetch handles cache automatically
  const fetchTheaters = useCallback(async () => {
    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      // 🚀 PERFORMANCE: Only set loading if we didn't have initial cache
      if (!hasInitialCache.current) {
        setLoading(true);
      }
      setError('');

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        isActive: 'true', // Only fetch active theaters
        ...(debouncedSearchTerm && { q: debouncedSearchTerm })
      });

      // 🚀 PERFORMANCE: Use optimizedFetch - it handles cache automatically
      // If cache exists, this returns instantly (< 50ms), otherwise fetches from API
      const cacheKey = getCacheKey(currentPage, itemsPerPage, debouncedSearchTerm);
      const data = await optimizedFetch(
        `${config.api.baseUrl}/theaters?${params.toString()}`,
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

      if (!data) {
        throw new Error('Failed to fetch theaters');
      }

      if (data.success) {
        setTheaters(data.data || []);
        setTotalPages(data.pagination?.totalPages || 0);
        setTotalItems(data.pagination?.totalItems || 0);
      } else {
        throw new Error(data.message || 'Failed to fetch theaters');
      }
    } catch (error) {
      if (error.name === 'AbortError') {

        return;
      }

      setError('Failed to load theaters. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearchTerm]);

  // Load theaters on component mount and when dependencies change
  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters, debouncedSearchTerm]);

  // Handle view theater QR Code Name management - navigate to QR name management page for specific theater
  const handleQRNameManagementClick = (theater) => {
    navigate(`/qr-names/${theater._id}`);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Calculate display info for pagination
  const startItem = ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="QR Code Name Management" currentPage="qr-names">
        <div className="theater-list-container qr-name-management-list-page qr-management-page">
          {/* Main Theater Management Container */}
          <div className="theater-main-container">
            {/* Header */}
            <div className="theater-list-header">
              <div className="header-content">
                <h1>QR Code Name Management</h1>
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
                <div className="stat-number">{Array.isArray(theaters) ? theaters.filter(theater => theater && (theater.contact || theater.owner)).length : 0}</div>
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
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', opacity: 0.3}}>
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                  </svg>
                  <p>No Theaters Found</p>
                  <p>There are no theaters available for QR code name management at the moment.</p>
                  <button 
                    className="btn-primary" 
                    onClick={() => navigate('/add-theater')}
                  >
                    CREATE YOUR FIRST THEATER
                  </button>
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
                      <TableSkeleton count={itemsPerPage} />
                    ) : (
                      <tbody>
                        {Array.isArray(sortedTheaters) && sortedTheaters.length > 0 ? sortedTheaters.map((theater, index) => {
                          if (!theater || !theater._id) return null;
                          
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
                                {/* Fixed: Use branding.logoUrl like in TheaterList (not media.logo) */}
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
                                <ActionButtons>
                                  <ActionButton 
                                    type="view"
                                    onClick={() => handleQRNameManagementClick(theater)}
                                    title="Manage QR Code Names for this Theater"
                                  />
                                </ActionButtons>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                              Loading theaters...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    )}
                  </table>
                </div>
              )}

              {/* Pagination - Global Component */}
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

export default QRCodeNameList;