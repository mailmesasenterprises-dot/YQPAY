import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import ErrorBoundary from '../../components/ErrorBoundary';
import { useModal } from '../../contexts/ModalContext';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/TheaterGenerateQR.css';
import '../../styles/TheaterList.css';

const TheaterGenerateQR = () => {
  const navigate = useNavigate();
  const { theaterId } = useParams();
  const { user, theaterId: userTheaterId, userType } = useAuth();
  const { showError, showSuccess, alert } = useModal();
  
  // PERFORMANCE MONITORING
  usePerformanceMonitoring('TheaterGenerateQR');
  
  const abortControllerRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    qrType: '',
    name: '',
    seatStart: '',
    seatEnd: '',
    selectedSeats: [],
    logoType: '',
    logoUrl: '',
    seatClass: ''
  });
  
  // UI state
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0, message: '' });
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [allAvailableSeats, setAllAvailableSeats] = useState([]);
  const [defaultLogoUrl, setDefaultLogoUrl] = useState('');
  const [theaterLogoUrl, setTheaterLogoUrl] = useState('');
  
  // QR Names state
  const [qrNames, setQrNames] = useState([]);
  const [qrNamesLoading, setQrNamesLoading] = useState(false);

  // Validate theater access
  useEffect(() => {
    if (userType === 'theater_user' && userTheaterId && theaterId !== userTheaterId) {
      console.error('Theater access denied: User can only access their own theater');
      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load default logo and theater data
  useEffect(() => {
    loadDefaultLogo();
    loadTheaterLogo();
    loadQRNames();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [theaterId]);

  const loadDefaultLogo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setDefaultLogoUrl(data.data.defaultQRLogo || '');
        }
      }
    } catch (error) {
      console.error('Error loading default logo:', error);
    }
  }, []);

  const loadTheaterLogo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/theaters/${theaterId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const theater = data.data;
          const logoUrl = theater.media?.logo || theater.logo || theater.logoUrl || '';
          setTheaterLogoUrl(logoUrl);
        }
      }
    } catch (error) {
      console.error('Error loading theater logo:', error);
    }
  }, [theaterId]);

  const loadQRNames = useCallback(async () => {
    if (!theaterId) return;
    
    try {
      setQrNamesLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Fetch available QR code names
      const apiUrl = `${config.api.baseUrl}/qrcodenames?theaterId=${theaterId}&limit=100&_t=${Date.now()}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR names');
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.qrCodeNames) {
        // Fetch existing QR codes to filter out already generated ones
        let existingQRNames = [];
        
        try {
          const existingQRsResponse = await fetch(`${config.api.baseUrl}/single-qrcodes/theater/${theaterId}?_t=${Date.now()}`, {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (existingQRsResponse.ok) {
            const existingQRsData = await existingQRsResponse.json();
            console.log('📊 Theater Generate QR - Existing Single QR Codes Response:', existingQRsData);
            
            if (existingQRsData.success && existingQRsData.data && existingQRsData.data.qrCodes) {
              // Extract unique QR names that already have generated QR codes in singleqrcodes
              existingQRNames = [...new Set(existingQRsData.data.qrCodes.map(qr => qr.name))];
              console.log('🚫 Theater Generate QR - Already generated QR names:', existingQRNames);
              console.log('🔍 Theater Generate QR - Number of existing QR records:', existingQRsData.data.qrCodes.length);
            }
          }
        } catch (fetchError) {
          console.warn('Could not fetch existing QR codes:', fetchError);
          existingQRNames = [];
        }
        
        // Filter out already generated QR names
        const availableQRNames = data.data.qrCodeNames.filter(
          qrName => !existingQRNames.includes(qrName.qrName)
        );
        
        console.log('✅ Theater Generate QR - Available QR Names (filtered):', availableQRNames.length, availableQRNames);
        setQrNames(availableQRNames);
      } else {
        setQrNames([]);
      }
    } catch (error) {
      console.error('Error loading QR names:', error);
      setQrNames([]);
    } finally {
      setQrNamesLoading(false);
    }
  }, [theaterId]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    if (name === 'name') {
      const selectedQRName = qrNames.find(qr => qr.qrName === value);
      setFormData(prev => ({
        ...prev,
        name: value,
        seatClass: selectedQRName ? selectedQRName.seatClass : ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseInt(value) || 0 : value
      }));
    }
  }, [qrNames]);

  const handleLogoTypeChange = useCallback((logoType) => {
    let logoUrl = '';
    
    if (logoType === 'default') {
      logoUrl = defaultLogoUrl;
    } else if (logoType === 'theater') {
      logoUrl = theaterLogoUrl;
    }
    
    setFormData(prev => ({
      ...prev,
      logoType,
      logoUrl
    }));
  }, [defaultLogoUrl, theaterLogoUrl]);

  const handleQRTypeChange = useCallback((qrType) => {
    setFormData(prev => ({
      ...prev,
      qrType,
      seatStart: '',
      seatEnd: '',
      selectedSeats: []
    }));
    setShowSeatMap(false);
    setAllAvailableSeats([]);
  }, []);

  const handleGenerateSeatMap = useCallback(() => {
    if (!formData.seatStart && !formData.seatEnd) {
      setFormData(prev => ({
        ...prev,
        seatStart: 'A1',
        seatEnd: 'A20'
      }));
      setTimeout(() => {
        handleGenerateSeatMap();
      }, 100);
      return;
    }
    
    const startMatch = formData.seatStart.match(/^([A-Z]+)(\d+)$/);
    const endMatch = formData.seatEnd.match(/^([A-Z]+)(\d+)$/);
    
    if (!startMatch || !endMatch) {
      showError('Invalid seat format. Use format like A1, B20, etc.');
      return;
    }
    
    const [, startRow, startNum] = startMatch;
    const [, endRow, endNum] = endMatch;
    const startRowCode = startRow.charCodeAt(0);
    const endRowCode = endRow.charCodeAt(0);
    const startNumber = parseInt(startNum);
    const endNumber = parseInt(endNum);
    
    if (startRowCode > endRowCode || (startRowCode === endRowCode && startNumber > endNumber)) {
      showError('Start seat must come before or equal to end seat');
      return;
    }
    
    const currentRange = {
      startRow,
      endRow,
      startNumber,
      endNumber,
      startRowCode,
      endRowCode
    };
    
    setAllAvailableSeats(prev => {
      const exists = prev.some(range => 
        range.startRow === startRow && 
        range.endRow === endRow && 
        range.startNumber === startNumber && 
        range.endNumber === endNumber
      );
      
      if (!exists) {
        return [...prev, currentRange];
      }
      return prev;
    });
    
    setShowSeatMap(true);
    
    // Auto-select newly generated seats
    const currentRangeSeats = [];
    for (let rowCode = startRowCode; rowCode <= endRowCode; rowCode++) {
      const currentRow = String.fromCharCode(rowCode);
      let rowStart = rowCode === startRowCode ? startNumber : 1;
      let rowEnd = rowCode === endRowCode ? endNumber : endNumber;
      
      for (let i = rowStart; i <= rowEnd; i++) {
        currentRangeSeats.push(`${currentRow}${i}`);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      selectedSeats: [...new Set([...prev.selectedSeats, ...currentRangeSeats])]
    }));
  }, [formData.seatStart, formData.seatEnd, showError]);

  const toggleSeatSelection = useCallback((seatId) => {
    setFormData(prev => ({
      ...prev,
      selectedSeats: prev.selectedSeats.includes(seatId)
        ? prev.selectedSeats.filter(s => s !== seatId)
        : [...prev.selectedSeats, seatId]
    }));
  }, []);

  const validateForm = useCallback(() => {
    if (!formData.logoType) {
      showError('Please select a logo type');
      return false;
    }
    
    if (!formData.qrType) {
      showError('Please select QR code type');
      return false;
    }
    
    if (!formData.name) {
      showError('Please select QR code name');
      return false;
    }
    
    if (!formData.seatClass) {
      showError('Seat class is required');
      return false;
    }
    
    if (formData.qrType === 'screen' && (!formData.selectedSeats || formData.selectedSeats.length === 0)) {
      showError('Please select at least one seat for screen type QR codes');
      return false;
    }
    
    return true;
  }, [formData, showError]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setGenerating(true);
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // Prepare request body based on QR type
      let requestBody;
      if (formData.qrType === 'single') {
        // For single QR codes
        requestBody = {
          theaterId: theaterId,
          qrType: 'single',
          qrName: formData.name,
          seatClass: formData.seatClass,
          logoUrl: formData.logoUrl,
          logoType: formData.logoType
        };
      } else {
        // For screen QR codes
        requestBody = {
          theaterId: theaterId,
          qrType: 'screen',
          qrName: formData.name,
          seatClass: formData.seatClass,
          seats: formData.selectedSeats,
          logoUrl: formData.logoUrl,
          logoType: formData.logoType
        };
      }
      
      const totalSeats = formData.qrType === 'single' ? 1 : (formData.selectedSeats?.length || 0);
      
      setGeneratingProgress({
        current: 0,
        total: totalSeats,
        message: 'Starting QR code generation...'
      });
      
      const response = await fetch(`${config.api.baseUrl}/single-qrcodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate QR codes');
      }
      
      const data = await response.json();
      
      if (data.success) {
        const count = data.count || (data.data && data.data.count) || totalSeats;
        const message = formData.qrType === 'single' 
          ? 'Single QR code generated and saved successfully!'
          : `${count} screen QR codes generated successfully!`;
        
        setGeneratingProgress({
          current: totalSeats,
          total: totalSeats,
          message: 'QR codes generated successfully!'
        });
        
        setTimeout(() => {
          setGenerating(false);
          
          // Reload QR names
          setTimeout(() => {
            loadQRNames();
          }, 500);
          
          showSuccess(message);
          
          // Reset form
          setFormData({
            qrType: '',
            name: '',
            seatStart: '',
            seatEnd: '',
            selectedSeats: [],
            logoType: '',
            logoUrl: '',
            seatClass: ''
          });
          setShowSeatMap(false);
          setAllAvailableSeats([]);
          
          // Redirect to QR Management page after successful generation
          setTimeout(() => {
            navigate(`/theater-qr-management/${theaterId}`);
          }, 1500); // Wait 1.5 seconds to show success message
        }, 1000);
      } else {
        throw new Error(data.message || 'Failed to generate QR codes');
      }
    } catch (error) {
      console.error('Error generating QR codes:', error);
      showError(error.message || 'Failed to generate QR codes');
      setGenerating(false);
    }
  }, [formData, theaterId, validateForm, loadQRNames, showSuccess, showError]);

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Generate QR Codes" currentPage="generate-qr">
        <PageContainer title="Generate QR Codes">
        
        {/* Purple Header */}
        <div className="qr-generate-header">
          {/* <h1>Generate QR Codes</h1> */}
        </div>

        {/* Main Form Container */}
        <div className="qr-generate-container">
          <form onSubmit={handleSubmit} className="qr-generate-form">
            
            {/* Basic Information Section */}
            <div className="form-section">
              <div className="section-header">
                <div className="section-indicator"></div>
                <h2>Basic Information</h2>
              </div>

              <div className="form-grid">
                {/* Logo Type Selection */}
                <div className="form-group">
                  <label htmlFor="logoType">
                    LOGO SELECTION <span className="required">*</span>
                  </label>
                  <select
                    id="logoType"
                    name="logoType"
                    value={formData.logoType}
                    onChange={(e) => handleLogoTypeChange(e.target.value)}
                    className="form-control"
                    required
                  >
                    <option value="">Select Logo Type</option>
                    <option value="default">Default Logo</option>
                    <option value="theater">Theater Logo</option>
                  </select>
                  {formData.logoType === 'default' && !defaultLogoUrl && (
                    <p className="form-help-text">
                      No default logo configured in settings.
                    </p>
                  )}
                  {formData.logoType === 'theater' && !theaterLogoUrl && (
                    <p className="form-help-text">
                      Theater has no logo. Please upload a logo or use default logo.
                    </p>
                  )}
                </div>

                {/* QR Type Selection */}
                <div className="form-group">
                  <label htmlFor="qrType">
                    QR CODE TYPE <span className="required">*</span>
                  </label>
                  <select
                    id="qrType"
                    name="qrType"
                    value={formData.qrType}
                    onChange={(e) => handleQRTypeChange(e.target.value)}
                    className="form-control"
                    required
                  >
                    <option value="">Select QR Code Type</option>
                    <option value="single">SINGLE QR CODE</option>
                    <option value="screen">Screen</option>
                  </select>
                </div>

                {/* QR Code Name */}
                <div className="form-group">
                  <label htmlFor="name">
                    QR CODE NAME <span className="required">*</span>
                  </label>
                  {qrNamesLoading ? (
                    <div className="form-control disabled-dropdown">
                      <span>Loading QR names...</span>
                    </div>
                  ) : qrNames.length === 0 ? (
                    <div className="form-control disabled-dropdown" style={{ color: '#e74c3c' }}>
                      <span>⚠️ All QR names have already been generated for this theater (checked against singleqrcodes database)</span>
                    </div>
                  ) : (
                    <select
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                    >
                      <option value="">Select QR Code Name</option>
                      {qrNames.map(qrName => (
                        <option key={qrName._id} value={qrName.qrName}>
                          {qrName.qrName}
                        </option>
                      ))}
                    </select>
                  )}
                  {!qrNamesLoading && qrNames.length > 0 && (
                    <p className="form-help-text">
                      ✅ {qrNames.length} QR name(s) available for generation (filtered by singleqrcodes database)
                    </p>
                  )}
                </div>

                {/* Seat Class */}
                <div className="form-group">
                  <label htmlFor="seatClass">
                    SEAT CLASS <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="seatClass"
                    name="seatClass"
                    value={formData.seatClass}
                    className="form-control"
                    readOnly
                    placeholder={formData.name ? "Auto-populated from QR name" : "Select a QR name first"}
                  />
                </div>

                {/* Screen-specific fields */}
                {formData.qrType === 'screen' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="seatStart">
                        SEAT START ID {(!formData.selectedSeats || formData.selectedSeats.length === 0) && <span className="required">*</span>}
                      </label>
                      <input
                        type="text"
                        id="seatStart"
                        name="seatStart"
                        value={formData.seatStart}
                        onChange={handleInputChange}
                        placeholder="e.g., A1, B1, C1"
                        className="form-control"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="seatEnd">
                        SEAT END ID {(!formData.selectedSeats || formData.selectedSeats.length === 0) && <span className="required">*</span>}
                      </label>
                      <input
                        type="text"
                        id="seatEnd"
                        name="seatEnd"
                        value={formData.seatEnd}
                        onChange={handleInputChange}
                        placeholder="e.g., A20, B20, C20"
                        className="form-control"
                      />
                    </div>

                    <div className="form-group" style={{gridColumn: '1 / -1'}}>
                      <button 
                        type="button" 
                        className="generate-seat-map-btn"
                        onClick={handleGenerateSeatMap}
                      >
                        {formData.selectedSeats && formData.selectedSeats.length > 0 ? 'ADD MORE SEATS' : 'ADD MORE SEATS'}
                      </button>
                    </div>

                    {/* Seat Map */}
                    {showSeatMap && allAvailableSeats.length > 0 && (
                      <div className="seat-map-section" style={{gridColumn: '1 / -1'}}>
                        <div className="seat-map-header">
                          <h3>Select Seats</h3>
                          <div className="seat-map-actions">
                            <button 
                              type="button"
                              className="apply-selected-btn"
                              onClick={() => setShowSeatMap(false)}
                            >
                              APPLY SELECTED ({formData.selectedSeats.length})
                            </button>
                            <button 
                              type="button"
                              className="clear-all-btn"
                              onClick={() => setFormData(prev => ({ ...prev, selectedSeats: [] }))}
                            >
                              CLEAR ALL
                            </button>
                          </div>
                        </div>

                        {allAvailableSeats.map((range, rangeIndex) => (
                          <div key={rangeIndex} className="seat-range-block">
                            <div className="screen-header">
                              <svg viewBox="0 0 24 24" className="screen-icon">
                                <path fill="currentColor" d="M4,6H20V16H4V6M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20Z"/>
                              </svg>
                              SCREEN
                              <button 
                                type="button"
                                className="remove-range-btn"
                                onClick={() => {
                                  const newRanges = allAvailableSeats.filter((_, idx) => idx !== rangeIndex);
                                  setAllAvailableSeats(newRanges);
                                  if (newRanges.length === 0) {
                                    setShowSeatMap(false);
                                  }
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                                </svg>
                              </button>
                            </div>
                            <div className="seat-grid">
                              {Array.from({ length: range.endRowCode - range.startRowCode + 1 }, (_, i) => {
                                const rowCode = range.startRowCode + i;
                                const currentRow = String.fromCharCode(rowCode);
                                let rowStart = rowCode === range.startRowCode ? range.startNumber : 1;
                                let rowEnd = rowCode === range.endRowCode ? range.endNumber : range.endNumber;
                                
                                return (
                                  <div key={currentRow} className="seat-row">
                                    <div className="row-label">{currentRow}</div>
                                    {Array.from({ length: rowEnd - rowStart + 1 }, (_, j) => {
                                      const seatNumber = rowStart + j;
                                      const seatId = `${currentRow}${seatNumber}`;
                                      const isSelected = formData.selectedSeats.includes(seatId);
                                      
                                      return (
                                        <div
                                          key={seatId}
                                          className={`seat ${isSelected ? 'selected' : ''}`}
                                          onClick={() => toggleSeatSelection(seatId)}
                                        >
                                          {seatNumber}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="seat-summary">
                              <strong>{formData.selectedSeats.length} seats selected</strong>
                              <div className="selected-seats-list">
                                {formData.selectedSeats.join(', ')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button 
                type="button" 
                onClick={() => navigate(`/theater-qr-management/${theaterId}`)} 
                className="cancel-btn"
                disabled={generating}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={generating}
              >
                {generating ? `Generating... ${generatingProgress.current}/${generatingProgress.total}` : 'Generate QR Codes'}
              </button>
            </div>
          </form>

          {/* Progress Modal - Enhanced */}
          {generating && (
            <div className="modal-overlay">
              <div className="progress-modal">
                <h3>Generating QR Codes</h3>
                
                {/* QR Icon */}
                <div className="qr-icon-container">
                  <svg className="qr-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,11H11V3H3M5,5H9V9H5M13,3V11H21V3M19,9H15V5H19M3,21H11V13H3M5,15H9V19H5M17,13H15V15H13V17H15V19H17V17H19V15H17M19,21H21V19H19M13,21H15V19H13M17,17H19V13H17V17Z"/>
                  </svg>
                </div>

                {/* Progress Spinner */}
                <div className="progress-spinner">
                  <div className="spinner"></div>
                </div>

                {/* Progress Message */}
                <p>{generatingProgress.message || 'Sending request to server...'}</p>
                <p>{generatingProgress.current} of {generatingProgress.total} completed</p>
                
                {/* Progress Bar */}
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{width: `${generatingProgress.total > 0 ? (generatingProgress.current / generatingProgress.total) * 100 : 0}%`}}
                  ></div>
                </div>
                <p style={{textAlign: 'center', marginTop: '8px', fontSize: '0.9rem', color: 'var(--primary-color)'}}>
                  {generatingProgress.total > 0 ? Math.round((generatingProgress.current / generatingProgress.total) * 100) : 0}%
                </p>

                {/* Generation Details */}
                <div className="qr-generation-details">
                  <div className="detail-row">
                    <span className="detail-label">📊 QR Codes</span>
                    <span className="detail-value">{generatingProgress.current}/{generatingProgress.total}</span>
                  </div>
                  {formData.selectedSeats && formData.selectedSeats.length > 0 && (
                    <div className="selected-seats-preview">
                      <span className="detail-label">Selected Seats:</span>
                      <div className="seats-grid">
                        {formData.selectedSeats.map(seat => (
                          <span key={seat} className="seat-chip">{seat}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Theater:</span>
                    <span className="detail-value">YQ PAY NOW</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Seat Class:</span>
                    <span className="detail-value">{formData.seatClass}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
};

export default TheaterGenerateQR;
