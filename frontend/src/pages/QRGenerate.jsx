import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import AdminLayout from '../components/AdminLayout';
import { useToast } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { clearTheaterCache } from '../utils/cacheManager';
import { optimizedFetch } from '../utils/apiOptimizer';
import { getCachedData } from '../utils/cacheUtils';
import config from '../config';
import '../styles/QRGenerate.css';
import '../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';
import QRCode from 'qrcode';



// Simple debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Theater Selection Skeleton Component
const TheaterSelectSkeleton = React.memo(() => (
  <div className="loading-select" style={{
    height: '40px',
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'loading 1.5s infinite',
    borderRadius: '4px'
  }}>
    Loading theaters...
  </div>
));



const QRGenerate = React.memo(() => {
  const navigate = useNavigate();
  const toast = useToast();
  const performanceMetrics = usePerformanceMonitoring('QRGenerate');
  const abortControllerRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    theaterId: '',
    qrType: '',
    name: '',
    seatStart: '',
    seatEnd: '',
    selectedSeats: [],
    logoType: '', // 'default' or 'theater'
    logoUrl: '',
    seatClass: '', // Will be auto-populated from QR name selection
    orientation: 'landscape' // 'landscape' or 'portrait'
  });
  
  // Cache keys - constants for consistency
  const THEATERS_CACHE_KEY = 'qr_generate_theaters_active';
  const LOGO_CACHE_KEY = 'qr_generate_settings_general';
  
  // 🚀 OPTIMIZED: Check cache synchronously on mount for instant loading
  // Use function form of useState to only check cache once on mount
  const [theaters, setTheaters] = useState(() => {
    if (typeof window === 'undefined') return [];
    const cached = getCachedData(THEATERS_CACHE_KEY, 120000);
    if (cached && cached.success) {
      return cached.data || cached.theaters || [];
    }
    return [];
  });
  
  const [theatersLoading, setTheatersLoading] = useState(() => {
    // Only show loading if no cache exists
    if (typeof window === 'undefined') return true;
    const cached = getCachedData(THEATERS_CACHE_KEY, 120000);
    return !(cached && cached.success && (cached.data || cached.theaters || []).length > 0);
  });
  
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState({ current: 0, total: 0, message: '' });
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [allAvailableSeats, setAllAvailableSeats] = useState([]); // Store all generated seat ranges
  
  const [defaultLogoUrl, setDefaultLogoUrl] = useState(() => {
    // 🚀 OPTIMIZED: Check cache for default logo on mount
    if (typeof window === 'undefined') return '';
    const cached = getCachedData(LOGO_CACHE_KEY, 300000);
    if (cached && cached.success && cached.data) {
      return cached.data.qrCodeUrl || cached.data.logoUrl || '';
    }
    return '';
  }); // Default logo from settings
  
  // QR Names state
  const [qrNames, setQrNames] = useState([]);
  const [qrNamesLoading, setQrNamesLoading] = useState(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (generating) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [generating]);

  // Load active theaters on component mount - OPTIMIZED: Load in parallel
  useEffect(() => {
    // 🚀 PERFORMANCE: Load data in parallel
    // optimizedFetch handles cache internally - returns instantly if cached (< 50ms)
    // If cache exists from initial state, these will also use cache and return instantly
    let isMounted = true;
    
    const loadData = async () => {
      await Promise.allSettled([
        loadTheaters(),
        loadDefaultLogo()
      ]);
    };
    
    loadData();
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Don't clear cache on unmount - keep it for faster subsequent loads
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - functions are stable

  const loadTheaters = useCallback(async () => {
    try {
      // 🚀 PERFORMANCE: optimizedFetch handles cache internally - returns instantly if cached
      // Initial state already handles loading: false if cache exists, true if no cache
      // No need to change loading state here - it's already correct from initial state
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // 🚀 PERFORMANCE: Use optimizedFetch - it handles cache automatically
      // If cache exists, this returns instantly (< 50ms), otherwise fetches from API
      const data = await optimizedFetch(
        `${config.api.baseUrl}/theaters?status=active&limit=100`,
        {
          signal: abortControllerRef.current.signal,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        },
        THEATERS_CACHE_KEY,
        120000 // 2-minute cache
      );
      
      if (data && data.success) {
        // Handle both paginated and direct response formats
        // Backend pagination returns: { success: true, data: [...], pagination: {...} }
        const theaterList = data.data || data.theaters || [];
        setTheaters(theaterList);
      } else {
        // Removed error modal - errors logged to console only
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      // Removed error modal - errors logged to console only
    } finally {
      // Always set loading to false when done (optimizedFetch returns instantly if cached)
      setTheatersLoading(false);
      abortControllerRef.current = null;
    }
  }, []); // Empty deps - stable function

  const loadDefaultLogo = useCallback(async () => {
    try {
      // 🚀 PERFORMANCE: Use optimizedFetch - it handles cache automatically
      // If cache exists, this returns instantly (< 50ms), otherwise fetches from API
      const data = await optimizedFetch(
        `${config.api.baseUrl}/settings/general`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        },
        LOGO_CACHE_KEY,
        300000 // 5-minute cache for settings
      );

      if (data && data.success && data.data) {
        // Use logoUrl from Super Admin -> Settings -> General -> Application Logo
        const logoUrl = data.data.logoUrl || '';
        setDefaultLogoUrl(logoUrl);
      }
    } catch (error) {
      // Silent fail - use existing state or empty string
    }
  }, []);

  const loadQRNames = useCallback(async (theaterId) => {

    if (!theaterId) {

      setQrNames([]);
      setQrNamesLoading(false);
      return;
    }
    
    try {

      setQrNamesLoading(true);
      
      // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
      const apiUrl = `${config.api.baseUrl}/qrcodenames?theaterId=${theaterId}&limit=100`;
      const data = await optimizedFetch(
        apiUrl,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        },
        `qr_generate_qrcodenames_theater_${theaterId}_limit_100`,
        120000 // 2-minute cache
      );

      if (data && data.success && data.data && data.data.qrCodeNames) {

        // Try to fetch already generated QR codes from singleqrcodes database for this theater (to filter duplicates)
        let existingQRNames = [];

        try {
          const token = config.helpers.getAuthToken();

          if (!token) {

            existingQRNames = [];
          } else {
            // 🚀 PERFORMANCE: Use optimizedFetch for instant cache loading
            const existingQRsUrl = `${config.api.baseUrl}/single-qrcodes/theater/${theaterId}`;
            const existingQRsData = await optimizedFetch(
              existingQRsUrl,
              {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                }
              },
              `qr_generate_existing_qrcodes_theater_${theaterId}`,
              120000 // 2-minute cache
            ).catch(() => ({ success: false, data: [] }));

            if (existingQRsData && existingQRsData.success && existingQRsData.data && existingQRsData.data.qrCodes) {
              // Extract unique QR names that already have generated QR codes in singleqrcodes
              // This checks both single and screen type QR codes in the unified collection
              existingQRNames = [...new Set(existingQRsData.data.qrCodes.map(qr => qr.name))]; // Using 'name' field from transformed response
            } else {
              existingQRNames = [];
            }
          }
        } catch (fetchError) {
          // Silently handle error - if we can't fetch existing QRs, just show all QR names

          // In case of error, set existingQRNames to empty array (showing all QR names)
          existingQRNames = [];
        }
        
        // Filter out QR names that already have generated QR codes
        const availableQRNames = data.data.qrCodeNames.filter(
          qrName => {
            const isAlreadyGenerated = existingQRNames.includes(qrName.qrName);

            return !isAlreadyGenerated;
          }
        );
        

        setQrNames(availableQRNames);

        if (availableQRNames.length === 0 && data.data.qrCodeNames.length > 0) {
          // All QR names have been generated
  } else if (existingQRNames.length === 0) {
          // No existing QR names found
  }
      } else {

        setQrNames([]);
      }
    } catch (error) {

      setQrNames([]);
      // Removed error modal - errors logged to console only
    } finally {

      setQrNamesLoading(false);
    }
  }, []);

  // Removed useEffect that was causing race condition
  // QR names are loaded directly in handleInputChange when theater is selected

  const handleInputChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    // Handle theater selection with logo update and QR names loading
    if (name === 'theaterId') {
      const selectedTheater = theaters.find(t => t._id === value);
      let logoUrl = formData.logoUrl;
      
      // Update logo URL if theater logo is selected
      if (formData.logoType === 'theater' && selectedTheater) {
        logoUrl = selectedTheater.media?.logo || selectedTheater.logo || selectedTheater.logoUrl || '';
  }
      
      // Load QR names for the selected theater

      loadQRNames(value);
      
      setFormData(prev => ({
        ...prev,
        theaterId: value,
        logoUrl,
        name: '', // Reset QR name when theater changes
        seatClass: '' // Reset seat class when theater changes
      }));
    } 
    // Handle QR name selection with automatic seat class update
    else if (name === 'name') {
      const selectedQRName = qrNames.find(qr => qr.qrName === value);
      
      setFormData(prev => ({
        ...prev,
        name: value,
        seatClass: selectedQRName ? selectedQRName.seatClass : ''
      }));
    } 
    else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'number' ? parseInt(value) || 0 : value
      }));
    }
  }, [theaters, formData.logoUrl, formData.logoType, loadQRNames, qrNames]);

  const handleLogoTypeChange = useCallback((logoType) => {
    const selectedTheater = theaters.find(t => t._id === formData.theaterId);
    let logoUrl = '';
    
    if (logoType === 'default') {
      logoUrl = defaultLogoUrl || '';
    } else if (logoType === 'theater' && selectedTheater) {
      // Check multiple possible logo locations in theater object
      logoUrl = selectedTheater.branding?.logoUrl 
        || selectedTheater.branding?.logo 
        || selectedTheater.documents?.logo 
        || selectedTheater.media?.logo 
        || selectedTheater.logo 
        || selectedTheater.logoUrl 
        || '';
    }
    
    setFormData(prev => ({
      ...prev,
      logoType,
      logoUrl
    }));
  }, [theaters, formData.theaterId, defaultLogoUrl]);

  const handleQRTypeChange = useCallback((type) => {
    setFormData(prev => ({
      ...prev,
      qrType: type,
      name: '',
      seatStart: '',
      seatEnd: '',
      selectedSeats: []
    }));
    setShowSeatMap(false); // Hide seat map when changing type
    setAllAvailableSeats([]); // Clear all stored seat ranges when changing type
  }, []);

  // Memoized calculations
  const selectedTheater = useMemo(() => 
    theaters.find(t => t._id === formData.theaterId),
    [theaters, formData.theaterId]
  );

  // QR Code Preview State
  const [qrPreviewUrl, setQrPreviewUrl] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const qrCanvasRef = useRef(null);
  const imageRef = useRef(null);

  // Image alternatives list
  const imageAlternatives = [
    '/images/scan/scan-order-pay.png',
    '/images/scan/scan-order-pay.jpg',
    '/images/scan/scan-order-pay.webp',
    '/images/scan/scan.png',
    '/images/scan/scan.jpg',
    '/images/scan/scan.webp',
    '/images/scan/order-pay.png',
    '/images/scan.png', // Fallback to existing file in images root
    '/images/scan.webp' // Final fallback
  ];

  // Reset image state when orientation changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setCurrentImageIndex(0);
  }, [formData.orientation]);

  // Check if image is already loaded (for cached images)
  useEffect(() => {
    const checkImageLoaded = () => {
      if (imageRef.current && imageRef.current.complete && imageRef.current.naturalHeight !== 0) {
        setImageLoaded(true);
        setImageError(false);
      }
    };
    
    // Check immediately
    checkImageLoaded();
    
    // Also check after a short delay to catch images that load quickly
    const timeout = setTimeout(checkImageLoaded, 100);
    
    return () => clearTimeout(timeout);
  }, [currentImageIndex]);

  // Generate QR code preview
  useEffect(() => {
    let timeoutId = null;
    let isMounted = true;
    
    const generateQRPreview = async () => {
      // Wait for canvas to be available with retries
      const checkCanvas = (retries = 10) => {
        if (qrCanvasRef.current) {
          // Canvas is available, proceed with generation
          return true;
        }
        if (retries > 0 && isMounted) {
          timeoutId = setTimeout(() => {
            if (isMounted && qrCanvasRef.current) {
              // Canvas is now available, generate QR code
              generateQRPreview();
            } else if (isMounted) {
              checkCanvas(retries - 1);
            }
          }, 100);
        }
        return false;
      };
      
      if (!checkCanvas()) {
        return;
      }

      try {
        const canvas = qrCanvasRef.current;
        if (!canvas) {
          console.warn('Canvas not available');
          return;
        }

        const size = formData.orientation === 'landscape' ? 200 : 250;
        
        // Set canvas dimensions
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Generate QR code data URL - use default if form not filled
        let qrCodeData;
        if (formData.theaterId && formData.name) {
          // Use actual form data
          const baseUrl = config.api.baseUrl?.replace('/api', '') || window.location.origin;
          qrCodeData = formData.qrType === 'screen' && formData.selectedSeats.length > 0
            ? `${baseUrl}/menu/${formData.theaterId}?qrName=${encodeURIComponent(formData.name)}&seat=${encodeURIComponent(formData.selectedSeats[0])}&type=screen`
            : `${baseUrl}/menu/${formData.theaterId}?qrName=${encodeURIComponent(formData.name)}&type=single`;
        } else {
          // Use default QR code data
          const baseUrl = window.location.origin;
          qrCodeData = `${baseUrl}/menu/preview`;
        }
        
        // Generate QR code
        await QRCode.toCanvas(canvas, qrCodeData, {
          width: size,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'H'
        });
        
        console.log('QR code generated successfully');

        // Determine which logo URL to use
        let logoToUse = '';
        if (formData.logoType === 'default') {
          // Use default logo if default logo type is selected
          logoToUse = defaultLogoUrl || formData.logoUrl || '';
        } else if (formData.logoType === 'theater') {
          // Use theater logo if theater logo type is selected
          logoToUse = formData.logoUrl || '';
        } else if (formData.logoUrl) {
          // Fallback to any logoUrl if set
          logoToUse = formData.logoUrl;
        }

        // Overlay logo if available (show instantly when logo type is selected)
        if (logoToUse) {
          try {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
              logoImg.onload = () => {
                try {
                  // Calculate logo size (30% of QR code size - increased from 20%)
                  const logoSize = size * 0.30;
                  const logoX = (size - logoSize) / 2;
                  const logoY = (size - logoSize) / 2;
                  
                  // Draw white background circle for logo with border
                  const centerX = size / 2;
                  const centerY = size / 2;
                  const borderWidth = 8; // White border width
                  const radius = logoSize / 2 + borderWidth;
                  
                  // Draw outer white circle (border)
                  ctx.fillStyle = '#FFFFFF';
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Draw inner white circle (background)
                  const innerRadius = logoSize / 2 + 4;
                  ctx.fillStyle = '#FFFFFF';
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Draw logo
                  ctx.save();
                  ctx.beginPath();
                  ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
                  ctx.clip();
                  ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
                  ctx.restore();
                  
                  console.log('Logo overlaid successfully:', logoToUse);
                  resolve();
                } catch (err) {
                  console.error('Error drawing logo on QR:', err);
                  resolve(); // Continue even if logo fails
                }
              };
              
              logoImg.onerror = () => {
                console.warn('Failed to load logo for preview:', logoToUse);
                resolve(); // Continue without logo
              };
              
              logoImg.src = logoToUse;
            });
          } catch (error) {
            console.error('Error overlaying logo:', error);
            // Continue without logo
          }
        }

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        setQrPreviewUrl(dataUrl);
      } catch (error) {
        console.error('Error generating QR preview:', error);
        setQrPreviewUrl(null);
      }
    };

    // Small delay to ensure canvas is mounted
    const initTimeout = setTimeout(() => {
      generateQRPreview();
    }, 50);
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
    };
  }, [formData.theaterId, formData.name, formData.qrType, formData.selectedSeats, formData.orientation, formData.logoUrl, formData.logoType, defaultLogoUrl]);

  const qrCodeCount = useMemo(() => {
    if (formData.qrType === 'single') return 1;
    return formData.selectedSeats.length;
  }, [formData.qrType, formData.selectedSeats.length]);

  const hasTheaterLogo = useMemo(() => 
    selectedTheater?.branding?.logoUrl 
    || selectedTheater?.branding?.logo 
    || selectedTheater?.documents?.logo 
    || selectedTheater?.media?.logo 
    || selectedTheater?.logo 
    || selectedTheater?.logoUrl,
    [selectedTheater]
  );

  const seatMapData = useMemo(() => {
    if (allAvailableSeats.length === 0) return [];
    
    const seatMap = [];
    const rowSeatsMap = new Map();
    
    allAvailableSeats.forEach(range => {
      const { startRowCode, endRowCode, startNumber, endNumber } = range;
      
      for (let rowCode = 65; rowCode <= endRowCode; rowCode++) {
        const currentRow = String.fromCharCode(rowCode);
        
        let rowStart, rowEnd;
        
        if (startRowCode === endRowCode) {
          if (rowCode === startRowCode) {
            rowStart = startNumber;
            rowEnd = endNumber;
          } else {
            continue;
          }
        } else {
          if (rowCode === startRowCode) {
            rowStart = startNumber;
            rowEnd = endNumber;
          } else if (rowCode === endRowCode) {
            rowStart = 1;
            rowEnd = endNumber;
          } else {
            rowStart = 1;
            rowEnd = endNumber;
          }
        }
        
        if (!rowSeatsMap.has(currentRow)) {
          rowSeatsMap.set(currentRow, new Set());
        }
        
        const seatSet = rowSeatsMap.get(currentRow);
        for (let i = rowStart; i <= rowEnd; i++) {
          seatSet.add(i);
        }
      }
    });
    
    Array.from(rowSeatsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([row, seatSet]) => {
        const seats = Array.from(seatSet)
          .sort((a, b) => a - b)
          .map(num => `${row}${num}`);
        seatMap.push({ row, seats });
      });
    
    return seatMap;
  }, [allAvailableSeats]);

  // Function to calculate QR codes from seat range
  const calculateQRCodes = useCallback((startSeat, endSeat) => {
    if (!startSeat || !endSeat) return { count: 0, seats: [] };
    
    try {
      // Extract row letter and number from seat IDs
      const startMatch = startSeat.match(/^([A-Z]+)(\d+)$/);
      const endMatch = endSeat.match(/^([A-Z]+)(\d+)$/);
      
      if (!startMatch || !endMatch) return { count: 0, seats: [] };
      
      const [, startRow, startNum] = startMatch;
      const [, endRow, endNum] = endMatch;
      
      // If same row, calculate seats in that row
      if (startRow === endRow) {
        const start = parseInt(startNum);
        const end = parseInt(endNum);
        const count = Math.max(0, end - start + 1);
        const seats = [];
        
        for (let i = start; i <= end; i++) {
          seats.push(`${startRow}${i}`);
        }
        
        return { count, seats };
      }
      
      // If different rows (A1 to B20), calculate across rows
      const startRowCode = startRow.charCodeAt(0);
      const endRowCode = endRow.charCodeAt(0);
      const startNumber = parseInt(startNum);
      const endNumber = parseInt(endNum);
      
      let totalSeats = [];
      
      for (let rowCode = startRowCode; rowCode <= endRowCode; rowCode++) {
        const currentRow = String.fromCharCode(rowCode);
        const start = rowCode === startRowCode ? startNumber : 1;
        const end = rowCode === endRowCode ? endNumber : endNumber;
        
        for (let seatNum = start; seatNum <= end; seatNum++) {
          totalSeats.push(`${currentRow}${seatNum}`);
        }
      }
      
      return { count: totalSeats.length, seats: totalSeats };
    } catch (error) {
      return { count: 0, seats: [] };
    }
  }, []);

  // Generate theater seat map based on all stored ranges - now memoized above as seatMapData
  const generateSeatMap = useCallback(() => seatMapData, [seatMapData]);

  // Handle seat selection
  const handleSeatClick = useCallback((seatId) => {
    setFormData(prev => {
      const isSelected = prev.selectedSeats.includes(seatId);
      const newSelectedSeats = isSelected
        ? prev.selectedSeats.filter(seat => seat !== seatId)
        : [...prev.selectedSeats, seatId];
      
      return {
        ...prev,
        selectedSeats: newSelectedSeats
      };
    });
  }, []);

  // Auto-populate seat range based on selection
  const updateSeatRangeFromSelection = () => {
    const { selectedSeats } = formData;
    if (selectedSeats.length === 0) return;
    
    // Sort seats to find range
    const sortedSeats = [...selectedSeats].sort((a, b) => {
      const [rowA, numA] = [a.match(/[A-Z]+/)[0], parseInt(a.match(/\d+/)[0])];
      const [rowB, numB] = [b.match(/[A-Z]+/)[0], parseInt(b.match(/\d+/)[0])];
      
      if (rowA !== rowB) return rowA.localeCompare(rowB);
      return numA - numB;
    });
    
    setFormData(prev => ({
      ...prev,
      seatStart: sortedSeats[0],
      seatEnd: sortedSeats[sortedSeats.length - 1]
    }));
  };

  const validateForm = useCallback(() => {
    const { theaterId, qrType, name, seatStart, seatEnd, seatClass } = formData;
    
    if (!theaterId) {
      // Removed error modal - validation errors silently fail
      return false;
    }
    
    if (!name.trim()) {
      // Removed error modal - validation errors silently fail
      return false;
    }
    
    if (qrType === 'screen') {
      if (!seatClass) {
        // Removed error modal - validation errors silently fail
        return false;
      }
      
      // Check if seats are selected
      if (!formData.selectedSeats || formData.selectedSeats.length === 0) {
        // Removed error modal - validation errors silently fail
        return false;
      }
      
      if (formData.selectedSeats.length > 100) {
        // Removed error modal - validation errors silently fail
        return false;
      }
    }
    
    return true;
  }, [formData]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    

    if (!validateForm()) {

      return;
    }
    
    try {
      setGenerating(true);
      
      // Set initial progress
      const totalSeats = formData.qrType === 'single' ? 1 : (formData.selectedSeats?.length || 1);
      setGeneratingProgress({ 
        current: 0, 
        total: totalSeats, 
        message: formData.qrType === 'single' ? 'Generating single QR code...' : `Preparing to generate ${totalSeats} QR codes...`
      });
      
      // No simulated progress - we'll only update based on real backend responses
      
      // Get authentication token
      const token = config.helpers.getAuthToken();
      
      if (!token) {
        // Removed error modal - authentication errors silently fail
        setGenerating(false);
        return;
      }
      

      // ✅ FIX: Use different endpoint for single vs screen QR codes
      const endpoint = formData.qrType === 'single' 
        ? '/single-qrcodes'  // New unified endpoint for single QR codes
        : '/single-qrcodes';  // SAME endpoint for screen QR codes (unified collection)
      
      // Prepare request body based on QR type
      let requestBody;
      if (formData.qrType === 'single') {
        // For single QR codes
        requestBody = {
          theaterId: formData.theaterId,
          qrType: 'single',
          qrName: formData.name,
          seatClass: formData.seatClass,
          logoUrl: formData.logoUrl || (formData.logoType === 'default' ? defaultLogoUrl : ''),
        logoType: formData.logoType || 'default',
        orientation: formData.orientation || 'landscape'
        };
      } else {
        // For screen QR codes
        requestBody = {
          theaterId: formData.theaterId,
          qrType: 'screen',
          qrName: formData.name,
          seatClass: formData.seatClass,
          seats: formData.selectedSeats, // Array of seats (A1, A2, B1, etc.)
          logoUrl: formData.logoUrl || (formData.logoType === 'default' ? defaultLogoUrl : ''),
        logoType: formData.logoType || 'default',
        orientation: formData.orientation || 'landscape'
        };
      }
      

      // Update progress for API call
      setGeneratingProgress(prev => ({ 
        ...prev, 
        message: 'Sending request to server...' 
      }));
      
      const response = await fetch(config.helpers.getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      // Update progress for processing response
      setGeneratingProgress(prev => ({ 
        ...prev, 
        message: 'Processing server response...' 
      }));
      

      if (data.success) {

        const count = data.count || (data.data && data.data.count) || totalSeats;
        const message = formData.qrType === 'single' 
          ? 'Single QR code generated and saved successfully!'
          : `${count} screen QR codes generated successfully!`;
        
        // Directly set progress to completion since QR codes are already created
        setGeneratingProgress({
          current: totalSeats,
          total: totalSeats,
          message: 'QR codes generated successfully!'
        });
        
        // Keep the completion visible for 1 second before showing success modal
        setTimeout(() => {
          setGenerating(false);
          
          // Reload QR names to update the dropdown (with delay to ensure DB update)
          if (formData.theaterId) {

            setTimeout(() => {

              loadQRNames(formData.theaterId);
            }, 500); // 500ms delay to ensure database is updated
          }
          
          // Show success and auto-navigate after 2 seconds
          toast.success('Success', message);
          
          // Auto-navigate to QR Management page after 2 seconds
          setTimeout(() => {
            navigate('/qr-management');
          }, 2000);
        }, 1000);
      } else {

        // Removed error modal - errors logged to console only
        setGenerating(false);
      }
    } catch (error) {

      // Removed error modal - errors logged to console only
      setGenerating(false);
    }
  }, [formData, validateForm, navigate, loadQRNames, defaultLogoUrl, toast]);

  // Add button click handler to generate seat map
  const handleGenerateSeatMap = useCallback(() => {
    // For now, allow generating seat map without specific start/end requirements
    // Users can interact with the visual seat map directly
    
    // Generate a default seat map if no specific range is provided
    if (!formData.seatStart && !formData.seatEnd) {
      // Generate default range A1-A20 if no input provided
      setFormData(prev => ({
        ...prev,
        seatStart: 'A1',
        seatEnd: 'A20'
      }));
      // Use setTimeout to wait for state update and call the function again
      setTimeout(() => {
        // Re-read formData from state after update
        const updatedSeatStart = 'A1';
        const updatedSeatEnd = 'A20';
        
        // Validate format
        const startMatch = updatedSeatStart.match(/^([A-Z]+)(\d+)$/);
        const endMatch = updatedSeatEnd.match(/^([A-Z]+)(\d+)$/);
        
        if (!startMatch || !endMatch) {
          return;
        }
        
        const [, startRow, startNum] = startMatch;
        const [, endRow, endNum] = endMatch;
        const startRowCode = startRow.charCodeAt(0);
        const endRowCode = endRow.charCodeAt(0);
        const startNumber = parseInt(startNum);
        const endNumber = parseInt(endNum);
        
        // Add current range to available seats list
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
        
        // Show seat map
        setShowSeatMap(true);
        
        // Auto-select all newly generated seats
        const currentRangeSeats = [];
        for (let rowCode = 65; rowCode <= endRowCode; rowCode++) {
          const currentRow = String.fromCharCode(rowCode);
          
          let rowStart, rowEnd;
          if (startRowCode === endRowCode) {
            if (rowCode === startRowCode) {
              rowStart = startNumber;
              rowEnd = endNumber;
            } else {
              continue;
            }
          } else {
            if (rowCode === startRowCode) {
              rowStart = startNumber;
              rowEnd = endNumber;
            } else if (rowCode === endRowCode) {
              rowStart = 1;
              rowEnd = endNumber;
            } else {
              rowStart = 1;
              rowEnd = endNumber;
            }
          }
          
          for (let i = rowStart; i <= rowEnd; i++) {
            currentRangeSeats.push(`${currentRow}${i}`);
          }
        }
        
        // Add new seats to selected seats (avoid duplicates)
        setFormData(prev => ({
          ...prev,
          seatStart: '',
          seatEnd: '',
          selectedSeats: [...new Set([...prev.selectedSeats, ...currentRangeSeats])]
        }));
      }, 100);
      return;
    }
    
    // Validate format if values are provided
    const startMatch = formData.seatStart.match(/^([A-Z]+)(\d+)$/);
    const endMatch = formData.seatEnd.match(/^([A-Z]+)(\d+)$/);
    
    if (!startMatch || !endMatch) {
      // Removed error modal - validation errors silently fail
      return;
    }
    
    const [, startRow, startNum] = startMatch;
    const [, endRow, endNum] = endMatch;
    const startRowCode = startRow.charCodeAt(0);
    const endRowCode = endRow.charCodeAt(0);
    const startNumber = parseInt(startNum);
    const endNumber = parseInt(endNum);
    
    // Validate that start comes before or equals end
    if (startRowCode > endRowCode || (startRowCode === endRowCode && startNumber > endNumber)) {
      alert('Start seat must come before or equal to end seat');
      return;
    }
    
    // Add current range to available seats list
    const currentRange = {
      startRow,
      endRow,
      startNumber,
      endNumber,
      startRowCode,
      endRowCode
    };
    
    setAllAvailableSeats(prev => {
      // Check if this range already exists
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
    
    // Show seat map
    setShowSeatMap(true);
    
    // Auto-select all newly generated seats
    const currentRangeSeats = [];
    for (let rowCode = 65; rowCode <= endRowCode; rowCode++) { // 65 = 'A'
      const currentRow = String.fromCharCode(rowCode);
      
      let rowStart, rowEnd;
      if (startRowCode === endRowCode) {
        if (rowCode === startRowCode) {
          rowStart = startNumber;
          rowEnd = endNumber;
        } else {
          continue;
        }
      } else {
        if (rowCode === startRowCode) {
          rowStart = startNumber;
          rowEnd = endNumber;
        } else if (rowCode === endRowCode) {
          rowStart = 1;
          rowEnd = endNumber;
        } else {
          rowStart = 1;
          rowEnd = endNumber;
        }
      }
      
      for (let i = rowStart; i <= rowEnd; i++) {
        currentRangeSeats.push(`${currentRow}${i}`);
      }
    }
    
    // Add new seats to selected seats (avoid duplicates)
    setFormData(prev => ({
      ...prev,
      seatStart: '',
      seatEnd: '',
      selectedSeats: [...new Set([...prev.selectedSeats, ...currentRangeSeats])]
    }));
  }, [formData.seatStart, formData.seatEnd]);

  // Delete specific row from seat map
  const handleDeleteRow = useCallback((rowToDelete) => {
    // Remove ranges that contain this row
    setAllAvailableSeats(prev => {
      return prev.filter(range => {
        const { startRowCode, endRowCode } = range;
        const deleteRowCode = rowToDelete.charCodeAt(0);
        // Keep ranges that don't include the row to delete
        return !(deleteRowCode >= startRowCode && deleteRowCode <= endRowCode);
      });
    });
    
    // Remove selected seats from this row
    setFormData(prev => ({
      ...prev,
      selectedSeats: prev.selectedSeats.filter(seat => !seat.startsWith(rowToDelete))
    }));
  }, []);

  const handleReset = useCallback(() => {
    setFormData({
      theaterId: '',
      qrType: '',
      name: '',
      seatStart: '',
      seatEnd: '',
      selectedSeats: [],
      logoType: 'default',
      logoUrl: defaultLogoUrl,
      seatClass: ''
    });
    setShowSeatMap(false); // Hide seat map when resetting
    setAllAvailableSeats([]); // Clear all stored seat ranges
    setQrNames([]); // Clear QR names when resetting
  }, [defaultLogoUrl]);

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Generate QR" currentPage="qr-generate">
        <div className="theater-list-container">
          <div className="theater-main-container">
            <div className="theater-list-header">
              <h1>Generate QR Codes</h1>
            </div>
            <div className="qr-generate-container" style={{ display: 'flex', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
              {/* Left Column - Form */}
              <div className="qr-generate-form-wrapper" style={{ flex: '1', minWidth: '0' }}>
                <form onSubmit={handleSubmit} className="qr-generate-form">
                  <div className="form-section">
                    <h2 className="section-title">Basic Information</h2>
                    <div className="form-grid">
                  {/* Theater Selection */}
                  <div className="form-group">
                    <label htmlFor="theaterId">
                      SELECT THEATER <span className="required">*</span>
                    </label>
                    {theatersLoading ? (
                      <TheaterSelectSkeleton />
                    ) : (
                      <select
                        id="theaterId"
                        name="theaterId"
                        value={formData.theaterId}
                        onChange={handleInputChange}
                        className="form-control"
                        required
                      >
                        <option value="">
                          {theaters.length === 0 ? 'No active theaters found' : 'Select a theater'}
                        </option>
                        {theaters.map(theater => (
                          <option key={theater._id} value={theater._id}>
                            {theater.name}
                            {theater.location?.city && theater.location?.state && 
                              ` - ${theater.location.city}, ${theater.location.state}`
                            }
                          </option>
                        ))}
                      </select>
                    )}
                    {!theatersLoading && theaters.length === 0 && (
                      <p className="form-help-text">
                        No active theaters available. Please add theaters first.
                      </p>
                    )}
                  </div>

                  {/* Logo Selection */}
                  <div className="form-group">
                    <label htmlFor="logoType">
                      LOGO SELECTION <span className="required">*</span>
                    </label>
                    {!formData.theaterId ? (
                      <div className="form-control disabled-dropdown">
                        <span>Please select a theater first</span>
                      </div>
                    ) : (
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
                    )}
                    {formData.logoType === 'default' && !defaultLogoUrl && (
                      <p className="form-help-text">
                        No default logo configured in settings. Please upload a default logo in settings.
                      </p>
                    )}
                    {formData.logoType === 'theater' && formData.theaterId && (
                      (() => {
                        const selectedTheater = theaters.find(t => t._id === formData.theaterId);
                        const hasTheaterLogo = selectedTheater?.logo || selectedTheater?.logoUrl;
                        return !hasTheaterLogo ? (
                          <p className="form-help-text">
                            Selected theater has no logo. Please upload a logo for this theater or use default logo.
                          </p>
                        ) : null;
                      })()
                    )}
                  </div>

                  {/* QR Type Selection */}
                  <div className="form-group">
                    <label htmlFor="qrType">
                      QR CODE TYPE <span className="required">*</span>
                    </label>
                    {!formData.theaterId || !formData.logoType ? (
                      <div className="form-control disabled-dropdown">
                        <span>
                          {!formData.theaterId 
                            ? "Please select a theater first" 
                            : "Please select a logo type first"}
                        </span>
                      </div>
                    ) : (
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
                    )}
                  </div>

                  {/* QR Code Name */}
                  <div className="form-group">
                    <label htmlFor="name">
                      QR CODE NAME <span className="required">*</span>
                    </label>
                    {!formData.theaterId ? (
                      <div className="form-control disabled-dropdown">
                        <span>Please select a theater first</span>
                      </div>
                    ) : qrNamesLoading ? (
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
                    {formData.theaterId && !qrNamesLoading && qrNames.length > 0 && (
                      <p className="form-help-text">
                        ✅ {qrNames.length} QR name(s) available for generation (filtered by singleqrcodes database)
                      </p>
                    )}
                  </div>

                  {/* Seat Class - Show for both canteen and screen types */}
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
                      title={formData.name ? `Seat class auto-populated from selected QR name: ${formData.name}` : "Seat class will be auto-populated when you select a QR name"}
                    />
                  </div>

                  {/* Screen-specific fields */}
                  {formData.qrType === 'screen' && (
                    <>

                      {/* Seat Range and Generate Button - Always visible for multiple ranges */}
                      <div className="seat-range-container form-group-full">
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
                        
                        {/* Generate Seat Map Button */}
                        <div className="form-group">
                          <label>&nbsp;</label>
                          <button 
                            type="button" 
                            className="generate-seat-map-btn"
                            onClick={handleGenerateSeatMap}
                          >
                            {formData.selectedSeats && formData.selectedSeats.length > 0 ? 'Add More Seats' : 'Generate Seat Map'}
                          </button>
                        </div>
                      </div>

           
                    </>
                  )}
                </div>
                
                {/* Theater Seat Map for Screen Type - Show only after clicking Generate Seat Map button */}
                {formData.qrType === 'screen' && showSeatMap && (
                  <div className="seat-map-section">
                    <div className="seat-map-header">
                      <h4>Select Seats</h4>
                      <div className="seat-controls">
                        <button 
                          type="button" 
                          className="btn btn-outline btn-sm"
                          onClick={updateSeatRangeFromSelection}
                        >
                          Apply Selected ({formData.selectedSeats.length})
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-outline btn-sm"
                          onClick={() => setFormData(prev => ({ ...prev, selectedSeats: [] }))}
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    
                    <div className="theater-screen">
                      <div className="screen-label">🎬 SCREEN</div>
                    </div>
                    
                    <div className="seat-map">
                      {generateSeatMap().map(({ row, seats }) => (
                        <div key={row} className="seat-row">
                          <div className="row-label">{row}</div>
                          <div className="seats">
                            {seats.map(seatId => (
                              <button
                                key={seatId}
                                type="button"
                                className={`seat ${formData.selectedSeats.includes(seatId) ? 'selected' : 'available'}`}
                                onClick={() => handleSeatClick(seatId)}
                                title={seatId}
                              >
                                {seatId.replace(/[A-Z]/g, '')}
                              </button>
                            ))}
                          </div>
                          <button 
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteRow(row)}
                            title={`Delete Row ${row}`}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px' }}>
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {formData.selectedSeats.length > 0 && (
                      <div className="selection-info">
                        <p><strong>{formData.selectedSeats.length} seats selected</strong></p>
                        <p className="selected-seats-preview">
                          {formData.selectedSeats.slice(0, 10).join(', ')}
                          {formData.selectedSeats.length > 10 && `... and ${formData.selectedSeats.length - 10} more`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => navigate('/qr-management')} 
                  className="cancel-btn"
                  disabled={generating}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={generating || theatersLoading} 
                  className={`submit-btn ${generating ? 'loading' : ''}`}
                >
                  {generating ? (
                    <>
                      <span className="loading-spinner"></span>
                      Generating...
                    </>
                  ) : (
                    `Generate QR ${formData.qrType === 'screen' ? 'Codes' : 'Code'}`
                  )}
                </button>
              </div>
            </form>
                </div>

                {/* Right Column - QR Preview */}
                <div className="qr-preview-wrapper" style={{ flex: '1', minWidth: '0' }}>
                  <div className="qr-preview-container" style={{ 
                    border: 'none', 
                    borderRadius: '12px', 
                    padding: '24px',
                    background: '#FFFFFF',
                    position: 'sticky',
                    top: '24px'
                  }}>
                    <h3 className="qr-preview-title" style={{ 
                      margin: '0 0 20px 0', 
                      fontSize: '1.5rem', 
                      fontWeight: '600',
                      color: '#1F2937'
                    }}>
                      QR Code Preview
                    </h3>
                    
                    {/* Orientation Toggle */}
                    <div className="qr-orientation-toggle" style={{ 
                      display: 'flex', 
                      gap: '12px', 
                      marginBottom: '24px' 
                    }}>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, orientation: 'landscape' }))}
                        className={`orientation-btn ${formData.orientation === 'landscape' ? 'active' : ''}`}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          border: `2px solid ${formData.orientation === 'landscape' ? '#8B5CF6' : '#E5E7EB'}`,
                          borderRadius: '8px',
                          background: formData.orientation === 'landscape' ? '#8B5CF6' : '#FFFFFF',
                          color: formData.orientation === 'landscape' ? '#FFFFFF' : '#6B7280',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontSize: '0.95rem'
                        }}
                      >
                        Landscape
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, orientation: 'portrait' }))}
                        className={`orientation-btn ${formData.orientation === 'portrait' ? 'active' : ''}`}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          border: `2px solid ${formData.orientation === 'portrait' ? '#8B5CF6' : '#E5E7EB'}`,
                          borderRadius: '8px',
                          background: formData.orientation === 'portrait' ? '#8B5CF6' : '#FFFFFF',
                          color: formData.orientation === 'portrait' ? '#FFFFFF' : '#6B7280',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontSize: '0.95rem'
                        }}
                      >
                        Portrait
                      </button>
                    </div>

                    {/* QR Code Preview Card */}
                    <div className={`qr-preview-card ${formData.orientation}`} style={{
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      padding: formData.orientation === 'landscape' ? '16px' : '20px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      flexDirection: formData.orientation === 'landscape' ? 'row' : 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: formData.orientation === 'landscape' ? '20px' : '16px',
                      minHeight: formData.orientation === 'landscape' ? '200px' : '350px',
                      position: 'relative',
                      overflow: 'hidden',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {/* Left/Top Section - Content with Theater Name */}
                      <div className="qr-preview-content" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: formData.orientation === 'landscape' ? '12px' : '16px',
                        flex: formData.orientation === 'landscape' ? '1' : 'none',
                        minWidth: 0,
                        width: formData.orientation === 'landscape' ? 'auto' : '100%',
                        height: formData.orientation === 'landscape' ? '100%' : 'auto',
                        alignSelf: 'center'
                      }}>
                        {/* Theater Name Display */}
                        {selectedTheater && (
                          <div style={{
                            textAlign: 'center',
                            width: '100%',
                            marginBottom: formData.orientation === 'landscape' ? '8px' : '12px'
                          }}>
                            <h2 style={{
                              fontSize: formData.orientation === 'landscape' ? '1.5rem' : '1.75rem',
                              fontWeight: '700',
                              color: '#000000',
                              margin: '0',
                              lineHeight: '1.2',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              {selectedTheater.name}
                            </h2>
                          </div>
                        )}
                        
                        {/* Food Icons Image */}
                        <div className="qr-food-icons" style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          position: 'relative',
                          minHeight: formData.orientation === 'landscape' ? '100px' : '80px',
                          height: '100%',
                          cursor: 'pointer',
                          transition: 'transform 0.3s ease, opacity 0.3s ease',
                          transform: 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        >
                          <img 
                            ref={imageRef}
                            key={currentImageIndex}
                            src={imageAlternatives[currentImageIndex]} 
                            alt="Scan Order Pay" 
                            style={{
                              maxWidth: formData.orientation === 'landscape' ? '100%' : '100%',
                              width: 'auto',
                              height: 'auto',
                              maxHeight: formData.orientation === 'landscape' ? '140px' : '160px',
                              objectFit: 'contain',
                              display: imageError && currentImageIndex >= imageAlternatives.length - 1 ? 'none' : 'block',
                              margin: 'auto',
                              opacity: imageLoaded ? 1 : 0.5,
                              transition: 'opacity 0.3s ease-in-out',
                              visibility: imageError && currentImageIndex >= imageAlternatives.length - 1 ? 'hidden' : 'visible'
                            }}
                            onError={() => {
                              // Try next alternative
                              if (currentImageIndex < imageAlternatives.length - 1) {
                                const nextIndex = currentImageIndex + 1;
                                console.log('Image failed, trying alternative:', imageAlternatives[nextIndex]);
                                setCurrentImageIndex(nextIndex);
                                setImageError(false);
                                setImageLoaded(false);
                              } else {
                                // All alternatives exhausted
                                console.error('All image alternatives failed. Image not found.');
                                setImageError(true);
                                setImageLoaded(false);
                              }
                            }}
                            onLoad={() => {
                              // Image loaded successfully
                              console.log('Image loaded successfully:', imageAlternatives[currentImageIndex]);
                              setImageLoaded(true);
                              setImageError(false);
                            }}
                            loading="eager"
                          />
                        </div>
                      </div>

                      {/* Right/Bottom Section - QR Code */}
                      <div className="qr-preview-qr" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        flexShrink: 0,
                        alignSelf: 'center'
                      }}>
                        {/* QR Code Display */}
                        <div style={{
                          width: formData.orientation === 'landscape' ? '180px' : '220px',
                          height: formData.orientation === 'landscape' ? '180px' : '220px',
                          borderRadius: '8px',
                          background: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          padding: '12px',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                          cursor: 'pointer',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                          transform: 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                        }}
                        >
                          <canvas
                            ref={qrCanvasRef}
                            style={{
                              width: '100%',
                              height: '100%',
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain',
                              borderRadius: '4px',
                              display: 'block'
                            }}
                          />
                        </div>

                        {/* Theater Info Footer */}
                        {selectedTheater && formData.name && (
                          <div style={{
                            width: '100%',
                            borderTop: '1px solid #E5E7EB',
                            paddingTop: '12px',
                            marginTop: '12px',
                            textAlign: formData.orientation === 'landscape' ? 'center' : 'center',
                            fontSize: '0.875rem',
                            color: '#000000',
                            fontWeight: '500',
                            fontFamily: 'Arial, sans-serif',
                            alignSelf: 'stretch'
                          }}>
                            {selectedTheater.name}
                            {selectedTheater.location?.city && ` - ${selectedTheater.location.city}`}
                            {selectedTheater.location?.area && ` - ${selectedTheater.location.area}`}
                            {formData.qrType === 'screen' && ` - Screen`}
                            {formData.qrType === 'screen' && formData.selectedSeats.length > 0 && ` - ${formData.selectedSeats[0]}`}
                            {formData.qrType === 'screen' && formData.selectedSeats.length === 0 && ' - __'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            
            {/* QR Generation Loading Overlay - Rendered via Portal */}
            {generating && ReactDOM.createPortal(
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
                      <div className="progress-message">{generatingProgress.message}</div>
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
                      {formData.qrType === 'screen' && formData.selectedSeats && (
                        <div className="seats-info">
                          <strong>Selected Seats:</strong> {formData.selectedSeats.join(', ')}
                        </div>
                      )}
                      <div className="theater-info">
                        <strong>Theater:</strong> {theaters.find(t => t._id === formData.theaterId)?.name || 'Unknown'}
                      </div>
                      <div className="class-info">
                        <strong>Seat Class:</strong> {formData.seatClass}
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
            
            {/* Performance Monitoring Display */}
            {(import.meta.env.DEV || import.meta.env.MODE === 'development') && performanceMetrics && (
              <div style={{
                position: 'fixed',
                bottom: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: 1000
              }}>
                QR Generate: {qrCodeCount} codes | 
                Theaters: {theaters.length} | 
                Memory: {performanceMetrics.memoryUsage}MB
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
});

export default QRGenerate;
