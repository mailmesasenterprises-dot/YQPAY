import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import PageContainer from '../components/PageContainer';
import { useSettings } from '../contexts/SettingsContext';
import { useModal } from '../contexts/ModalContext';
import AutoUpload from '../components/AutoUpload';
import ErrorBoundary from '../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { clearTheaterCache } from '../utils/cacheManager';
import { FormGroup, FormInput, FormSection, Button } from '../components/GlobalDesignSystem';
import { apiPost, apiGet, apiUpload, getApiUrl } from '../utils/apiHelper';
import config from '../config';
import '../styles/Settings.css';

// Simple cache utilities
const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, expiry } = JSON.parse(cached);
      if (Date.now() < expiry) {
        return data;
      }
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  return null;
};

const setCachedData = (key, data, ttl = 5 * 60 * 1000) => {
  try {
    const expiry = Date.now() + ttl;
    localStorage.setItem(key, JSON.stringify({ data, expiry }));
  } catch (error) {
    console.error('Cache write error:', error);
  }
};

// Connection Status Indicator Component
const ConnectionStatus = React.memo(({ status, testFunction, loading, label }) => (
  <div className="connection-status">
    <span className={`status-indicator ${status}`}>
      {status === 'connected' && '✅'}
      {status === 'disconnected' && '⏸️'}
      {status === 'error' && '❌'}
    </span>
    <span className="status-text">{label}</span>
    <button 
      onClick={testFunction}
      disabled={loading}
      className="test-btn"
    >
      {loading ? 'Testing...' : 'Test'}
    </button>
  </div>
));

// Memoized Tab Button Component
const TabButton = React.memo(({ isActive, onClick, children, icon }) => (
  <button
    className={`tab-btn ${isActive ? 'active' : ''}`}
    onClick={onClick}
    type="button"
  >
    {icon && <span className="tab-icon">{icon}</span>}
    {children}
  </button>
));

// Settings Skeleton Component
const SettingsSkeleton = React.memo(() => (
  <div className="settings-skeleton">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="skeleton-field" style={{
        height: '40px',
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'loading 1.5s infinite',
        borderRadius: '4px',
        marginBottom: '16px'
      }} />
    ))}
  </div>
));

