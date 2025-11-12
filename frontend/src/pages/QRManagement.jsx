import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import config from '../config';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import Pagination from '../components/Pagination';
import { useToast } from '../contexts/ToastContext';
import { clearTheaterCache, addCacheBuster } from '../utils/cacheManager';
import { usePerformanceMonitoring, preventLayoutShift } from '../hooks/usePerformanceMonitoring';
import { optimizedFetch } from '../utils/apiOptimizer';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';


// Enhanced Lazy Loading Image Component with Intersection Observer (matching TheaterList)
const LazyTheaterImage = React.memo(({ src, alt, className, style }) => {
  const [imageSrc, setImageSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setIsLoading(true);
    setHasError(false);
    setImageSrc(null);
    
    if (!src) {
      setIsLoading(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (isIntersecting && src && !imageSrc) {
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
    }
  }, [isIntersecting, src, imageSrc]);

  if (!src) {
    return (
      <div className="no-logo" ref={imgRef}>
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="lazy-theater-container" style={style} ref={imgRef}>
      {imageSrc && !isLoading ? (
        <img
          src={imageSrc}
          alt={alt}
          className={`${className} ${hasError ? 'error' : ''}`}
          style={style}
        />
      ) : isLoading ? (
        <div className="image-loading-placeholder">
          <div className="image-skeleton"></div>
        </div>
      ) : hasError ? (
        <div className="no-logo">
          <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '24px', height: '24px', color: '#8b5cf6'}}>
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
          </svg>
        </div>
      ) : null}
    </div>
  );
});

LazyTheaterImage.displayName = 'LazyTheaterImage';

// Table Skeleton Component
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

const TableSkeleton = React.memo(({ count = 10 }) => (
  <>
    {Array.from({ length: count }, (_, index) => (
      <TableSkeletonRow key={`table-skeleton-${index}`} />
    ))}
  </>
));

TableSkeleton.displayName = 'TableSkeleton';

const QRManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('QRManagement');
  
  // Data state
  const [managementData, setManagementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    totalTheaters: 0,
    totalCanteenQRs: 0,
    totalScreenQRs: 0,
    totalQRs: 0
  });
  
  // Pagination state (matching TheaterList)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState({});
  
  // Filter state with debounced search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Performance refs (matching TheaterList)
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sort management data by ID in ascending order
  const sortedManagementData = useMemo(() => {
    return [...managementData].sort((a, b) => {
      // Sort by MongoDB ObjectId in ascending order (chronological creation order)
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [managementData]);

  // Debounced search effect (matching TheaterList)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 500); // PERFORMANCE: 500ms debounce to reduce API calls

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Define loadManagementData with useCallback
  const loadManagementData = useCallback(async () => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      setLoading(true);
      setError('');
      
      // Build query parameters with pagination
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        isActive: 'true' // Only fetch active theaters
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim());
      }
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const baseUrl = `${config.api.baseUrl}/theaters?${params.toString()}`;
      const cacheKey = `qr_management_theaters_page_${currentPage}_limit_${itemsPerPage}_search_${debouncedSearchTerm || 'none'}`;
      const data = await optimizedFetch(
        baseUrl,
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
        throw new Error('Failed to fetch QR management data');
      }
      
      if (data.success) {
        // Process theaters data from theaters API
        const theaters = data.data || [];
        setManagementData(theaters);
        
        // Handle pagination data from theaters API
        const paginationData = data.pagination || {};
        setPagination(paginationData);
        setTotalPages(paginationData.totalPages || 0);
        setTotalItems(paginationData.totalItems || 0);
        
        // Calculate QR statistics from theaters data
        const totalTheaters = theaters.length;
        let totalCanteenQRs = 0;
        let totalScreenQRs = 0;
        
        theaters.forEach(theater => {
          // Count QR codes from theater data if available
          if (theater.qrCodes) {
            theater.qrCodes.forEach(qr => {
              if (qr.type === 'canteen') totalCanteenQRs++;
              else if (qr.type === 'screen') totalScreenQRs++;
            });
          }
        });
        
        setSummary({
          totalTheaters,
          totalCanteenQRs,
          totalScreenQRs,
          totalQRs: totalCanteenQRs + totalScreenQRs
        });
      } else {
        setError('Failed to load  data');
      }
    } catch (error) {
      // Handle AbortError gracefully
      if (error.name === 'AbortError') {

        return;
      }
      setError('Failed to load QR management data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, itemsPerPage]);

  // Load management data with pagination and search
  useEffect(() => {
    loadManagementData();
  }, [loadManagementData]);

  // Force reload when navigating back to this page
  useEffect(() => {
    loadManagementData();
  }, [location.key, loadManagementData]);

  // Pagination handlers (matching TheaterList)
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  }, []);

  // Cleanup effect for aborting requests (matching TheaterList)
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

  const viewTheaterQRs = (theater) => {
    // Navigate to theater-specific QR management page
    navigate(`/qr-theater/${theater._id}`, { 
      state: { 
        theater,
        canteenQRCount: theater.canteenQRCount,
        screenQRCount: theater.screenQRCount
      }
    });
  };

  const headerButton = (
    <button 
      className="add-theater-btn"
      onClick={() => navigate('/qr-generate')}
    >
      <span className="btn-icon">+</span>
      GENERATE QR CODES
    </button>
  );

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="QR Management" currentPage="qr-list">
        <div className="theater-list-container qr-management-page">
          {/* Main Theater Management Container */}
          <div className="theater-main-container">
            {/* Header */}
            <div className="theater-list-header">
              <div className="header-content">
                <h1>QR Code Management</h1>
              </div>
              {headerButton}
            </div>

            {/* Statistics Section */}
            <div className="qr-stats" key={`stats-${location.key}`}>
              <div className="stat-card">
                <div className="stat-number">{summary.totalTheaters || 0}</div>
                <div className="stat-label">Total Theaters</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.totalCanteenQRs || 0}</div>
                <div className="stat-label">Canteen QRs</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.totalScreenQRs || 0}</div>
                <div className="stat-label">Screen QRs</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{summary.totalQRs || 0}</div>
                <div className="stat-label">Total QR Codes</div>
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
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                <div className="filter-controls">
                  <div className="results-count">
                    Showing {sortedManagementData.length} of {totalItems} theaters (Page {currentPage} of {totalPages})
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
              {sortedManagementData.length === 0 && !loading ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: 'var(--text-gray)'}}>
                      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                    </svg>
                  </div>
                  <h3>No Theaters Found</h3>
                  <p>No theaters are currently available in the system.</p>
                  <button 
                    className="btn-primary" 
                    onClick={() => navigate('/add-theater')}
                  >
                    CREATE YOUR FIRST THEATER
                  </button>
                </div>
              ) : (
                <div className="table-container">
                  <div className="table-wrapper">
                    <table className="theater-table">
                      <thead>
                        <tr>
                          <th className="sno-col">S NO</th>
                          <th className="photo-col">LOGO</th>
                          <th className="name-col">Theater Name</th>
                          <th className="owner-col">Canteen QR Count</th>
                          <th className="contact-col">Screen QR Count</th>
                          <th className="actions-col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <TableSkeleton count={itemsPerPage} />
                        ) : (
                          sortedManagementData.map((theater, index) => (
                            <tr key={theater._id} className="theater-row">
                              {/* S NO Column */}
                              <td className="sno-cell">
                                <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                              </td>

                              {/* Logo Column */}
                              <td className="theater-logo-cell">
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

                              {/* Theater Name Column */}
                              <td className="name-cell">
                                <div className="theater-name-container">
                                  <div className="theater-name">{theater.name || 'No Name'}</div>
                                  <div className="theater-location">
                                    {(theater.location?.address || theater.location?.city) ? `${theater.location?.city || ''}, ${theater.location?.state || ''}` : 'Location not specified'}
                                  </div>
                                </div>
                              </td>

                              {/* Canteen QR Count Column */}
                              <td className="owner-cell">
                                <div className="owner-info">
                                  <span className="count-badge canteen-badge">
                                    {theater.canteenQRCount || 0}
                                  </span>
                                </div>
                              </td>

                              {/* Screen QR Count Column */}
                              <td className="contact-cell">
                                <div className="contact-info">
                                  <span className="count-badge screen-badge">
                                    {theater.screenQRCount || 0}
                                  </span>
                                </div>
                              </td>

                              {/* Actions Column */}
                              <td className="actions-cell">
                                <button
                                  className="action-btn view-btn"
                                  onClick={() => viewTheaterQRs(theater)}
                                  title="View QR Codes"
                                >
                                  <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagination - Global Component */}
              {!loading && sortedManagementData.length > 0 && (
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

export default QRManagement;
