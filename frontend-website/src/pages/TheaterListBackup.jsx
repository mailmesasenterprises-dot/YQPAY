// Enhanced TheaterList with all performance optimizations
// Maintains exact same design and functionality with:
// ✅ Virtual Scrolling for large datasets
// ✅ React Query for advanced caching and prefetching  
// ✅ Service Worker for offline support
// ✅ Critical CSS optimization
// ✅ Intelligent prefetching

export { default } from './TheaterListEnhanced';
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
    <td>{theater.owner?.name || 'N/A'}</td>
    <td>{theater.contact?.phone || 'N/A'}</td>
    <td>{theater.location ? `${theater.location.city}, ${theater.location.state}` : 'N/A'}</td>
    <td>
      <span className={`status ${theater.isActive ? 'active' : 'inactive'}`}>
        {theater.isActive ? 'Active' : 'Inactive'}
      </span>
    </td>
    <td className="actions">
      <button 
        className="btn-action btn-edit" 
        onClick={() => onEdit(theater, index)}
        title="Edit theater"
      >
        ✏️
      </button>
      <button 
        className="btn-action btn-view" 
        onClick={() => onView(theater, index)}
        title="View theater details"
      >
        👁️
      </button>
      <button 
        className="btn-action btn-delete" 
        onClick={() => onDelete(theater)}
        title="Delete theater"
      >
        🗑️
      </button>
    </td>
  </tr>
));

TheaterRow.displayName = 'TheaterRow';

