import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { useToast } from '../contexts/ToastContext';
import ErrorBoundary from '../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../hooks/usePerformanceMonitoring';
import { clearTheaterCache } from '../utils/cacheManager';
import config from '../config';
import '../styles/AddTheater.css';
import '../styles/TheaterList.css';
import { useDeepMemo, useComputed } from '../utils/ultraPerformance';
import { ultraFetch } from '../utils/ultraFetch';



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
  }
  return null;
};

const setCachedData = (key, data, ttl = 5 * 60 * 1000) => {
  try {
    const expiry = Date.now() + ttl;
    localStorage.setItem(key, JSON.stringify({ data, expiry }));
  } catch (error) {
  }
};

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

// File Upload Skeleton Component
const FileUploadSkeleton = React.memo(() => (
  <div className="file-upload-skeleton" style={{
    height: '120px',
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'loading 1.5s infinite',
    borderRadius: '8px',
    border: '2px dashed #ddd'
  }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      color: '#999'
    }}>
      Loading upload area...
    </div>
  </div>
));

// Memoized header button
const HeaderButton = React.memo(() => {
  const navigate = useNavigate();
  
  return (
    <button 
      type="button" 
      className="add-theater-btn"
      onClick={() => navigate('/theaters')}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '20px', height: '20px'}}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
        </svg>
      </span>
      Back to Theaters
    </button>
  );
});

