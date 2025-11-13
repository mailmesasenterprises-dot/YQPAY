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
import { useDeepMemo, useComputed } from '../../utils/ultraPerformance';
import { ultraFetch } from '../../utils/ultraFetch';



// QR Code Preview Component with Logo Overlay
const QRCodePreview = React.memo(({ data, logoUrl, size = 200 }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Import QRCode dynamically
    import('qrcode').then(QRCode => {
      // Generate QR code with black color
      QRCode.toCanvas(canvas, data, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',  // Black QR code
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      }, (error) => {
        if (error) {
          console.error('QR Code generation error:', error);
          return;
        }
        
        // Note: Logo overlay is skipped in preview due to CORS restrictions
        // The actual generated QR code from backend WILL include the logo
        if (logoUrl) {
          console.log('ℹ️ Logo will be added by backend during generation');
          
          // Add visual indicator that logo will be included
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          
          // Add "LOGO" text in center
          ctx.save();
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = '#8B5CF6';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('LOGO', size / 2, size / 2 - 5);
          ctx.font = '10px Arial';
          ctx.fillText('INCLUDED', size / 2, size / 2 + 8);
          ctx.restore();
        }
      });
    });
  }, [data, logoUrl, size]);
  
  if (!data) {
    return (
      <div style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #ccc',
        borderRadius: '8px',
        color: '#999',
        fontSize: '14px'
      }}>
        No QR data
      </div>
    );
  }
  
  return <canvas ref={canvasRef} style={{ borderRadius: '8px' }} />;
});