const TheaterList = () => {
  const navigate = useNavigate();
  const modal = useModal();
  const [theaters, setTheaters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ show: false, theater: null });
  const [viewModal, setViewModal] = useState({ show: false, theater: null, currentIndex: 0 });
  const [editModal, setEditModal] = useState({ show: false, theater: null, currentIndex: 0 });
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

  // Performance refs
  const searchTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to first page when searching
    }, 500); // PERFORMANCE: Increased debounce to 500ms to reduce API calls

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Clear any cached data on component mount
  useEffect(() => {

    clearTheaterCache();
  }, []);

  useEffect(() => {
    fetchTheaters();
  }, [currentPage, debouncedSearchTerm, filterStatus, itemsPerPage]);

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
        limit: itemsPerPage.toString(),
      });
      
      if (debouncedSearchTerm.trim()) {
        params.append('q', debouncedSearchTerm.trim());
      }
      
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      
      // PERFORMANCE OPTIMIZATION: Add cache headers but bust cache when needed
      const baseUrl = `/api/theaters?${params.toString()}`;
      const cacheBustedUrl = addCacheBuster(baseUrl);
      

      const response = await fetch(cacheBustedUrl, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate', // Force fresh data
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch theaters');
      }
      const result = await response.json();
      
      // PERFORMANCE OPTIMIZATION: Direct state update without expensive comparison
      const newTheaters = result.data || [];
      setTheaters(newTheaters);
      
      // PERFORMANCE OPTIMIZATION: Batch pagination state updates
      const paginationData = result.pagination || {};
      setPagination(paginationData);
      setTotalPages(paginationData.totalPages || 0);
      setTotalItems(paginationData.totalItems || 0);
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

  const handleDelete = useCallback(async (theaterId) => {
    try {
      const response = await fetch(`/api/theaters/${theaterId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete theater');
      }

      // CRITICAL FIX: Update local state immediately for instant UI feedback
      setTheaters(prevTheaters => 
        prevTheaters.filter(theater => theater._id !== theaterId)
      );
      
      // CACHE INVALIDATION: Clear ALL theater-related cache aggressively

      clearTheaterCache();
      
      // Close modal and show success message
      setDeleteModal({ show: false, theater: null });
      modal.showSuccess('Theater deleted successfully!');
      
      // Optional: Background refresh to ensure server consistency (no await to avoid blocking)
      setTimeout(() => {
        fetchTheaters().catch(error => {
  });
      }, 100); // Small delay to ensure cache is cleared
    } catch (error) {

      modal.showError('Failed to delete theater');
    }
  }, [modal]);

  const handleEditClick = useCallback((theater) => { // Debug log
    const currentIndex = theaters.findIndex(t => t._id === theater._id);
    setEditFormData({
      theaterName: theater.name || '',
      ownerName: theater.owner?.name || '',
      phone: theater.contact?.phone || '',
      businessType: theater.businessType || '',
      address: theater.location?.address || '',
      city: theater.location?.city || '',
      state: theater.location?.state || '',
      pincode: theater.location?.pincode || ''
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
    setEditModal({ show: true, theater, currentIndex });
  }, [theaters]);

  const handleViewClick = useCallback((theater) => {
    const currentIndex = theaters.findIndex(t => t._id === theater._id);
    setViewModal({ show: true, theater, currentIndex });
  }, [theaters]);

  // Navigation functions for modals
  const navigateModal = useCallback((direction, modalType) => {
    const isEdit = modalType === 'edit';
    const currentModal = isEdit ? editModal : viewModal;
    const setModal = isEdit ? setEditModal : setViewModal;
    
    if (!currentModal.show || theaters.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentModal.currentIndex + 1) % theaters.length;
    } else {
      newIndex = (currentModal.currentIndex - 1 + theaters.length) % theaters.length;
    }
    
    const newTheater = theaters[newIndex];
    
    if (isEdit) {
      setEditFormData({
        theaterName: newTheater.name || '',
        ownerName: newTheater.owner?.name || '',
        phone: newTheater.contact?.phone || '',
        businessType: newTheater.businessType || '',
        address: newTheater.location?.address || '',
        city: newTheater.location?.city || '',
        state: newTheater.location?.state || '',
        pincode: newTheater.location?.pincode || ''
      });
    }
    
    setModal({ show: true, theater: newTheater, currentIndex: newIndex });
  }, [theaters, editModal, viewModal]);

  const handleNextTheater = useCallback((modalType) => {
    navigateModal('next', modalType);
  }, [navigateModal]);

  const handlePrevTheater = useCallback((modalType) => {
    navigateModal('prev', modalType);
  }, [navigateModal]);

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

  const uploadFile = async (file, fileType) => {
    if (!file) return null;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    formData.append('theaterId', editModal.theater._id);

    try {
      setUploadProgress(prev => ({ ...prev, [fileType]: 0 }));
      
      const response = await fetch('/api/upload/theater-document', {
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
      // First upload any new files
      const uploadedFiles = {};
      const fileTypes = Object.keys(uploadFiles);
      
      for (const fileType of fileTypes) {
        if (uploadFiles[fileType]) {
          try {
            const fileUrl = await uploadFile(uploadFiles[fileType], fileType);
            uploadedFiles[fileType] = fileUrl;
          } catch (error) {
            modal.showError(`Failed to upload ${fileType.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
            return; // Stop if any file upload fails
          }
        }
      }

      // Format data according to backend schema
      const updateData = {
        name: editFormData.theaterName,
        owner: {
          ...editModal.theater.owner,
          name: editFormData.ownerName
        },
        contact: {
          ...editModal.theater.contact,
          phone: editFormData.phone
        },
        location: {
          ...editModal.theater.location,
          address: editFormData.address,
          city: editFormData.city,
          state: editFormData.state,
          pincode: editFormData.pincode
        },
        businessType: editFormData.businessType
      };

      // Add uploaded file URLs to update data
      if (Object.keys(uploadedFiles).length > 0) {
        updateData.media = {
          ...editModal.theater.media,
          ...(uploadedFiles.theaterPhoto && { theaterPhoto: uploadedFiles.theaterPhoto }),
          ...(uploadedFiles.logo && { logo: uploadedFiles.logo })
        };
        
        updateData.documents = {
          ...editModal.theater.documents,
          ...(uploadedFiles.aadharCard && { aadharCard: uploadedFiles.aadharCard }),
          ...(uploadedFiles.panCard && { panCard: uploadedFiles.panCard }),
          ...(uploadedFiles.gstCertificate && { gstCertificate: uploadedFiles.gstCertificate }),
          ...(uploadedFiles.businessLicense && { businessLicense: uploadedFiles.businessLicense }),
          ...(uploadedFiles.agreementDocument && { agreementDocument: uploadedFiles.agreementDocument })
        };
      } // Debug log

      const response = await fetch(`/api/theaters/${editModal.theater._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
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
    try {
      const response = await fetch(`/api/theaters/${theaterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update theater status');
      }

      // Refresh the current page to get updated data
      fetchTheaters();
    } catch (error) {

      modal.showError('Failed to update theater status');
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

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }, [totalPages]);

  // Handle items per page change
  const handleItemsPerPageChange = useCallback((e) => {
    setItemsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page when changing items per page
  }, []);

  // Memoized computations for better performance
  const paginationInfo = useMemo(() => ({
    startItem: ((currentPage - 1) * itemsPerPage) + 1,
    endItem: Math.min(currentPage * itemsPerPage, totalItems),
    showingText: `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} entries`
  }), [currentPage, itemsPerPage, totalItems]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    } else if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    } else if (currentPage >= totalPages - 2) {
      return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
    } else {
      return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
    }
  }, [currentPage, totalPages]);

  // Cleanup effect for aborting requests
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
    <AdminLayout pageTitle="Theater Management" currentPage="theaters">
      <div className="theater-list-container">
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
              Showing {theaters.length} of {totalItems} theaters (Page {currentPage} of {totalPages})
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
        {theaters.length === 0 && !loading ? (
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
                    <th className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton count={itemsPerPage} />
                  ) : (
                    theaters.map((theater, index) => (
                      <tr key={theater._id} className={`theater-row ${!theater.isActive ? 'inactive' : ''}`}>
                      {/* S NO Column */}
                      <td className="sno-cell">
                        <div className="sno-number">{index + 1}</div>
                      </td>

                      {/* Photo Column */}
                      <td className="photo-cell">
                        <div className="theater-photo-thumb">
                          {theater.media?.theaterPhoto ? (
                            <LazyImage 
                              src={theater.media.theaterPhoto} 
                              alt={theater.name}
                              className="theater-photo"
                              fallback="/placeholder-theater.png"
                            />
                          ) : (
                            <div className="no-photo">
                              <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Theater Name Column */}
                      <td className="name-cell">
                        <div className="theater-info">
                          <div className="theater-name">{theater.name}</div>
                        </div>
                      </td>

                      {/* Owner Column */}
                      <td className="owner-cell">
                        <div className="owner-info">
                          <div className="owner-name">{theater.owner?.name}</div>
                        </div>
                      </td>

                      {/* Location Column */}
                      <td className="location-cell">
                        <div className="location-info">
                          <div className="city">{theater.location?.city}</div>
                          <div className="state">{theater.location?.state}</div>
                          <div className="pincode">{theater.location?.pincode}</div>
                        </div>
                      </td>

                      {/* Contact Column */}
                      <td className="contact-cell">
                        <div className="contact-info">
                          <div className="phone">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '14px', height: '14px', display: 'inline', marginRight: '6px'}}>
                              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                            </svg>
                            {theater.contact?.phone}
                          </div>
                        </div>
                      </td>

                      {/* Agreement Column */}
                      <td className="agreement-cell">
                        <div className="agreement-info">
                          <div className="start-date">
                            From: {new Date(theater.agreement?.startDate).toLocaleDateString()}
                          </div>
                          <div className="end-date">
                            To: {new Date(theater.agreement?.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="status-cell">
                        <span className={`status-badge ${theater.isActive ? 'active' : 'inactive'}`}>
                          {theater.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            onClick={() => { // Debug log
                              handleViewClick(theater);
                            }}
                            className="action-btn view-btn"
                            title="View Theater Details"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                          </button>
                          
                          <button 
                            onClick={() => handleEditClick(theater)}
                            className="action-btn edit-btn"
                            title="Edit Theater"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          
                          <button 
                            onClick={() => setDeleteModal({ show: true, theater })}
                            className="action-btn delete-btn"
                            title="Delete Theater"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  <span>
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} entries
                  </span>
                </div>
                
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn prev-btn"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                    Previous
                  </button>

                  <div className="page-numbers">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          className={`page-btn ${currentPage === pageNumber ? 'active' : ''}`}
                          onClick={() => handlePageChange(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button 
                    className="pagination-btn next-btn"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                  </button>
                </div>
              </div>
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                  <button 
                    className="nav-btn prev-btn" 
                    onClick={() => handlePrevTheater('view')}
                    disabled={theaters.length <= 1}
                    title="Previous Theater"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                  </button>
                </div>
                
                <div className="modal-title-section">
                  <h2>Theater Details</h2>
                  <span className="theater-counter">
                    {viewModal.currentIndex + 1} of {theaters.length}
                  </span>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="nav-btn next-btn" 
                    onClick={() => handleNextTheater('view')}
                    disabled={theaters.length <= 1}
                    title="Next Theater"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                  </button>
                  
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
                <div className="view-details">
                  <div className="detail-row">
                    <strong>Theater Name:</strong>
                    <span>{viewModal.theater?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Owner Name:</strong>
                    <span>{viewModal.theater?.owner?.name || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Phone:</strong>
                    <span>{viewModal.theater?.contact?.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Business Type:</strong>
                    <span>{viewModal.theater?.businessType || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Address:</strong>
                    <span>{viewModal.theater?.location?.address || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>City:</strong>
                    <span>{viewModal.theater?.location?.city || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>State:</strong>
                    <span>{viewModal.theater?.location?.state || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Pincode:</strong>
                    <span>{viewModal.theater?.location?.pincode || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong> 
                    <span className={`status-badge ${viewModal.theater?.isActive ? 'active' : 'inactive'}`}>
                      {viewModal.theater?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {viewModal.theater?.media?.logo && (
                    <div className="detail-row">
                      <strong>Logo:</strong>
                      <div className="logo-preview">
                        <img 
                          src={viewModal.theater.media.logo} 
                          alt="Theater Logo" 
                          style={{width: '100px', height: '100px', objectFit: 'contain'}}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Documents Section in View Modal */}
                {viewModal.theater && (viewModal.theater.documents || viewModal.theater.media) && (
                  <div className="documents-section">
                    <h3>Documents & Media</h3>
                    <div className="documents-grid">
                      {/* Theater Photo */}
                      {viewModal.theater.media?.theaterPhoto && (
                        <div className="document-item">
                          <label>Theater Photo</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.media.theaterPhoto} 
                              alt="Theater Photo"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📷 Theater Photo
                            </div>
                            <a 
                              href={viewModal.theater.media.theaterPhoto} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Full Size
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Logo */}
                      {viewModal.theater.media?.logo && (
                        <div className="document-item">
                          <label>Theater Logo</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.media.logo} 
                              alt="Theater Logo"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🏢 Theater Logo
                            </div>
                            <a 
                              href={viewModal.theater.media.logo} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Full Size
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Aadhar Card */}
                      {viewModal.theater.documents?.aadharCard && (
                        <div className="document-item">
                          <label>Aadhar Card</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.documents.aadharCard} 
                              alt="Aadhar Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🆔 Aadhar Card
                            </div>
                            <a 
                              href={viewModal.theater.documents.aadharCard} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* PAN Card */}
                      {viewModal.theater.documents?.panCard && (
                        <div className="document-item">
                          <label>PAN Card</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.documents.panCard} 
                              alt="PAN Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📄 PAN Card
                            </div>
                            <a 
                              href={viewModal.theater.documents.panCard} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* GST Certificate */}
                      {viewModal.theater.documents?.gstCertificate && (
                        <div className="document-item">
                          <label>GST Certificate</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.documents.gstCertificate} 
                              alt="GST Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📋 GST Certificate
                            </div>
                            <a 
                              href={viewModal.theater.documents.gstCertificate} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* FSSAI Certificate */}
                      {viewModal.theater.documents?.fssaiCertificate && (
                        <div className="document-item">
                          <label>FSSAI Certificate</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.documents.fssaiCertificate} 
                              alt="FSSAI Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🍽️ FSSAI Certificate
                            </div>
                            <a 
                              href={viewModal.theater.documents.fssaiCertificate} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Agreement Copy */}
                      {viewModal.theater.documents?.agreementCopy && (
                        <div className="document-item">
                          <label>Agreement Copy</label>
                          <div className="document-preview">
                            <img 
                              src={viewModal.theater.documents.agreementCopy} 
                              alt="Agreement Copy"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📝 Agreement Copy
                            </div>
                            <a 
                              href={viewModal.theater.documents.agreementCopy} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left">
                  <button 
                    className="nav-btn prev-btn" 
                    onClick={() => handlePrevTheater('edit')}
                    disabled={theaters.length <= 1}
                    title="Previous Theater"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                    </svg>
                  </button>
                </div>
                
                <div className="modal-title-section">
                  <h2>Edit Theater</h2>
                  <span className="theater-counter">
                    {editModal.currentIndex + 1} of {theaters.length}
                  </span>
                </div>
                
                <div className="modal-nav-right">
                  <button 
                    className="nav-btn next-btn" 
                    onClick={() => handleNextTheater('edit')}
                    disabled={theaters.length <= 1}
                    title="Next Theater"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                    </svg>
                  </button>
                  
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
                  <div className="form-group">
                    <label>Theater Name</label>
                    <input 
                      type="text" 
                      value={editFormData.theaterName || ''} 
                      onChange={(e) => handleEditFormChange('theaterName', e.target.value)}
                      className="form-control"
                      placeholder="Enter theater name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Owner Name</label>
                    <input 
                      type="text" 
                      value={editFormData.ownerName || ''} 
                      onChange={(e) => handleEditFormChange('ownerName', e.target.value)}
                      className="form-control"
                      placeholder="Enter owner name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input 
                      type="text" 
                      value={editFormData.phone || ''} 
                      onChange={(e) => handleEditFormChange('phone', e.target.value)}
                      className="form-control"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Business Type</label>
                    <select 
                      value={editFormData.businessType || ''} 
                      onChange={(e) => handleEditFormChange('businessType', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Select Business Type</option>
                      <option value="Theater">Theater</option>
                      <option value="Canteen">Canteen</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Food Court">Food Court</option>
                      <option value="Cafe">Cafe</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea 
                      value={editFormData.address || ''} 
                      onChange={(e) => handleEditFormChange('address', e.target.value)}
                      className="form-control"
                      placeholder="Enter complete address"
                      rows="3"
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input 
                      type="text" 
                      value={editFormData.city || ''} 
                      onChange={(e) => handleEditFormChange('city', e.target.value)}
                      className="form-control"
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input 
                      type="text" 
                      value={editFormData.state || ''} 
                      onChange={(e) => handleEditFormChange('state', e.target.value)}
                      className="form-control"
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="form-group">
                    <label>Pincode</label>
                    <input 
                      type="text" 
                      value={editFormData.pincode || ''} 
                      onChange={(e) => handleEditFormChange('pincode', e.target.value)}
                      className="form-control"
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>

                {/* Documents Section */}
                {editModal.theater && (editModal.theater.documents || editModal.theater.media) && (
                  <div className="documents-section">
                    <h3>Documents & Media</h3>
                    <div className="documents-grid">
                      {/* Theater Photo */}
                      {editModal.theater.media?.theaterPhoto && (
                        <div className="document-item">
                          <label>Theater Photo</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.media.theaterPhoto} 
                              alt="Theater Photo"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📷 Theater Photo
                            </div>
                            <a 
                              href={editModal.theater.media.theaterPhoto} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Full Size
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Logo */}
                      {editModal.theater.media?.logo && (
                        <div className="document-item">
                          <label>Theater Logo</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.media.logo} 
                              alt="Theater Logo"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🏢 Theater Logo
                            </div>
                            <a 
                              href={editModal.theater.media.logo} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Full Size
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Aadhar Card */}
                      {editModal.theater.documents?.aadharCard && (
                        <div className="document-item">
                          <label>Aadhar Card</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.documents.aadharCard} 
                              alt="Aadhar Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🆔 Aadhar Card
                            </div>
                            <a 
                              href={editModal.theater.documents.aadharCard} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* PAN Card */}
                      {editModal.theater.documents?.panCard && (
                        <div className="document-item">
                          <label>PAN Card</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.documents.panCard} 
                              alt="PAN Card"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📄 PAN Card
                            </div>
                            <a 
                              href={editModal.theater.documents.panCard} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* GST Certificate */}
                      {editModal.theater.documents?.gstCertificate && (
                        <div className="document-item">
                          <label>GST Certificate</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.documents.gstCertificate} 
                              alt="GST Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📋 GST Certificate
                            </div>
                            <a 
                              href={editModal.theater.documents.gstCertificate} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* FSSAI Certificate */}
                      {editModal.theater.documents?.fssaiCertificate && (
                        <div className="document-item">
                          <label>FSSAI Certificate</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.documents.fssaiCertificate} 
                              alt="FSSAI Certificate"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              🍽️ FSSAI Certificate
                            </div>
                            <a 
                              href={editModal.theater.documents.fssaiCertificate} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Agreement Copy */}
                      {editModal.theater.documents?.agreementCopy && (
                        <div className="document-item">
                          <label>Agreement Copy</label>
                          <div className="document-preview">
                            <img 
                              src={editModal.theater.documents.agreementCopy} 
                              alt="Agreement Copy"
                              className="document-image"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                              }}
                            />
                            <div className="document-placeholder" style={{display: 'none'}}>
                              📝 Agreement Copy
                            </div>
                            <a 
                              href={editModal.theater.documents.agreementCopy} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="view-document-btn"
                            >
                              View Document
                            </a>
                          </div>
                        </div>
                      )}

                      {/* File Upload Section */}
                      <div className="upload-section">
                        <h4>Upload New Documents</h4>
                        <div className="upload-grid">
                          {/* Theater Photo Upload */}
                          <div className="upload-item">
                            <label>Update Theater Photo</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange('theaterPhoto', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.theaterPhoto !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.theaterPhoto}%`}}></div>
                                <span>{uploadProgress.theaterPhoto}%</span>
                              </div>
                            )}
                          </div>

                          {/* Logo Upload */}
                          <div className="upload-item">
                            <label>Update Theater Logo</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleFileChange('logo', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.logo !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.logo}%`}}></div>
                                <span>{uploadProgress.logo}%</span>
                              </div>
                            )}
                          </div>

                          {/* Aadhar Card Upload */}
                          <div className="upload-item">
                            <label>Update Aadhar Card</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileChange('aadharCard', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.aadharCard !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.aadharCard}%`}}></div>
                                <span>{uploadProgress.aadharCard}%</span>
                              </div>
                            )}
                          </div>

                          {/* PAN Card Upload */}
                          <div className="upload-item">
                            <label>Update PAN Card</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileChange('panCard', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.panCard !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.panCard}%`}}></div>
                                <span>{uploadProgress.panCard}%</span>
                              </div>
                            )}
                          </div>

                          {/* GST Certificate Upload */}
                          <div className="upload-item">
                            <label>Update GST Certificate</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileChange('gstCertificate', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.gstCertificate !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.gstCertificate}%`}}></div>
                                <span>{uploadProgress.gstCertificate}%</span>
                              </div>
                            )}
                          </div>

                          {/* Business License Upload */}
                          <div className="upload-item">
                            <label>Update Business License</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileChange('businessLicense', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.businessLicense !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.businessLicense}%`}}></div>
                                <span>{uploadProgress.businessLicense}%</span>
                              </div>
                            )}
                          </div>

                          {/* Agreement Document Upload */}
                          <div className="upload-item">
                            <label>Update Agreement Document</label>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleFileChange('agreementDocument', e.target.files[0])}
                              className="file-input"
                            />
                            {uploadProgress.agreementDocument !== undefined && (
                              <div className="upload-progress">
                                <div className="progress-bar" style={{width: `${uploadProgress.agreementDocument}%`}}></div>
                                <span>{uploadProgress.agreementDocument}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
                
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
  );
};

export default TheaterList;