const AddTheater = React.memo(() => {
  const navigate = useNavigate();
  const toast = useToast();
  const performanceMetrics = usePerformanceMonitoring('AddTheater');
  
  // Refs for performance optimization
  const abortControllerRef = useRef(null);
  const formRef = useRef(null);
  const validationTimeoutRef = useRef(null);
  
  // State management
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    ownerName: '',
    ownerContactNumber: '',
    personalAddress: '',
    agreementStartDate: '',
    agreementEndDate: '',
    facebook: '',
    instagram: '',
    twitter: '',
    youtube: '',
    website: ''
  });

  const [files, setFiles] = useState({
    theaterPhoto: null,
    logo: null,
    aadharCard: null,
    panCard: null,
    gstCertificate: null,
    fssaiCertificate: null,
    agreementCopy: null
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state persistence
  const FORM_STORAGE_KEY = 'addTheater_formData';
  
  // Check authentication on mount
  useEffect(() => {
    const token = config.helpers.getAuthToken();
    if (!token) {

      modal.toast.error(
        'Authentication Required',
        'You must be logged in to add a theater. Please login first.',
        () => navigate('/login')
      );
    }
  }, [modal, navigate]);
  
  // Load saved form data on component mount
  useEffect(() => {
    const savedData = localStorage.getItem(FORM_STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(parsed);
      } catch (error) {
  }
    }
    
    // Cleanup function to cancel any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      clearTheaterCache(); // Clear cache on unmount
    };
  }, []);

  // Save form data to localStorage when it changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(formData));
    }, 1000); // Debounce saves to prevent excessive storage writes

    return () => clearTimeout(timeoutId);
  }, [formData]);

  // Cleanup localStorage on successful submission
  const clearSavedFormData = useCallback(() => {
    localStorage.removeItem(FORM_STORAGE_KEY);
  }, []);

  // Memoized validation rules
  const validationRules = useMemo(() => ({
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\d{10}$/,
    pincode: /^\d{6}$/
  }), []);

  // Memoized form validation status
  const formValidationStatus = useMemo(() => {
    const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'ownerName', 'ownerContactNumber'];
    const hasAllRequired = requiredFields.every(field => formData[field]?.trim());
    const hasErrors = Object.keys(errors).length > 0;
    const hasFiles = Object.values(files).some(file => file !== null);
    
    return {
      isValid: hasAllRequired && !hasErrors,
      completionPercentage: Math.round((requiredFields.filter(field => formData[field]?.trim()).length / requiredFields.length) * 100),
      hasFiles,
      totalErrors: Object.keys(errors).length
    };
  }, [formData, errors, files]);

  // Memoized file upload status
  const uploadStatus = useMemo(() => {
    const totalFiles = Object.keys(files).length;
    const uploadedFiles = Object.values(files).filter(file => file !== null).length;
    const inProgress = Object.values(uploadProgress).some(progress => progress > 0 && progress < 100);
    
    return {
      totalFiles,
      uploadedFiles,
      inProgress,
      percentage: totalFiles > 0 ? Math.round((uploadedFiles / totalFiles) * 100) : 0
    };
  }, [files, uploadProgress]);

  // Optimized input change handler with useCallback
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      if (name.includes('.')) {
        const [parent, child] = name.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      } else {
        return {
          ...prev,
          [name]: value
        };
      }
    });

    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }

    // Debounced validation for real-time feedback
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }
    
    validationTimeoutRef.current = setTimeout(() => {
      validateField(name, value);
    }, 300);
  }, [errors]);

  // Individual field validation for real-time feedback
  const validateField = useCallback((name, value) => {
    let error = '';
    
    switch (name) {
      case 'email':
        if (value && !validationRules.email.test(value)) {
          error = 'Please enter a valid email address';
        }
        break;
      case 'phone':
      case 'ownerContactNumber':
        if (value && !validationRules.phone.test(value)) {
          error = 'Please enter exactly 10 digits';
        }
        break;
      case 'pincode':
        if (value && !validationRules.pincode.test(value)) {
          error = 'Please enter a valid 6-digit pincode';
        }
        break;
      default:
        if (value.trim() === '' && ['name', 'address', 'city', 'state', 'ownerName', 'personalAddress'].includes(name)) {
          error = `${name.charAt(0).toUpperCase() + name.slice(1)} is required`;
        }
    }

    // Always update errors state - set error if validation failed, clear if validation passed
    setErrors(prev => {
      if (error) {
        return {
          ...prev,
          [name]: error
        };
      } else {
        // Remove error if validation passed
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
    });
  }, [validationRules]);

  // Optimized file change handler
  const handleFileChange = useCallback((e) => {
    const { name, files: fileList } = e.target;
    const file = fileList[0];
    

    // File validation
    if (file) {
      const maxSize = 10 * 1024 * 1024; // 10MB (increased for PDFs)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];
      
      if (file.size > maxSize) {
        const errorMsg = 'File size must be less than 10MB';

        setErrors(prev => ({
          ...prev,
          [name]: errorMsg
        }));
        e.target.value = ''; // Reset input
        return;
      }
      
      if (!allowedTypes.includes(file.type)) {
        const errorMsg = 'Only JPEG, PNG, JPG, GIF, WEBP, and PDF files are allowed';

        setErrors(prev => ({
          ...prev,
          [name]: errorMsg
        }));
        e.target.value = ''; // Reset input
        return;
      }
      

      // Clear any previous error for this field
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    setFiles(prev => {
      const updated = {
        ...prev,
        [name]: file
      };

      return updated;
    });
  }, []);

  // Memoized form validation
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    // Required field validation - removed agreementStartDate and agreementEndDate
    const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'ownerName', 'ownerContactNumber', 'personalAddress'];
    
    requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        newErrors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
      }
    });

    // Email validation
    if (formData.email && !validationRules.email.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Phone validation
    if (formData.phone && !validationRules.phone.test(formData.phone)) {
      newErrors.phone = 'Please enter exactly 10 digits';
    }

    if (formData.ownerContactNumber && !validationRules.phone.test(formData.ownerContactNumber)) {
      newErrors.ownerContactNumber = 'Please enter exactly 10 digits';
    }

    // Pincode validation
    if (formData.pincode && !validationRules.pincode.test(formData.pincode)) {
      newErrors.pincode = 'Please enter a valid 6-digit pincode';
    }

    // Date validation
    if (formData.agreementStartDate && formData.agreementEndDate) {
      const startDate = new Date(formData.agreementStartDate);
      const endDate = new Date(formData.agreementEndDate);
      
      if (endDate <= startDate) {
        newErrors.agreementEndDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validationRules]);

  // Memoized form validity check - only consider form field errors, not file upload errors
  const isFormValid = useMemo(() => {
    const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'ownerName', 'ownerContactNumber', 'personalAddress'];
    const hasRequiredFields = requiredFields.every(field => formData[field] && formData[field].trim() !== '');
    
    // Only check for form field errors, not file upload errors
    const formFieldErrors = Object.keys(errors).filter(key => 
      ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'ownerName', 'ownerContactNumber', 'personalAddress', 'agreementStartDate', 'agreementEndDate'].includes(key)
    );
    
    return hasRequiredFields && formFieldErrors.length === 0;
  }, [formData, errors]);

  // Optimized file upload with progress tracking
  const uploadFile = useCallback(async (file, type) => {
    if (!file) return null;

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    uploadFormData.append('type', type);

    // Set up abort controller for this upload
    abortControllerRef.current = new AbortController();

    try {
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));
      
      const response = await fetch(`${config.api.baseUrl}/upload/image`, {
        method: 'POST',
        body: uploadFormData,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${type}`);
      }

      const result = await response.json();
      setUploadProgress(prev => ({ ...prev, [type]: 100 }));
      
      return result.data.data.publicUrl; // Note: nested data structure
    } catch (error) {
      if (error.name === 'AbortError') {
        return null;
      }
      
      setUploadProgress(prev => ({ ...prev, [type]: -1 })); // Error state
      throw error;
    }
  }, []);

  // Optimized form submission
  const handleSubmit = useCallback(async (e) => {
    // CRITICAL: Prevent default form submission behavior
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    if (isSubmitting) {

      return; // Prevent double submission
    }
    

    if (!formValidationStatus.isValid) {
      console.log('🛑 Form validation failed:', {
        formValidationStatus,
        formData,
        errors
      });
      
      // Reset submitting state
      setIsSubmitting(false);
      
      // Show validation error alert
      const requiredFields = ['name', 'address', 'city', 'state', 'pincode', 'phone', 'email', 'ownerName', 'ownerContactNumber'];
      const missingFields = requiredFields.filter(field => !formData[field]?.trim());
      
      const fieldNames = {
        name: 'Theater Name',
        address: 'Address',
        city: 'City',
        state: 'State',
        pincode: 'Pincode',
        phone: 'Phone',
        email: 'Email',
        ownerName: 'Owner Name',
        ownerContactNumber: 'Owner Contact Number'
      };
      
      let errorMessage = 'Please complete the form:\n\n';
      if (missingFields.length > 0) {
        errorMessage += 'Missing required fields:\n' + missingFields.map(field => 
          `• ${fieldNames[field]}`
        ).join('\n');
      }
      
      if (Object.keys(errors).length > 0) {
        errorMessage += '\n\nValidation errors:\n' + Object.entries(errors).map(([field, error]) => 
          `• ${fieldNames[field] || field}: ${error}`
        ).join('\n');
      }
      
      console.error('❌ Validation failed:', errorMessage);
      
      // Reset submitting state in case it was set
      setIsSubmitting(false);
      
      modal.alert({
        title: 'Form Validation Error',
        message: errorMessage,
        type: 'error',
        position: 'toast' // Use toast position for errors
      });
      
      // Scroll to first error field
      const firstErrorField = document.querySelector('.error-field');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      
      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      
      // Create FormData object for multipart/form-data
      const formDataToSend = new FormData();
      
      // Generate unique username with timestamp to avoid conflicts
      const timestamp = Date.now();
      const generatedUsername = formData.username || `${formData.name.toLowerCase().replace(/\s+/g, '_')}_${timestamp}`;
      
      // Add all text fields
      formDataToSend.append('name', formData.name);
      formDataToSend.append('username', generatedUsername);
      formDataToSend.append('password', formData.password || 'theater123'); // Default password
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      

      // Add address fields (backend expects 'address' which maps to 'street')
      formDataToSend.append('address', formData.address); // Backend maps this to address.street
      formDataToSend.append('city', formData.city);
      formDataToSend.append('state', formData.state);
      formDataToSend.append('pincode', formData.pincode);
      
      // Add owner details
      formDataToSend.append('ownerName', formData.ownerName);
      formDataToSend.append('ownerContactNumber', formData.ownerContactNumber);
      if (formData.personalAddress) {
        formDataToSend.append('ownerPersonalAddress', formData.personalAddress);
      }
      
      // Add agreement details
      if (formData.agreementStartDate) {
        formDataToSend.append('agreementStartDate', formData.agreementStartDate);
      }
      if (formData.agreementEndDate) {
        formDataToSend.append('agreementEndDate', formData.agreementEndDate);
      }
      
      // Add social media links
      if (formData.facebook) formDataToSend.append('facebook', formData.facebook);
      if (formData.instagram) formDataToSend.append('instagram', formData.instagram);
      if (formData.twitter) formDataToSend.append('twitter', formData.twitter);
      if (formData.youtube) formDataToSend.append('youtube', formData.youtube);
      if (formData.website) formDataToSend.append('website', formData.website);
      
      // Add files to FormData

      if (files.theaterPhoto) formDataToSend.append('theaterPhoto', files.theaterPhoto);
      if (files.logo) formDataToSend.append('logo', files.logo);
      if (files.aadharCard) formDataToSend.append('aadharCard', files.aadharCard);
      if (files.panCard) formDataToSend.append('panCard', files.panCard);
      if (files.gstCertificate) formDataToSend.append('gstCertificate', files.gstCertificate);
      if (files.fssaiCertificate) formDataToSend.append('fssaiCertificate', files.fssaiCertificate);
      if (files.agreementCopy) formDataToSend.append('agreementCopy', files.agreementCopy);


      // Submit theater data with abort controller and authentication
      abortControllerRef.current = new AbortController();
      const response = await fetch(`${config.api.baseUrl}/theaters`, {
        method: 'POST',
        headers: {
          // Don't set Content-Type - let browser set it with boundary for multipart/form-data
          ...config.helpers.getAuthToken() ? { 'Authorization': `Bearer ${config.helpers.getAuthToken()}` } : {}
        },
        body: formDataToSend,
        signal: abortControllerRef.current.signal
      });


      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle authentication error specifically
        if (response.status === 401 || response.status === 403) {
          const errorMessage = response.status === 401 
            ? 'You must be logged in as Super Admin to add theaters.'
            : 'You do not have permission to add theaters. Super Admin role required.';
          
          await modal.alert({
            title: 'Authentication Required',
            message: errorMessage + '\n\nYou will be redirected to the login page.',
            type: 'error',
            position: 'toast' // Use toast position
          });
          
          navigate('/login');
          throw new Error('Unauthorized - Please login');
        }
        
        throw new Error(errorData.message || errorData.error || 'Failed to create theater');
      }

      const result = await response.json();

      // Clear saved form data on success
      clearSavedFormData();
      
      // Reset form
      setFormData({
        name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        email: '',
        ownerName: '',
        ownerContactNumber: '',
        personalAddress: '',
        agreementStartDate: '',
        agreementEndDate: '',
        facebook: '',
        instagram: '',
        twitter: '',
        youtube: '',
        website: ''
      });
      setFiles({
        theaterPhoto: null,
        logo: null,
        aadharCard: null,
        panCard: null,
        gstCertificate: null,
        fssaiCertificate: null,
        agreementCopy: null
      });
      setErrors({});

      // Show success message using the correct modal function
      if (modal && modal.alert) {
        await modal.alert({
          title: 'Success',
          message: 'Theater added successfully!',
          type: 'success',
          position: 'toast', // Use toast position
          autoClose: true,
          autoCloseDelay: 3000
        });
      }
      
      // Navigate back to theater list

      navigate('/theaters', { replace: true });
  } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      
      modal.alert({
        title: 'Error',
        message: error.message || 'Failed to add theater. Please try again.',
        type: 'error',
        position: 'toast' // Use toast position
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setUploadProgress({});
    }
  }, [formData, files, formValidationStatus, isSubmitting, uploadFile, clearSavedFormData, modal, navigate]);

  const handleCancel = useCallback(() => {
    // Check if form has unsaved changes
    const hasChanges = Object.values(formData).some(value => value !== '') || 
                      Object.values(files).some(file => file !== null);
    
    if (hasChanges) {
      modal.confirm({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        onConfirm: () => {
          clearSavedFormData();
          navigate('/theaters');
        }
      });
    } else {
      navigate('/theaters');
    }
  }, [formData, files, modal, navigate, clearSavedFormData]);

  return (
    <ErrorBoundary>
      <AdminLayout pageTitle="Add New Theater" currentPage="add-theater">
        <div className="theater-list-container">
          <div className="theater-main-container">
            <div className="theater-list-header">
              <h1>Add New Theater</h1>
              <HeaderButton />
            </div>
        <form 
          onSubmit={handleSubmit} 
          className="add-theater-form"
          action="javascript:void(0);"
          method="post"
        >
          {/* Basic Information */}
          <div className="form-section">
            <h2>Basic Information</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="name">Theater Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`form-control ${errors.name ? 'error-field is-invalid' : ''}`}
                  placeholder="Enter theater name"
                  required
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <span 
                    id="name-error" 
                    className="error-message" 
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.name}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="ownerName">Owner Name *</label>
                <input
                  type="text"
                  id="ownerName"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  className={`form-control ${errors.ownerName ? 'error-field is-invalid' : ''}`}
                  placeholder="Enter owner full name"
                  required
                  aria-invalid={errors.ownerName ? 'true' : 'false'}
                  aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                />
                {errors.ownerName && (
                  <span 
                    id="ownerName-error" 
                    className="error-message" 
                    role="alert"
                    aria-live="polite"
                  >
                    {errors.ownerName}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="phone">Theater Phone *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={errors.phone ? 'error' : ''}
                  placeholder="Enter theater phone number (10 digits)"
                  maxLength="10"
                  pattern="[0-9]{10}"
                  required
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="ownerContactNumber">Owner Contact *</label>
                <input
                  type="tel"
                  id="ownerContactNumber"
                  name="ownerContactNumber"
                  value={formData.ownerContactNumber}
                  onChange={handleInputChange}
                  className={errors.ownerContactNumber ? 'error' : ''}
                  placeholder="Enter owner contact number (10 digits)"
                  maxLength="10"
                  pattern="[0-9]{10}"
                  required
                />
                {errors.ownerContactNumber && <span className="error-message">{errors.ownerContactNumber}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={errors.email ? 'error' : ''}
                  placeholder="Enter email address"
                  required
                />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>

              <div className="form-group full-width">
                <label htmlFor="personalAddress">Personal Address *</label>
                <textarea
                  id="personalAddress"
                  name="personalAddress"
                  value={formData.personalAddress}
                  onChange={handleInputChange}
                  className={errors.personalAddress ? 'error' : ''}
                  placeholder="Enter owner's personal address"
                  rows="3"
                  required
                />
                {errors.personalAddress && <span className="error-message">{errors.personalAddress}</span>}
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="form-section">
            <h2>Location Details</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="address">Address *</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className={errors.address ? 'error' : ''}
                  placeholder="Enter complete address"
                  rows="3"
                />
                {errors.address && <span className="error-message">{errors.address}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className={errors.city ? 'error' : ''}
                  placeholder="Enter city"
                />
                {errors.city && <span className="error-message">{errors.city}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="state">State *</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className={errors.state ? 'error' : ''}
                  placeholder="Enter state"
                />
                {errors.state && <span className="error-message">{errors.state}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="pincode">Pincode *</label>
                <input
                  type="text"
                  id="pincode"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleInputChange}
                  className={errors.pincode ? 'error' : ''}
                  placeholder="Enter pincode"
                  required
                />
                {errors.pincode && <span className="error-message">{errors.pincode}</span>}
              </div>
            </div>
          </div>

          {/* Agreement Details */}
          <div className="form-section">
            <h2>Agreement Details</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="agreementStartDate">Agreement Start Date *</label>
                <input
                  type="date"
                  id="agreementStartDate"
                  name="agreementStartDate"
                  value={formData.agreementStartDate}
                  onChange={handleInputChange}
                  className={errors.agreementStartDate ? 'error' : ''}
                  required
                />
                {errors.agreementStartDate && <span className="error-message">{errors.agreementStartDate}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="agreementEndDate">Agreement End Date *</label>
                <input
                  type="date"
                  id="agreementEndDate"
                  name="agreementEndDate"
                  value={formData.agreementEndDate}
                  onChange={handleInputChange}
                  className={errors.agreementEndDate ? 'error' : ''}
                  required
                />
                {errors.agreementEndDate && <span className="error-message">{errors.agreementEndDate}</span>}
              </div>
            </div>
          </div>

          {/* Social Media Accounts */}
          <div className="form-section">
            <h2>Social Media Accounts</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="facebook">Facebook</label>
                <input
                  type="url"
                  id="facebook"
                  name="facebook"
                  value={formData.facebook}
                  onChange={handleInputChange}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>

              <div className="form-group">
                <label htmlFor="instagram">Instagram</label>
                <input
                  type="url"
                  id="instagram"
                  name="instagram"
                  value={formData.instagram}
                  onChange={handleInputChange}
                  placeholder="https://instagram.com/yourpage"
                />
              </div>

              <div className="form-group">
                <label htmlFor="twitter">Twitter</label>
                <input
                  type="url"
                  id="twitter"
                  name="twitter"
                  value={formData.twitter}
                  onChange={handleInputChange}
                  placeholder="https://twitter.com/yourpage"
                />
              </div>

              <div className="form-group">
                <label htmlFor="youtube">YouTube</label>
                <input
                  type="url"
                  id="youtube"
                  name="youtube"
                  value={formData.youtube}
                  onChange={handleInputChange}
                  placeholder="https://youtube.com/yourchannel"
                />
              </div>

              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {/* Photos & Media */}
          <div className="form-section">
            <h2>Photos & Media</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="theaterPhoto">Theater Photo</label>
                <input
                  type="file"
                  id="theaterPhoto"
                  name="theaterPhoto"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="file-input"
                />
                {files.theaterPhoto && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.theaterPhoto.name}
                  </small>
                )}
                {errors.theaterPhoto && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.theaterPhoto}
                  </small>
                )}
                <small>Upload theater main photo (PNG, JPG, JPEG - Max 10MB)</small>
              </div>

              <div className="form-group">
                <label htmlFor="logo">Theater Logo</label>
                <input
                  type="file"
                  id="logo"
                  name="logo"
                  onChange={handleFileChange}
                  accept="image/*"
                  className="file-input"
                />
                {files.logo && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.logo.name}
                  </small>
                )}
                {errors.logo && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.logo}
                  </small>
                )}
                <small>Upload theater logo (PNG, JPG, JPEG - Max 10MB)</small>
              </div>
            </div>
          </div>

          {/* Identity Documents */}
          <div className="form-section">
            <h2>Identity Documents</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="aadharCard">Aadhar Card</label>
                <input
                  type="file"
                  id="aadharCard"
                  name="aadharCard"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="file-input"
                />
                {files.aadharCard && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.aadharCard.name}
                  </small>
                )}
                {errors.aadharCard && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.aadharCard}
                  </small>
                )}
                <small>Upload Aadhar card (PDF or Image - Max 10MB)</small>
              </div>

              <div className="form-group">
                <label htmlFor="panCard">PAN Card</label>
                <input
                  type="file"
                  id="panCard"
                  name="panCard"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="file-input"
                />
                {files.panCard && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.panCard.name}
                  </small>
                )}
                {errors.panCard && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.panCard}
                  </small>
                )}
                <small>Upload PAN card (PDF or Image - Max 10MB)</small>
              </div>
            </div>
          </div>

          {/* Business Documents */}
          <div className="form-section">
            <h2>Business Documents</h2>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="gstCertificate">GST Certificate</label>
                <input
                  type="file"
                  id="gstCertificate"
                  name="gstCertificate"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="file-input"
                />
                {files.gstCertificate && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.gstCertificate.name}
                  </small>
                )}
                {errors.gstCertificate && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.gstCertificate}
                  </small>
                )}
                <small>Upload GST certificate (PDF or Image - Max 10MB)</small>
              </div>

              <div className="form-group">
                <label htmlFor="fssaiCertificate">FSSAI Certificate</label>
                <input
                  type="file"
                  id="fssaiCertificate"
                  name="fssaiCertificate"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="file-input"
                />
                {files.fssaiCertificate && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.fssaiCertificate.name}
                  </small>
                )}
                {errors.fssaiCertificate && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.fssaiCertificate}
                  </small>
                )}
                <small>Upload FSSAI certificate (PDF or Image - Max 10MB)</small>
              </div>

              <div className="form-group">
                <label htmlFor="agreementCopy">Agreement Copy</label>
                <input
                  type="file"
                  id="agreementCopy"
                  name="agreementCopy"
                  onChange={handleFileChange}
                  accept=".pdf,image/*"
                  className="file-input"
                />
                {files.agreementCopy && (
                  <small className="file-selected" style={{color: 'green', display: 'block', marginTop: '5px'}}>
                    ✓ Selected: {files.agreementCopy.name}
                  </small>
                )}
                {errors.agreementCopy && (
                  <small className="error-text" style={{color: 'red', display: 'block', marginTop: '5px'}}>
                    {errors.agreementCopy}
                  </small>
                )}
                <small>Upload agreement copy (PDF or Image - Max 10MB)</small>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleCancel} 
              className="cancel-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className={`submit-btn ${isSubmitting ? 'loading' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <span className="loading-spinner"></span>
                  {Object.keys(uploadProgress).length > 0 ? 'Uploading Files...' : 'Creating Theater...'}
                </>
              ) : (
                'Create Theater'
              )}
            </button>
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="upload-progress-container">
              <h4>Upload Progress</h4>
              {Object.entries(uploadProgress).map(([fileType, progress]) => (
                <div key={fileType} className="progress-item">
                  <span className="progress-label">
                    {fileType.charAt(0).toUpperCase() + fileType.slice(1)}:
                  </span>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${progress === -1 ? 'error' : ''}`}
                      style={{ width: `${Math.max(0, progress)}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {progress === -1 ? 'Error' : `${progress}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </form>
        
        {/* Performance Monitoring Display */}
        {process.env.NODE_ENV === 'development' && performanceMetrics && (
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
            AddTheater: {formValidationStatus.completionPercentage}% complete | 
            Errors: {formValidationStatus.totalErrors} | 
            Files: {uploadStatus.uploadedFiles}/{uploadStatus.totalFiles} | 
            Memory: {performanceMetrics.memoryUsage}MB
          </div>
        )}
          </div>
        </div>
    </AdminLayout>
    </ErrorBoundary>
  );
});

export default AddTheater;
