import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
    'Accept': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  };
};

// Direct QR Image Component - No Caching
const DirectQRImage = React.memo(({ src, alt, className, style }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  // Handle different types of image sources
  const imageSrc = (() => {
    if (!src) return '/placeholder-qr.png';
    
    // If it's a data URL (base64), don't add timestamp as it would break the URL
    if (src.startsWith('data:')) {
      return src;
    }
    
    // For regular URLs, add timestamp to bypass caching
    return `${src}${src.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  })();

  // If there's an error, show a proper fallback instead of the broken image
  if (hasError) {
    return (
      <div style={{
        ...style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        border: '2px dashed #d1d5db',
        borderRadius: '8px',
        color: '#6b7280',
        fontSize: '14px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <div style={{ marginBottom: '8px' }}>⚠️</div>
          <div>QR Code image failed to load</div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            {src && src.startsWith('data:') ? 'Base64 data URL provided' : 
             src ? `URL: ${src.substring(0, 50)}...` : 'No URL provided'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', ...style }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '12px',
          color: '#666',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          Loading QR Code...
        </div>
      )}
      <img
        src={imageSrc}
        alt="" // Remove alt text to prevent showing "QR Code for A2" when image fails
        className={className}
        style={{
          ...style,
          opacity: isLoading ? 0.3 : 1,
          transition: 'opacity 0.3s ease',
          display: hasError ? 'none' : 'block'
        }}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
    </div>
  );
});

DirectQRImage.displayName = 'DirectQRImage';

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
          <form className="edit-form" onSubmit={handleSubmit}>
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

              {/* QR Code Preview - Only for single QR or individual seat rows */}
              {(() => {
                const shouldShowQRPreview = (formData.qrType === 'single' || formData.isSeatRow) && !formData.seats;

                return shouldShowQRPreview;
              }              )() && (
                <div className="form-group full-width">
                  <label>QR Code Preview</label>
                  <div className="qr-preview">
                  {displayImageUrl ? (
                    <div className="qr-image-container">
                      <DirectQRImage 
                        src={displayImageUrl} 
                        alt="QR Code Preview"
                        className="qr-preview-img"
                      />
                      <div className="qr-preview-error" style={{ display: 'none' }}>
                        <div className="qr-error-content">
                          <span>???</span>
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
                      <span>??</span>
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
                <div className="form-group full-width">
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
                          <DirectQRImage 
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
                <div className="form-group full-width" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <label style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', display: 'block' }}>
                    Seat Layout ({formData.seats.length} seats)
                  </label>
                  <div style={{
                    padding: '20px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    overflow: 'visible'
                  }}>
                    {/* Purple Screen Header with Add Seat and Download All buttons */}
                    <div style={{
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      fontSize: '14px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      boxSizing: 'border-box',
                      position: 'relative',
                      minWidth: 0
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        flex: '0 1 auto',
                        minWidth: 0,
                        overflow: 'hidden',
                        maxWidth: 'calc(100% - 250px)' // Reserve space for buttons
                      }}>
                        <span style={{ flexShrink: 0 }}>🎬</span>
                        <span style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          display: 'block'
                        }}>
                          SCREEN - {formData.seatClass || formData.name}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        gap: '8px',
                        flex: '0 0 auto',
                        flexShrink: 0,
                        alignItems: 'center',
                        marginLeft: 'auto'
                      }}>
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
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              minWidth: 'fit-content'
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
                            <span>➕</span>
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
                              padding: '8px 14px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              minWidth: 'fit-content'
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
                            <span>📦</span>
                            <span>Download All ({formData.seats.filter(s => s.qrCodeUrl).length})</span>
                          </button>
                        )}
                      </div>
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
                                      }} />
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
          </form>
        </div>

        {/* Modal Footer - Complete CRUD Actions */}
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

const TheaterQRManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError, showSuccess } = useModal();
  
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
  const [isDeleting, setIsDeleting] = useState(false);
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

      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load QR Names (like admin page tabs)
  const loadQRNames = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      setQrNamesLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      

      const response = await fetch(`${config.api.baseUrl}/qrcodenames?theaterId=${theaterId}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR names');
      }
      
      const data = await response.json();
      

      if (data.success && data.data && data.data.qrCodeNames) {
        const names = data.data.qrCodeNames;

        setQrNames(names);
        if (names.length > 0 && !activeCategory) {
          const firstCategory = names[0].qrName;

          setActiveCategory(firstCategory);
        }
      } else {

        setQrNames([]);
      }
    } catch (error) {

      console.error('Failed to load QR names:', error);
    } finally {
      setQrNamesLoading(false);
    }
  }, [theaterId]); // Removed 'showError' dependency

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
        'Accept': 'application/json'
      };
      
      if (!theater) {
        const theaterResponse = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, { signal, headers });
        const theaterData = await theaterResponse.json();
        if (theaterData.success) {
          setTheater(theaterData.theater);
        }
      }
      
      const singleUrl = `${config.api.baseUrl}/single-qrcodes/theater/${theaterId}?_t=${Date.now()}`;
      const singleResponse = await fetch(singleUrl, { signal, headers });
      
      console.log('🔍 Single QR Response Status:', singleResponse.status, singleResponse.ok);
      
      const singleData = singleResponse.ok ? await singleResponse.json().catch(() => ({ success: false })) : { success: false };
      
      console.log('🔍 Single QR Data:', {
        success: singleData.success,
        hasData: !!singleData.data,
        qrCodesCount: singleData.data?.qrCodes?.length || 0,
        qrCodes: singleData.data?.qrCodes
      });
      
      const qrsByName = {};
      
      if (singleData.success) {
        (singleData.data?.qrCodes || []).forEach(qr => {
          if (!qrsByName[qr.name]) {
            qrsByName[qr.name] = [];
          }
          qrsByName[qr.name].push({ ...qr });
        });
      }
      
      console.log('🔍 QRs by Name:', qrsByName);
      console.log('🔍 QR Name Keys:', Object.keys(qrsByName));
      
      setQrCodesByName(qrsByName);
      
      // Also set qrCodes for backward compatibility
      const allQRs = Object.values(qrsByName).flat();
      console.log('🔍 All QRs Array:', allQRs, 'Length:', allQRs.length);
      setQrCodes(allQRs);
      
      // Calculate counts
      const counts = {};
      Object.keys(qrsByName).forEach(name => {
        counts[name] = qrsByName[name].length;
      });
      setQrNameCounts(counts);
      
      // Auto-switch active category if current one is empty
      setActiveCategory(prevCategory => {
        // If no previous category or previous category no longer exists
        if (!prevCategory || !qrsByName[prevCategory] || qrsByName[prevCategory].length === 0) {
          // Switch to first available category
          const availableCategories = Object.keys(qrsByName).filter(name => qrsByName[name].length > 0);
          const newCategory = availableCategories.length > 0 ? availableCategories[0] : null;
          console.log('🔄 Auto-switching category from', prevCategory, 'to', newCategory);
          return newCategory;
        }
        return prevCategory;
      });
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Failed to load theater data:', error);
    } finally {
      setLoading(false);
    }
  }, [theaterId]); // Removed 'theater' and 'showError' to prevent circular dependency

  // Load QR codes
  const loadQRCodes = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      setLoading(true);
      
      // 🚀 CRITICAL: Clear existing data before fetch to prevent stale data
      setQrCodes([]);
      setQrCodesByName({});
      setQrNameCounts({});
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      

      // Use same endpoint as admin page with cache-busting timestamp
      const timestamp = Date.now();
      console.log('🔗 Fetching QR codes from:', `${config.api.baseUrl}/single-qrcodes/theater/${theaterId}?_t=${timestamp}`);
      
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/theater/${theaterId}?_t=${timestamp}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('📥 QR Response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR codes');
      }
      
      const data = await response.json();
      console.log('📦 QR Response data:', data);

      if (data.success && data.data && data.data.qrCodes) {
        const qrCodesData = data.data.qrCodes;
        console.log('✅ QR Codes count:', qrCodesData.length);

        setQrCodes(qrCodesData);
        
        // Calculate counts per QR name
        const counts = {};
        qrCodesData.forEach(qr => {
          const name = qr.name || 'Unnamed';
          counts[name] = (counts[name] || 0) + 1;
        });

        console.log('📊 QR Name counts:', counts);
        setQrNameCounts(counts);
      } else {
        console.warn('⚠️ No QR codes found or invalid response');
        setQrCodes([]);
        setQrNameCounts({});
      }
    } catch (error) {
      if (error.name === 'AbortError') {

        return;
      }

      showError('Failed to load QR codes');
    } finally {
      setLoading(false);
    }
  }, [theaterId, showError]);

  useEffect(() => {
    console.log('🔄 Theater ID changed or component mounted:', theaterId);
    loadQRNames();
    loadTheaterData(); // This now handles both theater and QR codes
    
    // Add event listener for page visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('📱 Page became visible, reloading data...');
        loadTheaterData();
      }
    };
    
    // Add event listener for window focus
    const handleFocus = () => {
      console.log('🔄 Window focused, reloading data...');
      loadTheaterData();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      setQrCodesByName({});
      setActiveCategory(null);
      setQrNames([]);
      setLoading(true);
    };
  }, [theaterId, loadQRNames, loadTheaterData]); // Add theaterId to dependencies

  // Reload data when navigating back from Generate QR page
  useEffect(() => {
    if (location.state?.reload) {
      console.log('🔄 Navigation detected from Generate page - reloading data');
      loadTheaterData();
      // Clear the state to prevent reload loops
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, loadTheaterData, navigate]);

  // Filter QR codes by active category (matching admin page pattern)
  const currentQRs = useMemo(() => {
    if (!activeCategory || !qrCodesByName[activeCategory]) {
      return [];
    }
    return qrCodesByName[activeCategory];
  }, [qrCodesByName, activeCategory]);

  // Modal handlers
  const openCrudModal = useCallback((qrCode, mode = 'view') => {

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

  // Handle Generate QR Codes navigation
  const handleGenerateQRCodes = useCallback(() => {
    navigate(`/theater-generate-qr/${theaterId}`);
  }, [navigate, theaterId]);

  // Handle CRUD Save (mirrored from admin page)
  const handleCrudSave = useCallback(async (formData) => {
    try {
      setActionLoading(prev => ({ ...prev, [formData._id || 'new']: true }));
      
      const isEditing = crudModal.mode === 'edit';
      const isCreating = crudModal.mode === 'create';
      
      if (isCreating) {
        // Handle QR Code Creation
        const createPayload = {
          theater: theaterId,
          qrType: formData.qrType || 'single',
          qrName: formData.name,
          seatClass: formData.seatClass,
          seat: formData.seat || null,
          logoUrl: formData.logoUrl,
          logoType: formData.logoType || 'default',
          isActive: formData.isActive !== false
        };

        const response = await fetch(`${config.api.baseUrl}/single-qrcodes`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(createPayload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create QR code');
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Immediately add to state
          if (data.qrCode) {
            setQrCodes(prevQrs => [...prevQrs, data.qrCode]);
            
            // Update counts immediately
            setQrNameCounts(prevCounts => ({
              ...prevCounts,
              [data.qrCode.name]: (prevCounts[data.qrCode.name] || 0) + 1
            }));
          }
          
          showSuccess('QR code created successfully');
          closeCrudModal();
          
          // Reload to ensure data is in sync
          await loadTheaterData();
        } else {
          throw new Error(data.message || 'Failed to create QR code');
        }
        
      } else if (isEditing) {
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
            // Immediately update state
            setQrCodes(prevQrs => 
              prevQrs.map(qr => 
                qr._id === formData._id 
                  ? { ...qr, ...updatePayload, name: updatePayload.qrName }
                  : qr
              )
            );
            
            showSuccess('QR code updated successfully');
            closeCrudModal();
            
            // Reload to ensure data is in sync
            await loadTheaterData();
          } else {
            throw new Error(data.message || 'Failed to update QR code');
          }
        }
        
        // Reload after any edit operation
        await loadTheaterData();
        closeCrudModal();
      }
    } catch (error) {

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

      showError('Failed to download QR code');
    }
  }, [showError, showSuccess]);

  // Toggle QR code status
  const toggleQRStatus = useCallback(async (qrCodeId, currentStatus) => {
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${qrCodeId}`, {
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
        // Immediately update state before reloading
        setQrCodes(prevQrs => {
          return prevQrs.map(qr => 
            qr._id === qrCodeId 
              ? { ...qr, isActive: !currentStatus }
              : qr
          );
        });
        
        showSuccess(`QR code ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        
        // Reload to ensure data is in sync
        await loadQRCodes();
      } else {
        throw new Error(data.message || 'Failed to update QR code status');
      }
    } catch (error) {

      showError(error.message || 'Failed to update QR code status');
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
    }
  }, [loadQRCodes, showError, showSuccess]);

  // Delete QR code
  const deleteQRCode = useCallback((qrCodeId, qrCodeName) => {

    // Find the full QR code object to get parentDocId
    let qrToDelete = null;
    const allQRs = qrCodes || [];
    qrToDelete = allQRs.find(q => q._id === qrCodeId);
    
    if (qrToDelete) {
      setDeleteModal({ show: true, qrCode: qrToDelete });
    } else {
      // Fallback if QR not found in list
      setDeleteModal({ show: true, qrCode: { _id: qrCodeId, name: qrCodeName } });
    }
  }, [qrCodes]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModal.qrCode || isDeleting) return;
    
    setIsDeleting(true);
    const qrCodeId = deleteModal.qrCode._id;
    const parentDocId = deleteModal.qrCode.parentDocId;
    
    console.log('🗑️ Starting delete process:', { qrCodeId, parentDocId });

    // Check if we have parentDocId (nested structure)
    if (!parentDocId) {
      console.log('⚠️ No parentDocId - using direct delete');

      // Fallback to direct delete if no parentDocId
      try {
        setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
        console.log('🔄 Action loading set for:', qrCodeId);
        
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        console.log('📡 Sending DELETE request to:', `${config.api.baseUrl}/single-qrcodes/${qrCodeId}?permanent=true`);
        const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${qrCodeId}?permanent=true`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('📥 Delete response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Delete failed:', errorData);
          
          // Handle specific case where QR detail is already deleted
          if (response.status === 404 && (errorData.error === 'QR detail not found' || errorData.message?.includes('QR detail not found'))) {
            console.log('⚠️ QR detail already deleted - updating UI state');
            // QR is already deleted, just update the UI state
            const deletedQrName = deleteModal.qrCode.name;
            
            // Remove from state
            setQrCodes(prevQrs => prevQrs.filter(qr => qr._id !== qrCodeId));
            setQrCodesByName(prevByName => {
              const updated = { ...prevByName };
              if (updated[deletedQrName]) {
                updated[deletedQrName] = updated[deletedQrName].filter(qr => qr._id !== qrCodeId);
                if (updated[deletedQrName].length === 0) {
                  delete updated[deletedQrName];
                  if (activeCategory === deletedQrName) {
                    const remainingCategories = Object.keys(updated);
                    setActiveCategory(remainingCategories.length > 0 ? remainingCategories[0] : null);
                  }
                }
              }
              return updated;
            });
            
            setDeleteModal({ show: false, qrCode: null });
            showSuccess('QR code was already deleted');
            setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
            setIsDeleting(false);
            return; // Exit early, don't throw error
          }
          
          throw new Error(errorData.message || errorData.error || 'Failed to delete QR code');
        }
        
        const data = await response.json();
        console.log('✅ Delete response data:', data);

        if (data.success) {
          console.log('🎉 Delete successful - updating state immediately');
          // Immediately remove from ALL state before reloading
          const deletedQrName = deleteModal.qrCode.name;
          console.log('📝 Deleted QR name:', deletedQrName);
          
          setQrCodes(prevQrs => {
            const updatedQrs = prevQrs.filter(qr => qr._id !== qrCodeId);
            console.log('🔄 Updated qrCodes count:', updatedQrs.length);
            
            // Update counts immediately
            const counts = {};
            updatedQrs.forEach(qr => {
              const name = qr.name || 'Unnamed';
              counts[name] = (counts[name] || 0) + 1;
            });
            console.log('📊 Updated counts:', counts);
            setQrNameCounts(counts);
            
            return updatedQrs;
          });
          
          // CRITICAL: Also update qrCodesByName immediately
          setQrCodesByName(prevByName => {
            const updated = { ...prevByName };
            if (updated[deletedQrName]) {
              updated[deletedQrName] = updated[deletedQrName].filter(qr => qr._id !== qrCodeId);
              console.log('🔄 Updated qrCodesByName for', deletedQrName, ':', updated[deletedQrName].length);
              // Remove category if empty
              if (updated[deletedQrName].length === 0) {
                console.log('⚠️ Category empty - removing:', deletedQrName);
                delete updated[deletedQrName];
                
                // Switch to another category if current one is empty
                if (activeCategory === deletedQrName) {
                  const remainingCategories = Object.keys(updated);
                  if (remainingCategories.length > 0) {
                    console.log('🔀 Switching to category:', remainingCategories[0]);
                    setActiveCategory(remainingCategories[0]);
                  } else {
                    console.log('⚠️ No categories left');
                    setActiveCategory(null);
                  }
                }
              }
            }
            return updated;
          });
          
          setDeleteModal({ show: false, qrCode: null });
          showSuccess('QR code deleted successfully');
          
          console.log('✅ Delete complete - NO RELOAD NEEDED (using immediate state)');
          // NO RELOAD - State is already updated immediately above
        } else {
          throw new Error(data.message || 'Failed to delete QR code');
        }
      } catch (error) {
        console.error('💥 Delete error:', error);

        showError(error.message || 'Failed to delete QR code');
      } finally {
        setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
        setIsDeleting(false);
      }
      return;
    }
    
    console.log('✅ Has parentDocId - using nested delete');
    // Use nested delete endpoint (matching TheaterQRDetail)
    try {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: true }));
      console.log('🔄 Action loading set for:', qrCodeId);
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      console.log('📡 Sending DELETE request to:', `${config.api.baseUrl}/single-qrcodes/${parentDocId}/details/${qrCodeId}?permanent=true`);

      const response = await fetch(`${config.api.baseUrl}/single-qrcodes/${parentDocId}/details/${qrCodeId}?permanent=true`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📥 Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Delete failed:', errorData);
        
        // Handle specific case where QR detail is already deleted
        if (response.status === 404 && (errorData.error === 'QR detail not found' || errorData.message?.includes('QR detail not found'))) {
          console.log('⚠️ QR detail already deleted - updating UI state');
          // QR is already deleted, just update the UI state
          const deletedQrName = deleteModal.qrCode.name;
          
          // Remove from state
          setQrCodes(prevQrs => prevQrs.filter(qr => qr._id !== qrCodeId));
          setQrCodesByName(prevByName => {
            const updated = { ...prevByName };
            if (updated[deletedQrName]) {
              updated[deletedQrName] = updated[deletedQrName].filter(qr => qr._id !== qrCodeId);
              if (updated[deletedQrName].length === 0) {
                delete updated[deletedQrName];
                if (activeCategory === deletedQrName) {
                  const remainingCategories = Object.keys(updated);
                  setActiveCategory(remainingCategories.length > 0 ? remainingCategories[0] : null);
                }
              }
            }
            return updated;
          });
          
          setDeleteModal({ show: false, qrCode: null });
          showSuccess('QR code was already deleted');
          setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
          setIsDeleting(false);
          return; // Exit early, don't throw error
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to delete QR code');
      }
      
      const data = await response.json();
      console.log('✅ Delete response data:', data);

      if (data.success) {
        console.log('🎉 Delete successful - updating state immediately');
        // Immediately remove from ALL state before reloading
        const deletedQrName = deleteModal.qrCode.name;
        console.log('📝 Deleted QR name:', deletedQrName);
        
        setQrCodes(prevQrs => {
          const updatedQrs = prevQrs.filter(qr => qr._id !== qrCodeId);
          console.log('🔄 Updated qrCodes count:', updatedQrs.length);
          
          // Update counts immediately
          const counts = {};
          updatedQrs.forEach(qr => {
            const name = qr.name || 'Unnamed';
            counts[name] = (counts[name] || 0) + 1;
          });
          console.log('📊 Updated counts:', counts);
          setQrNameCounts(counts);
          
          return updatedQrs;
        });
        
        // CRITICAL: Also update qrCodesByName immediately
        setQrCodesByName(prevByName => {
          const updated = { ...prevByName };
          if (updated[deletedQrName]) {
            updated[deletedQrName] = updated[deletedQrName].filter(qr => qr._id !== qrCodeId);
            console.log('🔄 Updated qrCodesByName for', deletedQrName, ':', updated[deletedQrName].length);
            // Remove category if empty
            if (updated[deletedQrName].length === 0) {
              console.log('⚠️ Category empty - removing:', deletedQrName);
              delete updated[deletedQrName];
              
              // Switch to another category if current one is empty
              if (activeCategory === deletedQrName) {
                const remainingCategories = Object.keys(updated);
                if (remainingCategories.length > 0) {
                  console.log('🔀 Switching to category:', remainingCategories[0]);
                  setActiveCategory(remainingCategories[0]);
                } else {
                  console.log('⚠️ No categories left');
                  setActiveCategory(null);
                }
              }
            }
          }
          return updated;
        });
        
        setDeleteModal({ show: false, qrCode: null });
        showSuccess('QR code deleted successfully');
        
        console.log('✅ Delete complete - NO RELOAD NEEDED (using immediate state)');
        // NO RELOAD - State is already updated immediately above
      } else {
        console.error('❌ Delete unsuccessful:', data);
        throw new Error(data.message || 'Failed to delete QR code');
      }
    } catch (error) {
      console.error('💥 Delete error:', error);
      showError(error.message || 'Failed to delete QR code');
    } finally {
      setActionLoading(prev => ({ ...prev, [qrCodeId]: false }));
      setIsDeleting(false);
    }
  }, [deleteModal.qrCode, loadTheaterData, showError, showSuccess, isDeleting]);

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
              title="QR CODE"
              showBackButton={false}
              actionButton={
                <button 
                  className="header-btn"
                  onClick={handleGenerateQRCodes}
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
                  
                  {/* QR Table - MATCHES SUPER ADMIN PAGE */}
                  <div className="table-container">
                    <div className="table-wrapper">
                      <table className="theater-table">
                        <thead>
                          <tr>
                            <th className="sno-col">S NO</th>
                            <th className="name-col">QR CODE NAME</th>
                            <th className="access-status-col">ACCESS STATUS</th>
                            <th className="status-col">STATUS</th>
                            <th className="actions-col">ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan="5" style={{textAlign: 'center', padding: '40px'}}>
                                Loading QR codes...
                              </td>
                            </tr>
                          ) : currentQRs.length === 0 ? (
                            <tr>
                              <td colSpan="5" style={{textAlign: 'center', padding: '40px'}}>
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
                                    onClick={handleGenerateQRCodes}
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

                                {/* Status Column */}
                                <td className="status-cell">
                                  <span className={`status-badge ${qrCode.isActive ? 'active' : 'inactive'}`}>
                                    {qrCode.isActive ? 'Active' : 'Inactive'}
                                  </span>
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

        {/* Delete Modal - Following Global Design System */}
        {deleteModal.show && (
          <div className="modal-overlay">
            <div className="delete-modal">
              <div className="modal-header">
                <h3>Delete Confirmation</h3>
              </div>
              <div className="modal-body">
                <p>Are you sure you want to delete the QR code <strong>{deleteModal.qrCode?.name}</strong>?</p>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setDeleteModal({ show: false, qrCode: null })}
                  className="cancel-btn"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="confirm-delete-btn"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </TheaterLayout>

      {/* ? COMPREHENSIVE TABLE STYLING - MATCHES SUPER ADMIN PAGE */}
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

          /* ============================================
             COMPREHENSIVE TABLE RESPONSIVE DESIGN
             ============================================ */
          
          /* Table base styling */
          .theater-user-settings-content .theater-table {
            width: 100%;
            min-width: 740px;
            border-collapse: collapse;
            font-size: 0.9rem;
            background: white;
            table-layout: auto !important;
            border: 1px solid #d1d5db;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          /* Table header styling */
          .theater-user-settings-content .theater-table thead {
            background: linear-gradient(135deg, #6B0E9B 0%, #8B2FB8 100%);
            box-shadow: 0 2px 4px rgba(107, 14, 155, 0.1);
            color: white;
            position: sticky;
            top: 0;
            z-index: 10;
          }

          .theater-user-settings-content .theater-table thead tr {
            border-bottom: 2px solid #5A0C82;
          }

          .theater-user-settings-content .theater-table th {
            padding: 18px 16px;
            text-align: center;
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border: none;
            position: relative;
            white-space: nowrap;
            color: white !important;
          }

          .theater-user-settings-content .theater-table th::after {
            content: '';
            position: absolute;
            right: 0;
            top: 25%;
            height: 50%;
            width: 1px;
            background: rgba(255, 255, 255, 0.2);
          }

          .theater-user-settings-content .theater-table th:last-child::after {
            display: none;
          }

          /* Table body styling */
          .theater-user-settings-content .theater-table tbody tr {
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
            transition: all 0.2s ease;
          }

          .theater-user-settings-content .theater-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }

          .theater-user-settings-content .theater-table tbody tr:hover {
            background: #f0f9ff !important;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transform: translateY(-1px);
          }

          .theater-user-settings-content .theater-table td {
            padding: 16px 12px;
            vertical-align: middle;
            border-right: 1px solid #f3f4f6;
          }

          .theater-user-settings-content .theater-table td:last-child {
            border-right: none;
          }

          /* Column Widths - 5 COLUMNS ONLY */
          .theater-user-settings-content .theater-table .sno-col { 
            width: 80px; 
            min-width: 70px;
            text-align: center;
          }
          
          .theater-user-settings-content .theater-table .name-col { 
            width: 200px; 
            min-width: 180px;
          }
          
          .theater-user-settings-content .theater-table .access-status-col { 
            width: 150px; 
            min-width: 130px;
            text-align: center;
          }
          
          .theater-user-settings-content .theater-table .status-col { 
            width: 130px; 
            min-width: 120px;
            text-align: center;
          }
          
          .theater-user-settings-content .theater-table .actions-col { 
            width: 180px; 
            min-width: 160px;
            text-align: center;
          }

          /* S.No cell styling */
          .theater-user-settings-content .theater-table .sno-cell {
            text-align: center;
          }

          .theater-user-settings-content .theater-table .sno-number {
            display: inline-block;
            width: 32px;
            height: 32px;
            line-height: 32px;
            background: #f3f4f6;
            border-radius: 50%;
            font-size: 0.875rem;
            font-weight: 600;
            color: #6b7280;
          }

          /* Name cell styling */
          .theater-user-settings-content .theater-table .theater-name-cell {
            font-weight: 600;
            color: #111827;
            text-align: left;
            padding-left: 20px;
          }

          .theater-user-settings-content .theater-table .theater-name-full {
            font-weight: 600;
            color: #111827;
          }

          /* Access Status cell styling */
          .theater-user-settings-content .theater-table .access-status-cell {
            text-align: center;
          }

          /* Status cell styling */
          .theater-user-settings-content .theater-table .status-cell {
            text-align: center;
          }

          /* Actions cell styling */
          .theater-user-settings-content .theater-table .actions-cell {
            text-align: center;
          }

          /* Enhanced action buttons styling */
          .theater-user-settings-content .action-buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
            align-items: center;
            flex-wrap: nowrap;
          }

          /* Status badge styling */
          .theater-user-settings-content .status-badge {
            padding: 6px 16px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-block;
          }

          .theater-user-settings-content .status-badge.active {
            background: #d1fae5;
            color: #065f46;
          }

          .theater-user-settings-content .status-badge.inactive {
            background: #fee2e2;
            color: #991b1b;
          }

          /* Toggle wrapper styling */
          .theater-user-settings-content .toggle-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
          }

          /* Responsive table container */
          .theater-user-settings-content .table-container {
            width: 100%;
            overflow-x: auto;
            margin-top: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .theater-user-settings-content .table-wrapper {
            min-width: 100%;
            display: inline-block;
          }

          /* Empty state styling */
          .theater-user-settings-content .empty-state {
            text-align: center;
            padding: 60px 20px;
          }

          .theater-user-settings-content .empty-state .empty-icon {
            margin-bottom: 20px;
          }

          .theater-user-settings-content .empty-state h3 {
            font-size: 1.25rem;
            font-weight: 600;
            color: #111827;
            margin-bottom: 8px;
          }

          .theater-user-settings-content .empty-state p {
            color: #6b7280;
            margin-bottom: 24px;
          }

          /* Mobile responsive adjustments */
          @media (max-width: 768px) {
            .theater-user-settings-content .theater-table {
              min-width: 600px;
            }

            .theater-user-settings-content .theater-table th {
              padding: 12px 8px;
              font-size: 0.75rem;
            }

            .theater-user-settings-content .theater-table td {
              padding: 12px 8px;
            }
          }
        `
      }} />
    </ErrorBoundary>
  );
};

export default TheaterQRManagement;
