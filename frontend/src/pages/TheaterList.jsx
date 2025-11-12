import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import config from '../config';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import { useModal } from '../contexts/ModalContext';
import { clearTheaterCache } from '../utils/cacheManager';
import { optimizedFetch } from '../utils/apiOptimizer';
import { optimisticDelete, invalidateRelatedCaches } from '../utils/crudOptimizer';
import { getImageSrc } from '../utils/globalImageCache'; // 🚀 Instant image loading
import InstantImage from '../components/InstantImage';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import '../styles/TheaterList.css';
import '../styles/QRManagementPage.css';
import '../styles/TheaterGlobalModals.css'; // Global theater modal styles
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



// Lazy Loading Image Component WITH INSTANT CACHE
const LazyImage = React.memo(({ src, alt, className, style, fallback = '/placeholder-theater.png' }) => {
  // 🚀 INSTANT: Check cache first synchronously
  const cachedSrc = src ? getImageSrc(src) : fallback;
  const [imageSrc, setImageSrc] = useState(cachedSrc || fallback);
  const [isLoading, setIsLoading] = useState(!cachedSrc);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // If already cached, no need for lazy loading
    if (cachedSrc) {
      setImageSrc(cachedSrc);
      setIsLoading(false);
      return;
    }

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
  }, [src, fallback, cachedSrc]);

  return (
    <div className="lazy-image-container" style={style}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
        style={style}
      />
      {isLoading && (
        <div className="image-loading-placeholder">
          <div className="image-skeleton"></div>
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Loading Skeleton Components
const TheaterCardSkeleton = React.memo(() => (
  <div className="theater-card skeleton-card">
    <div className="theater-card-image skeleton-image"></div>
    <div className="theater-card-content">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-subtitle"></div>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-buttons">
        <div className="skeleton-button"></div>
        <div className="skeleton-button"></div>
      </div>
    </div>
  </div>
));

TheaterCardSkeleton.displayName = 'TheaterCardSkeleton';

const TheaterListSkeleton = React.memo(({ count = 6 }) => (
  <div className="theaters-grid">
    {Array.from({ length: count }, (_, index) => (
      <TheaterCardSkeleton key={`skeleton-${index}`} />
    ))}
  </div>
));

TheaterListSkeleton.displayName = 'TheaterListSkeleton';

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
    <td className="location-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="contact-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="agreement-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="status-cell">
      <div className="skeleton-line skeleton-small"></div>
    </td>
    <td className="access-status-cell">
      <div className="skeleton-toggle"></div>
    </td>
    <td className="actions-cell">
      <div className="skeleton-buttons">
        <div className="skeleton-button skeleton-small"></div>
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

// Memoized Theater Row Component to prevent unnecessary re-renders
const TheaterRow = React.memo(({ theater, index, onEdit, onView, onDelete }) => (
  <tr key={theater._id}>
    <td>{theater.name || 'N/A'}</td>
    <td>{theater.ownerDetails?.name || 'N/A'}</td>
    <td>{theater.phone || 'N/A'}</td>
    <td>{theater.address ? `${theater.address.city}, ${theater.address.state}` : 'N/A'}</td>
    <td>
      <span className={`status ${theater.isActive ? 'active' : 'inactive'}`}>
        {theater.isActive ? 'Active' : 'Inactive'}
      </span>
    </td>
    <td className="actions-cell">
      <ActionButtons>
        <ActionButton 
          type="view"
          onClick={() => onView(theater, index)}
          title="View theater details"
        />
        <ActionButton 
          type="edit"
          onClick={() => onEdit(theater, index)}
          title="Edit theater"
        />
        <ActionButton 
          type="delete"
          onClick={() => onDelete(theater)}
          title="Delete theater"
        />
      </ActionButtons>
    </td>
  </tr>
));

TheaterRow.displayName = 'TheaterRow';

// 🚀 OPTIMIZED: Memoized component to prevent unnecessary re-renders
const TheaterList = React.memo(() => {
  const navigate = useNavigate();
  const modal = useModal();
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterList');
  
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, theater: null });
  const [viewModal, setViewModal] = useState({ show: false, theater: null });
  const [editModal, setEditModal] = useState({ show: false, theater: null });
  const [editFormData, setEditFormData] = useState({});
  const [uploadFiles, setUploadFiles] = useState({
    theaterPhoto: null,
    logo: null,
    aadharCard: null,
    panCard: null,
    gstCertificate: null,
    businessLicense: null,
    agreementDocument: null
  });
  const [uploadProgress, setUploadProgress] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [togglingTheaterId, setTogglingTheaterId] = useState(null); // Track which theater is being toggled
  
  // Summary state for statistics
  const [summary, setSummary] = useState({
    totalTheaters: 0,
    activeTheaters: 0,
    inactiveTheaters: 0,
    activeAgreements: 0
  });

  // Sort theaters by ID in ascending order
  const sortedTheaters = useMemo(() => {
    return [...theaters].sort((a, b) => {
      // Sort by MongoDB ObjectId in ascending order (chronological creation order)
      const idA = a._id || '';
      const idB = b._id || '';
      return idA.localeCompare(idB);
    });
  }, [theaters]);

  // Helper function to close modal with cleanup
  const closeEditModal = useCallback(() => {
    // Clear upload files and progress
    setUploadFiles({
      theaterPhoto: null,
      logo: null,
      aadharCard: null,
      panCard: null,
      gstCertificate: null,
      businessLicense: null,
      agreementDocument: null
    });
    
    setUploadProgress({});
    
    // Close modal
    setEditModal({ show: false, theater: null, currentIndex: 0 });
  }, []);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState({});

  // Performance refs (matching QRManagement)
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounced search effect (matching QRManagement)
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

  // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
  const fetchTheaters = useCallback(async () => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      setLoading(true);
      setError('');
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('q', debouncedSearchTerm.trim());
      }
      
      if (filterStatus !== 'all') {
        params.append('isActive', filterStatus === 'active' ? 'true' : 'false');
      }
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const cacheKey = `theaters_list_page_${currentPage}_limit_${itemsPerPage}_search_${debouncedSearchTerm || 'none'}_status_${filterStatus}`;
      const result = await optimizedFetch(
        `${config.api.baseUrl}/theaters?${params.toString()}`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${config.helpers.getAuthToken() || localStorage.getItem('authToken') || ''}`
          }
        },
        cacheKey,
        120000 // 2-minute cache
      );
      
      if (!result) {
        throw new Error('Failed to fetch theaters');
      }
      
      // Handle response data
      const newTheaters = result.data || result.theaters || [];
      const paginationData = result.pagination || {};
      
      // Update state
      setTheaters(newTheaters);
      setPagination(paginationData);
      setTotalPages(paginationData.totalPages || 0);
      setTotalItems(paginationData.totalItems || 0);
      
      // Calculate and update summary statistics
      const activeCount = newTheaters.filter(theater => theater.isActive).length;
      const inactiveCount = newTheaters.filter(theater => !theater.isActive).length;
      const activeAgreementsCount = newTheaters.filter(theater => 
        theater.agreementDetails && 
        theater.agreementDetails.startDate && 
        theater.agreementDetails.endDate &&
        new Date(theater.agreementDetails.endDate) > new Date()
      ).length;
      
      setSummary({
        totalTheaters: newTheaters.length,
        activeTheaters: activeCount,
        inactiveTheaters: inactiveCount,
        activeAgreements: activeAgreementsCount
      });
      
    } catch (error) {
      // Handle AbortError gracefully
      if (error.name === 'AbortError') {
        return;
      }

      setError('Failed to load theaters');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, filterStatus, itemsPerPage]);

  // 🚀 PERFORMANCE: Fetch theaters when filters/page change
  useEffect(() => {
    fetchTheaters();
  }, [fetchTheaters]);

  const handleDelete = useCallback(async (theaterId) => {
    const apiCall = () => {
      const token = config.helpers.getAuthToken();
      return fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...token ? { 'Authorization': `Bearer ${token}` } : {}
        }
      });
    };

    try {
      // 🚀 OPTIMISTIC DELETE - Remove from UI immediately
      await optimisticDelete({
        apiCall,
        itemId: theaterId,
        onOptimisticUpdate: (id) => {
          const removedTheater = theaters.find(t => t._id === id);
          setTheaters(prev => prev.filter(t => t._id !== id));
          setTotalItems(prev => prev - 1);
          return removedTheater;
        },
        onSuccess: () => {
          setDeleteModal({ show: false, theater: null });
          modal.showSuccess('Theater removed from display (data preserved in database)');
          console.log('✅ Theater deleted successfully');
        },
        onError: (error, removedTheater) => {
          if (removedTheater) {
            setTheaters(prev => [...prev, removedTheater]);
            setTotalItems(prev => prev + 1);
          }
          modal.showError(error.message || 'Failed to delete theater');
        },
        cachePatterns: ['theater', 'api_get_theaters']
      });
    } catch (error) {
      console.error('Delete theater error:', error);
      // Error already handled in optimistic function
    }
  }, [theaters, modal]);

  const handleEditClick = useCallback((theater) => { // Debug log
    setEditFormData({
      theaterName: theater.name || '',
      ownerName: theater.ownerDetails?.name || '',
      ownerContactNumber: theater.ownerDetails?.contactNumber || '',
      phone: theater.phone || '',
      email: theater.email || '',
      address: theater.address?.street || '',
      city: theater.address?.city || '',
      state: theater.address?.state || '',
      pincode: theater.address?.pincode || theater.address?.zipCode || ''
    });
    // Reset upload files when opening edit modal
    setUploadFiles({
      theaterPhoto: null,
      logo: null,
      aadharCard: null,
      panCard: null,
      gstCertificate: null,
      businessLicense: null,
      agreementDocument: null
    });
    setUploadProgress({});
    setEditModal({ show: true, theater });
  }, []);

  const handleViewClick = useCallback((theater) => {
    setViewModal({ show: true, theater });
  }, []);

  const handleEditFormChange = useCallback((field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleFileChange = useCallback((fileType, file) => {
    setUploadFiles(prev => ({
      ...prev,
      [fileType]: file
    }));
  }, []);

  // New handler for the integrated upload fields
  const handleFileUpload = useCallback((event, fileType) => {
    const file = event.target.files[0];
    if (file) {
      setUploadFiles(prev => ({
        ...prev,
        [fileType]: file
      }));
    }
  }, []);

  // Handler for removing existing files
  const handleRemoveFile = useCallback((fileType) => {
    // Remove from uploadFiles state if it's a newly uploaded file
    setUploadFiles(prev => ({
      ...prev,
      [fileType]: null
    }));
    
    // Also update the editModal theater data to remove the existing file
    if (editModal.theater) {
      if (fileType === 'agreementCopy') {
        // Handle agreementCopy which is stored in both documents and agreementDetails
        setEditModal(prev => ({
          ...prev,
          theater: {
            ...prev.theater,
            documents: {
              ...prev.theater.documents,
              agreementCopy: null
            },
            agreementDetails: {
              ...prev.theater.agreementDetails,
              copy: null
            }
          }
        }));
      } else {
        // Handle regular documents
        setEditModal(prev => ({
          ...prev,
          theater: {
            ...prev.theater,
            documents: {
              ...prev.theater.documents,
              [fileType]: null
            }
          }
        }));
      }
    }
  }, [editModal.theater]);

  // Handler for downloading files
  const handleDownloadFile = useCallback((fileUrl, fileName) => {
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'document';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {

      modal.showError('Failed to download file');
    }
  }, [modal]);

  const uploadFile = async (file, fileType) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    formData.append('theaterId', editModal.theater._id);

    try {
      setUploadProgress(prev => ({ ...prev, [fileType]: 0 }));
      
      const response = await fetch(`${config.api.baseUrl}/upload/theater-document`, {
        method: 'POST',
        body: formData,
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [fileType]: progress }));
        }
      });

      if (!response.ok) {
        throw new Error('File upload failed');
      }

      const result = await response.json();
      setUploadProgress(prev => ({ ...prev, [fileType]: 100 }));
      
      return result.fileUrl || result.url;
    } catch (error) {

      setUploadProgress(prev => ({ ...prev, [fileType]: null }));
      throw error;
    }
  };

  const handleEditSubmit = async () => {
    try {
      // Create FormData to handle both files and form fields
      const formData = new FormData();
      
      // Add form fields
      if (editFormData.theaterName) formData.append('name', editFormData.theaterName);
      if (editFormData.ownerName) formData.append('ownerName', editFormData.ownerName);
      if (editFormData.ownerContactNumber) formData.append('ownerContactNumber', editFormData.ownerContactNumber);
      if (editFormData.phone) formData.append('phone', editFormData.phone);
      if (editFormData.email) formData.append('email', editFormData.email);
      if (editFormData.address) formData.append('address', editFormData.address);
      if (editFormData.city) formData.append('city', editFormData.city);
      if (editFormData.state) formData.append('state', editFormData.state);
      if (editFormData.pincode) formData.append('pincode', editFormData.pincode);
      
      // Add any new files
      const fileTypes = Object.keys(uploadFiles);
      for (const fileType of fileTypes) {
        if (uploadFiles[fileType]) {
          formData.append(fileType, uploadFiles[fileType]);
        }
      } // Debug log

      const response = await fetch(`${config.api.baseUrl}/theaters/${editModal.theater._id}`, {
        method: 'PUT',
        headers: {
          // Don't set Content-Type header - browser will set it automatically with boundary for FormData
          ...config.helpers.getAuthToken() ? { 'Authorization': `Bearer ${config.helpers.getAuthToken()}` } : {}
        },
        body: formData
      }); // Debug log

      if (!response.ok) {
        const errorData = await response.text();

        throw new Error('Failed to update theater');
      }

      const responseData = await response.json(); // Debug log
      
      // Handle different response formats
      const updatedTheater = responseData.data || responseData; // Debug log
      
      // First, update the local state immediately for instant feedback
      setTheaters(prevTheaters => 
        prevTheaters.map(theater => 
          theater._id === editModal.theater._id ? { ...theater, ...updatedTheater } : theater
        )
      );
      
      // Update the current modal theater with the updated data
      setEditModal(prevModal => ({
        ...prevModal,
        theater: updatedTheater
      }));
      
      // Clear uploaded files and progress immediately for better UX
      setUploadFiles({
        theaterPhoto: null,
        logo: null,
        aadharCard: null,
        panCard: null,
        gstCertificate: null,
        businessLicense: null,
        agreementDocument: null
      });
      setUploadProgress({});
      
      // Show success message and close modal for instant feedback
      modal.showSuccess('Theater updated successfully!');
      closeEditModal();
      
      // Optional: Background refresh for data consistency (no await to avoid blocking)
      fetchTheaters().catch(error => {

        // No user-facing error since local update already succeeded
      });
    } catch (error) {

      modal.showError('Failed to update theater');
    }
  };

  const toggleTheaterStatus = async (theaterId, currentStatus) => {
    const newStatus = !currentStatus;
    
    // Prevent multiple clicks on the same theater
    if (togglingTheaterId === theaterId) return;
    
    try {
      console.log('🔄 Toggling theater status:', { theaterId, currentStatus, newStatus });
      
      // Set loading state for this specific theater
      setTogglingTheaterId(theaterId);
      
      // 🚀 INSTANT UI UPDATE: Update local state immediately for instant feedback
      setTheaters(prevTheaters => 
        prevTheaters.map(theater => 
          theater._id === theaterId 
            ? { ...theater, isActive: newStatus }
            : theater
        )
      );

      // Also update summary counts immediately for better UX
      setSummary(prev => ({
        ...prev,
        activeTheaters: newStatus ? prev.activeTheaters + 1 : prev.activeTheaters - 1,
        inactiveTheaters: newStatus ? prev.inactiveTheaters - 1 : prev.inactiveTheaters + 1
      }));

      // Now make the API call in the background
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...config.helpers.getAuthToken() ? { 'Authorization': `Bearer ${config.helpers.getAuthToken()}` } : {}
        },
        body: JSON.stringify({ isActive: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update theater status');
      }

      const result = await response.json();
      console.log('✅ Theater status updated successfully:', result);

      // Optional: Show success message
      if (modal.showSuccess) {
        modal.showSuccess(`Theater ${newStatus ? 'activated' : 'deactivated'} successfully`);
      }

    } catch (error) {
      console.error('❌ Failed to toggle theater status:', error);
      
      // 🔄 ROLLBACK: Revert the optimistic update if API fails
      setTheaters(prevTheaters => 
        prevTheaters.map(theater => 
          theater._id === theaterId 
            ? { ...theater, isActive: currentStatus } // Revert to original status
            : theater
        )
      );

      // Revert summary counts as well
      setSummary(prev => ({
        ...prev,
        activeTheaters: currentStatus ? prev.activeTheaters + 1 : prev.activeTheaters - 1,
        inactiveTheaters: currentStatus ? prev.inactiveTheaters - 1 : prev.inactiveTheaters + 1
      }));

      // Show error message
      modal.showError('Failed to update theater status. Please try again.');
    } finally {
      // Clear loading state
      setTogglingTheaterId(null);
    }
  };

  // Handle search with debounce
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    // currentPage reset is handled in debounced effect
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback((e) => {
    setFilterStatus(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  // Pagination handlers (matching QRManagement)
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  }, []);

  // Cleanup effect for aborting requests (matching QRManagement)
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

  if (loading) {
    return (
      <AdminLayout pageTitle="Theater Management" currentPage="theaters">
        <div className="theater-list-container">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading theaters...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout pageTitle="Theater Management" currentPage="theaters">
        <div className="theater-list-container">
          <div className="error-state">
            <h3>Error Loading Theaters</h3>
            <p>{error}</p>
            <button onClick={fetchTheaters} className="retry-btn">
              Try Again
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Theater Management" currentPage="theaters">
      <div className="theater-list-container qr-management-page">
        {/* Main Theater Management Container */}
        <div className="theater-main-container">
          {/* Header */}
          <div className="theater-list-header">
            <div className="header-content">
              <h1>Theater Management</h1>
            </div>
            <button 
              onClick={() => navigate('/add-theater')} 
              className="add-theater-btn"
            >
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </span>
              Add New Theater
            </button>
          </div>

          {/* Stats Section */}
          <div className="qr-stats">
            <div className="stat-card">
              <div className="stat-number">{totalItems || 0}</div>
              <div className="stat-label">Total Theaters</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{theaters.filter(theater => theater.isActive === true).length || 0}</div>
              <div className="stat-label">Active Theaters</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{theaters.filter(theater => theater.isActive === false).length || 0}</div>
              <div className="stat-label">Inactive Theaters</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{theaters.filter(theater => theater.agreement?.status === 'active').length || 0}</div>
              <div className="stat-label">Active Agreements</div>
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
            <select
              value={filterStatus}
              onChange={handleFilterChange}
              className="status-filter"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <div className="results-count">
              Showing {sortedTheaters.length} of {totalItems} theaters (Page {currentPage} of {totalPages})
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
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
              </svg>
            </div>
            <h3>No Theaters Found</h3>
            <p>
              {searchTerm || filterStatus !== 'all' 
                ? 'No theaters match your current filters.'
                : 'Start by adding your first theater to the network.'
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <button 
                onClick={() => navigate('/add-theater')} 
                className="add-theater-btn"
              >
                Add Your First Theater
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <div className="table-wrapper">
              <table className="theater-table">
                <thead>
                  <tr>
                    <th className="sno-col">S NO</th>
                    <th className="photo-col">Photo</th>
                    <th className="name-col">Theater Name</th>
                    <th className="owner-col">Owner</th>
                    <th className="location-col">Location</th>
                    <th className="contact-col">Contact</th>
                    <th className="agreement-col">Agreement Period</th>
                    <th className="status-col">Status</th>
                    <th className="access-status-col">Access Status</th>
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton count={itemsPerPage} />
                  ) : (
                    sortedTheaters.map((theater, index) => (
                      <tr key={theater._id} className={`theater-row ${!theater.isActive ? 'inactive' : ''}`}>
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
                      <td className="theater-name-cell">
                        <div className="theater-name-full">{theater.name}</div>
                      </td>

                      {/* Owner Column */}
                      <td className="owner-cell">
                        <div className="owner-info">
                          <div className="owner-name">{theater.ownerDetails?.name || 'N/A'}</div>
                        </div>
                      </td>

                      {/* Location Column */}
                      <td className="location-cell">
                        <div className="location-info">
                          <div className="city">{theater.address?.city || 'N/A'}</div>
                          <div className="state">{theater.address?.state || 'N/A'}</div>
                          <div className="pincode">{theater.address?.pincode || theater.address?.zipCode || 'N/A'}</div>
                        </div>
                      </td>

                      {/* Contact Column */}
                      <td className="contact-cell">
                        <div className="contact-info">
                          <div className="phone">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '14px', height: '14px', display: 'inline', marginRight: '6px'}}>
                              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                            </svg>
                            {theater.phone}
                          </div>
                        </div>
                      </td>

                      {/* Agreement Column */}
                      <td className="agreement-cell">
                        <div className="agreement-info">
                          {theater.agreementDetails?.startDate && theater.agreementDetails?.endDate ? (
                            <>
                              <div className="start-date">
                                From: {new Date(theater.agreementDetails.startDate).toLocaleDateString()}
                              </div>
                              <div className="end-date">
                                To: {new Date(theater.agreementDetails.endDate).toLocaleDateString()}
                              </div>
                            </>
                          ) : (
                            <div className="no-agreement">
                              <span style={{color: '#999', fontSize: '0.9em'}}>No agreement dates</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="status-cell">
                        <span className={`status-badge ${theater.isActive ? 'active' : 'inactive'}`}>
                          {theater.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Access Status Column - Toggle Button */}
                      <td className="access-status-cell">
                        <div className="toggle-wrapper">
                          <label className="switch" style={{
                            position: 'relative',
                            display: 'inline-block',
                            width: '50px',
                            height: '24px',
                            opacity: togglingTheaterId === theater._id ? 0.7 : 1,
                            pointerEvents: togglingTheaterId === theater._id ? 'none' : 'auto'
                          }}>
                            <input
                              type="checkbox"
                              checked={theater.isActive}
                              onChange={() => toggleTheaterStatus(theater._id, theater.isActive)}
                              disabled={togglingTheaterId === theater._id}
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
                              backgroundColor: theater.isActive ? 'var(--primary-dark, #6D28D9)' : '#ccc',
                              transition: '.4s',
                              borderRadius: '24px'
                            }}>
                              <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '18px',
                                width: '18px',
                                left: theater.isActive ? '26px' : '3px',
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

                      {/* Actions Column */}
                      <td className="actions-cell">
                        <ActionButtons>
                          <ActionButton 
                            type="view"
                            onClick={() => { // Debug log
                              handleViewClick(theater);
                            }}
                            title="View Theater Details"
                          />
                          
                          <ActionButton 
                            type="edit"
                            onClick={() => handleEditClick(theater)}
                            title="Edit Theater"
                          />
                          
                          <ActionButton 
                            type="delete"
                            onClick={() => setDeleteModal({ show: true, theater })}
                            title="Delete Theater"
                          />
                        </ActionButtons>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

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
        )}
        </div>
        {/* End Theater Content Container */}
        </div>
        {/* End Main Theater Management Container */}

        {/* View Theater Modal */}
        {viewModal.show && (
          <div className="modal-overlay" onClick={() => setViewModal({ show: false, theater: null })}>
            <div className="modal-content theater-view-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-section">
                  <h2>Theater Details</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn" 
                    onClick={() => setViewModal({ show: false, theater: null })}
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
                    <label>Theater Name</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.name || ''} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.ownerDetails?.name || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.phone || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Owner Contact Number</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.ownerDetails?.contactNumber || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  {viewModal.theater?.email && (
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="text" 
                        value={viewModal.theater?.email || 'N/A'} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Address</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.address?.street || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.address?.city || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.address?.state || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input 
                      type="text" 
                      value={viewModal.theater?.address?.pincode || viewModal.theater?.address?.zipCode || 'N/A'} 
                      className="form-control"
                      readOnly
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select 
                      value={viewModal.theater?.isActive ? 'Active' : 'Inactive'} 
                      className="form-control"
                      disabled
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  {viewModal.theater?.agreementDetails?.startDate && (
                    <div className="form-group">
                      <label>Agreement Start Date</label>
                      <input 
                        type="text" 
                        value={new Date(viewModal.theater.agreementDetails.startDate).toLocaleDateString()} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {viewModal.theater?.agreementDetails?.endDate && (
                    <div className="form-group">
                      <label>Agreement End Date</label>
                      <input 
                        type="text" 
                        value={new Date(viewModal.theater.agreementDetails.endDate).toLocaleDateString()} 
                        className="form-control"
                        readOnly
                      />
                    </div>
                  )}
                  {/* {(viewModal.theater?.documents?.logo || viewModal.theater?.branding?.logo || viewModal.theater?.branding?.logoUrl) && (
                    <div className="form-group">
                      <label>Theater Logo</label>
                      <div className="logo-preview-container">
                        <InstantImage 
                          src={viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl} 
                          alt="Theater Logo" 
                          className="theater-logo-preview"
                          loading="eager"
                          style={{width: '120px', height: '120px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px'}}
                        />
                      </div>
                    </div>
                  )} */}
                </div>

                {/* Documents Section in View Modal */}
                {viewModal.theater && viewModal.theater.documents && (
                  <div className="documents-section">
                    <h3>Documents & Media</h3>
                    <div className="documents-grid">
                      {/* Theater Photo */}
                      {viewModal.theater.documents?.theaterPhoto && (
                        <div className="document-item">
                          <label>Theater Photo</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.theaterPhoto} 
                              alt="Theater Photo"
                              className="document-image"
                              loading="eager"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button
                              onClick={() => handleDownloadFile(viewModal.theater.documents.theaterPhoto, 'theater-photo.jpg')}
                              className="action-btn download-btn download-btn-overlay"
                              title="Download"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📷 Theater Photo
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Logo */}
                      {(viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl) && (
                        <div className="document-item">
                          <label>Theater Logo</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl} 
                              alt="Theater Logo"
                              className="document-image"
                              loading="eager"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button
                              onClick={() => handleDownloadFile(viewModal.theater.documents?.logo || viewModal.theater.branding?.logo || viewModal.theater.branding?.logoUrl, 'theater-logo.png')}
                              className="action-btn download-btn download-btn-overlay"
                              title="Download"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🏢 Theater Logo
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Aadhar Card */}
                      {viewModal.theater.documents?.aadharCard && (
                        <div className="document-item">
                          <label>Aadhar Card</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.aadharCard} 
                              alt="Aadhar Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button
                              onClick={() => handleDownloadFile(viewModal.theater.documents.aadharCard, 'aadhar-card.pdf')}
                              className="action-btn download-btn download-btn-overlay"
                              title="Download"
                            >
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🆔 Aadhar Card
                            </div>
                          </div>
                        </div>
                      )}

                      {/* PAN Card */}
                      {viewModal.theater.documents?.panCard && (
                        <div className="document-item">
                          <label>PAN Card</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.panCard} 
                              alt="PAN Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button 
                              className="action-btn download-btn download-btn-overlay"
                              onClick={() => handleDownloadFile(
                                viewModal.theater.documents.panCard,
                                `${viewModal.theater.name}_PAN_Card.pdf`
                              )}
                              title="Download PAN Card"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📄 PAN Card
                            </div>
                          </div>
                        </div>
                      )}

                      {/* GST Certificate */}
                      {viewModal.theater.documents?.gstCertificate && (
                        <div className="document-item">
                          <label>GST Certificate</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.gstCertificate} 
                              alt="GST Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button 
                              className="action-btn download-btn download-btn-overlay"
                              onClick={() => handleDownloadFile(
                                viewModal.theater.documents.gstCertificate,
                                `${viewModal.theater.name}_GST_Certificate.pdf`
                              )}
                              title="Download GST Certificate"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📋 GST Certificate
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FSSAI Certificate */}
                      {viewModal.theater.documents?.fssaiCertificate && (
                        <div className="document-item">
                          <label>FSSAI Certificate</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.fssaiCertificate} 
                              alt="FSSAI Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button 
                              className="action-btn download-btn download-btn-overlay"
                              onClick={() => handleDownloadFile(
                                viewModal.theater.documents.fssaiCertificate,
                                `${viewModal.theater.name}_FSSAI_Certificate.pdf`
                              )}
                              title="Download FSSAI Certificate"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🍽️ FSSAI Certificate
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Agreement Copy */}
                      {viewModal.theater.documents?.agreementCopy && (
                        <div className="document-item">
                          <label>Agreement Copy</label>
                          <div className="document-preview">
                            <InstantImage 
                              src={viewModal.theater.documents.agreementCopy} 
                              alt="Agreement Copy"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <button 
                              className="action-btn download-btn download-btn-overlay"
                              onClick={() => handleDownloadFile(
                                viewModal.theater.documents.agreementCopy,
                                `${viewModal.theater.name}_Agreement_Copy.pdf`
                              )}
                              title="Download Agreement Copy"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                              </svg>
                            </button>
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📝 Agreement Copy
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Theater Modal */}
        {editModal.show && (
          <div className="modal-overlay" onClick={closeEditModal}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-section">
                  <h2>Edit Theater</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="close-btn"
                    onClick={closeEditModal}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">Theater Name</label>
                      <input 
                        type="text" 
                        value={editFormData.theaterName || ''} 
                        onChange={(e) => handleEditFormChange('theaterName', e.target.value)}
                        className="form-control"
                        placeholder="e.g., Grand Theater"
                      />
                    </div>
                    <div className="form-group">
                      <label className="required">Owner Name</label>
                      <input 
                        type="text" 
                        value={editFormData.ownerName || ''} 
                        onChange={(e) => handleEditFormChange('ownerName', e.target.value)}
                        className="form-control"
                        placeholder="Enter owner name"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Address</label>
                      <textarea 
                        value={editFormData.address || ''} 
                        onChange={(e) => handleEditFormChange('address', e.target.value)}
                        className="form-control"
                        placeholder="Enter complete address"
                        rows="3"
                      ></textarea>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">Theater Phone</label>
                      <input 
                        type="tel" 
                        value={editFormData.phone || ''} 
                        onChange={(e) => handleEditFormChange('phone', e.target.value)}
                        className="form-control"
                        placeholder="Enter theater phone number"
                      />
                    </div>
                    <div className="form-group">
                      <label className="required">Owner Contact Number</label>
                      <input 
                        type="tel" 
                        value={editFormData.ownerContactNumber || ''} 
                        onChange={(e) => handleEditFormChange('ownerContactNumber', e.target.value)}
                        className="form-control"
                        placeholder="Enter owner contact number"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Email Address</label>
                      <input 
                        type="email" 
                        value={editFormData.email || ''} 
                        onChange={(e) => handleEditFormChange('email', e.target.value)}
                        className="form-control"
                        placeholder="Enter email address"
                      />
                    </div>
                    <div className="form-group">
                      <label className="required">City</label>
                      <input 
                        type="text" 
                        value={editFormData.city || ''} 
                        onChange={(e) => handleEditFormChange('city', e.target.value)}
                        className="form-control"
                        placeholder="Enter city"
                      />
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required">State</label>
                      <input 
                        type="text" 
                        value={editFormData.state || ''} 
                        onChange={(e) => handleEditFormChange('state', e.target.value)}
                        className="form-control"
                        placeholder="Enter state"
                      />
                    </div>
                    <div className="form-group">
                      <label className="required">Pincode</label>
                      <input 
                        type="text" 
                        value={editFormData.pincode || ''} 
                        onChange={(e) => handleEditFormChange('pincode', e.target.value)}
                        className="form-control"
                        placeholder="Enter pincode"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents & Media Section - View Only (Like View Modal) */}
                <div className="form-section">
                  <h3>📁 Documents & Media</h3>
                  
                  <div className="documents-grid">
                    {/* Theater Photo */}
                    {editModal.theater?.documents?.theaterPhoto && (
                      <div className="document-item">
                        <label>Theater Photo</label>
                        <div className="document-preview">
                          <InstantImage 
                            src={editModal.theater.documents.theaterPhoto} 
                            alt="Theater Photo"
                            className="document-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <button 
                            className="action-btn download-btn download-btn-overlay"
                            onClick={() => handleDownloadFile(
                              editModal.theater.documents.theaterPhoto,
                              `${editModal.theater.name}_Theater_Photo.jpg`
                            )}
                            title="Download Theater Photo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                            </svg>
                          </button>
                          <div className="document-placeholder" style={{display: 'none'}}>
                            📷 Theater Photo
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Theater Logo */}
                    {(editModal.theater?.documents?.logo || editModal.theater?.branding?.logo || editModal.theater?.branding?.logoUrl) && (
                      <div className="document-item">
                        <label>Theater Logo</label>
                        <div className="document-preview">
                          <InstantImage 
                            src={editModal.theater.documents?.logo || editModal.theater.branding?.logo || editModal.theater.branding?.logoUrl} 
                            alt="Theater Logo"
                            className="document-image"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'block';
                            }}
                          />
                          <button 
                            className="action-btn download-btn download-btn-overlay"
                            onClick={() => handleDownloadFile(
                              editModal.theater.documents?.logo || editModal.theater.branding?.logo || editModal.theater.branding?.logoUrl,
                              `${editModal.theater.name}_Logo.jpg`
                            )}
                            title="Download Theater Logo"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-6 2h12v2H6v-2z"/>
                            </svg>
                          </button>
                          <div className="document-placeholder" style={{display: 'none'}}>
                            🏢 Theater Logo
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Fixed Footer with Cancel and Submit Buttons */}
              <div className="modal-actions">
                <button 
                  className="cancel-btn" 
                  onClick={closeEditModal}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleEditSubmit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal.show && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{deleteModal.theater?.name}</strong>?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setDeleteModal({ show: false, theater: null })}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDelete(deleteModal.theater._id)}
                  className="confirm-delete-btn"
                >
                  Delete Theater
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>

    {/* Custom CSS for TheaterList modals only */}
    <style dangerouslySetInnerHTML={{
      __html: `
        .theater-view-modal-content,
        .theater-edit-modal-content {
          max-width: 900px !important;
          width: 85% !important;
        }

        @media (max-width: 768px) {
          .theater-view-modal-content,
          .theater-edit-modal-content {
            width: 95% !important;
            max-width: none !important;
          }
        }
      `
    }} />
  </ErrorBoundary>
  );
});

TheaterList.displayName = 'TheaterList';

export default TheaterList;