QRCodePreview.displayName = 'QRCodePreview';

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

      return;
    }
  }, [theaterId, userTheaterId, userType]);

  // Load default logo and theater data
  useEffect(() => {
    loadDefaultLogo();
    loadTheaterLogo();
    loadQRNames(true);
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [theaterId]);

  const loadDefaultLogo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      const response = await fetch(`${config.api.baseUrl}/settings/general`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Use logoUrl from Super Admin -> Settings -> General -> Application Logo
          const logoUrl = data.data.logoUrl || '';
          console.log('🎨 Loaded Default Logo URL from Settings:', logoUrl);
          setDefaultLogoUrl(logoUrl);
        }
      }
    } catch (error) {
      console.error('❌ Error loading default logo:', error);
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
          
          // Check multiple possible logo locations (matching Admin page)
          const logoUrl = theater.branding?.logoUrl 
            || theater.branding?.logo 
            || theater.documents?.logo 
            || theater.media?.logo 
            || theater.logo 
            || theater.logoUrl 
            || '';
            
          console.log('🎨 Loaded Theater Logo URL:', logoUrl);
          console.log('🏛️ Theater data (all logo fields):', { 
            'branding.logoUrl': theater.branding?.logoUrl,
            'branding.logo': theater.branding?.logo,
            'documents.logo': theater.documents?.logo,
            'media.logo': theater.media?.logo,
            'logo': theater.logo,
            'logoUrl': theater.logoUrl,
            'finalLogo': logoUrl
          });
          setTheaterLogoUrl(logoUrl);
        }
      }
    } catch (error) {
      console.error('❌ Error loading theater logo:', error);
  }
  }, [theaterId]);

  const loadQRNames = useCallback(async (forceRefresh = false) => {
    if (!theaterId) return;
    
    try {
      setQrNamesLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      
      // 🔄 FORCE REFRESH: Add cache-busting timestamp when force refreshing
      if (forceRefresh) {
        console.log('🔄 [TheaterGenerateQR] FORCE REFRESHING from server (bypassing ALL caches)');
      }

      // Fetch available QR code names
      const params = new URLSearchParams({
        theaterId: theaterId,
        limit: '100',
        _t: Date.now().toString()
      });

      if (forceRefresh) {
        params.append('_force', Date.now().toString());
      }

      const apiUrl = `${config.api.baseUrl}/qrcodenames?${params.toString()}`;
      
      // 🔄 FORCE REFRESH: Add no-cache headers when force refreshing
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      if (forceRefresh) {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }

      const response = await fetch(apiUrl, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR names');
      }
      
      const data = await response.json();
      
      if (data.success && data.data && data.data.qrCodeNames) {
        // Fetch existing QR codes to filter out already generated ones
        let existingQRNames = [];
        
        try {
          const existingParams = new URLSearchParams({
            _t: Date.now().toString()
          });

          if (forceRefresh) {
            existingParams.append('_force', Date.now().toString());
          }

          const existingHeaders = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          };

          if (forceRefresh) {
            existingHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            existingHeaders['Pragma'] = 'no-cache';
            existingHeaders['Expires'] = '0';
          }

          const existingQRsResponse = await fetch(`${config.api.baseUrl}/single-qrcodes/theater/${theaterId}?${existingParams.toString()}`, {
            headers: existingHeaders
          });
          
          if (existingQRsResponse.ok) {
            const existingQRsData = await existingQRsResponse.json();

            if (existingQRsData.success && existingQRsData.data && existingQRsData.data.qrCodes) {
              // Extract unique QR names that already have generated QR codes in singleqrcodes
              existingQRNames = [...new Set(existingQRsData.data.qrCodes.map(qr => qr.name))];
  }
          }
        } catch (fetchError) {

          existingQRNames = [];
        }
        
        // Filter out already generated QR names
        const availableQRNames = data.data.qrCodeNames.filter(
          qrName => !existingQRNames.includes(qrName.qrName)
        );
        

        setQrNames(availableQRNames);
      } else {
        setQrNames([]);
      }
    } catch (error) {

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
    
    console.log('🔄 Logo Type Changed:', {
      selectedLogoType: logoType,
      resultingLogoUrl: logoUrl,
      defaultLogoUrl,
      theaterLogoUrl
    });
    
    setFormData(prev => ({
      ...prev,
      logoType,
      logoUrl
    }));
  }, [defaultLogoUrl, theaterLogoUrl]);

  // Auto-update logoUrl when defaultLogoUrl or theaterLogoUrl changes
  useEffect(() => {
    // Only auto-update if logoUrl is empty and a logoType is selected
    if (formData.logoType && !formData.logoUrl) {
      if (formData.logoType === 'default' && defaultLogoUrl) {
        console.log('🔄 Auto-setting default logo URL:', defaultLogoUrl);
        setFormData(prev => ({
          ...prev,
          logoUrl: defaultLogoUrl
        }));
      } else if (formData.logoType === 'theater' && theaterLogoUrl) {
        console.log('🔄 Auto-setting theater logo URL:', theaterLogoUrl);
        setFormData(prev => ({
          ...prev,
          logoUrl: theaterLogoUrl
        }));
      }
    }
  }, [defaultLogoUrl, theaterLogoUrl, formData.logoType, formData.logoUrl]);

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
    console.log('🔍 Validating form:', formData);
    
    if (!formData.logoType) {
      console.log('❌ Logo type missing');
      showError('Please select a logo type');
      return false;
    }
    
    if (!formData.qrType) {
      console.log('❌ QR type missing');
      showError('Please select QR code type');
      return false;
    }
    
    if (!formData.name) {
      console.log('❌ QR name missing');
      showError('Please select QR code name');
      return false;
    }
    
    if (!formData.seatClass) {
      console.log('❌ Seat class missing');
      showError('Seat class is required');
      return false;
    }
    
    if (formData.qrType === 'screen' && (!formData.selectedSeats || formData.selectedSeats.length === 0)) {
      console.log('❌ No seats selected for screen type');
      showError('Please select at least one seat for screen type QR codes');
      return false;
    }
    
    console.log('✅ All validations passed');
    return true;
  }, [formData, showError]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    console.log('========================================');
    console.log('🚀 FORM SUBMITTED!');
    console.log('========================================');
    console.log('📝 Form Data:', JSON.stringify(formData, null, 2));
    console.log('🎭 Theater ID:', theaterId);
    console.log('🖼️ Default Logo URL:', defaultLogoUrl);
    console.log('🏛️ Theater Logo URL:', theaterLogoUrl);
    console.log('========================================');
    
    if (!validateForm()) {
      console.log('❌ VALIDATION FAILED - Stopping submission');
      return;
    }
    
    console.log('✅ VALIDATION PASSED - Starting generation...');
    
    try {
      setGenerating(true);
      console.log('🔄 Generating state set to TRUE');
      
      const token = localStorage.getItem('token') || localStorage.getItem('authToken');
      console.log('🔑 Token found:', token ? 'YES' : 'NO');
      
      // Prepare request body based on QR type
      let requestBody;
      
      // Ensure logoUrl is properly set based on logoType
      const finalLogoType = formData.logoType || 'default';
      const finalLogoUrl = formData.logoUrl || (finalLogoType === 'theater' ? theaterLogoUrl : defaultLogoUrl);
      
      console.log('🎨 QR Generation - Logo Details:', {
        logoType: finalLogoType,
        logoUrl: finalLogoUrl,
        formDataLogoUrl: formData.logoUrl,
        formDataLogoType: formData.logoType,
        defaultLogoUrl,
        theaterLogoUrl
      });

      // DEBUG: Alert to verify logo URL
      if (!finalLogoUrl) {
        alert('⚠️ WARNING: Logo URL is EMPTY!\n\n' + 
              'logoType: ' + finalLogoType + '\n' +
              'defaultLogoUrl: ' + defaultLogoUrl + '\n' +
              'theaterLogoUrl: ' + theaterLogoUrl + '\n' +
              'formData.logoUrl: ' + formData.logoUrl);
      } else {
        console.log('✅ Logo URL is set:', finalLogoUrl);
        console.log('🚀 Sending to backend - Logo Type:', finalLogoType, 'Logo URL:', finalLogoUrl);
      }
      
      if (formData.qrType === 'single') {
        // For single QR codes
        requestBody = {
          theaterId: theaterId,
          qrType: 'single',
          qrName: formData.name,
          seatClass: formData.seatClass,
          logoUrl: finalLogoUrl,
          logoType: finalLogoType
        };
      } else {
        // For screen QR codes
        requestBody = {
          theaterId: theaterId,
          qrType: 'screen',
          qrName: formData.name,
          seatClass: formData.seatClass,
          seats: formData.selectedSeats,
          logoUrl: finalLogoUrl,
          logoType: finalLogoType
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
            loadQRNames(true);
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
            navigate(`/theater-qr-management/${theaterId}`, { state: { reload: true } });
          }, 1500); // Wait 1.5 seconds to show success message
        }, 1000);
      } else {
        throw new Error(data.message || 'Failed to generate QR codes');
      }
    } catch (error) {

      showError(error.message || 'Failed to generate QR codes');
      setGenerating(false);
    }
  }, [formData, theaterId, validateForm, loadQRNames, showSuccess, showError, defaultLogoUrl, theaterLogoUrl, navigate, setGeneratingProgress]);

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
                  
                  {/* Logo Preview */}
                  {formData.logoType && formData.logoUrl && (
                    <div style={{
                      marginTop: '15px',
                      padding: '15px',
                      border: '2px solid #8B5CF6',
                      borderRadius: '8px',
                      backgroundColor: '#F9F5FF',
                      textAlign: 'center'
                    }}>
                      <p style={{
                        margin: '0 0 10px 0',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6B21A8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Selected Logo Preview
                      </p>
                      <div style={{
                        display: 'inline-block',
                        padding: '10px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}>
                        <img
                          src={formData.logoUrl}
                          alt={`${formData.logoType} logo`}
                          style={{
                            maxWidth: '150px',
                            maxHeight: '150px',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                        />
                        <div style={{
                          display: 'none',
                          color: '#DC2626',
                          fontSize: '12px',
                          padding: '20px'
                        }}>
                          Failed to load logo image
                        </div>
                      </div>
                      <p style={{
                        margin: '10px 0 0 0',
                        fontSize: '11px',
                        color: '#6B7280'
                      }}>
                        {formData.logoType === 'default' ? 'Default Logo' : 'Theater Logo'}
                      </p>
                    </div>
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

            {/* QR Code Preview Section */}
            {formData.logoUrl && formData.name && (
              <div className="form-section" style={{ marginTop: '20px' }}>
                <div className="section-header">
                  <div className="section-indicator"></div>
                  <h2>QR Code Preview</h2>
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '20px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <p style={{ 
                    marginBottom: '15px', 
                    color: '#6b7280',
                    fontSize: '14px' 
                  }}>
                    Preview of QR code with selected logo
                  </p>
                  <QRCodePreview 
                    data={`${config.app.publicUrl || window.location.origin}/menu/${theaterId}?qrName=${encodeURIComponent(formData.name)}`}
                    logoUrl={formData.logoUrl}
                    size={200}
                  />
                  <p style={{
                    marginTop: '10px',
                    fontSize: '12px',
                    color: '#9ca3af'
                  }}>
                    {formData.logoType === 'default' ? 'Using default logo' : 'Using theater logo'} • Black QR code
                  </p>
                </div>
              </div>
            )}

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
                onClick={() => console.log('🔘 Generate button clicked!')}
              >
                {generating ? `Generating... ${generatingProgress.current}/${generatingProgress.total}` : 'Generate QR Codes'}
              </button>
            </div>
          </form>

          {/* QR Generation Loading Overlay - Advanced UI (matching Admin page) */}
          {generating && (
            <div className="qr-generation-overlay">
              <div className="qr-generation-modal">
                <div className="qr-generation-header">
                  <h3>Generating QR Codes</h3>
                  <div className="qr-generation-spinner">
                    <div className="spinner-circle"></div>
                  </div>
                </div>
                
                <div className="qr-generation-content">
                  <div className="progress-info">
                    <div className="progress-message">{generatingProgress.message || 'Sending request to server...'}</div>
                    {generatingProgress.total > 1 && (
                      <div className="progress-counter">
                        {generatingProgress.current} of {generatingProgress.total} completed
                      </div>
                    )}
                  </div>
                  
                  {generatingProgress.total > 1 ? (
                    <div className="progress-bar-container">
                      <div className="progress-bar-wrapper">
                        <div className="progress-bar">
                          <div 
                            className="progress-bar-fill"
                            style={{ 
                              width: `${(generatingProgress.current / generatingProgress.total) * 100}%` 
                            }}
                          >
                            <div className="progress-bar-shine"></div>
                          </div>
                        </div>
                        <div className="progress-percentage-overlay">
                          {Math.round((generatingProgress.current / generatingProgress.total) * 100)}%
                        </div>
                      </div>
                      <div className="progress-stats">
                        <span className="progress-current">{generatingProgress.current}/{generatingProgress.total} QR Codes</span>
                        <span className="progress-speed">Generating...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="simple-loading">
                      <div className="simple-progress-bar">
                        <div className="simple-progress-fill"></div>
                      </div>
                      <div className="loading-text">Creating QR code...</div>
                    </div>
                  )}
                  
                  <div className="generating-details">
                    {formData.selectedSeats && formData.selectedSeats.length > 0 && (
                      <div className="seats-info">
                        <strong>Selected Seats:</strong> {formData.selectedSeats.join(', ')}
                      </div>
                    )}
                    <div className="theater-info">
                      <strong>Theater:</strong> YQ PAY NOW
                    </div>
                    <div className="class-info">
                      <strong>Seat Class:</strong> {formData.seatClass}
                    </div>
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