const Settings = React.memo(() => {
  const { generalSettings, updateSettings, updateFavicon } = useSettings();
  const { showAlert, showConfirm, showPrompt, showSuccess, showError, confirmDelete } = useModal();
  const performanceMetrics = usePerformanceMonitoring('Settings');
  const abortControllerRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('firebase');
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  });
  const [dbConfig, setDbConfig] = useState({
    mongoUri: 'mongodb://localhost:27017/theater_canteen_db',
    status: 'disconnected'
  });
  const [gcsConfig, setGcsConfig] = useState({
    projectId: '',
    keyFilename: '',
    bucketName: '',
    region: 'us-central1'
  });
  const [smsConfig, setSmsConfig] = useState({
    provider: 'twilio', // twilio, textlocal, aws-sns, msg91
    // Twilio Config
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    // TextLocal Config
    textlocalApiKey: '',
    textlocalUsername: '',
    textlocalSender: '',
    // AWS SNS Config
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'us-east-1',
    // MSG91 Config
    msg91ApiKey: '',
    msg91SenderId: '',
    msg91Route: '4',
    msg91TemplateId: '',
    msg91TemplateVariable: 'OTP',
    // General Settings
    otpLength: 6,
    otpExpiry: 300, // 5 minutes in seconds
    maxRetries: 3,
    enabled: false,
    // Test Phone Number
    testPhoneNumber: ''
  });
  const [connectionStatus, setConnectionStatus] = useState({
    firebase: 'disconnected',
    mongodb: 'disconnected',
    gcs: 'disconnected',
    sms: 'disconnected'
  });
  const [loading, setLoading] = useState(false);

  // Memoized configuration validation
  const configValidation = useMemo(() => {
    const firebaseValid = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.storageBucket;
    const mongoValid = dbConfig.mongoUri.startsWith('mongodb://') || dbConfig.mongoUri.startsWith('mongodb+srv://');
    const gcsValid = gcsConfig.projectId && gcsConfig.bucketName;
    const smsValid = smsConfig.enabled && (
      (smsConfig.provider === 'twilio' && smsConfig.twilioAccountSid && smsConfig.twilioAuthToken) ||
      (smsConfig.provider === 'textlocal' && smsConfig.textlocalApiKey) ||
      (smsConfig.provider === 'aws-sns' && smsConfig.awsAccessKeyId && smsConfig.awsSecretAccessKey) ||
      (smsConfig.provider === 'msg91' && smsConfig.msg91ApiKey)
    );
    
    return {
      firebase: firebaseValid,
      mongodb: mongoValid,
      gcs: gcsValid,
      sms: smsValid,
      overall: firebaseValid && mongoValid
    };
  }, [firebaseConfig, dbConfig, gcsConfig, smsConfig]);

  // Memoized connection status summary
  const connectionSummary = useMemo(() => {
    const connections = Object.entries(connectionStatus);
    const connected = connections.filter(([_, status]) => status === 'connected').length;
    const total = connections.length;
    const hasErrors = connections.some(([_, status]) => status === 'error');
    
    return {
      connected,
      total,
      percentage: Math.round((connected / total) * 100),
      hasErrors,
      allConnected: connected === total
    };
  }, [connectionStatus]);

  // Memoized tab configuration
  const tabsConfig = useMemo(() => [
    { id: 'firebase', label: 'Firebase', icon: '🔥', valid: configValidation.firebase },
    { id: 'database', label: 'Database', icon: '🗄️', valid: configValidation.mongodb },
    { id: 'storage', label: 'Storage', icon: '☁️', valid: configValidation.gcs },
    { id: 'sms', label: 'SMS', icon: '📱', valid: configValidation.sms },
    { id: 'general', label: 'General', icon: '⚙️', valid: true }
  ], [configValidation]);

  // Test Firebase connection
  const testFirebaseConnection = useCallback(async () => {
    setLoading(true);
    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      const response = await apiPost('/settings/test-firebase', firebaseConfig, {
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      setConnectionStatus(prev => ({
        ...prev,
        firebase: result.success ? 'connected' : 'error'
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Firebase test was aborted');
        return;
      }
      setConnectionStatus(prev => ({
        ...prev,
        firebase: 'error'
      }));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [firebaseConfig]);

  // Test MongoDB connection
  const testMongoConnection = useCallback(async () => {
    setLoading(true);
    try {
      abortControllerRef.current = new AbortController();
      
      const response = await apiPost('/settings/test-mongodb', { uri: dbConfig.mongoUri }, {
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      setConnectionStatus(prev => ({
        ...prev,
        mongodb: result.success ? 'connected' : 'error'
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('MongoDB test was aborted');
        return;
      }
      setConnectionStatus(prev => ({
        ...prev,
        mongodb: 'error'
      }));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [dbConfig.mongoUri]);

  // Test Google Cloud Storage connection
  const testGCSConnection = useCallback(async () => {
    setLoading(true);
    try {
      abortControllerRef.current = new AbortController();
      
      const response = await apiPost('/settings/test-gcs', gcsConfig, {
        signal: abortControllerRef.current.signal
      });
      const result = await response.json();
      
      setConnectionStatus(prev => ({
        ...prev,
        gcs: result.success ? 'connected' : 'error'
      }));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('GCS test was aborted');
        return;
      }
      setConnectionStatus(prev => ({
        ...prev,
        gcs: 'error'
      }));
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [gcsConfig]);

  // Save Google Cloud Storage configuration
  const saveGCSConfig = async () => {
    setLoading(true);
    try {
      const response = await apiPost('/settings/gcs', gcsConfig);
      
      if (response.ok) {
        showSuccess('Google Cloud Storage configuration saved successfully!');
      }
    } catch (error) {
      showError('Error saving Google Cloud Storage configuration');
    } finally {
      setLoading(false);
    }
  };

  // Save Firebase configuration
  const saveFirebaseConfig = async () => {
    setLoading(true);
    try {
      const response = await apiPost('/settings/firebase', firebaseConfig);
      
      if (response.ok) {
        showSuccess('Firebase configuration saved successfully!');
      }
    } catch (error) {
      showError('Error saving Firebase configuration');
    } finally {
      setLoading(false);
    }
  };

  // Load existing configurations
  useEffect(() => {
    const loadConfigurations = async () => {
      try {
        // Check cache first
        const cacheKey = 'settings-configs';
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
          setFirebaseConfig(prev => ({ ...prev, ...cachedData.firebase }));
          setDbConfig(prev => ({ ...prev, ...cachedData.mongodb }));
          setGcsConfig(prev => ({ ...prev, ...cachedData.gcs }));
          setSmsConfig(prev => ({ ...prev, ...cachedData.sms }));
          return;
        }

        // Load Firebase config
        const firebaseResponse = await apiGet('/settings/firebase');
        if (firebaseResponse.ok) {
          const firebaseData = await firebaseResponse.json();
          // Handle API response format: result.data.config
          const config = firebaseData.data?.config || {};
          if (config && Object.keys(config).length > 0) {
            setFirebaseConfig(prevConfig => ({ ...prevConfig, ...config }));
          }
        }

        // Load MongoDB config
        const mongoResponse = await apiGet('/settings/mongodb');
        if (mongoResponse.ok) {
          const mongoData = await mongoResponse.json();
          const config = mongoData.data?.config || {};
          if (config && Object.keys(config).length > 0) {
            setDbConfig(prevConfig => ({ ...prevConfig, ...config }));
          }
        }

        // Load Google Cloud Storage config
        const gcsResponse = await apiGet('/settings/gcs');
        if (gcsResponse.ok) {
          const gcsData = await gcsResponse.json();
          const config = gcsData.data?.config || {};
          if (config && Object.keys(config).length > 0) {
            setGcsConfig(prevConfig => ({ ...prevConfig, ...config }));
          }
        }

        // Load SMS config
        console.log('🔍 Loading SMS configuration...');
        const smsResponse = await apiGet('/settings/sms');
        console.log('📡 SMS Response Status:', smsResponse.status, smsResponse.ok);
        if (smsResponse.ok) {
          const smsData = await smsResponse.json();
          console.log('📦 SMS Raw Response:', smsData);
          const config = smsData.data || {};
          console.log('📋 SMS Config to merge:', config);
          if (config && Object.keys(config).length > 0) {
            console.log('✅ Merging SMS config into state...');
            setSmsConfig(prevConfig => {
              const merged = { ...prevConfig, ...config };
              console.log('🔄 Previous SMS Config:', prevConfig);
              console.log('🆕 Merged SMS Config:', merged);
              return merged;
            });
          } else {
            console.log('⚠️ No SMS config data to merge');
          }
        } else {
          console.log('❌ SMS config request failed:', smsResponse.status);
        }

        // Load General settings
        const generalResponse = await apiGet('/settings/general');
        if (generalResponse.ok) {
          const generalData = await generalResponse.json();
          console.log('📡 General settings API response:', generalData);
          
          // ✅ FIX: Updated response format - data directly without nested config
          const config = generalData.data || {};
          console.log('📋 Parsed general settings:', config);
          
          if (config && Object.keys(config).length > 0) {
            updateSettings(config);
            
            // Update favicon if logo is set
            if (config.logoUrl) {
              // Use simple proxy URL for favicon instead of signed URL
              updateFavicon(getApiUrl('/settings/image/logo'));
            }
            
            // Update browser tab title
            if (config.browserTabTitle) {
              document.title = config.browserTabTitle;
            }
          }
        }
        
        // Cache the loaded data (only after loading all configs)
        // Note: We'll cache this after each individual config is loaded above
        
      } catch (error) {
        console.error('Error loading configurations:', error);
      }
    };

    loadConfigurations();
    
    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearTheaterCache(); // Clear cache on unmount
    };
  }, []);

  const handleFirebaseChange = useCallback((field, value) => {
    setFirebaseConfig(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleGCSChange = useCallback((field, value) => {
    setGcsConfig(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSMSChange = useCallback((field, value) => {
    console.log(`📝 SMS Change - Field: ${field}, Value:`, value);
    setSmsConfig(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      console.log('🔄 Updated SMS Config:', updated);
      return updated;
    });
  }, []);

  // Memoized tab change handler
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  // Test SMS connection by sending actual OTP
  const testSMSConnection = async () => {
    console.log('🧪 Testing SMS Connection by sending OTP...');
    
    if (!smsConfig.testPhoneNumber) {
      showError('Please enter a test phone number first');
      return;
    }
    
    if (smsConfig.testPhoneNumber.length !== 10) {
      showError('Please enter a valid 10-digit mobile number');
      return;
    }
    
    const fullPhoneNumber = '+91' + smsConfig.testPhoneNumber;
    console.log('📤 Sending test OTP to:', fullPhoneNumber);
    setLoading(true);
    
    try {
      // Generate OTP based on configured length
      const otpLength = smsConfig.otpLength || 6;
      const min = Math.pow(10, otpLength - 1);
      const max = Math.pow(10, otpLength) - 1;
      const testOTP = Math.floor(min + Math.random() * (max - min + 1)).toString();
      
      console.log('🔢 Generated OTP:', testOTP, `(${otpLength} digits)`);
      
      const response = await apiPost('/sms/send-test-otp', {
        phoneNumber: fullPhoneNumber,
        otp: testOTP
      });
      
      console.log('📡 Test SMS Response Status:', response.status);
      const result = await response.json();
      console.log('📦 Test SMS Result:', result);
      
      setConnectionStatus(prev => ({
        ...prev,
        sms: result.success ? 'connected' : 'error'
      }));
      
      if (result.success) {
        showSuccess(`✅ OTP sent successfully to ${fullPhoneNumber}! Check your phone for ${otpLength}-digit OTP: ${testOTP}`);
      } else {
        showError(result.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('❌ Test SMS Error:', error);
      setConnectionStatus(prev => ({
        ...prev,
        sms: 'error'
      }));
      showError('Error sending test OTP. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Save SMS configuration  
  const saveSMSConfig = async () => {
    setLoading(true);
    try {
      const response = await apiPost('/settings/sms', smsConfig);

      if (response.ok) {
        showSuccess('SMS configuration saved successfully!');
      } else {
        throw new Error('Failed to save SMS configuration');
      }
    } catch (error) {
      showError('Error saving SMS configuration');
    } finally {
      setLoading(false);
    }
  };  // Send test OTP
  const sendTestOTP = async () => {
    const phoneNumber = await showPrompt('Test OTP', 'Enter phone number to send test OTP (with country code, e.g., +911234567890):', '', 'tel');
    if (!phoneNumber) return;

    setLoading(true);
    try {
      const response = await apiPost('/sms/send-test-otp', { phoneNumber });
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess(`Test OTP sent successfully to ${phoneNumber}. OTP: ${result.otp} (This is shown only in test mode)`);
      } else {
        showError(`Failed to send OTP: ${result.message}`);
      }
    } catch (error) {
      showError('Error sending test OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/ico', 'image/x-icon'];
    if (!validTypes.includes(file.type)) {
      showError('Please upload a valid image file (PNG, JPG, GIF, or ICO)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError('Logo file size should be less than 5MB');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      // Add folder organization parameters for settings/logos
      formData.append('folderType', 'settings');
      formData.append('folderSubtype', 'logos');

      // Try Google Cloud Storage upload first
      console.log('Attempting GCS upload...');
      const response = await apiUpload('/upload/image', formData);
      
      console.log('Upload response status:', response.status);
      console.log('Upload response headers:', response.headers);

      if (response.ok) {
        const result = await response.json();
        console.log('Upload result:', result); // Debug log
        
        // Extract signed URL from nested response structure
        const signedUrl = result.data?.data?.publicUrl || result.data?.publicUrl || result.publicUrl;
        
        if (!signedUrl) {
          console.error('No signed URL found in response:', result);
          throw new Error('Upload successful but no URL returned');
        }
        
        console.log('Extracted signed URL:', signedUrl); // Debug log
        
        // Create a simple favicon URL that points to our image proxy
        const faviconUrl = getApiUrl('/settings/image/logo');
        
        // Update general settings with the signed URL (for storage reference)
        updateSettings({ logoUrl: signedUrl });
        
        // Save the logo URL to the database
        const saveResponse = await apiPost('/settings/general', { ...generalSettings, logoUrl: signedUrl });
        
        console.log('Save response status:', saveResponse.status); // Debug log
        
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error('Save error:', errorText);
          throw new Error('Failed to save logo URL to database: ' + errorText);
        }
        
        console.log('Logo URL saved to database successfully'); // Debug log
        
        // Update favicon immediately with the simple proxy URL
        updateFavicon(faviconUrl);
        
        showSuccess('Logo uploaded successfully to Google Cloud Storage! 🎉');
      } else {
        const errorData = await response.json();
        console.error('GCS Upload failed:', errorData);
        
        // If GCS is not configured, try local upload as fallback
        if (errorData.error === 'GCS_NOT_CONFIGURED') {
          console.log('GCS not configured, attempting local upload fallback...');
          
          try {
            const localResponse = await apiUpload('/upload-local/image', formData);
            
            if (localResponse.ok) {
              const localResult = await localResponse.json();
              console.log('Local upload result:', localResult);
              
              const localUrl = localResult.data?.publicUrl || localResult.data?.url || localResult.publicUrl || localResult.url;
              
              if (localUrl) {
                // Update settings with local URL
                updateSettings({ logoUrl: localUrl });
                
                // Save to database
                const saveResponse = await apiPost('/settings/general', { ...generalSettings, logoUrl: localUrl });
                
                if (!saveResponse.ok) {
                  const errorText = await saveResponse.text();
                  console.error('Save error:', errorText);
                  throw new Error('Failed to save logo URL to database: ' + errorText);
                }
                
                console.log('Local logo URL saved successfully');
                
                // Update favicon with local URL
                updateFavicon(localUrl);
                
                showSuccess('Logo uploaded successfully (using local storage)! 🎉');
                return; // Success, exit function
              } else {
                throw new Error('Local upload successful but no URL returned');
              }
            } else {
              const localErrorData = await localResponse.json();
              throw new Error(localErrorData.message || 'Local upload failed');
            }
          } catch (localError) {
            console.error('Local upload also failed:', localError);
            throw new Error('Both GCS and local upload failed. Please check your configuration.');
          }
        } else {
          throw new Error(errorData.message || 'Failed to upload logo');
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      showError('Error uploading logo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle QR code upload
  const handleQrCodeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      showError('Please upload a valid image file (PNG, JPG, or GIF)');
      return;
    }

    // Validate file size (max 10MB for QR codes)
    if (file.size > 10 * 1024 * 1024) {
      showError('QR code file size should be less than 10MB');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      // Add folder organization parameters for settings/qr-codes
      formData.append('folderType', 'settings');
      formData.append('folderSubtype', 'qr-codes');

      // Use Google Cloud Storage upload endpoint
      const response = await apiUpload('/upload/image', formData);

      if (response.ok) {
        const result = await response.json();
        console.log('QR Upload result:', result); // Debug log
        
        // Extract signed URL from nested response structure
        const signedUrl = result.data?.data?.publicUrl || result.data?.publicUrl || result.publicUrl;
        
        if (!signedUrl) {
          console.error('No signed URL found in QR upload response:', result);
          throw new Error('Upload successful but no URL returned');
        }
        
        console.log('Extracted QR signed URL:', signedUrl); // Debug log
        
        // Update general settings with the signed URL (for storage reference)
        updateSettings({ qrCodeUrl: signedUrl });
        
        // Save the QR code URL to the database
        const saveResponse = await apiPost('/settings/general', 
          { ...generalSettings, qrCodeUrl: signedUrl }
        );
        
        console.log('QR Save response status:', saveResponse.status); // Debug log
        
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.error('QR Save error:', errorText);
          throw new Error('Failed to save QR code URL to database: ' + errorText);
        }
        
        console.log('QR code URL saved to database successfully'); // Debug log
        
        showSuccess('QR code uploaded successfully to Google Cloud Storage! 🎉');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload QR code');
      }
    } catch (error) {
      console.error('Error uploading QR code:', error);
      showError('Error uploading QR code: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = async () => {
    setLoading(true);
    try {
      const response = await apiPost('/settings/general', generalSettings);

      if (response.ok) {
        showSuccess('General settings saved successfully!');
        // Apply settings globally through context
        updateSettings(generalSettings);
        
        // Update favicon if logo is set
        if (generalSettings.logoUrl) {
          updateFavicon(getApiUrl('/settings/image/logo'));
        }
        
        // Update browser tab title
        if (generalSettings.browserTabTitle) {
          document.title = generalSettings.browserTabTitle;
        }
      } else {
        throw new Error('Failed to save general settings');
      }
    } catch (error) {
      console.error('Error saving general settings:', error);
      showError('Error saving general settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetGeneralSettings = async () => {
    const confirmed = await showConfirm(
      'Reset Settings', 
      'Are you sure you want to reset all general settings to their default values? This action cannot be undone.',
      'warning'
    );
    
    if (!confirmed) return;
    
    const defaultSettings = {
      applicationName: 'Theater Canteen System',
      environment: 'development',
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      browserTabTitle: 'YQPayNow - Theater Canteen',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12hour',
      languageRegion: 'en-IN'
    };
    updateSettings(defaultSettings);
    showSuccess('General settings have been reset to default values.');
  };

  const StatusIndicator = ({ status }) => (
    <span className={`status-indicator status-${status}`}>
      {status === 'connected' && '✅ Connected'}
      {status === 'disconnected' && '⚪ Disconnected'}
      {status === 'error' && '❌ Error'}
    </span>
  );

  const tabs = [
    { id: 'firebase', label: 'Firebase Setup', icon: '🔥' },
    { id: 'gcs', label: 'Google Cloud Storage', icon: '☁️' },
    { id: 'sms', label: 'SMS & OTP', icon: '💬' },
    { id: 'database', label: 'Database', icon: '🗄️' },
    { id: 'general', label: 'General', icon: '⚙️' }
  ];

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Settings" currentPage="settings">
        {/* Performance Monitoring - Development Mode */}
        {process.env.NODE_ENV === 'development' && performanceMetrics && (
          <div className="alert alert-info mb-3">
            <small>
              <strong>Performance:</strong> Load: {performanceMetrics.loadTime}ms | 
              Render: {performanceMetrics.renderTime}ms | 
              Memory: {performanceMetrics.memoryUsage}MB
            </small>
          </div>
        )}
        
        <PageContainer
          title="Settings"
        >
          <div className="settings-container">
            {/* Settings Tabs */}
            <div className="settings-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Settings Content */}
            <div className="settings-content">
          {/* Firebase Configuration Tab */}
          {activeTab === 'firebase' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Firebase Configuration</h2>
                <StatusIndicator status={connectionStatus.firebase} />
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="firebase-apiKey" data-required="true">API Key</label>
                  <input
                    id="firebase-apiKey"
                    type="password"
                    value={firebaseConfig.apiKey}
                    onChange={(e) => handleFirebaseChange('apiKey', e.target.value)}
                    placeholder="Your Firebase API Key"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="firebase-authDomain" data-required="true">Auth Domain</label>
                  <input
                    id="firebase-authDomain"
                    type="text"
                    value={firebaseConfig.authDomain}
                    onChange={(e) => handleFirebaseChange('authDomain', e.target.value)}
                    placeholder="your-project.firebaseapp.com"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="firebase-projectId" data-required="true">Project ID</label>
                  <input
                    id="firebase-projectId"
                    type="text"
                    value={firebaseConfig.projectId}
                    onChange={(e) => handleFirebaseChange('projectId', e.target.value)}
                    placeholder="your-project-id"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="firebase-storageBucket" data-required="true">Storage Bucket</label>
                  <input
                    id="firebase-storageBucket"
                    type="text"
                    value={firebaseConfig.storageBucket}
                    onChange={(e) => handleFirebaseChange('storageBucket', e.target.value)}
                    placeholder="your-project.appspot.com"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="firebase-messagingSenderId" data-required="true">Messaging Sender ID</label>
                  <input
                    id="firebase-messagingSenderId"
                    type="text"
                    value={firebaseConfig.messagingSenderId}
                    onChange={(e) => handleFirebaseChange('messagingSenderId', e.target.value)}
                    placeholder="123456789"
                    className="form-control"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="firebase-appId" data-required="true">APP ID</label>
                  <input
                    id="firebase-appId"
                    type="text"
                    value={firebaseConfig.appId}
                    onChange={(e) => handleFirebaseChange('appId', e.target.value)}
                    placeholder="1:123456789:web:abcdef123456"
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="firebase-measurementId">MEASUREMENT ID</label>
                  <input
                    id="firebase-measurementId"
                    type="text"
                    value={firebaseConfig.measurementId}
                    onChange={(e) => handleFirebaseChange('measurementId', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="form-control"
                  />
                  <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Optional - Required only if using Google Analytics
                  </small>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="settings-button secondary"
                  onClick={testFirebaseConnection}
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Connection'}
                </button>
                <button 
                  type="button"
                  className="settings-button primary"
                  onClick={saveFirebaseConfig}
                  disabled={loading}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          )}          {/* Google Cloud Storage Configuration Tab */}
          {activeTab === 'gcs' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Google Cloud Storage Configuration</h2>
                <StatusIndicator status={connectionStatus.gcs} />
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="gcs-projectId" data-required="true">Project ID</label>
                  <input
                    id="gcs-projectId"
                    type="text"
                    value={gcsConfig.projectId}
                    onChange={(e) => handleGCSChange('projectId', e.target.value)}
                    placeholder="your-gcp-project-id"
                    className="form-control"
                  />
                  <small className="help-text">Your Google Cloud Platform Project ID</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="gcs-bucketName" data-required="true">Bucket Name</label>
                  <input
                    id="gcs-bucketName"
                    type="text"
                    value={gcsConfig.bucketName}
                    onChange={(e) => handleGCSChange('bucketName', e.target.value)}
                    placeholder="your-storage-bucket"
                    className="form-control"
                  />
                  <small className="help-text">Cloud Storage bucket for images and videos</small>
                </div>
                
                <div className="form-group">
                  <label htmlFor="gcs-region" data-required="true">Region</label>
                  <select
                    id="gcs-region"
                    value={gcsConfig.region}
                    onChange={(e) => handleGCSChange('region', e.target.value)}
                    className="form-control"
                  >
                    <option value="us-central1">US Central (us-central1)</option>
                    <option value="us-east1">US East (us-east1)</option>
                    <option value="us-west1">US West (us-west1)</option>
                    <option value="europe-west1">Europe West (europe-west1)</option>
                    <option value="asia-south1">Asia South (asia-south1)</option>
                    <option value="asia-southeast1">Asia Southeast (asia-southeast1)</option>
                  </select>
                  <small className="help-text">Choose the closest region to your users</small>
                </div>
                
                <div className="form-group full-width">
                  <label htmlFor="gcs-keyFilename" data-required="true">Service Account Key File Path</label>
                  <input
                    id="gcs-keyFilename"
                    type="text"
                    value={gcsConfig.keyFilename}
                    onChange={(e) => handleGCSChange('keyFilename', e.target.value)}
                    placeholder="/path/to/service-account-key.json"
                    className="form-control"
                  />
                  <small className="help-text">Path to your Google Cloud service account JSON key file</small>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="settings-button secondary"
                  onClick={testGCSConnection}
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Connection'}
                </button>
                <button 
                  type="button"
                  className="settings-button primary"
                  onClick={saveGCSConfig}
                  disabled={loading}
                >
                  Save Configuration
                </button>
              </div>

              <div className="info-section">
                <h4>Storage Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span>Storage Type:</span>
                    <span>Google Cloud Storage</span>
                  </div>
                  <div className="info-item">
                    <span>Current Status:</span>
                    <StatusIndicator status={connectionStatus.gcs} />
                  </div>
                  <div className="info-item">
                    <span>Supported Files:</span>
                    <span>Images (JPG, PNG, GIF), Videos (MP4, AVI, MOV)</span>
                  </div>
                  <div className="info-item">
                    <span>Max File Size:</span>
                    <span>100MB per file</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SMS & OTP Configuration Tab */}
          {activeTab === 'sms' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>SMS & OTP Configuration</h2>
                <StatusIndicator status={connectionStatus.sms} />
              </div>

              {/* SMS Provider Selection */}
              <div className="form-group">
                <label htmlFor="sms-provider" data-required="true">SMS Provider</label>
                <select
                  id="sms-provider"
                  value={smsConfig.provider}
                  onChange={(e) => handleSMSChange('provider', e.target.value)}
                  className="form-control"
                >
                  <option value="twilio">📱 Twilio</option>
                  <option value="textlocal">💬 TextLocal</option>
                  <option value="aws-sns">☁️ AWS SNS</option>
                  <option value="msg91">🇮🇳 MSG91</option>
                </select>
                <small className="help-text">Choose your preferred SMS service provider</small>
              </div>

              {/* Twilio Configuration */}
              {smsConfig.provider === 'twilio' && (
                <div className="provider-config">
                  <h3>Twilio Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="twilio-accountSid" data-required="true">Account SID</label>
                      <input
                        id="twilio-accountSid"
                        type="text"
                        value={smsConfig.twilioAccountSid}
                        onChange={(e) => handleSMSChange('twilioAccountSid', e.target.value)}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="twilio-authToken" data-required="true">Auth Token</label>
                      <input
                        id="twilio-authToken"
                        type="password"
                        value={smsConfig.twilioAuthToken}
                        onChange={(e) => handleSMSChange('twilioAuthToken', e.target.value)}
                        placeholder="Your Twilio Auth Token"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="twilio-phoneNumber" data-required="true">Phone Number</label>
                      <input
                        id="twilio-phoneNumber"
                        type="text"
                        value={smsConfig.twilioPhoneNumber}
                        onChange={(e) => handleSMSChange('twilioPhoneNumber', e.target.value)}
                        placeholder="+1234567890"
                        className="form-control"
                      />
                      <small className="help-text">Your Twilio phone number (with country code)</small>
                    </div>
                  </div>
                </div>
              )}

              {/* TextLocal Configuration */}
              {smsConfig.provider === 'textlocal' && (
                <div className="provider-config">
                  <h3>TextLocal Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="textlocal-apiKey" data-required="true">API Key</label>
                      <input
                        id="textlocal-apiKey"
                        type="password"
                        value={smsConfig.textlocalApiKey}
                        onChange={(e) => handleSMSChange('textlocalApiKey', e.target.value)}
                        placeholder="Your TextLocal API Key"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="textlocal-username" data-required="true">Username</label>
                      <input
                        id="textlocal-username"
                        type="text"
                        value={smsConfig.textlocalUsername}
                        onChange={(e) => handleSMSChange('textlocalUsername', e.target.value)}
                        placeholder="Your TextLocal username"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="textlocal-sender" data-required="true">Sender Name</label>
                      <input
                        id="textlocal-sender"
                        type="text"
                        value={smsConfig.textlocalSender}
                        onChange={(e) => handleSMSChange('textlocalSender', e.target.value)}
                        placeholder="TXTLCL"
                        maxLength="6"
                        className="form-control"
                      />
                      <small className="help-text">6 characters max (alphanumeric)</small>
                    </div>
                  </div>
                </div>
              )}

              {/* AWS SNS Configuration */}
              {smsConfig.provider === 'aws-sns' && (
                <div className="provider-config">
                  <h3>AWS SNS Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="aws-accessKeyId" data-required="true">Access Key ID</label>
                      <input
                        id="aws-accessKeyId"
                        type="text"
                        value={smsConfig.awsAccessKeyId}
                        onChange={(e) => handleSMSChange('awsAccessKeyId', e.target.value)}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="aws-secretAccessKey" data-required="true">Secret Access Key</label>
                      <input
                        id="aws-secretAccessKey"
                        type="password"
                        value={smsConfig.awsSecretAccessKey}
                        onChange={(e) => handleSMSChange('awsSecretAccessKey', e.target.value)}
                        placeholder="Your AWS Secret Access Key"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="aws-region" data-required="true">Region</label>
                      <select
                        id="aws-region"
                        value={smsConfig.awsRegion}
                        onChange={(e) => handleSMSChange('awsRegion', e.target.value)}
                        className="form-control"
                      >
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="us-west-2">US West (Oregon)</option>
                        <option value="eu-west-1">Europe (Ireland)</option>
                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                        <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* MSG91 Configuration */}
              {smsConfig.provider === 'msg91' && (
                <div className="provider-config">
                  <h3>MSG91 Configuration</h3>
                  <div className="form-grid">
                    <div className="form-group">
                      <label htmlFor="msg91-apiKey" data-required="true">API Key</label>
                      <input
                        id="msg91-apiKey"
                        type="password"
                        value={smsConfig.msg91ApiKey || ''}
                        onChange={(e) => handleSMSChange('msg91ApiKey', e.target.value)}
                        placeholder="Your MSG91 API Key"
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="msg91-senderId" data-required="true">Sender ID</label>
                      <input
                        id="msg91-senderId"
                        type="text"
                        value={smsConfig.msg91SenderId || ''}
                        onChange={(e) => handleSMSChange('msg91SenderId', e.target.value)}
                        placeholder="MSGIND"
                        maxLength="6"
                        className="form-control"
                      />
                      <small className="help-text">6 characters max (approved sender ID)</small>
                    </div>
                    <div className="form-group">
                      <label htmlFor="msg91-templateId" data-required="true">Template ID</label>
                      <input
                        id="msg91-templateId"
                        type="text"
                        value={smsConfig.msg91TemplateId || ''}
                        onChange={(e) => handleSMSChange('msg91TemplateId', e.target.value)}
                        placeholder="67f60904d6fc053aa622bdc2"
                        className="form-control"
                      />
                      <small className="help-text">MSG91 approved template ID for OTP messages</small>
                    </div>
                    <div className="form-group">
                      <label htmlFor="msg91-templateVariable" data-required="true">Template Variable</label>
                      <input
                        id="msg91-templateVariable"
                        type="text"
                        value={smsConfig.msg91TemplateVariable || ''}
                        onChange={(e) => handleSMSChange('msg91TemplateVariable', e.target.value)}
                        placeholder="OTP"
                        className="form-control"
                      />
                      <small className="help-text">Variable name used in your MSG91 template</small>
                    </div>
                  </div>
                </div>
              )}

              {/* OTP Settings */}
              <div className="otp-settings">
                <h3>OTP Settings</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="otp-length" data-required="true">OTP Length</label>
                    <select
                      id="otp-length"
                      value={smsConfig.otpLength}
                      onChange={(e) => handleSMSChange('otpLength', parseInt(e.target.value))}
                      className="form-control"
                    >
                      <option value="4">4 digits</option>
                      <option value="6">6 digits</option>
                      <option value="8">8 digits</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="otp-expiry" data-required="true">OTP Expiry (minutes)</label>
                    <select
                      id="otp-expiry"
                      value={smsConfig.otpExpiry}
                      onChange={(e) => handleSMSChange('otpExpiry', parseInt(e.target.value))}
                      className="form-control"
                    >
                      <option value="300">5 minutes</option>
                      <option value="600">10 minutes</option>
                      <option value="900">15 minutes</option>
                      <option value="1800">30 minutes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="max-retries" data-required="true">Max Retry Attempts</label>
                    <select
                      id="max-retries"
                      value={smsConfig.maxRetries}
                      onChange={(e) => handleSMSChange('maxRetries', parseInt(e.target.value))}
                      className="form-control"
                    >
                      <option value="3">3 attempts</option>
                      <option value="5">5 attempts</option>
                      <option value="7">7 attempts</option>
                    </select>
                  </div>
                  <div className="form-group checkbox-group">
                    <label htmlFor="sms-enabled" className="checkbox-label">
                      <input
                        id="sms-enabled"
                        type="checkbox"
                        checked={smsConfig.enabled}
                        onChange={(e) => handleSMSChange('enabled', e.target.checked)}
                        className="checkbox-input"
                      />
                      <span className="checkbox-text">Enable SMS Service</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Test Phone Number */}
              <div className="test-phone-section">
                <h3>Test Configuration</h3>
                <div className="form-group">
                  <label htmlFor="test-phone">Test Phone Number</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      value="+91"
                      disabled
                      style={{ width: '60px', backgroundColor: '#f0f0f0' }}
                      className="form-control"
                    />
                    <input
                      id="test-phone"
                      type="tel"
                      value={smsConfig.testPhoneNumber || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, ''); // Only digits
                        if (value.length <= 10) {
                          handleSMSChange('testPhoneNumber', value);
                        }
                      }}
                      placeholder="9876543210"
                      className="form-control"
                      maxLength="10"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <small className="help-text">Enter 10-digit mobile number (automatically adds +91)</small>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                <button 
                  type="button"
                  className="settings-button secondary" 
                  onClick={testSMSConnection}
                  disabled={loading || !smsConfig.testPhoneNumber || smsConfig.testPhoneNumber.length !== 10}
                >
                  {loading ? 'Testing...' : 'Test Connection'}
                </button>
                <button 
                  type="button"
                  className="settings-button secondary" 
                  onClick={sendTestOTP}
                  disabled={loading || !smsConfig.enabled}
                >
                  {loading ? 'Sending...' : 'Send Test OTP'}
                </button>
                <button 
                  type="button"
                  className="settings-button primary" 
                  onClick={saveSMSConfig}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>

              {/* SMS Information */}
              {/* <div className="sms-info">
                <h4>SMS Service Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span>Current Provider:</span>
                    <span>{smsConfig.provider.toUpperCase()}</span>
                  </div>
                  <div className="info-item">
                    <span>Service Status:</span>
                    <StatusIndicator status={connectionStatus.sms} />
                  </div>
                  <div className="info-item">
                    <span>OTP Length:</span>
                    <span>{smsConfig.otpLength} digits</span>
                  </div>
                  <div className="info-item">
                    <span>OTP Expiry:</span>
                    <span>{Math.floor(smsConfig.otpExpiry / 60)} minutes</span>
                  </div>
                  <div className="info-item">
                    <span>Max Retries:</span>
                    <span>{smsConfig.maxRetries} attempts</span>
                  </div>
                  <div className="info-item">
                    <span>SMS Enabled:</span>
                    <span style={{color: smsConfig.enabled ? '#22c55e' : '#ef4444'}}>
                      {smsConfig.enabled ? '✅ Yes' : '❌ No'}
                    </span>
                  </div>
                </div>
              </div> */}
            </div>
          )}

          {/* Database Configuration Tab */}
          {activeTab === 'database' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>Database Configuration</h2>
                <StatusIndicator status={connectionStatus.mongodb} />
              </div>
              
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="mongo-uri" data-required="true">MongoDB Connection URI</label>
                  <input
                    id="mongo-uri"
                    type="text"
                    value={dbConfig.mongoUri}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, mongoUri: e.target.value }))}
                    placeholder="mongodb://localhost:27017/theater_canteen_db"
                    className="form-control"
                  />
                  <small className="help-text">Enter your MongoDB connection string</small>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="settings-button secondary" 
                  onClick={testMongoConnection}
                  disabled={loading}
                >
                  {loading ? 'Testing...' : 'Test Connection'}
                </button>
                <button 
                  type="button"
                  className="settings-button primary"
                  disabled={loading}
                >
                  Save Configuration
                </button>
              </div>

              <div className="db-info">
                <h4>Database Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span>Database Type:</span>
                    <span>MongoDB</span>
                  </div>
                  <div className="info-item">
                    <span>Current Status:</span>
                    <StatusIndicator status={connectionStatus.mongodb} />
                  </div>
                  <div className="info-item">
                    <span>Collections:</span>
                    <span>theaters, orders, users, qrcodes, admins</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="section-header">
                <h2>General Settings</h2>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="app-name" data-required="true">Application Name</label>
                  <input
                    id="app-name"
                    type="text"
                    value={generalSettings.applicationName}
                    onChange={(e) => updateSettings({ applicationName: e.target.value })}
                    placeholder="Your application name"
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="browser-title" data-required="true">Browser Tab Title</label>
                  <input
                    id="browser-title"
                    type="text"
                    value={generalSettings.browserTabTitle}
                    onChange={(e) => updateSettings({ browserTabTitle: e.target.value })}
                    placeholder="Enter browser tab title"
                    className="form-control"
                  />
                  <small className="help-text">This title appears in the browser tab</small>
                </div>

                <div className="config-item">
                  <label>Application Logo</label>
                  <div className="logo-upload-container">
                    {generalSettings.logoUrl && (
                      <div className="current-logo">
                        <img 
                          src={generalSettings.logoUrl} 
                          alt="Current Logo" 
                          style={{width: '48px', height: '48px', borderRadius: '8px', marginBottom: '10px'}}
                        />
                        <div style={{fontSize: '12px', color: '#666'}}>Current Logo</div>
                      </div>
                    )}
                    <AutoUpload
                      uploadType="logo"
                      label="Choose Logo File"
                      maxSize={20 * 1024 * 1024} // 20MB for logos
                      acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/ico', 'image/x-icon']}
                      onSuccess={async (result) => {
                        console.log('✅ Logo uploaded successfully:', result);
                        const signedUrl = result.signedUrl;
                        
                        // Update local state
                        updateSettings({ logoUrl: signedUrl });
                        
                        try {
                          // Save to database
                          const saveResponse = await apiPost('/settings/general', { 
                            ...generalSettings, 
                            logoUrl: signedUrl 
                          });
                          
                          if (saveResponse.ok) {
                            console.log('✅ Logo URL saved to database');
                            
                            // Update favicon with retry mechanism using full URL
                            const faviconUrl = getApiUrl('/settings/image/logo');
                            setTimeout(() => updateFavicon(faviconUrl), 500);
                            setTimeout(() => updateFavicon(faviconUrl), 1500);
                            setTimeout(() => updateFavicon(faviconUrl), 3000);
                            
                            showSuccess('Logo uploaded and saved successfully! Browser tab icon will update shortly.');
                          } else {
                            throw new Error('Failed to save logo URL to database');
                          }
                        } catch (error) {
                          console.error('❌ Error saving logo URL:', error);
                          showError('Logo uploaded but failed to save to database: ' + error.message);
                        }
                      }}
                      onError={(error) => {
                        console.error('❌ Logo upload failed:', error);
                        showError('Logo upload failed: ' + error);
                      }}
                    />
                    <small style={{color: '#666', fontSize: '12px'}}>
                      Upload a logo to display in the browser tab and application header. 
                      Recommended size: 32x32 or 48x48 pixels. Supports PNG, JPG, ICO formats.
                    </small>
                    {generalSettings.logoUrl && (
                      <button 
                        type="button"
                        onClick={() => {
                          updateFavicon(getApiUrl('/settings/image/logo'));
                          showSuccess('Favicon refresh triggered!');
                        }}
                        style={{
                          marginTop: '10px',
                          padding: '8px 16px',
                          backgroundColor: '#8b5cf6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🔄 Refresh Browser Tab Icon
                      </button>
                    )}
                  </div>
                </div>

                <div className="config-item">
                  <label>QR Code Image</label>
                  <div className="logo-upload-container">
                    {generalSettings.qrCodeUrl && (
                      <div className="current-logo">
                        <img 
                          src={generalSettings.qrCodeUrl} 
                          alt="Current QR Code" 
                          style={{width: '48px', height: '48px', borderRadius: '8px', marginBottom: '10px'}}
                        />
                        <div style={{fontSize: '12px', color: '#666'}}>Current QR Code</div>
                      </div>
                    )}
                    <AutoUpload
                      uploadType="qr-code"
                      label="Choose QR Code File"
                      maxSize={30 * 1024 * 1024} // 30MB for QR codes
                      acceptedTypes={['image/png', 'image/jpeg', 'image/jpg', 'image/gif']}
                      onSuccess={async (result) => {
                        console.log('✅ QR Code uploaded successfully:', result);
                        const signedUrl = result.signedUrl;
                        
                        // Update local state
                        updateSettings({ qrCodeUrl: signedUrl });
                        
                        try {
                          // Save to database
                          const saveResponse = await apiPost('/settings/general', { 
                            ...generalSettings, 
                            qrCodeUrl: signedUrl 
                          });
                          
                          if (saveResponse.ok) {
                            console.log('✅ QR Code URL saved to database');
                            showSuccess('QR Code uploaded and saved successfully!');
                          } else {
                            throw new Error('Failed to save QR code URL to database');
                          }
                        } catch (error) {
                          console.error('❌ Error saving QR code URL:', error);
                          showError('QR Code uploaded but failed to save to database: ' + error.message);
                        }
                      }}
                      onError={(error) => {
                        console.error('❌ QR Code upload failed:', error);
                        showError('QR Code upload failed: ' + error);
                      }}
                    />
                    <small style={{color: '#666', fontSize: '12px'}}>
                      Upload a QR code image for your theater/canteen. This can be used for promotions or scanning.
                      Recommended size: 200x200 or higher. Supports PNG, JPG formats.
                    </small>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="date-format" data-required="true">Date Format</label>
                  <select 
                    id="date-format"
                    value={generalSettings.dateFormat}
                    onChange={(e) => updateSettings({ dateFormat: e.target.value })}
                    className="form-control"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY (31-12-2024)</option>
                    <option value="MM-DD-YYYY">MM-DD-YYYY (12-31-2024)</option>
                    <option value="DD MMM YYYY">DD MMM YYYY (31 Dec 2024)</option>
                    <option value="MMM DD, YYYY">MMM DD, YYYY (Dec 31, 2024)</option>
                  </select>
                  <small className="help-text">Selected format applies throughout the application</small>
                </div>

                <div className="form-group">
                  <label htmlFor="time-format" data-required="true">Time Format</label>
                  <select 
                    id="time-format"
                    value={generalSettings.timeFormat}
                    onChange={(e) => updateSettings({ timeFormat: e.target.value })}
                    className="form-control"
                  >
                    <option value="12hour">12 Hour (02:30 PM)</option>
                    <option value="24hour">24 Hour (14:30)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="environment" data-required="true">Environment</label>
                  <select 
                    id="environment"
                    value={generalSettings.environment}
                    onChange={(e) => updateSettings({ environment: e.target.value })}
                    className="form-control"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="default-currency" data-required="true">Default Currency</label>
                  <select 
                    id="default-currency"
                    value={generalSettings.defaultCurrency}
                    onChange={(e) => updateSettings({ defaultCurrency: e.target.value })}
                    className="form-control"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="timezone" data-required="true">Timezone</label>
                  <select 
                    id="timezone"
                    value={generalSettings.timezone}
                    onChange={(e) => updateSettings({ timezone: e.target.value })}
                    className="form-control"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="language-region" data-required="true">Language & Region</label>
                  <select 
                    id="language-region"
                    value={generalSettings.languageRegion}
                    onChange={(e) => updateSettings({ languageRegion: e.target.value })}
                    className="form-control"
                  >
                    <option value="en-IN">English (India)</option>
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (United Kingdom)</option>
                    <option value="hi-IN">Hindi (India)</option>
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="settings-button primary"
                  onClick={handleSaveGeneralSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save General Settings'}
                </button>
                <button 
                  type="button"
                  className="settings-button secondary"
                  onClick={handleResetGeneralSettings}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </PageContainer>

      <style jsx>{`
        .settings-container {
          max-width: 100%;
          margin: 0;
          background: transparent;
          border-radius: 0;
          box-shadow: none;
          overflow: hidden;
          display: flex;
          min-height: 600px;
          height: 100%;
        }

        .settings-tabs {
          display: flex;
          flex-direction: column;
          background: #f8f8f5;
          border-right: 1px solid #e5e5e0;
          width: 280px;
          min-width: 280px;
          height: 100%;
          min-height: 100%;
        }

        .settings-tab {
          padding: 20px 24px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }

        .settings-tab:hover {
          background: #f0f0ed;
          color: #374151;
          transition: all 0.2s ease;
        }

        .settings-tab.active {
          background: #fafaf8;
          color: #6B0E9B;
          border-right: 3px solid #6B0E9B;
          font-weight: 600;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
        }

        .settings-tab.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: #6B0E9B;
        }

        .tab-icon {
          font-size: 18px;
          min-width: 20px;
        }

        .settings-content {
          flex: 1;
          padding: 32px;
          background: transparent;
          height: 100%;
          min-height: 100%;
        }

        .settings-section {
          max-width: 800px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }

        .section-header h3 {
          margin: 0;
          color: #1e293b;
          font-size: 20px;
          font-weight: 600;
        }

        .status-indicator {
          font-size: 14px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .status-connected {
          background: #dcfce7;
          color: #166534;
        }

        .status-disconnected {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-error {
          background: #fef2f2;
          color: #dc2626;
        }

        .config-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .config-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .config-item.full-width {
          grid-column: 1 / -1;
        }

        .config-item label {
          font-weight: 500;
          color: #374151;
          font-size: 14px;
        }

        .config-item input,
        .config-item select {
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .config-item input:focus,
        .config-item select:focus {
          outline: none;
          border-color: #6B0E9B;
          box-shadow: 0 0 0 3px rgba(107, 14, 155, 0.1);
        }

        .config-item small {
          color: #6b7280;
          font-size: 12px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary {
          background: #6B0E9B;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #5A0C82;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #6B0E9B;
          border: 1px solid #6B0E9B;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #6B0E9B;
          color: white;
        }

        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .db-info {
          margin-top: 32px;
          padding: 20px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .db-info h4 {
          margin: 0 0 16px 0;
          color: #1e293b;
          font-size: 16px;
          font-weight: 600;
        }

        .gcs-info {
          margin-top: 32px;
          padding: 20px;
          background: #f0f9ff;
          border-radius: 8px;
          border-left: 4px solid #0ea5e9;
        }

        .gcs-info h4 {
          margin: 0 0 16px 0;
          color: #1e293b;
          font-size: 16px;
          font-weight: 600;
        }

        .info-grid {
          display: grid;
          gap: 12px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-item span:first-child {
          font-weight: 500;
          color: #374151;
        }

        .info-item span:last-child {
          color: #6b7280;
        }

        /* SMS Configuration Specific Styles */
        .config-group {
          margin-bottom: 32px;
          padding: 24px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .config-group h4 {
          margin: 0 0 16px 0;
          color: #1e293b;
          font-size: 16px;
          font-weight: 600;
        }

        .provider-dropdown {
          margin-bottom: 16px;
        }

        .provider-select {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          font-size: 14px;
          font-weight: 500;
          color: #1e293b;
          cursor: pointer;
          transition: all 0.2s;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
          padding-right: 40px;
        }

        .provider-select:focus {
          outline: none;
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }

        .provider-select:hover {
          border-color: #8b5cf6;
        }

        .provider-dropdown small {
          display: block;
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
        }

        .provider-name {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          margin: 0;
          width: 18px;
          height: 18px;
        }

        .sms-info {
          margin-top: 32px;
          padding: 24px;
          background: linear-gradient(135deg, #8b5cf6, #a855f7);
          border-radius: 12px;
          color: white;
        }

        .sms-info h4 {
          margin: 0 0 16px 0;
          color: white;
          font-size: 16px;
          font-weight: 600;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-size: 14px;
        }

        .info-item span:first-child {
          opacity: 0.9;
          font-weight: 500;
        }

        .info-item span:last-child {
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .settings-container {
            flex-direction: column;
            min-height: auto;
          }

          .settings-tabs {
            flex-direction: row;
            width: 100%;
            min-width: 100%;
            border-right: none;
            border-bottom: 1px solid #e2e8f0;
            overflow-x: auto;
          }

          .settings-tab {
            min-width: 140px;
            padding: 16px 20px;
            border-bottom: none;
            border-right: 1px solid #e2e8f0;
            justify-content: center;
          }

          .settings-tab.active {
            border-right: 1px solid #e2e8f0;
            border-bottom: 3px solid #6B0E9B;
          }

          .settings-tab.active::before {
            display: none;
          }

          .config-grid {
            grid-template-columns: 1fr;
          }

          .settings-content {
            padding: 20px;
          }

          .action-buttons {
            flex-direction: column;
          }

          .tab-icon {
            font-size: 16px;
          }
        }
      `}</style>
    </AdminLayout>
    </ErrorBoundary>
  );
});

export default Settings;
