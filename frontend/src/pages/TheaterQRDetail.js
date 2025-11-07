import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import config from '../config';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import ErrorBoundary from '../components/ErrorBoundary';
import PageContainer from '../components/PageContainer';
import VerticalPageHeader from '../components/VerticalPageHeader';
import { ActionButton, ActionButtons } from '../components/ActionButton';
import Pagination from '../components/Pagination';
import InstantImage from '../components/InstantImage';
import { useModal } from '../contexts/ModalContext';
import JSZip from 'jszip';
import '../styles/TheaterList.css'; // Import TheaterList styles for table
import '../styles/QRManagementPage.css'; // Import global modal styles
import '../styles/RoleCreate.css'; // Import for consistent styling
import '../styles/TheaterUserDetails.css'; // Import Theater User Details styles for vertical layout
import { clearTheaterCache, addCacheBuster } from '../utils/cacheManager';
import { usePerformanceMonitoring, preventLayoutShift } from '../hooks/usePerformanceMonitoring';

// Helper function to get authenticated headers
const getAuthHeaders = () => {
  const authToken = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Accept': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  };
};

// Enhanced Lazy Loading QR Image Component with Intersection Observer (matching QRManagement)
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

  return (
    <div className="lazy-qr-container" style={style}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'loading' : ''} ${hasError ? 'error' : ''}`}
        style={style}
      />
      {isLoading && (
        <div className="qr-loading-placeholder">
          <div className="qr-skeleton"></div>
        </div>
      )}
    </div>
  );
});

LazyQRImage.displayName = 'LazyQRImage';

// QR Card Component
const QRCard = React.memo(({ qrCode, onView, onDownload, onToggleStatus, onDelete, actionLoading }) => (
  <div className="qr-detail-card">
    <div className="qr-image">
      <LazyQRImage 
        src={qrCode.qrImageUrl} 
        alt={qrCode.name}
        className="qr-img"
      />
      <div className="qr-type-badge">
        {qrCode.qrType === 'canteen' ? '🍕' : '🎬'}
      </div>
      <div className={`qr-status-indicator ${qrCode.isActive ? 'active' : 'inactive'}`}></div>
    </div>
    
    <div className="qr-info">
      <h3 className="qr-name">{qrCode.name}</h3>
      {qrCode.qrType === 'screen' && (
        <p className="qr-seat">
          {qrCode.screenName} - Seat {qrCode.seatNumber}
        </p>
      )}
      <div className="qr-stats">
        <span>Orders: {qrCode.orderCount || 0}</span>
        <span>Revenue: ₹{qrCode.totalRevenue || 0}</span>
      </div>
      <div className="qr-status">
        <span className={`status ${qrCode.isActive ? 'active' : 'inactive'}`}>
          {qrCode.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
    </div>
    
    <div className="qr-actions">
      <button
        className="action-btn view-btn"
        onClick={() => onView(qrCode)}
        title="View Details"
      >
        👁️
      </button>
      <button
        className="action-btn download-btn"
        onClick={() => onDownload(qrCode)}
        title="Download QR Code"
      >
        ⬇️
      </button>
      <button
        className={`action-btn toggle-btn ${qrCode.isActive ? 'active' : 'inactive'}`}
        onClick={() => onToggleStatus(qrCode._id, qrCode.isActive)}
        disabled={actionLoading[qrCode._id]}
        title={qrCode.isActive ? 'Deactivate' : 'Activate'}
      >
        {actionLoading[qrCode._id] ? '⟳' : (qrCode.isActive ? '⏸️' : '▶️')}
      </button>
      <button
        className="action-btn delete-btn"
        onClick={() => onDelete(qrCode._id, qrCode.name)}
        disabled={actionLoading[qrCode._id]}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  </div>
));

QRCard.displayName = 'QRCard';

// CRUD Modal Component
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

  const handleDelete = () => {
    // Call onDelete which will open the global delete modal
    onDelete(formData._id, formData.name);
    // Close the CRUD modal
    onClose();
  };

  const isReadOnly = mode === 'view';
  const isEditing = mode === 'edit';

  const getModalTitle = () => {
    switch (mode) {
      case 'view': return 'View QR Code';
      case 'edit': return 'Edit QR Code';
      case 'create': return 'Create QR Code';
      default: return 'QR Code Details';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-nav-left">
          </div>
          
          <div className="modal-title-section">
            <h2>{getModalTitle()}</h2>
          </div>
          
          <div className="modal-nav-right">
            <button 
              className="close-btn"
              onClick={onClose}
            >
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
              <select
                name="name"
                className="form-control"
                value={formData.name || ''}
                onChange={(e) => {
                  // Find the selected QR name to get its seatClass
                  const selectedQRName = qrNames.find(qr => qr.qrName === e.target.value);
                  
                  // Update both name and seatClass
                  setFormData(prev => ({
                    ...prev,
                    name: e.target.value,
                    screenName: selectedQRName?.seatClass || prev.screenName,
                    seatClass: selectedQRName?.seatClass || prev.seatClass
                  }));
                }}
                disabled={isReadOnly}
                required
              >
                <option value="">Select QR Code Name</option>
                {qrNames
                  .filter(qr => {
                    // Show only unused QR names OR the current QR name being edited
                    return !existingQRNames.includes(qr.qrName) || qr.qrName === qrCode?.name;
                  })
                  .map((qr, index) => (
                  <option key={index} value={qr.qrName}>
                    {qr.qrName}
                  </option>
                ))}
              </select>
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

            {/* Show Screen Name and Seat Number if they exist in the data */}
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
                    style={{
                      backgroundColor: '#f3f4f6',
                      cursor: 'not-allowed'
                    }}
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

            {/* PHASE 2 FIX: Hide QR Preview for screen-type QR codes (seat rows) */}
            {(() => {
              const shouldShowQRPreview = formData.qrType !== 'screen' && !formData.isSeatRow;

              return shouldShowQRPreview;
            })() && (
              <div className="form-group">
                <label>QR Code Preview</label>
                <div className="qr-preview">
                {displayImageUrl ? (
                  <div className="qr-image-container">
                    <InstantImage 
                      src={displayImageUrl} 
                      alt="QR Code Preview"
                      className="qr-preview-img"
                      onLoad={(e) => {

                        e.target.nextElementSibling.style.display = 'none';
                      }}
                      onError={(e) => {

                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    <div className="qr-preview-error" style={{ display: 'none' }}>
                      <div className="qr-error-content">
                        <span>🖼️</span>
                        <h4>Image not available</h4>
                        <p>The QR code image could not be loaded. This might be due to:</p>
                        <ul>
                          <li>Expired access URL</li>
                          <li>Network connectivity issues</li>
                          <li>Google Cloud Storage configuration</li>
                        </ul>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            // Generate new QR code on the fly
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            canvas.width = 150;
                            canvas.height = 150;
                            
                            // Simple QR-like pattern
                            ctx.fillStyle = '#000';
                            ctx.fillRect(0, 0, 150, 150);
                            ctx.fillStyle = '#fff';
                            ctx.fillRect(10, 10, 130, 130);
                            ctx.fillStyle = '#000';
                            
                            // Create a simple grid pattern
                            for (let i = 0; i < 15; i++) {
                              for (let j = 0; j < 15; j++) {
                                if ((i + j) % 2 === 0) {
                                  ctx.fillRect(i * 9 + 15, j * 9 + 15, 8, 8);
                                }
                              }
                            }
                            
                            // Add text
                            ctx.fillStyle = '#fff';
                            ctx.font = '12px Arial';
                            ctx.textAlign = 'center';
                            ctx.fillText(formData.name || 'QR Code', 75, 80);
                            
                            const img = document.querySelector('.qr-preview-img');
                            img.src = canvas.toDataURL();
                            img.style.display = 'block';
                            img.nextElementSibling.style.display = 'none';
                          }}
                        >
                          Generate Preview
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="qr-preview-placeholder">
                    <span>🔍</span>
                    <h4>No QR Code Available</h4>
                    <p>No QR code image URL found for this item.</p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Display seat information for screen-type QR codes instead of QR preview */}
            {(() => {
              // Show individual seat info only if it's a seat row
              const shouldShowSeatInfo = formData.isSeatRow;

              return shouldShowSeatInfo;
            })() && (
              <div className="form-group">
                <label>Seat Information</label>
                <div className="seat-info-display" style={{
                  padding: '15px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                    <strong>QR Code Name:</strong> {formData.name || formData.parentQRName}
                  </div>
                  <div style={{ fontSize: '16px', color: '#1f2937', fontWeight: '600', marginBottom: '8px' }}>
                    <strong>Seat Number:</strong> {formData.seatNumber || 'N/A'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    <strong>Seat Class:</strong> {formData.seatClass || 'N/A'}
                  </div>
                  
                  {/* Show QR Code Image for individual seat in view/edit mode */}
                  {formData.isSeatRow && formData.qrImageUrl && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
                        <strong>QR Code Image:</strong>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <InstantImage 
                          src={formData.qrImageUrl} 
                          alt={`QR Code for ${formData.seatNumber}`}
                          style={{
                            maxWidth: '200px',
                            maxHeight: '200px',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '8px',
                            backgroundColor: 'white'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'block';
                          }}
                        />

                        <div style={{ display: 'none', color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
                          QR code image not available
                        </div>
                      </div>
                      
                      {/* Download Button for Seat QR Code */}
                      <div style={{ textAlign: 'center', marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={() => {

                            const link = document.createElement('a');
                            link.href = formData.qrImageUrl;
                            link.download = `${formData.seatClass || formData.name}_${formData.seatNumber}_QR.png`;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          style={{
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#7c3aed';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.4)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#8b5cf6';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.3)';
                          }}
                        >
                          <span>??</span>
                          <span>Download QR Code</span>
                        </button>
                      </div>
                      
                      {/* QR Image Update in Edit Mode */}
                      {mode === 'edit' && (
                        <div style={{ marginTop: '12px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '13px', 
                            color: '#6b7280', 
                            marginBottom: '6px' 
                          }}>
                            Update QR Code Image URL:
                          </label>
                          {/* <input
                            type="text"
                            name="qrImageUrl"
                            className="form-control"
                            value={formData.qrImageUrl || ''}
                            onChange={handleInputChange}
                            placeholder="Enter new QR code image URL"
                            style={{ fontSize: '13px' }}
                          /> */}
                          <p style={{ 
                            fontSize: '11px', 
                            color: '#9ca3af', 
                            marginTop: '4px',
                            marginBottom: '0'
                          }}>
                            Paste the new Google Cloud Storage URL for this seat's QR code
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Visual Seat Grid Display for Screen QR Codes (parent view) */}
            {(() => {
              // Show seat grid only if it's a screen-type QR with seats (not an individual seat row)
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
                  {/* Screen Header with Download All Button */}
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
                      <span>??</span>
                      <span>SCREEN - {formData.seatClass || formData.name}</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {mode === 'view' && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentMaxSeat = Math.max(...formData.seats.map(s => {
                              const match = s.seat.match(/\d+/);
                              return match ? parseInt(match[0]) : 0;
                            }));
                            const nextSeatNumber = currentMaxSeat + 1;
                            const newSeatName = `A${nextSeatNumber}`;
                            
                            // Create new seat data
                            const newSeatData = {
                              ...formData,
                              isSeatRow: true,
                              seatNumber: newSeatName,
                              qrImageUrl: null,
                              isActive: true,
                              scanCount: 0,
                              seatId: `new_${Date.now()}`,
                              parentQRDetailId: formData._id,
                              parentDocId: formData.parentDocId || formData._id,
                              _id: `${formData._id}_new_${Date.now()}`,
                              parentQRName: formData.name,
                              seatClass: formData.seatClass,
                              seats: formData.seats,
                              isNewSeat: true
                            };
                            

                            // Switch to edit mode for the new seat
                            if (onSeatEdit) {
                              onSeatEdit(newSeatData);
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
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span>?</span>
                          <span>Add Seat</span>
                        </button>
                      )}
                      
                      {mode === 'view' && formData.seats.filter(s => s.qrCodeUrl).length > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const seatsWithQR = formData.seats.filter(s => s.qrCodeUrl);

                            try {
                              const zip = new JSZip();
                              const folder = zip.folder(`${formData.seatClass || formData.name}_QR_Codes`);
                              
                              // Fetch all QR code images
                              const fetchPromises = seatsWithQR.map(async (seat) => {
                                try {
                                  const response = await fetch(seat.qrCodeUrl);
                                  const blob = await response.blob();
                                  const filename = `${seat.seat}_QR.png`;
                                  folder.file(filename, blob);
  } catch (error) {
  }
                              });
                              
                              await Promise.all(fetchPromises);
                              
                              // Generate ZIP file

                              const zipBlob = await zip.generateAsync({ type: 'blob' });
                              
                              // Download ZIP
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(zipBlob);
                              link.download = `${formData.seatClass || formData.name}_QR_Codes.zip`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(link.href);
                              

                              alert(`? Downloaded ${seatsWithQR.length} QR codes as ZIP file!`);
                            } catch (error) {

                              alert('? Failed to create ZIP file. Please try again.');
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
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          <span>??</span>
                          <span>Download All ({formData.seats.filter(s => s.qrCodeUrl).length})</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Seat Grid - Grouped by Row Letter */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {(() => {
                      // Group seats by their letter prefix
                      const seatsByRow = {};
                      formData.seats.forEach(seat => {
                        const rowLetter = seat.seat.match(/^[A-Za-z]+/)?.[0] || 'Other';
                        if (!seatsByRow[rowLetter]) {
                          seatsByRow[rowLetter] = [];
                        }
                        seatsByRow[rowLetter].push(seat);
                      });

                      // Sort rows alphabetically
                      const sortedRows = Object.keys(seatsByRow).sort();

                      return sortedRows.map(rowLetter => (
                        <div key={rowLetter} style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center'
                        }}>
                          {/* Row Label */}
                          <div style={{
                            minWidth: '30px',
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#374151',
                            textAlign: 'center'
                          }}>
                            {rowLetter}
                          </div>

                          {/* Seat Buttons in this row */}
                          <div style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            flex: 1
                          }}>
                            {seatsByRow[rowLetter]
                              .sort((a, b) => {
                                // Sort by number part: A1, A2, A3, etc.
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
                                    transition: 'all 0.2s',
                                    position: 'relative',
                                    border: '2px solid transparent',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    minWidth: '50px'
                                  }}
                                  title={mode === 'view' ? `Left-click: Edit | Right-click: Download ${seat.seat}` : `Editing ${seat.seat}`}
                                  onClick={() => {
                                    // In view mode: Trigger seat edit callback
                                    if (mode === 'view' && onSeatEdit) {
                                      const seatData = {
                                        ...formData,
                                        isSeatRow: true,
                                        seatNumber: seat.seat,
                                        qrImageUrl: seat.qrCodeUrl,
                                        isActive: seat.isActive,
                                        scanCount: seat.scanCount || 0,
                                        seatId: seat._id,
                                        parentQRDetailId: formData._id,
                                        parentDocId: formData.parentDocId || formData._id,
                                        _id: `${formData._id}_${seat._id}`,
                                        parentQRName: formData.name,
                                        seatClass: formData.seatClass,
                                        seats: formData.seats
                                      };
                                      

                                      onSeatEdit(seatData);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault(); // Prevent default context menu
                                    if (seat.qrCodeUrl && mode === 'view') {
                                      // Download QR code for this seat

                                      const link = document.createElement('a');
                                      link.href = seat.qrCodeUrl;
                                      link.download = `${formData.seatClass || formData.name}_${seat.seat}_QR.png`;
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      
                                      // Visual feedback
                                      e.currentTarget.style.transform = 'scale(0.95)';
                                      setTimeout(() => {
                                        e.currentTarget.style.transform = 'scale(1)';
                                      }, 150);
                                    }
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.borderColor = '#6366f1';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(99, 102, 241, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
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
                                    }} title="QR code available" />
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Legend */}
                  <div style={{
                    marginTop: '20px',
                    paddingTop: '15px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    gap: '20px',
                    fontSize: '12px',
                    color: '#6b7280',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#8b5cf6', borderRadius: '4px' }}></div>
                      <span>Active with QR</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '20px', height: '20px', backgroundColor: '#d1d5db', borderRadius: '4px' }}></div>
                      <span>Inactive</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                      <span>QR Code Available (click to view)</span>
                    </div>
                  </div>

                  {/* Seat Count Summary */}
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#374151'
                  }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Summary:</strong> {formData.seats.filter(s => s.isActive).length} active seats, 
                      {' '}{formData.seats.filter(s => s.qrCodeUrl).length} with QR codes
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                      <strong>Quick Actions:</strong> Left-click to edit � Right-click to download
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* <div className="form-group stats-group">
              <div className="stat-item">
                <span className="stat-label">Orders:</span>
                <span className="stat-value">{formData.orderCount || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Revenue:</span>
                <span className="stat-value">₹{formData.totalRevenue || 0}</span>
              </div>
            </div> */}
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-actions">
          {mode === 'view' && !formData.isSeatRow && (
            <>
              <button type="button" className="cancel-btn" onClick={onClose}>
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onModeChange('edit')}
              >
                Edit
              </button>
            </>
          )}
          
          {mode === 'view' && formData.isSeatRow && (
            <>
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => {
                  // Navigate back to parent screen QR view
                  if (formData.parentQRDetailId) {
                    const parentQR = {
                      _id: formData.parentQRDetailId,
                      parentDocId: formData.parentDocId || formData._id,
                      name: formData.parentQRName || formData.seatClass,
                      qrType: 'screen',
                      seatClass: formData.seatClass,
                      seats: formData.seats,
                      qrImageUrl: formData.qrImageUrl,
                      isActive: formData.isActive
                    };
                    onModeChange('view', parentQR);
                  } else {
                    onClose();
                  }
                }}
                style={{ marginRight: 'auto' }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (onDelete && formData.seatId) {
                    onDelete(formData.seatId, `Seat ${formData.seatNumber}`);
                  }
                }}
                disabled={actionLoading[formData.seatId]}
                style={{ 
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                {actionLoading[formData.seatId] ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => onModeChange('edit')}
              >
                Edit
              </button>
            </>
          )}
          
          {mode === 'edit' && formData.isSeatRow && (
            <>
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => {
                  // Switch back to view mode instead of closing
                  onModeChange('view');
                }}
                style={{ marginRight: 'auto' }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (onDelete && formData.seatId) {
                    onDelete(formData.seatId, `Seat ${formData.seatNumber}`);
                  }
                }}
                disabled={actionLoading[formData.seatId]}
                style={{ 
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                {actionLoading[formData.seatId] ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="submit"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={actionLoading[formData._id]}
              >
                {actionLoading[formData._id] ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
          
          {mode === 'edit' && !formData.isSeatRow && (
            <>
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={actionLoading[formData._id]}
              >
                {actionLoading[formData._id] ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
          
          {mode === 'create' && (
            <>
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                onClick={handleSubmit}
                disabled={actionLoading.new}
              >
                {actionLoading.new ? 'Creating...' : 'Create QR Code'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

CrudModal.displayName = 'CrudModal';

// Skeleton component for QR cards (matching performance patterns)
const QRCardSkeleton = React.memo(() => (
  <div className="qr-detail-card skeleton-card">
    <div className="qr-image skeleton-image"></div>
    <div className="qr-info">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-text"></div>
      <div className="skeleton-line skeleton-stats"></div>
    </div>
    <div className="qr-actions">
      <div className="skeleton-button"></div>
      <div className="skeleton-button"></div>
      <div className="skeleton-button"></div>
      <div className="skeleton-button"></div>
    </div>
  </div>
));

QRCardSkeleton.displayName = 'QRCardSkeleton';

const TheaterQRDetail = () => {
  const { theaterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showError, showSuccess, alert } = useModal();
  
  // PERFORMANCE MONITORING: Track page performance metrics
  usePerformanceMonitoring('TheaterQRDetail');
  
  // Data from navigation state or fetch
  const [theater, setTheater] = useState(location.state?.theater || null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  
  // QR Names state for dynamic sidebar
  const [qrNames, setQrNames] = useState([]);
  const [qrNamesLoading, setQrNamesLoading] = useState(true);
  
  // QR Codes grouped by name
  const [qrCodesByName, setQrCodesByName] = useState({});
  
  // Pagination state (matching RolesList)
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Search state (matching RolesList)
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Performance refs (matching QRManagement)
  const abortControllerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  
  // Active category state - will be set to first QR name when loaded
  const [activeCategory, setActiveCategory] = useState(null);
  
  // Force render state for tab reloading
  const [forceRender, setForceRender] = useState(0);
  
  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    isActive: ''
  });
  
  // CRUD Modal state
  const [crudModal, setCrudModal] = useState({
    isOpen: false,
    qrCode: null,
    mode: 'view' // 'view', 'edit', 'create'
  });

  // Delete Modal state (matching Theater Management global design)
  const [deleteModal, setDeleteModal] = useState({ show: false, qrCode: null });

  // Display image URL state for signed URL
  const [displayImageUrl, setDisplayImageUrl] = useState(null);

  // Debounced search effect (matching RolesList)
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

  // Load QR Names for dynamic sidebar
  const loadQRNames = useCallback(async () => {
    if (!theaterId) return;
    
    try {

      setQrNamesLoading(true);
      const url = `${config.api.baseUrl}/qrcodenames?theaterId=${theaterId}&isActive=true&limit=100`;

      const response = await fetch(url, { headers: getAuthHeaders() });
      const data = await response.json();
      

      if (data.success && data.data) {
        const qrNamesArray = data.data.qrCodeNames || [];

        setQrNames(qrNamesArray);
      } else {

        setQrNames([]);
      }
    } catch (error) {

      setQrNames([]);
    } finally {
      setQrNamesLoading(false);
    }
  }, [theaterId]);

  // Set active category to first QR name when QR names are loaded
  useEffect(() => {

    if (qrNames.length > 0) {
      // Set activeCategory if it's null OR if current activeCategory is not in the list
      if (!activeCategory || !qrNames.find(qr => qr.qrName === activeCategory)) {
        const firstQRName = qrNames[0].qrName;

        setActiveCategory(firstQRName);
      }
    }
  }, [qrNames]); // Removed activeCategory from dependencies to prevent loops

  const loadTheaterData = useCallback(async () => {
    try {
      // Cancel previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      setLoading(true);
      
      const signal = abortControllerRef.current.signal;
      const headers = getAuthHeaders();
      
      if (!theater) {
        const theaterUrl = addCacheBuster(`/api/theaters/${theaterId}`);
        const theaterResponse = await fetch(theaterUrl, { signal, headers });
        const theaterData = await theaterResponse.json();
        if (theaterData.success) {
          setTheater(theaterData.theater);
        }
      }
      
      // PERFORMANCE OPTIMIZATION: Parallel requests for all QR codes

      const singleUrl = addCacheBuster(`${config.api.baseUrl}/single-qrcodes/theater/${theaterId}`);
      // Fetching from singleqrcodes collection which contains both single and screen QR codes

      // singleUrl removed
      
      const singleResponse = await fetch(singleUrl, { signal, headers });
      
      // Safely parse JSON response
      const singleData = singleResponse.ok ? await singleResponse.json().catch(() => ({ success: false, message: 'Invalid JSON response' })) : { success: false, message: `HTTP ${singleResponse.status}` };
      const screenData = { success: false }; // Not fetching screens separately anymore
      
      // Group QR codes by name
      const qrsByName = {};
      

      // singleResponse removed

      if (!singleData.success) {

        // Only show error for actual server errors, not "not found" cases
        if (singleData.message && !singleData.message.includes('not found') && !singleData.message.includes('No QR codes found')) {

          // Removed error modal - errors logged to console only
        }
      }
      
      if (!screenData.success) {

        // Only show error for actual server errors, not "not found" cases
        if (screenData.message && !screenData.message.includes('not found') && !screenData.message.includes('No QR codes found')) {

          // Removed error modal - errors logged to console only
        }
      }
      
      if (singleData.success) {

        (singleData.data?.qrCodes || []).forEach(qr => {

          if (!qrsByName[qr.name]) {
            qrsByName[qr.name] = [];
          }
          
          // Keep screen QR as single row with seats array (don't expand into individual rows)
          // The view modal will display the seat grid visually when clicked
          qrsByName[qr.name].push({ ...qr });
        });
      }
      
      // singleResponse removed

      // Additional error logging for screen QR codes (already handled above)
      if (!screenData.success) {
  }
      
      if (screenData.success) {

        (screenData.data?.qrCodes || []).forEach(qr => {

          if (!qrsByName[qr.name]) {
            qrsByName[qr.name] = [];
          }
          
          // Keep screen QR as single row with seats array (don't expand into individual rows)
          // The view modal will display the seat grid visually when clicked
          qrsByName[qr.name].push({ ...qr });
        });
      }
      

      setQrCodesByName(qrsByName);
      
    } catch (error) {
      // Handle AbortError gracefully
      if (error.name === 'AbortError') {

        return;
      }

      // Removed error modal - errors logged to console only
    } finally {
      setLoading(false);
    }
  }, [theaterId]); // Removed 'theater' to prevent circular dependency

  // Fetch signed URL for QR code image display
  const fetchDisplayImageUrl = useCallback(async (qrCodeId) => {
    if (!qrCodeId) return null;
    
    try {

      const response = await fetch(`${config.api.baseUrl}/qrcodes/${qrCodeId}/image-url`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {

        return null;
      }
      
      const data = await response.json();

      if (data.success && data.data && data.data.imageUrl) {
        return data.data.imageUrl;
      }
      
      return null;
    } catch (error) {

      return null;
    }
  }, []);

  // Load theater and QR data - MUST be after function declarations
  useEffect(() => {
    loadTheaterData();
    loadQRNames();
    
    // Cleanup on unmount to prevent stale data
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Reset state to prevent displaying stale data on remount
      setQrCodesByName({});
      setActiveCategory(null);
      setQrNames([]);
      setLoading(true);
    };
  }, [theaterId, loadTheaterData, loadQRNames]);

  // Memoized computations for better performance - now based on QR names with pagination
  const filteredQRs = useMemo(() => {
    if (!activeCategory || !qrCodesByName[activeCategory]) {
      return [];
    }
    
    return qrCodesByName[activeCategory].filter(qr => {
      const matchesSearch = !debouncedSearchTerm || 
        qr.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        (qr.screenName && qr.screenName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (qr.seatNumber && qr.seatNumber.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      
      const matchesStatus = !filters.isActive || 
        qr.isActive.toString() === filters.isActive;
      
      return matchesSearch && matchesStatus;
    });
  }, [activeCategory, qrCodesByName, debouncedSearchTerm, filters.isActive]);

  // Update pagination when filtered results change
  useEffect(() => {
    const total = filteredQRs.length;
    setTotalItems(total);
    setTotalPages(Math.ceil(total / itemsPerPage));
  }, [filteredQRs, itemsPerPage]);

  // Paginated QRs
  const currentQRs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredQRs.slice(startIndex, endIndex);
  }, [filteredQRs, currentPage, itemsPerPage]);

  // Get QR count for each QR name (for sidebar display)
  const qrNameCounts = useMemo(() => {
    const counts = {};
    Object.keys(qrCodesByName).forEach(name => {
      counts[name] = qrCodesByName[name].length;
    });
    return counts;
  }, [qrCodesByName]);

  const statsInfo = useMemo(() => {
    const allQRs = Object.values(qrCodesByName).flat();
    return {
      totalQRs: allQRs.length,
      activeQRs: allQRs.filter(qr => qr.isActive).length,
      qrNameCount: qrNames.length
    };
  }, [qrCodesByName, qrNames]);

  // Action handlers (matching QRManagement performance)
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      isActive: ''
    });
  }, []);

  // CRUD Modal Functions
  const openCrudModal = useCallback(async (qrCode, mode = 'view') => {
    setCrudModal({
      isOpen: true,
      qrCode: { ...qrCode },
      mode
    });
    
    // Set display image URL directly from qrCode data
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

  const handleCrudSave = useCallback(async (formData) => {

    try {
      setActionLoading(prev => ({ ...prev, [formData._id || 'new']: true }));
      
      const isEditing = crudModal.mode === 'edit';
      
      if (isEditing) {
        // PHASE 3 FIX: Check if this is a seat-level update
        if (formData.isSeatRow && formData.parentQRDetailId && formData.seatId) {

          // Check if this is a new seat (seatId starts with 'new_')
          if (formData.isNewSeat || formData.seatId.toString().startsWith('new_')) {

            // For new seats, use the new POST endpoint to add seat to existing screen
            const response = await fetch(
              `${config.api.baseUrl}/single-qrcodes/${formData.parentDocId}/details/${formData.parentQRDetailId}/seats`,
              {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  seat: formData.seatNumber,
                  isActive: formData.isActive
                  // QR code will be auto-generated by backend
                })
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to create new seat');
            }

            const result = await response.json();

            // Reload theater data to reflect the new seat
            await loadTheaterData();
            closeCrudModal();
            showSuccess(`Seat ${formData.seatNumber} added successfully!`);
            
          } else {
            // Update existing seat
            const response = await fetch(
              `${config.api.baseUrl}/single-qrcodes/${formData.parentDocId}/details/${formData.parentQRDetailId}/seats/${formData.seatId}`,
              {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  seat: formData.seatNumber,
                  isActive: formData.isActive,
                  qrCodeUrl: formData.qrImageUrl // Include QR code URL update
                })
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || 'Failed to update seat');
            }

            const result = await response.json();

            showSuccess(`Seat ${formData.seatNumber} updated successfully`);
          }
          
        } else {
          // Regular QR detail update
          if (!formData.parentDocId) {
            // Removed error modal - errors logged to console only
            setActionLoading(prev => ({ ...prev, [formData._id]: false }));
            return;
          }

          // Prepare update payload with all fields needed for QR regeneration
          const updatePayload = {
            qrName: formData.name,           // QR code name
            seatClass: formData.seatClass,   // Seat class (e.g., 'screen-1')
            seat: formData.seat || null,     // Seat number (for screen QR codes)
            logoUrl: formData.logoUrl,       // Logo overlay URL
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
            // Reload theater data to get updated QR codes
            await loadTheaterData();
            showSuccess('QR code updated successfully');
            closeCrudModal();
          } else {
            // Removed error modal - errors logged to console only
          }
        }
        
        // Reload data after any successful update
        await loadTheaterData();
        closeCrudModal();
      } else {
        // Create new QR code using generate endpoint
        let payload;
        
        if (formData.qrType === 'screen' && formData.screenName && formData.seatNumber) {
          // For screen QR codes, use selectedSeats array format expected by backend
          payload = {
            theaterId: theaterId,
            qrType: 'screen',
            name: formData.screenName, // Use screen name as the QR name
            selectedSeats: [formData.seatNumber], // Array of seat numbers
            logoType: 'theater'
          };
        } else {
          // For single QR codes
          payload = {
            theaterId: theaterId,
            qrType: 'single',
            name: formData.name,
            logoType: 'theater'
          };
        }
        

        const response = await fetch(`${config.api.baseUrl}/qrcodes/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Reload theater data to get the new QR code
          loadTheaterData();
          showSuccess('QR code created successfully');
          closeCrudModal();
        } else {
          // Removed error modal - errors logged to console only
        }
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    } finally {
      setActionLoading(prev => ({ ...prev, [formData._id || 'new']: false }));
    }
  }, [crudModal.mode, showSuccess, loadTheaterData, closeCrudModal, theaterId]);

  const viewQRCode = (qrCode) => {
    const details = [
      `Name: ${qrCode.name}`,
      `Theater: ${theater?.name}`,
      `Type: ${qrCode.qrType === 'canteen' ? 'Canteen' : 'Screen'}`,
      ...(qrCode.qrType === 'screen' ? [
        `Screen: ${qrCode.screenName}`,
        `Seat: ${qrCode.seatNumber}`
      ] : []),
      `Location: ${qrCode.location || 'Not specified'}`,
      `Status: ${qrCode.isActive ? 'Active' : 'Inactive'}`,
      `Orders: ${qrCode.orderCount || 0}`,
      `Revenue: ?${qrCode.totalRevenue || 0}`
    ].join('\n');

    alert({
      title: 'QR Code Details',
      message: details,
      type: 'info'
    });
  };

  const downloadQRCode = async (qrCode) => {

    try {
      if (!qrCode._id) {

        return;
      }
      
      // Check if this is a screen QR with seats
      if (qrCode.qrType === 'screen' && qrCode.seats && qrCode.seats.length > 0) {
        const seatsWithQR = qrCode.seats.filter(s => s.qrCodeUrl);
        
        if (seatsWithQR.length === 0) {
          showError('No QR codes available to download');
          return;
        }
        

        try {
          const zip = new JSZip();
          const folderName = `${qrCode.seatClass || qrCode.name}_QR_Codes`;
          const folder = zip.folder(folderName);
          
          // Fetch all seat QR code images
          const fetchPromises = seatsWithQR.map(async (seat) => {
            try {
              const response = await fetch(seat.qrCodeUrl);
              const blob = await response.blob();
              const filename = `${seat.seat}_QR.png`;
              folder.file(filename, blob);
  } catch (error) {
  }
          });
          
          await Promise.all(fetchPromises);
          
          // Generate ZIP file

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          
          // Download ZIP
          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          link.download = `${folderName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          

          showSuccess(`Downloaded ${seatsWithQR.length} QR codes as ZIP file!`);
        } catch (error) {

          showError('Failed to create ZIP file. Please try again.');
        }
        return;
      }
      
      // Single QR code download (original logic)

      // Create clean filename
      const filename = `${qrCode.name.replace(/[^a-zA-Z0-9\s]/g, '_').replace(/\s+/g, '_')}_QR.png`;

      // Use backend proxy to download (handles CORS)

      const downloadUrl = `${config.api.baseUrl}/single-qrcodes/${qrCode._id}/download`;

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download QR code: ${response.status}`);
      }
      
      const blob = await response.blob();

      // Create download link
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up blob URL
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
      

      showSuccess('QR code downloaded successfully!');
      
    } catch (error) {

      // Removed error modal - errors logged to console only
    }
  };
  const toggleQRStatus = async (qrCodeId, currentStatus) => {
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      
      // Find the QR code to get its parentDocId
      let qrToUpdate = null;
      let parentDocId = null;
      
      Object.keys(qrCodesByName).forEach(name => {
        const qr = qrCodesByName[name].find(q => q._id === qrCodeId);
        if (qr) {
          qrToUpdate = qr;
          parentDocId = qr.parentDocId;
        }
      });
      
      if (!parentDocId) {
        // Removed error modal - errors logged to console only
        return;
      }
      
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${parentDocId}/details/${qrCodeId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !currentStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reload theater data to get updated QR codes
        await loadTheaterData();
        showSuccess(`QR code ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      } else {
        // Removed error modal - errors logged to console only
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
    }
  };

  const deleteSeat = async (seatId, seatName) => {
    // Get the parent document ID and detail ID from the current crud modal data
    const parentDocId = crudModal.qrCode?.parentDocId;
    const parentQRDetailId = crudModal.qrCode?.parentQRDetailId;
    
    if (!parentDocId || !parentQRDetailId || !seatId) {
      showError('Missing required information to delete seat');
      return;
    }

    // Use browser confirm dialog
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

      showError(error.message || 'Failed to delete seat');
    } finally {
      setActionLoading(prev => ({ ...prev, [seatId]: false }));
    }
  };

  const deleteQRCode = async (qrCodeId, qrCodeName) => {
    // Find the QR code to delete and set it in modal
    let qrToDelete = null;
    Object.keys(qrCodesByName).forEach(name => {
      const qr = qrCodesByName[name].find(q => q._id === qrCodeId);
      if (qr) {
        qrToDelete = qr;
      }
    });
    
    if (qrToDelete) {
      setDeleteModal({ show: true, qrCode: qrToDelete });
    }
  };

  // Handle actual deletion after confirmation
  const handleDeleteConfirmed = async () => {
    const qrCodeId = deleteModal.qrCode?._id;
    const parentDocId = deleteModal.qrCode?.parentDocId;
    
    if (!qrCodeId || !parentDocId) {
      setDeleteModal({ show: false, qrCode: null });
      return;
    }
    
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${parentDocId}/details/${qrCodeId}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close modal first
        setDeleteModal({ show: false, qrCode: null });
        // Reload theater data to get updated list
        await loadTheaterData();
        showSuccess('QR code deleted successfully');
      } else {
        // Removed error modal - errors logged to console only
        setDeleteModal({ show: false, qrCode: null });
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
      setDeleteModal({ show: false, qrCode: null });
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
    }
  };

  // Cleanup effect for aborting requests (matching QRManagement)
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (loading) {
    return (
      <ErrorBoundary>
        <AdminLayout 
          pageTitle="Loading Theater QR Details..." 
          currentPage="qr-list"
        >
          <div className="theater-list-page qr-management-page">
            <div className="page-header-section">
              <div className="header-content">
                <h1 className="page-title">Loading QR Codes...</h1>
              </div>
            </div>
            <div className="qr-stats">
              <div className="stat-card">
                <div className="stat-number">...</div>
                <div className="stat-label">Total QR Codes</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">...</div>
                <div className="stat-label">Active QR Codes</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">...</div>
                <div className="stat-label">Inactive QR Codes</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">...</div>
                <div className="stat-label">QR Name Categories</div>
              </div>
            </div>
            <div className="theater-list-section">
              <div className="theater-table-container">
                <table className="theater-table">
                  <thead>
                    <tr>
                      <th className="sno-cell">S.No</th>
                      <th className="name-cell">QR Code Name</th>
                      <th className="description-cell">Type</th>
                      <th className="status-cell">Status</th>
                      <th className="actions-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colSpan="5" className="loading-cell">
                        <div className="loading-spinner"></div>
                        <span>Loading QR codes...</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </AdminLayout>
      </ErrorBoundary>
    );
  }

  if (!theater) {
    return (
      <ErrorBoundary>
        <AdminLayout 
          pageTitle="Theater Not Found" 
          currentPage="qr-list"
        >
          <div className="theater-list-page qr-management-page">
            <div className="page-header-section">
              <div className="header-content">
                <h1 className="page-title">Theater Not Found</h1>
              </div>
            </div>
            <div className="theater-list-section">
              <div className="theater-table-container">
                <div className="error-container" style={{padding: '60px 20px', textAlign: 'center'}}>
                  <i className="fas fa-exclamation-circle fa-3x" style={{color: 'var(--primary-color)', marginBottom: '20px'}}></i>
                  <h2>Theater not found</h2>
                  <p>The requested theater could not be found.</p>
                  <button 
                    className="add-theater-btn" 
                    onClick={() => navigate('/qr-management')}
                    style={{marginTop: '20px'}}
                  >
                    Return to QR Management
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AdminLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AdminLayout 
        pageTitle={theater ? `QR Codes - ${theater.name}` : "Theater QR Management"} 
        currentPage="qr-list"
      >
        <div className="theater-user-details-page">
          <PageContainer
            hasHeader={false}
            className="theater-user-management-vertical"
          >
            {/* Global Vertical Header Component */}
            <VerticalPageHeader
              title={theater?.name ? `${theater.name} - QR Code Management` : 'QR Code Management'}
              backButtonText="Back to QR Management"
              backButtonPath="/qr-management"
              actionButton={
                <button 
                  className="header-btn"
                  onClick={() => navigate(`/qr-generate?theaterId=${theaterId}`)}
                >
                  <span className="btn-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                  </span>
                  Generate QR Codes
                </button>
              }
            />
            <div className="theater-user-settings-container">
              {/* Settings Tabs - EXACTLY like Theater Users page */}
              <div className="theater-user-settings-tabs" key={`tabs-${forceRender}`}>
                {qrNames.length > 0 && qrNames.map((qrName) => (
                  <button
                    key={qrName.qrName}
                    className={`theater-user-settings-tab ${activeCategory === qrName.qrName ? 'active' : ''}`}
                    onClick={() => {
                      setActiveCategory(qrName.qrName);
                      setCurrentPage(1);
                    }}
                  >
                    <span className="theater-user-tab-icon">
                      <i className="fas fa-qrcode"></i>
                    </span>
                    {qrName.qrName}
                    <span className="badge" style={{
                      marginLeft: 'auto',
                      background: activeCategory === qrName.qrName ? 'rgba(255, 255, 255, 0.3)' : 'var(--background-light)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.8rem',
                      fontWeight: '700'
                    }}>
                      {qrNameCounts[qrName.qrName] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Settings Content - EXACTLY like Theater Users page */}
              <div className="theater-user-settings-content">
                {activeCategory ? (
                  <div className="theater-user-settings-section">
                   

             

                    {/* QR Codes Table */}
                    {loading ? (
                      <div className="theater-user-empty-state">
                        <div className="theater-user-empty-state-icon">⏳</div>
                        <h4>Loading QR codes...</h4>
                        <p>Please wait while we fetch the QR code data.</p>
                      </div>
                    ) : currentQRs.length === 0 ? (
                      <div className="theater-user-empty-state">
                        <div className="theater-user-empty-state-icon">
                          <i className="fas fa-qrcode fa-3x"></i>
                        </div>
                        <h4>No QR codes found</h4>
                        {debouncedSearchTerm ? (
                          <>
                            <p>No QR codes match your search.</p>
                            <button className="add-theater-btn" onClick={() => setSearchTerm('')}>
                              Clear Search
                            </button>
                          </>
                        ) : (
                          <>
                            <p>Get started by generating your first QR code.</p>
                            <button 
                              className="add-theater-btn" 
                              onClick={() => navigate(`/qr-generate?theaterId=${theaterId}`)}
                            >
                              Generate First QR Code
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="theater-table-container">
                          <table className="theater-table">
                            <thead>
                              <tr>
                                <th className="sno-col">S NO</th>
                                <th className="name-col">QR CODE NAME</th>
                                <th className="description-col">TYPE</th>
                                <th className="status-col">STATUS</th>
                                <th className="actions-col">ACTIONS</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentQRs.map((qrCode, index) => (
                                <tr key={qrCode._id} className="theater-row">
                                  <td className="sno-cell">
                                    <div className="sno-number">{(currentPage - 1) * itemsPerPage + index + 1}</div>
                                  </td>
                                  <td className="name-cell">
                                    <div className="role-name-wrapper">
                                      <strong>{qrCode.name}</strong>
                                      {qrCode.qrType === 'screen' }
                                    </div>
                                  </td>
                                  <td className="description-cell">
                                    {qrCode.qrType === 'screen' ? (
                                      <span>
                                        <i className="fas fa-film"></i> Screen QR
                                        {qrCode.screenName && ` - ${qrCode.screenName}`}
                                      </span>
                                    ) : (
                                      <span>
                                        <i className="fas fa-qrcode"></i> Single QR
                                      </span>
                                    )}
                                  </td>
                                  <td className="status-cell">
                                    <span className={`status-badge ${qrCode.isActive ? 'active' : 'inactive'}`}>
                                      {qrCode.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="actions-cell">
                                    <ActionButtons>
                                      <ActionButton
                                        type="view"
                                        onClick={() => openCrudModal(qrCode)}
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
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {!loading && (
                          <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            itemType="QR codes"
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="theater-user-empty-state">
                    <div className="theater-user-empty-state-icon">
                      <i className="fas fa-qrcode fa-3x"></i>
                    </div>
                    <h4>Select a QR Category</h4>
                    <p>Choose a category from the left sidebar to view QR codes.</p>
                  </div>
                )}
              </div>
            </div>
          </PageContainer>
        </div>

        {/* CRUD Modal */}
        {crudModal.isOpen && (
          <CrudModal
            isOpen={crudModal.isOpen}
            qrCode={crudModal.qrCode}
            mode={crudModal.mode}
            theater={theater}
            onClose={closeCrudModal}
            onSave={handleCrudSave}
            onDelete={crudModal.qrCode?.isSeatRow ? deleteSeat : deleteQRCode}
            onModeChange={(mode, newQrCode) => {
              if (newQrCode) {
                // Update both mode and QR code data (for navigating back to parent)
                setCrudModal(prev => ({ ...prev, mode, qrCode: newQrCode }));
              } else {
                // Just update the mode
                setCrudModal(prev => ({ ...prev, mode }));
              }
            }}
            actionLoading={actionLoading}
            displayImageUrl={displayImageUrl}
            onToggleStatus={toggleQRStatus}
            qrNames={qrNames}
            existingQRNames={Object.keys(qrCodesByName)}
            onSeatEdit={(seatData) => {
              // Close current modal and open seat edit modal
              closeCrudModal();
              setTimeout(() => {
                setCrudModal({
                  isOpen: true,
                  qrCode: seatData,
                  mode: 'edit'
                });
              }, 100);
            }}
          />
        )}

        {/* Delete Confirmation Modal - GLOBAL DESIGN from Theater Management */}
        {deleteModal.show && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Confirm Deletion</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete <strong>{deleteModal.qrCode?.name}</strong>?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setDeleteModal({ show: false, qrCode: null })}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteConfirmed}
                  className="confirm-delete-btn"
                  disabled={actionLoading[deleteModal.qrCode?._id]}
                >
                  {actionLoading[deleteModal.qrCode?._id] ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ErrorBoundary>
  );
};

export default TheaterQRDetail;

