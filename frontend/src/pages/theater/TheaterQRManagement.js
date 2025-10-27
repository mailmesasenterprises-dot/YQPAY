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
import config from '../../config';
import '../../styles/TheaterUserDetails.css';
import '../../styles/TheaterList.css';
import '../../styles/QRManagementPage.css';

const TheaterQRManagement = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError, showSuccess, confirm } = useModal();
  
  // PERFORMANCE MONITORING
  usePerformanceMonitoring('TheaterQRManagement');
  
  // Data state
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrNames, setQrNames] = useState([]);
  const [qrNamesLoading, setQrNamesLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [qrNameCounts, setQrNameCounts] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [crudModal, setCrudModal] = useState({
    isOpen: false,
    qrCode: null,
    mode: 'view' // 'view', 'edit', 'delete'
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
    loadQRCodes();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadQRNames, loadQRCodes]);

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
  }, []);

  const closeCrudModal = useCallback(() => {
    setCrudModal({
      isOpen: false,
      qrCode: null,
      mode: 'view'
    });
  }, []);

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

        {/* CRUD Modal - Matching Admin Design */}
        {crudModal.isOpen && crudModal.qrCode && (
          <div className="modal-overlay" onClick={closeCrudModal}>
            <div className="modal-content theater-edit-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-nav-left"></div>
                
                <div className="modal-title-section">
                  <h2>View QR Code</h2>
                </div>
                
                <div className="modal-nav-right">
                  <button className="close-btn" onClick={closeCrudModal}>
                    <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="modal-body">
                <div className="edit-form">
                  {console.log('🔄 View Modal Rendered - Active Toggle Version:', crudModal.qrCode.isActive)}
                  {/* QR Code Name */}
                  <div className="form-group">
                    <label>QR Code Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={crudModal.qrCode.name || ''}
                      disabled
                      placeholder="Enter QR code name"
                    />
                  </div>

                  {/* QR Type */}
                  <div className="form-group">
                    <label>QR Type</label>
                    <select
                      className="form-control"
                      value={crudModal.qrCode.qrType || 'single'}
                      disabled
                    >
                      <option value="single">Single QR</option>
                      <option value="screen">Screen QR</option>
                    </select>
                  </div>

                  {/* Screen Name - Only for screen type QR */}
                  {crudModal.qrCode.qrType === 'screen' && (
                    <div className="form-group">
                      <label>Screen Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={crudModal.qrCode.screenName || crudModal.qrCode.seatClass || ''}
                        disabled
                        placeholder="Enter screen name"
                      />
                    </div>
                  )}

                  {/* Seat Number - Only for individual screen seats */}
                  {crudModal.qrCode.qrType === 'screen' && crudModal.qrCode.seatNumber && (
                    <div className="form-group">
                      <label>Seat Number</label>
                      <input
                        type="text"
                        className="form-control"
                        value={crudModal.qrCode.seatNumber || ''}
                        disabled
                        placeholder="Enter seat number"
                      />
                    </div>
                  )}

                  {/* Location */}
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      className="form-control"
                      value={crudModal.qrCode.location || ''}
                      disabled
                      placeholder="e.g., Entrance, Lobby, Screen 1"
                    />
                  </div>

                  {/* Active Checkbox - Clickable */}
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={crudModal.qrCode.isActive || false}
                        onChange={() => {
                          toggleQRStatus(crudModal.qrCode._id, crudModal.qrCode.isActive);
                          // Update modal state optimistically
                          setCrudModal(prev => ({
                            ...prev,
                            qrCode: {
                              ...prev.qrCode,
                              isActive: !prev.qrCode.isActive
                            }
                          }));
                        }}
                        disabled={actionLoading[crudModal.qrCode._id]}
                        style={{
                          marginRight: '8px',
                          width: '18px',
                          height: '18px',
                          cursor: actionLoading[crudModal.qrCode._id] ? 'not-allowed' : 'pointer'
                        }}
                      />
                      Active
                    </label>
                  </div>

                  {/* Visual Seat Grid for Screen QR with multiple seats (parent screen record) */}
                  {crudModal.qrCode.qrType === 'screen' && !crudModal.qrCode.isSeatRow && crudModal.qrCode.seats && crudModal.qrCode.seats.length > 0 && (
                    <div className="form-group">
                      <label style={{ fontSize: '16px', fontWeight: '600', marginBottom: '15px', display: 'block' }}>
                        Seat Layout ({crudModal.qrCode.seats.length} seats)
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
                            <span>🎬</span>
                            <span>SCREEN - {crudModal.qrCode.seatClass || crudModal.qrCode.name}</span>
                          </div>
                          
                          {/* Download All Button */}
                          <button
                            type="button"
                            onClick={() => {
                              // Download all QR codes for this screen
                              console.log('Download all QRs for screen:', crudModal.qrCode.name);
                              crudModal.qrCode.seats.forEach((seat, index) => {
                                if (seat.qrCodeUrl) {
                                  setTimeout(() => {
                                    const link = document.createElement('a');
                                    link.href = seat.qrCodeUrl;
                                    link.download = `${crudModal.qrCode.seatClass || crudModal.qrCode.name}_Seat_${seat.seat}_QR.png`;
                                    link.target = '_blank';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }, index * 300); // Stagger downloads to avoid browser blocking
                                }
                              });
                            }}
                            style={{
                              backgroundColor: 'white',
                              color: '#8b5cf6',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '16px', height: '16px'}}>
                              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                            Download All ({crudModal.qrCode.seats.filter(s => s.qrCodeUrl).length})
                          </button>
                        </div>

                        {/* Seat Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(auto-fill, minmax(50px, 1fr))`,
                          gap: '8px'
                        }}>
                          {crudModal.qrCode.seats.map((seat, index) => (
                            <div
                              key={seat._id || index}
                              style={{
                                backgroundColor: seat.isActive ? '#8b5cf6' : '#d1d5db',
                                color: 'white',
                                padding: '10px 6px',
                                borderRadius: '6px',
                                textAlign: 'center',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: seat.qrCodeUrl ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                                position: 'relative',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                              onClick={() => {
                                if (seat.qrCodeUrl) {
                                  window.open(seat.qrCodeUrl, '_blank');
                                }
                              }}
                              title={seat.qrCodeUrl ? `Click to view QR for ${seat.seat}` : `Seat ${seat.seat}`}
                            >
                              {seat.seat || index + 1}
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
                            <span>Active Seat</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
                            <span>QR Available (click to view)</span>
                          </div>
                        </div>

                        {/* Summary */}
                        <div style={{
                          marginTop: '15px',
                          padding: '12px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: '#374151'
                        }}>
                          <strong>Summary:</strong> {crudModal.qrCode.seats.filter(s => s.isActive).length} active seats, 
                          {' '}{crudModal.qrCode.seats.filter(s => s.qrCodeUrl).length} with QR codes
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    // Edit functionality - theater users might not have edit permission
                    console.log('Edit clicked for:', crudModal.qrCode.name);
                  }}
                >
                  EDIT
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    deleteQRCode(crudModal.qrCode._id, crudModal.qrCode.name);
                    closeCrudModal();
                  }}
                  disabled={actionLoading[crudModal.qrCode._id]}
                >
                  {actionLoading[crudModal.qrCode._id] ? 'Deleting...' : 'DELETE'}
                </button>
                <button type="button" className="cancel-btn" onClick={closeCrudModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterQRManagement;
