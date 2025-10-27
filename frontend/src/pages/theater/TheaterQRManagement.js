import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import VerticalPageHeader from '../../components/VerticalPageHeader';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { ActionButton, ActionButtons } from '../../components/ActionButton';
import JSZip from 'jszip';
import config from '../../config';
import '../../styles/TheaterUserDetails.css';
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css';
import '../../styles/AddTheater.css';

// Helper function to get authenticated headers
const getAuthHeaders = () => {
  const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Accept': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  };
};

// Lazy Loading QR Image Component
const LazyQRImage = React.memo(({ src, alt, className, style }) => {
  const [imageSrc, setImageSrc] = useState('/placeholder-qr.png');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && src && src !== '/placeholder-qr.png') {
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
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  return (
    <div ref={imgRef} style={{ position: 'relative', ...style }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          Loading...
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        style={{
          ...style,
          opacity: isLoading ? 0.3 : 1,
          transition: 'opacity 0.3s ease'
        }}
      />
      {hasError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'red'
        }}>
          Failed to load
        </div>
      )}
    </div>
  );
});

LazyQRImage.displayName = 'LazyQRImage';

// CRUD Modal Component (Complete mirror from TheaterQRDetail.js)
const CrudModal = React.memo(({ isOpen, qrCode, mode, theater, onClose, onSave, onDelete, onModeChange, actionLoading, displayImageUrl, onSeatEdit, onToggleStatus, qrNames = [], existingQRNames = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    qrType: 'single',
    screenName: '',
    seatNumber: '',
    location: '',
    isActive: true,
    ...qrCode
  });

  useEffect(() => {
    if (qrCode) {
      setFormData({ ...qrCode });
    }
  }, [qrCode]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const isReadOnly = mode === 'view';

  const getModalTitle = () => {
    switch (mode) {
      case 'view': return 'View QR Code';
      case 'edit': return 'Edit QR Code';
      case 'create': return 'Create QR Code';
      default: return 'QR Code Details';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-nav-left"></div>
          
          <div className="modal-title-section">
            <h2>{getModalTitle()}</h2>
          </div>
          
          <div className="modal-nav-right">
            <button className="close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          <div className="edit-form">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>QR Code Name *</label>
                {isReadOnly ? (
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name || ''}
                    disabled
                  />
                ) : (
                  <select
                    name="name"
                    className="form-control"
                    value={formData.name || ''}
                    onChange={(e) => {
                      const selectedQRName = qrNames.find(qr => qr.qrName === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        name: e.target.value,
                        screenName: selectedQRName?.seatClass || prev.screenName,
                        seatClass: selectedQRName?.seatClass || prev.seatClass
                      }));
                    }}
                    required
                  >
                    <option value="">Select QR Code Name</option>
                    {qrNames
                      .filter(qr => !existingQRNames.includes(qr.qrName) || qr.qrName === qrCode?.name)
                      .map((qr, index) => (
                        <option key={index} value={qr.qrName}>{qr.qrName}</option>
                      ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>QR Type</label>
                <select
                  name="qrType"
                  className="form-control"
                  value={formData.qrType || 'single'}
                  onChange={handleInputChange}
                  disabled={isReadOnly}
                >
                  <option value="single">Single QR</option>
                  <option value="screen">Screen QR</option>
                </select>
              </div>

              {(formData.qrType === 'screen' || formData.screenName || formData.seatClass) && (
                <>
                  <div className="form-group">
                    <label>Screen Name</label>
                    <input
                      type="text"
                      name="screenName"
                      className="form-control"
                      value={formData.screenName || formData.seatClass || ''}
                      onChange={handleInputChange}
                      disabled={true}
                      readOnly
                      placeholder="Auto-filled from QR Code Name"
                      style={{backgroundColor: '#f3f4f6', cursor: 'not-allowed'}}
                    />
                  </div>

                  {formData.seatNumber && (
                    <div className="form-group">
                      <label>Seat Number</label>
                      <input
                        type="text"
                        name="seatNumber"
                        className="form-control"
                        value={formData.seatNumber || ''}
                        onChange={handleInputChange}
                        disabled={isReadOnly}
                        placeholder="Enter seat number"
                      />
                    </div>
                  )}
                </>
              )}

              {(() => {
                const shouldShowSeatGrid = formData.qrType === 'screen' && !formData.isSeatRow && formData.seats && formData.seats.length > 0;
                return shouldShowSeatGrid;
              })() && (
                <div className="form-group">
                  <label style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', display: 'block' }}>
                    Seat Layout ({formData.seats.length} seats)
                  </label>
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🎬</span>
                        <span>SCREEN - {formData.seatClass || formData.name}</span>
                      </div>
                      
                      {mode === 'view' && formData.seats.filter(s => s.qrCodeUrl).length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const seatsWithQR = formData.seats.filter(s => s.qrCodeUrl);
                            try {
                              const zip = new JSZip();
                              const folder = zip.folder(`${formData.seatClass || formData.name}_QR_Codes`);
                              
                              const fetchPromises = seatsWithQR.map(async (seat) => {
                                try {
                                  const response = await fetch(seat.qrCodeUrl);
                                  const blob = await response.blob();
                                  folder.file(`${seat.seat}_QR.png`, blob);
                                } catch (error) {
                                  console.error(`Failed to fetch ${seat.seat}:`, error);
                                }
                              });
                              
                              await Promise.all(fetchPromises);
                              const zipBlob = await zip.generateAsync({ type: 'blob' });
                              
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(zipBlob);
                              link.download = `${formData.seatClass || formData.name}_QR_Codes.zip`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(link.href);
                              
                              alert(`✅ Downloaded ${seatsWithQR.length} QR codes as ZIP file!`);
                            } catch (error) {
                              alert('❌ Failed to create ZIP file.');
                            }
                          }}
                          style={{
                            backgroundColor: 'white',
                            color: '#8b5cf6',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>⬇️</span>
                          <span>Download All ({formData.seats.filter(s => s.qrCodeUrl).length})</span>
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const seatsByRow = {};
                        formData.seats.forEach(seat => {
                          const rowLetter = seat.seat.match(/^[A-Za-z]+/)?.[0] || 'Other';
                          if (!seatsByRow[rowLetter]) seatsByRow[rowLetter] = [];
                          seatsByRow[rowLetter].push(seat);
                        });

                        return Object.keys(seatsByRow).sort().map(rowLetter => (
                          <div key={rowLetter} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{
                              minWidth: '30px',
                              fontSize: '16px',
                              fontWeight: '600',
                              color: '#374151',
                              textAlign: 'center'
                            }}>
                              {rowLetter}
                            </div>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                              {seatsByRow[rowLetter]
                                .sort((a, b) => {
                                  const numA = parseInt(a.seat.match(/\d+/)?.[0] || '0');
                                  const numB = parseInt(b.seat.match(/\d+/)?.[0] || '0');
                                  return numA - numB;
                                })
                                .map((seat, index) => (
                                  <div
                                    key={seat._id || index}
                                    style={{
                                      backgroundColor: seat.isActive ? '#8b5cf6' : '#d1d5db',
                                      color: 'white',
                                      padding: '10px 16px',
                                      borderRadius: '6px',
                                      textAlign: 'center',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      position: 'relative',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                      minWidth: '50px'
                                    }}
                                    title={`Seat ${seat.seat}`}
                                    onClick={() => {
                                      if (seat.qrCodeUrl) {
                                        window.open(seat.qrCodeUrl, '_blank');
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      if (seat.qrCodeUrl) {
                                        const link = document.createElement('a');
                                        link.href = seat.qrCodeUrl;
                                        link.download = `${formData.seatClass}_${seat.seat}_QR.png`;
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }
                                    }}
                                  >
                                    {seat.seat}
                                    {seat.qrCodeUrl && (
                                      <div style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        width: '12px',
                                        height: '12px',
                                        backgroundColor: '#10b981',
                                        borderRadius: '50%',
                                        border: '2px solid white'
                                      }} />
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
});

CrudModal.displayName = 'CrudModal';

const TheaterQRManagement = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError, showSuccess, confirm } = useModal();
  
  // PERFORMANCE MONITORING
  usePerformanceMonitoring('TheaterQRManagement');
  
  // Theater state
  const [theater, setTheater] = useState(null);
  
  // Data state
  const [qrCodes, setQrCodes] = useState([]);
  const [qrCodesByName, setQrCodesByName] = useState({});
  const [loading, setLoading] = useState(true);
  const [qrNames, setQrNames] = useState([]);
  const [qrNamesLoading, setQrNamesLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [qrNameCounts, setQrNameCounts] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  
  // Modal states
  const [crudModal, setCrudModal] = useState({
    isOpen: false,
    qrCode: null,
    mode: 'view' // 'view', 'edit'
  });
  
  const [deleteModal, setDeleteModal] = useState({ show: false, qrCode: null });
  const [displayImageUrl, setDisplayImageUrl] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    isActive: 'all'
  });
  
  const abortControllerRef = useRef(null);

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
      console.error('Theater access denied: User can only access their own theater');
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load QR Names (like admin page tabs)
  const loadQRNames = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      setQrNamesLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('🔍 Loading QR Names for theater:', theaterId);
      
      const response = await fetch(`${config.api.baseUrl}/qrcodenames?theaterId=${theaterId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR names');
      }
      
      const data = await response.json();
      
      console.log('📋 QR Names API Response:', data);
      
      if (data.success && data.data && data.data.qrCodeNames) {
        const names = data.data.qrCodeNames;
        console.log('✅ QR Names loaded:', names);
        setQrNames(names);
        if (names.length > 0 && !activeCategory) {
          const firstCategory = names[0].qrName;
          console.log('📌 Setting first category:', firstCategory);
          setActiveCategory(firstCategory);
        }
      } else {
        console.log('⚠️ No QR names found');
        setQrNames([]);
      }
    } catch (error) {
      console.error('❌ Error loading QR names:', error);
      showError('Failed to load QR names');
    } finally {
      setQrNamesLoading(false);
    }
  }, [theaterId, showError]);

  // Load theater data and organize QR codes by name
  const loadTheaterData = useCallback(async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      setLoading(true);
      
      const signal = abortControllerRef.current.signal;
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept': 'application/json'
      };
      
      if (!theater) {
        const theaterResponse = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, { signal, headers });
        const theaterData = await theaterResponse.json();
        if (theaterData.success) {
          setTheater(theaterData.theater);
        }
      }
      
      const singleUrl = `${config.api.baseUrl}/single-qrcodes/theater/${theaterId}`;
      const singleResponse = await fetch(singleUrl, { signal, headers });
      
      const singleData = singleResponse.ok ? await singleResponse.json().catch(() => ({ success: false })) : { success: false };
      
      const qrsByName = {};
      
      if (singleData.success) {
        (singleData.data?.qrCodes || []).forEach(qr => {
          if (!qrsByName[qr.name]) {
            qrsByName[qr.name] = [];
          }
          qrsByName[qr.name].push({ ...qr });
        });
      }
      
      setQrCodesByName(qrsByName);
      
      // Also set qrCodes for backward compatibility
      const allQRs = Object.values(qrsByName).flat();
      setQrCodes(allQRs);
      
      // Calculate counts
      const counts = {};
      Object.keys(qrsByName).forEach(name => {
        counts[name] = qrsByName[name].length;
      });
      setQrNameCounts(counts);
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      console.error('Error loading theater data:', error);
      showError('Failed to load theater data');
    } finally {
      setLoading(false);
    }
  }, [theaterId, theater, showError]);

  // Load QR codes
  const loadQRCodes = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      setLoading(true);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('🔍 Loading QR Codes for theater:', theaterId);
      
      // Use same endpoint as admin page
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/theater/${theaterId}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR codes');
      }
      
      const data = await response.json();
      
      console.log('📦 QR Codes API Response:', data);
      
      if (data.success && data.data && data.data.qrCodes) {
        const qrCodesData = data.data.qrCodes;
        console.log('✅ QR Codes loaded:', qrCodesData.length, 'codes');
        console.log('📊 QR Codes data:', qrCodesData);
        
        setQrCodes(qrCodesData);
        
        // Calculate counts per QR name
        const counts = {};
        qrCodesData.forEach(qr => {
          const name = qr.name || 'Unnamed';
          counts[name] = (counts[name] || 0) + 1;
        });
        console.log('🔢 QR Name Counts:', counts);
        setQrNameCounts(counts);
      } else {
        console.log('⚠️ No QR codes found in response');
        setQrCodes([]);
        setQrNameCounts({});
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏹️ QR codes request was cancelled');
        return;
      }
      console.error('❌ Error loading QR codes:', error);
      showError('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, [theaterId, showError]);

  useEffect(() => {
    loadQRNames();
    loadTheaterData(); // This now handles both theater and QR codes
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setQrCodesByName({});
      setActiveCategory(null);
      setQrNames([]);
      setLoading(true);
    };
  }, [loadQRNames, loadTheaterData]);

  // Filter QR codes by active category
  const currentQRs = useMemo(() => {
    if (!activeCategory) return qrCodes;
    return qrCodes.filter(qr => qr.name === activeCategory);
  }, [qrCodes, activeCategory]);

  // Modal handlers
  const openCrudModal = useCallback((qrCode, mode = 'view') => {
    console.log('🔍 Opening modal for QR:', qrCode);
    setCrudModal({
      isOpen: true,
      qrCode: qrCode,
      mode: mode
    });
    
    // Set display image URL
    if (qrCode && qrCode.qrImageUrl) {
      setDisplayImageUrl(qrCode.qrImageUrl);
    } else {
      setDisplayImageUrl(null);
    }
  }, []);

  const closeCrudModal = useCallback(() => {
    setCrudModal({
      isOpen: false,
      qrCode: null,
      mode: 'view'
    });
  }, []);

  // Handle CRUD Save (mirrored from admin page)
  const handleCrudSave = useCallback(async (formData) => {
    try {
      setActionLoading(prev => ({ ...prev, [formData._id || 'new']: true }));
      
      const isEditing = crudModal.mode === 'edit';
      
      if (isEditing) {
        if (formData.isSeatRow && formData.parentQRDetailId && formData.seatId) {
          if (formData.isNewSeat || formData.seatId.toString().startsWith('new_')) {
            const response = await fetch(
              `${config.api.baseUrl}/single-qrcodes/${formData.parentDocId}/details/${formData.parentQRDetailId}/seats`,
              {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  seat: formData.seatNumber,
                  isActive: formData.isActive
                })
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to create new seat');
            }

            await loadTheaterData();
            closeCrudModal();
            showSuccess(`Seat ${formData.seatNumber} added successfully!`);
            
          } else {
            const response = await fetch(
              `${config.api.baseUrl}/single-qrcodes/${formData.parentDocId}/details/${formData.parentQRDetailId}/seats/${formData.seatId}`,
              {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  seat: formData.seatNumber,
                  isActive: formData.isActive,
                  qrCodeUrl: formData.qrImageUrl
                })
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to update seat');
            }

            showSuccess(`Seat ${formData.seatNumber} updated successfully`);
          }
          
        } else {
          if (!formData.parentDocId) {
            setActionLoading(prev => ({ ...prev, [formData._id]: false }));
            return;
          }

          const updatePayload = {
            qrName: formData.name,
            seatClass: formData.seatClass,
            seat: formData.seat || null,
            logoUrl: formData.logoUrl,
            logoType: formData.logoType || 'default',
            isActive: formData.isActive
          };

          const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${formData.parentDocId}/details/${formData._id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updatePayload)
          });
          
          const data = await response.json();
          
          if (data.success) {
            await loadTheaterData();
            showSuccess('QR code updated successfully');
            closeCrudModal();
          }
        }
        
        await loadTheaterData();
        closeCrudModal();
      }
    } catch (error) {
      console.error('Error saving QR code:', error);
      showError(error.message || 'Failed to save QR code');
    } finally {
      setActionLoading(prev => ({ ...prev, [formData._id || 'new']: false }));
    }
  }, [crudModal.mode, loadTheaterData, closeCrudModal, showSuccess, showError]);

  // Delete Seat (mirrored from admin page)
  const deleteSeat = async (seatId, seatName) => {
    const parentDocId = crudModal.qrCode?.parentDocId;
    const parentQRDetailId = crudModal.qrCode?.parentQRDetailId;
    
    if (!parentDocId || !parentQRDetailId || !seatId) {
      showError('Missing required information to delete seat');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete ${seatName}? This action cannot be undone.`);
    
    if (!confirmed) return;
    
    try {
      setActionLoading(prev => ({ ...prev, [seatId]: true }));
      
      const response = await fetch(
        `${config.api.baseUrl}/single-qrcodes/${parentDocId}/details/${parentQRDetailId}/seats/${seatId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete seat');
      }
      
      const data = await response.json();
      
      if (data.success) {
        closeCrudModal();
        await loadTheaterData();
        showSuccess(`${seatName} deleted successfully`);
      } else {
        throw new Error(data.message || 'Failed to delete seat');
      }
    } catch (error) {
      console.error('Error deleting seat:', error);
      showError(error.message || 'Failed to delete seat');
    } finally {
      setActionLoading(prev => ({ ...prev, [seatId]: false }));
    }
  };

  // Download QR code
  const downloadQRCode = useCallback(async (qrCode) => {
    try {
      const qrImageUrl = qrCode.qrImageUrl || qrCode.qrCodeUrl;
      
      if (!qrImageUrl) {
        showError('QR code image not available');
        return;
      }
      
      const link = document.createElement('a');
      link.href = qrImageUrl;
      link.download = `${qrCode.name || 'qr-code'}-${qrCode.seatId || qrCode._id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showSuccess('QR code downloaded successfully');
    } catch (error) {
      console.error('Error downloading QR code:', error);
      showError('Failed to download QR code');
    }
  }, [showError, showSuccess]);

  // Toggle QR code status
  const toggleQRStatus = useCallback(async (qrCodeId, currentStatus) => {
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/singleqrcodes/${qrCodeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update QR code status');
      }
      
      const data = await response.json();
      
      if (data.success) {
        showSuccess(`QR code ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        loadQRCodes();
      } else {
        throw new Error(data.message || 'Failed to update QR code status');
      }
    } catch (error) {
      console.error('Error toggling QR code status:', error);
      showError(error.message || 'Failed to update QR code status');
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
    }
  }, [loadQRCodes, showError, showSuccess]);

  // Delete QR code
  const deleteQRCode = useCallback(async (qrCodeId, qrCodeName) => {
    const confirmed = await confirm(
      `Are you sure you want to delete the QR code "${qrCodeName}"? This action cannot be undone.`,
      'Delete QR Code'
    );
    
    if (!confirmed) return;
    
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/singleqrcodes/${qrCodeId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ theaterId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete QR code');
      }
      
      const data = await response.json();
      
      if (data.success) {
        showSuccess('QR code deleted successfully');
        loadQRCodes();
      } else {
        throw new Error(data.message || 'Failed to delete QR code');
      }
    } catch (error) {
      console.error('Error deleting QR code:', error);
      showError(error.message || 'Failed to delete QR code');
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
    }
  }, [theaterId, loadQRCodes, showError, showSuccess, confirm]);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="QR Management" currentPage="qr-management">
        <div className="theater-user-details-page">
          <PageContainer
            hasHeader={false}
            className="theater-user-management-vertical"
          >
            {/* Vertical Page Header */}
            <VerticalPageHeader
              title="QR PAYNOW"
              backButtonText="Back to QR Management"
              backButtonPath={`/theater-dashboard/${theaterId}`}
              actionButton={
                <button 
                  className="header-btn"
                  onClick={() => navigate(`/theater-generate-qr/${theaterId}`)}
                >
                  <span className="btn-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </span>
                  GENERATE QR CODES
                </button>
              }
            />

            <div className="theater-user-settings-container">
              {/* Settings Tabs - Dynamic QR Names */}
              <div className="theater-user-settings-tabs">
                {qrNamesLoading ? (
                  <div className="theater-user-loading">Loading QR names...</div>
                ) : qrNames.length > 0 ? (
                  qrNames.map((qrName) => (
                    <button 
                      key={qrName.qrName}
                      className={`theater-user-settings-tab ${activeCategory === qrName.qrName ? 'active' : ''}`}
                      onClick={() => setActiveCategory(qrName.qrName)}
                    >
                      <span className="theater-user-tab-icon">📱</span>
                      {qrName.qrName}
                      <span className="theater-user-tab-count">{qrNameCounts[qrName.qrName] || 0}</span>
                    </button>
                  ))
                ) : (
                  <div className="theater-user-no-names">No QR names configured for this theater</div>
                )}
              </div>

              {/* Settings Content - Table */}
              <div className="theater-user-settings-content">
                <div className="theater-user-settings-section">
                  <div className="theater-user-section-header">
                    <h3>{activeCategory ? `${activeCategory} QR Codes` : 'QR Codes'}</h3>
                    <div className="theater-user-section-stats">
                      {loading ? (
                        <>
                          <span>Total: <span className="loading-dots">...</span></span>
                          <span>Active: <span className="loading-dots">...</span></span>
                        </>
                      ) : (
                        <>
                          <span>Total: {currentQRs.length}</span>
                          <span>Active: {currentQRs.filter(qr => qr.isActive !== false).length}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* QR Table */}
                  <div className="table-container">
                    <div className="table-wrapper">
                      <table className="theater-table">
                        <thead>
                          <tr>
                            <th className="sno-col">S.No</th>
                            <th className="name-col">QR Code Name</th>
                            <th className="owner-col">Seat Class</th>
                            <th className="status-col">Status</th>
                            <th className="access-status-col">Access Status</th>
                            <th className="actions-col">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>
                                Loading QR codes...
                              </td>
                            </tr>
                          ) : currentQRs.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{textAlign: 'center', padding: '40px'}}>
                                <div className="empty-state">
                                  <div className="empty-icon">
                                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '48px', height: '48px', color: '#8b5cf6'}}>
                                      <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3v-3z"/>
                                    </svg>
                                  </div>
                                  <h3>No QR Codes Found</h3>
                                  <p>
                                    {activeCategory 
                                      ? `No QR codes found for "${activeCategory}"`
                                      : 'Start by generating your first QR code'}
                                  </p>
                                  <button 
                                    className="btn-primary"
                                    onClick={() => navigate(`/theater-generate-qr/${theaterId}`)}
                                  >
                                    GENERATE QR CODES
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            currentQRs.map((qrCode, index) => (
                              <tr key={qrCode._id} className={`theater-row ${!qrCode.isActive ? 'inactive' : ''}`}>
                                {/* S NO Column */}
                                <td className="sno-cell">
                                  <div className="sno-number">{index + 1}</div>
                                </td>

                                {/* QR Name Column */}
                                <td className="theater-name-cell">
                                  <div className="theater-name-full">{qrCode.name}</div>
                                </td>

                                {/* Seat Class Column */}
                                <td className="owner-cell">
                                  <div className="owner-info">
                                    <div className="owner-name">{qrCode.seatClass || 'Single QR'}</div>
                                  </div>
                                </td>

                                {/* Status Column */}
                                <td className="status-cell">
                                  <span className={`status-badge ${qrCode.isActive ? 'active' : 'inactive'}`}>
                                    {qrCode.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </td>

                                {/* Access Status Column - Toggle Switch */}
                                <td className="access-status-cell">
                                  <div className="toggle-wrapper">
                                    <label className="switch" style={{
                                      position: 'relative',
                                      display: 'inline-block',
                                      width: '50px',
                                      height: '24px'
                                    }}>
                                      <input
                                        type="checkbox"
                                        checked={qrCode.isActive}
                                        onChange={() => toggleQRStatus(qrCode._id, qrCode.isActive)}
                                        disabled={actionLoading[qrCode._id]}
                                        style={{
                                          opacity: 0,
                                          width: 0,
                                          height: 0
                                        }}
                                      />
                                      <span className="slider" style={{
                                        position: 'absolute',
                                        cursor: actionLoading[qrCode._id] ? 'not-allowed' : 'pointer',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: qrCode.isActive ? 'var(--primary-dark, #6D28D9)' : '#ccc',
                                        transition: '.4s',
                                        borderRadius: '24px',
                                        opacity: actionLoading[qrCode._id] ? 0.5 : 1
                                      }}>
                                        <span style={{
                                          position: 'absolute',
                                          content: '""',
                                          height: '18px',
                                          width: '18px',
                                          left: qrCode.isActive ? '26px' : '3px',
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
                                      onClick={() => openCrudModal(qrCode, 'view')}
                                      disabled={actionLoading[qrCode._id]}
                                      title="View QR Details"
                                    />
                                    
                                    <ActionButton 
                                      type="download"
                                      onClick={() => downloadQRCode(qrCode)}
                                      title="Download QR Code"
                                    />
                                    
                                    <ActionButton 
                                      type="delete"
                                      onClick={() => deleteQRCode(qrCode._id, qrCode.name)}
                                      disabled={actionLoading[qrCode._id]}
                                      title="Delete QR Code"
                                    />
                                  </ActionButtons>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PageContainer>
        </div>

        {/* CRUD Modal - Complete Mirror from Admin Page */}
        {crudModal.isOpen && crudModal.qrCode && (
          <CrudModal
            isOpen={crudModal.isOpen}
            qrCode={crudModal.qrCode}
            mode={crudModal.mode}
            theater={theater}
            onClose={closeCrudModal}
            onSave={handleCrudSave}
            onDelete={deleteSeat}
            onModeChange={(mode, newQrCode) => {
              if (newQrCode) {
                setCrudModal(prev => ({ ...prev, mode, qrCode: newQrCode }));
              } else {
                setCrudModal(prev => ({ ...prev, mode }));
              }
            }}
            actionLoading={actionLoading}
            displayImageUrl={displayImageUrl}
            onSeatEdit={(seatData) => {
              closeCrudModal();
              setTimeout(() => {
                setCrudModal({
                  isOpen: true,
                  qrCode: seatData,
                  mode: 'edit'
                });
              }, 100);
            }}
            onToggleStatus={toggleQRStatus}
            qrNames={qrNames}
            existingQRNames={Object.keys(qrCodesByName)}
          />
        )}
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterQRManagement;
