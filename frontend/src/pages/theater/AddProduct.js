import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TheaterLayout from '../../components/theater/TheaterLayout';
import PageContainer from '../../components/PageContainer';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import config from '../../config';
import '../../styles/AddTheater.css'; // Keep original form styling only

// Simple cache utilities (identical to AddTheater)
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

// Simple debounce utility (identical to AddTheater)
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

// File Upload Skeleton Component (identical to AddTheater)
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
const HeaderButton = React.memo(({ theaterId }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className="header-btn"
      onClick={() => navigate(`/theater-dashboard/${theaterId}`)}
    >
      <span className="btn-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      </span>
      Back to Dashboard
    </button>
  );
});

const AddProduct = React.memo(() => {
  // 🔥🔥🔥 SIMPLE TEST - IF YOU DON'T SEE THIS, FILE NOT LOADING 🔥🔥🔥

  const { theaterId: urlTheaterId } = useParams();
  const { theaterId: authTheaterId, userType, user, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const modal = useModal();
  const performanceMetrics = usePerformanceMonitoring('AddProduct');

  // Determine effective theater ID from authentication (following TheaterSettings pattern)
  let effectiveTheaterId = urlTheaterId || authTheaterId;
  
  // If still no theater ID, try to extract from user data
  if (!effectiveTheaterId && user) {
    if (user.assignedTheater) {
      effectiveTheaterId = user.assignedTheater._id || user.assignedTheater;
  } else if (user.theater) {
      effectiveTheaterId = user.theater._id || user.theater;
  }
  }
  

  const theaterId = effectiveTheaterId;


  //   urlTheaterId, 
  //   authTheaterId, 
  //   finalTheaterId: theaterId,
  //   userType,
  //   userTheater: user?.theater?._id || user?.assignedTheater?._id,
  //   userObject: user ? {
  //     theater: user.theater,
  //     assignedTheater: user.assignedTheater,
  //     id: user.id
  //   } : null
  // });

  // Redirect to correct URL if theater ID mismatch
  useEffect(() => {
    if (theaterId && urlTheaterId && theaterId !== urlTheaterId) {
      navigate(`/theater-add-product/${theaterId}`, { replace: true });
    }
  }, [theaterId, urlTheaterId, navigate]);

  // Refs for performance optimization
  const abortControllerRef = useRef(null);
  const formRef = useRef(null);
  const validationTimeoutRef = useRef(null);

  // State management - simplified to match backend
  const [formData, setFormData] = useState({
    // Basic Information
    name: '',
    category: '',
    kioskType: '',
    quantity: '',
    description: '',
    productCode: '',

    // Pricing Information
    sellingPrice: '',
    costPrice: '',
    discount: '',
    taxRate: '',
    gstType: '',

    // Inventory Management
    lowStockAlert: '',

    // Food Information
    isVeg: '',
    preparationTime: '',
    ingredients: ''
  });

  const [files, setFiles] = useState({
    productImage: null
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Product Names dropdown state
  const [productNames, setProductNames] = useState([]);
  const [loadingProductNames, setLoadingProductNames] = useState(false);

  // Categories dropdown state
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Kiosk Types dropdown state
  const [kioskTypes, setKioskTypes] = useState([]);
  const [loadingKioskTypes, setLoadingKioskTypes] = useState(false);

  // Existing products state - to filter dropdown
  const [existingProducts, setExistingProducts] = useState([]);

  // Data refresh status
  const [refreshStatus, setRefreshStatus] = useState('');

  // Product Code field state - disabled by default until product is selected
  const [isProductCodeDisabled, setIsProductCodeDisabled] = useState(true);
  
  // Quantity field state - disabled by default until product is selected
  const [isQuantityDisabled, setIsQuantityDisabled] = useState(true);

  // Product Image state management - for auto-filled images from ProductType
  const [productImage, setProductImage] = useState('');
  const [isImageFromProductType, setIsImageFromProductType] = useState(false);

  // Debug effect to track quantity state changes
  useEffect(() => {
  }, [isQuantityDisabled, formData.quantity]);

  // Professional Modal States - Following Delete Modal Pattern
  const [validationModal, setValidationModal] = useState({ show: false, message: '' });
  const [unsavedChangesModal, setUnsavedChangesModal] = useState({ show: false });
  const [successModal, setSuccessModal] = useState({ show: false, message: '' });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  // Debug effect to track what's happening (moved after state declarations)
  useEffect(() => {
   
    // If no theater ID and user is present, force logout and redirect to login
    if (user && !theaterId) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }
  }, [theaterId, authTheaterId, urlTheaterId, user]);

  // Load initial data on component mount
  useEffect(() => {
    // SIMPLIFIED: Just check if we have theater ID and try to load
    if (!theaterId) {
      return;
    }



    // Clear any existing form data from localStorage (cleanup)
    const formKey = `addProduct_formData_${theaterId}`;
    localStorage.removeItem(formKey);

    // FIXED: Clear cached ProductTypes data to always get fresh data
    const productTypesKey = `productTypes_${theaterId}`;
    localStorage.removeItem(productTypesKey);
    
    // Clear categories cache too
    const categoriesKey = `categories_${theaterId}`;
    localStorage.removeItem(categoriesKey);

    // Clear any existing errors on mount
    setErrors({});

    // Load data sequentially: existing products first, then product names and categories
    const loadInitialData = async () => {
      try {
        // Step 1: Load existing products first and get the array
        const existingProductsArray = await loadExistingProducts();

        // Step 2: Load product names with the existing products array for filtering
        await loadProductNames(existingProductsArray);
        
        // Step 3: Load categories and kiosk types in parallel (doesn't depend on filtering)
        loadCategories();
        loadKioskTypes();
      } catch (error) {
  }
    };
    
    loadInitialData();

    // Cleanup function to cancel any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [theaterId]); // Simplified dependencies - only need theaterId

  // Function to load existing products (to filter dropdown)
  const loadExistingProducts = useCallback(async () => {
    if (!theaterId) return [];


    try {
      const timestamp = Date.now();
      const response = await fetch(config.helpers.getApiUrl(`/theater-products/${theaterId}?limit=100&_t=${timestamp}`));

      if (!response.ok) {

        return [];
      }

      const data = await response.json();

      if (data.success && data.data?.products) {
        const products = data.data.products;
        setExistingProducts(products);

        products.forEach((p, index) => {
  });
        return products; // Return the products array
      }

      return [];
    } catch (error) {

      return [];
    }
  }, [theaterId]);

  // Function to load active product names for dropdown (ALWAYS FRESH DATA)
  const loadProductNames = useCallback(async (existingProductsArray = null) => {

    if (!theaterId) return;


    setLoadingProductNames(true);

    try {
      const timestamp = Date.now();
      // FIXED: Use correct endpoint directly - no test-bypass needed
      const response = await fetch(config.helpers.getApiUrl(`/theater-product-types/${theaterId}?_t=${timestamp}`));

      if (!response.ok) {

        throw new Error(`Failed to fetch product names: ${response.status}`);
      }

      const data = await response.json();
      

      // FIXED: Backend returns data directly as array, not data.data.productTypes
      if (data.success && data.data) {

        data.data.forEach((pt, index) => {
  });
        
        let activeProductNames = data.data
          .filter(type => type.isActive && type.productName && type.productName.trim())
          .map(type => ({
            id: type._id,
            name: type.productName.trim(),
            code: type.productCode || '',
            quantity: type.quantity || '',
            imageUrl: type.image || '' // FIXED: backend uses 'image' not 'imageUrl'
          }));
        
        // Filter out product names that are already added
        // SIMPLE RULE: If a product with the same name and code exists, don't show it in dropdown
        const productsToCheck = existingProductsArray || existingProducts;

        productsToCheck.forEach((p, index) => {
  });
        

        activeProductNames = activeProductNames.filter(productType => {

          // Check if this ProductType already exists in the product list
          const isAlreadyAdded = productsToCheck.some(existingProduct => {
            // Case-insensitive comparison for name and code
            const nameMatch = existingProduct.name.toLowerCase().trim() === productType.name.toLowerCase().trim();
            const codeMatch = (existingProduct.sku || '').toLowerCase().trim() === (productType.code || '').toLowerCase().trim();
            

            // Product exists if BOTH name AND code match
            const isDuplicate = nameMatch && codeMatch;
            
            if (isDuplicate) {
  }
            
            return isDuplicate;
          });
          
          if (isAlreadyAdded) {
  } else {
  }
          
          return !isAlreadyAdded;
        });
        

        // Expose to window for debugging
        window.productNamesDebug = activeProductNames;
        
        setProductNames(activeProductNames);
      } else {
        setProductNames([]);
      }
    } catch (error) {
      setProductNames([]);
    } finally {
      setLoadingProductNames(false);
    }
  }, [theaterId, existingProducts]);

  // Function to load active categories for dropdown (ALWAYS FRESH DATA)
  const loadCategories = useCallback(async () => {
    if (!theaterId) return;

    setLoadingCategories(true);

    try {
      const timestamp = Date.now();
      // FIXED: Use correct endpoint directly - no bypass needed
      const response = await fetch(config.helpers.getApiUrl(`/theater-categories/${theaterId}?limit=100&_t=${timestamp}`));

      if (!response.ok) {

        throw new Error(`Failed to fetch categories: ${response.status}`);
      }

      const data = await response.json();
      

      // FIXED: Backend returns data.categories (nested structure)
      if (data.success && data.data?.categories) {
        const activeCategories = data.data.categories
          .filter(category => category.categoryName && category.categoryName.trim())
          .map(category => ({
            id: category._id,
            name: category.categoryName.trim(), // FIXED: backend uses 'categoryName' not 'name'
            description: category.description || ''
          }));
        
        setCategories(activeCategories);
      } else {
        setCategories([]);
      }
    } catch (error) {
      setCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  }, [theaterId]);

  // Function to load active kiosk types for dropdown
  const loadKioskTypes = useCallback(async () => {
    if (!theaterId) return;

    setLoadingKioskTypes(true);

    try {
      const timestamp = Date.now();
      const response = await fetch(config.helpers.getApiUrl(`/theater-kiosk-types/${theaterId}?limit=100&_t=${timestamp}`));

      if (!response.ok) {
        throw new Error(`Failed to fetch kiosk types: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.kioskTypes) {
        const activeKioskTypes = data.data.kioskTypes
          .filter(kt => kt.isActive && kt.name && kt.name.trim())
          .map(kt => ({
            id: kt._id,
            name: kt.name.trim()
          }));
        
        setKioskTypes(activeKioskTypes);
      } else {
        setKioskTypes([]);
      }
    } catch (error) {
      setKioskTypes([]);
    } finally {
      setLoadingKioskTypes(false);
    }
  }, [theaterId]);

  // Memoized validation rules
  const validationRules = useMemo(() => ({
    name: /^.{2,100}$/,
    sellingPrice: /^\d+(\.\d{1,2})?$/,
    stockQuantity: /^\d+$/,
    productCode: /^[A-Za-z0-9_-]*$/
  }), []);

  // Enhanced form validation status
  const formValidationStatus = useMemo(() => {
    const requiredFields = ['name', 'sellingPrice', 'isVeg'];
    
    // Check each required field more thoroughly
    const fieldValidation = requiredFields.map(field => {
      const value = formData[field];
      let isValid = false;
      let isEmpty = false;
      
      if (value === undefined || value === null || value === '') {
        isEmpty = true;
      } else {
        // Additional validation for specific fields
        switch (field) {
          case 'name':
            // Must be selected from dropdown and exist in productNames
            isValid = productNames.some(product => product.name === value);
            break;
          case 'sellingPrice':
            // Must be a valid price
            isValid = validationRules.sellingPrice.test(value) && parseFloat(value) > 0;
            break;
          case 'isVeg':
            // Must be true or false
            isValid = value === 'true' || value === 'false' || value === true || value === false;
            break;
          default:
            isValid = true;
        }
      }
      
      return { field, value, isValid, isEmpty };
    });
    
    const hasAllRequired = fieldValidation.every(f => !f.isEmpty && f.isValid);
    const actualErrorCount = Object.keys(errors).filter(key => errors[key] && errors[key].trim()).length;
    const validFieldsCount = fieldValidation.filter(f => !f.isEmpty && f.isValid).length;

    // Show detailed field status for debugging

    return {
      isValid: hasAllRequired && actualErrorCount === 0,
      completionPercentage: Math.round((validFieldsCount / requiredFields.length) * 100),
      hasFiles: Object.values(files).some(file => file !== null),
      totalErrors: actualErrorCount,
      fieldStatus: fieldValidation.reduce((acc, f) => {
        acc[f.field] = { isValid: f.isValid, isEmpty: f.isEmpty };
        return acc;
      }, {})
    };
  }, [formData, errors, files, productNames, validationRules]);

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
    const { name, value, type, checked } = e.target;

    let newFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    };

    // AUTO-POPULATE PRODUCT CODE AND QUANTITY when product name is selected
    if (name === 'name' && value) {
      
      // Find the selected product in productNames array
      const selectedProduct = productNames.find(product => product.name === value);
      
      if (selectedProduct) {
        // Handle Product Code auto-fill
        if (selectedProduct.code) {
          newFormData.productCode = selectedProduct.code;
          setIsProductCodeDisabled(true);
        } else {
          newFormData.productCode = '';
          setIsProductCodeDisabled(false);
        }
        
        // Handle Quantity - Auto-fill from template (user can modify)
        if (selectedProduct.quantity) {
          newFormData.quantity = selectedProduct.quantity;
          setIsQuantityDisabled(false); // Keep enabled so user can change
        } else {
          newFormData.quantity = '';
          setIsQuantityDisabled(false);
        }
        
        // Handle Product Image auto-fill
        if (selectedProduct.imageUrl) {
          setProductImage(selectedProduct.imageUrl);
          setIsImageFromProductType(true);
        } else {
          setProductImage('');
          setIsImageFromProductType(false);
        }
        

        
        // Clear any existing errors for auto-filled fields
        if (errors.productCode || errors.quantity) {
          setErrors(prev => {
            const newErrors = { ...prev };
            if (selectedProduct.code) delete newErrors.productCode;
            if (selectedProduct.quantity) delete newErrors.quantity;
            return newErrors;
          });
        }
      } else {
        // No matching product - enable both fields for manual entry and reset image
        newFormData.productCode = '';
        newFormData.quantity = '';
        setIsProductCodeDisabled(false);
        setIsQuantityDisabled(false);
        setProductImage('');
        setIsImageFromProductType(false);
      }
    } else if (name === 'name' && !value) {
      // If product name is cleared, disable both fields and clear them, reset image
      setIsProductCodeDisabled(true);
      setIsQuantityDisabled(true);
      newFormData.productCode = '';
      newFormData.quantity = '';
      setProductImage('');
      setIsImageFromProductType(false);
    }

    setFormData(newFormData);

    // Debug functions for testing (expose to window)
    window.testQuantityAutoFill = (testProductName) => {
      
      const testProduct = productNames.find(p => p.name === testProductName);
      
      if (testProduct) {
        // Manually trigger the auto-fill logic
        const mockEvent = {
          target: { name: 'name', value: testProductName, type: 'text' }
        };

        handleInputChange(mockEvent);
      }
    };

    window.inspectCurrentState = () => {
  };

    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Debounced validation for real-time feedback
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      validateField(name, type === 'checkbox' ? checked : value);
    }, 300);
  }, [errors, formData, productNames]);

  // Enhanced field validation with better error messages
  const validateField = useCallback((name, value) => {
    let error = '';

    switch (name) {
      case 'name':
        if (!value || value.trim() === '') {
          error = 'Please select a product name from the dropdown';
        } else if (value.trim().length < 2) {
          error = 'Product name must be at least 2 characters long';
        } else {
          // Check if the selected product name exists in available options
          const validOption = productNames.find(product => product.name === value);
          if (!validOption) {
            error = 'Please select a valid product name from the dropdown list';
          }
        }
        break;
      case 'sellingPrice':
        if (!value || value.trim() === '') {
          error = 'Selling price is required';
        } else if (!validationRules.sellingPrice.test(value)) {
          error = 'Please enter a valid selling price (numbers and up to 2 decimal places)';
        } else if (parseFloat(value) <= 0) {
          error = 'Selling price must be greater than 0';
        }
        break;
      case 'stockQuantity':
        if (value !== '' && !validationRules.stockQuantity.test(value)) {
          error = 'Stock quantity must be a whole number';
        } else if (value !== '' && parseInt(value) < 0) {
          error = 'Stock quantity cannot be negative';
        }
        break;
      case 'productCode':
        if (value && !validationRules.productCode.test(value)) {
          error = 'Product code can only contain letters, numbers, hyphens and underscores';
        }
        break;
      case 'isVeg':
        if (value === '' || value === undefined || value === null) {
          error = 'Please select if the product is vegetarian or non-vegetarian';
        }
        break;
      case 'category':
        // Category is optional, but if provided, validate it exists
        if (value && value.trim() !== '') {
          const validCategory = categories.find(cat => cat.name === value);
          if (!validCategory) {
            error = 'Please select a valid category from the dropdown list';
          }
        }
        break;
      default:
        if (value === '' && ['name', 'sellingPrice', 'isVeg'].includes(name)) {
          const fieldDisplayNames = {
            name: 'Product Name',
            sellingPrice: 'Selling Price', 
            isVeg: 'Vegetarian/Non-Vegetarian'
          };
          error = `${fieldDisplayNames[name] || name} is required`;
        }
    }

    if (error) {
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    } else {
      // Clear the error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [validationRules, productNames, categories]);

  // Optimized file change handler
  const handleFileChange = useCallback((e) => {
    const { name, files: fileList } = e.target;
    const file = fileList[0];

    // File validation
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({
          ...prev,
          [name]: 'Please select a valid image file (JPEG, PNG, WebP)'
        }));
        return;
      }

      if (file.size > maxSize) {
        setErrors(prev => ({
          ...prev,
          [name]: 'File size must be less than 5MB'
        }));
        return;
      }

      // Clear any existing error
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });

      // Set the file
      setFiles(prev => ({
        ...prev,
        [name]: file
      }));
    }
  }, []);

  // Handle file removal
  const handleFileRemove = useCallback((fileName) => {
    setFiles(prev => ({
      ...prev,
      [fileName]: null
    }));
    
    // Clear upload progress
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    
    // Clear any file errors
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fileName];
      return newErrors;
    });
    
    // Reset the file input
    const fileInput = document.getElementById(fileName);
    if (fileInput) {
      fileInput.value = '';
    }
  }, []);

  // File upload function with progress tracking - NOW USES GCS ONLY
  const uploadFile = useCallback(async (file, fieldName) => {
    if (!file) return null;

    const uploadFormData = new FormData();
    uploadFormData.append('image', file);
    uploadFormData.append('theaterId', theaterId);
    uploadFormData.append('productName', formData.name || 'unnamed-product');

    try {
      setUploadProgress(prev => ({ ...prev, [fieldName]: 0 }));

      // Use the new product-image endpoint with structured folders
      const response = await fetch(config.helpers.getApiUrl('/upload/product-image'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: uploadFormData
      });

      if (!response.ok) {
        setUploadProgress(prev => ({ ...prev, [fieldName]: -1 }));
        const errorData = await response.json();
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();

      // Check if we have the expected response structure
      if (!data.data?.publicUrl) {
        setUploadProgress(prev => ({ ...prev, [fieldName]: -1 }));
        throw new Error('Invalid response: missing publicUrl in upload response');
      }

      setUploadProgress(prev => ({ ...prev, [fieldName]: 100 }));
  
      // Return the GCS public URL instead of local path
      return data.data.publicUrl;
  } catch (error) {
      setUploadProgress(prev => ({ ...prev, [fieldName]: -1 }));

      // Show user-friendly error message
      setErrorModal({ 
        show: true, 
        message: `Failed to upload ${fieldName}: ${error.message}` 
      });

      throw error;
    }
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!formValidationStatus.isValid) {
      setValidationModal({ 
        show: true, 
        message: 'Please fill in all required fields and fix any errors before submitting.' 
      });
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {

      // Handle product image - auto-filled or uploaded
      let finalImageUrl = null;
      if (isImageFromProductType && productImage) {
        // Use auto-filled image from ProductType
        finalImageUrl = productImage;
  } else if (files.productImage) {
        // Upload new image file
        finalImageUrl = await uploadFile(files.productImage, 'productImage');
  }

      // Find the selected ProductType to get its ID for proper referencing
      const selectedProduct = productNames.find(product => product.name === formData.name);
      
      // Find the selected Category to get its ID
      const selectedCategory = categories.find(cat => cat.name === formData.category);
      
      if (!selectedCategory) {
        throw new Error('Please select a valid category');
      }
      
      // Prepare product data matching backend schema
      const productData = {
        name: formData.name,
        description: formData.description || '',
        categoryId: selectedCategory.id, // Backend expects categoryId as ObjectId
        productTypeId: selectedProduct ? selectedProduct.id : null, // Backend expects productTypeId
        sku: formData.productCode || '', // Map productCode to sku
        quantity: formData.quantity || '', // NEW: Direct quantity field from form
        pricing: {
          basePrice: parseFloat(formData.sellingPrice), // Backend expects pricing.basePrice
          salePrice: formData.costPrice ? parseFloat(formData.costPrice) : parseFloat(formData.sellingPrice),
          discountPercentage: formData.discount ? parseFloat(formData.discount) : 0,
          taxRate: formData.taxRate ? parseFloat(formData.taxRate) : 0,
          gstType: formData.gstType || 'EXCLUDE'
        },
        inventory: {
          trackStock: true,
          currentStock: formData.quantity ? parseInt(formData.quantity) : 0,
          minStock: formData.lowStockAlert ? parseInt(formData.lowStockAlert) : 5,
          maxStock: 1000
        },
        images: finalImageUrl ? [finalImageUrl] : [], // Backend expects array of URL strings
        specifications: {
          ingredients: formData.ingredients ? formData.ingredients.split(',').map(i => i.trim()) : []
        },
        isActive: true,
        status: 'active'
      };
      
      // Add product details if isVeg or preparationTime is specified
      if (formData.isVeg !== '' || formData.preparationTime) {
        productData.specifications = productData.specifications || {};
        if (formData.isVeg !== '') {
          productData.tags = formData.isVeg === 'true' ? ['veg'] : ['non-veg'];
        }
      }


      // Submit product data with abort controller
      abortControllerRef.current = new AbortController();
      const response = await fetch(config.helpers.getApiUrl(`/theater-products/${theaterId}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(productData),
        signal: abortControllerRef.current.signal
      });


      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create product');
      }

      const result = await response.json();

      // Reset form
      setFormData({
        name: '',
        category: '',
        kioskType: '',
        quantity: '',
        description: '',
        productCode: '',
        sellingPrice: '',
        costPrice: '',
        discount: '',
        taxRate: '',
        gstType: '',
        lowStockAlert: '',
        isVeg: '',
        preparationTime: '',
        ingredients: ''
      });
      
      // Reset both product code and quantity disabled states to default (disabled)
      setIsProductCodeDisabled(true);
      setIsQuantityDisabled(true);
      setFiles({
        productImage: null
      });
      setErrors({});


      // Use professional modal system
      setSuccessModal({ 
        show: true, 
        message: 'Product added successfully!' 
      });
  } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }

      setErrorModal({ 
        show: true, 
        message: error.message || 'Failed to add product. Please try again.' 
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
      setUploadProgress({});
    }
  }, [formData, files, isSubmitting, uploadFile, navigate, theaterId]);

  const handleCancel = useCallback(() => {
    // Check if form has unsaved changes
    const hasChanges = Object.values(formData).some(value => value !== '' && value !== false) ||
      Object.values(files).some(file => file !== null);

    if (hasChanges) {
      setUnsavedChangesModal({ show: true });
    } else {
      navigate(`/theater-products/${theaterId}`);
    }
  }, [formData, files, navigate, theaterId]);

  // Professional Modal Handlers - Following Delete Modal Pattern
  const handleConfirmUnsavedChanges = useCallback(() => {
    setUnsavedChangesModal({ show: false });
    navigate(`/theater-products/${theaterId}`);
  }, [navigate, theaterId]);

  const handleSuccessModalClose = useCallback(() => {
    setSuccessModal({ show: false, message: '' });
    navigate(`/theater-products/${theaterId}`);
  }, [navigate, theaterId]);

  const headerButton = <HeaderButton theaterId={theaterId} />;

  return (
    <ErrorBoundary>
      <TheaterLayout pageTitle="Add New Product" currentPage="add-product">
        <PageContainer
          title="Add New Product"
          headerButton={headerButton}
        >
          {/* Auth Loading State */}
          {authLoading && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '400px',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '3px solid #f3f3f3', 
                borderTop: '3px solid #8B5CF6', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite' 
              }}></div>
              <p style={{ color: '#666', fontSize: '16px' }}>Loading authentication...</p>
            </div>
          )}

          {/* Main Form Content */}
          {!authLoading && (
          <form onSubmit={handleSubmit} className="add-theater-form" ref={formRef}>
            {/* Basic Information */}
            <div className="form-section">
              <h2>Basic Information</h2>
              <div className="form-grid">
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label htmlFor="name">Product Name *</label>
                    <button
                      type="button"
                      onClick={async () => {

                        setRefreshStatus('Refreshing...');
                        try {
                          const existingProductsArray = await loadExistingProducts(); // Load existing products first
                          await loadProductNames(existingProductsArray); // Pass products array for filtering
                          await loadCategories();
                          setRefreshStatus('✅ Data refreshed!');
                          setTimeout(() => setRefreshStatus(''), 2000);
                        } catch (error) {
                          setRefreshStatus('❌ Refresh failed');
                          setTimeout(() => setRefreshStatus(''), 2000);
                        }
                      }}
                      disabled={loadingProductNames || loadingCategories}
                      style={{
                        background: '#8B5CF6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: loadingProductNames || loadingCategories ? 'not-allowed' : 'pointer',
                        opacity: loadingProductNames || loadingCategories ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ fontSize: '10px' }}>🔄</span>
                      {refreshStatus || (loadingProductNames || loadingCategories ? 'Refreshing...' : 'Refresh Data')}
                    </button>
                  </div>
                  <select
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? 'form-control error' : 'form-control'}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                      paddingRight: '45px'
                    }}
                  >
                    <option value="">
                      {loadingProductNames ? 'Loading product names...' : 'Select Product Name...'}
                    </option>
                    {productNames.map((productName) => (
                      <option key={productName.id} value={productName.name}>
                        {productName.name}
                      </option>
                    ))}
                  </select>
                  {errors.name && <span className="error-message">{errors.name}</span>}
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    💡 Data is automatically refreshed on each page load. Use "Refresh Data" for latest updates.
                  </small>
                </div>



                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                      paddingRight: '45px'
                    }}
                  >
                    <option value="">
                      {loadingCategories ? 'Loading categories...' : 'Select category...'}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name} {category.description ? `- ${category.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="kioskType">Kiosk Type</label>
                  <select
                    id="kioskType"
                    name="kioskType"
                    value={formData.kioskType}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                      paddingRight: '45px'
                    }}
                  >
                    <option value="">
                      {loadingKioskTypes ? 'Loading kiosk types...' : 'Select kiosk type...'}
                    </option>
                    {kioskTypes.map((kioskType) => (
                      <option key={kioskType.id} value={kioskType.id}>
                        {kioskType.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="quantity">
                    Quantity {isQuantityDisabled ? '(🔒 DISABLED)' : '(✏️ ENABLED)'}
                  </label>
                  <input
                    type="text"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity || ''}
                    onChange={handleInputChange}
                    className={errors.quantity ? 'form-control error' : 'form-control'}
                    placeholder={
                      isQuantityDisabled && formData.quantity 
                        ? "Auto-filled from product name" 
                        : isQuantityDisabled 
                        ? "Select a product name first" 
                        : "Enter quantity"
                    }
                    disabled={isQuantityDisabled}
                    style={{
                      backgroundColor: isQuantityDisabled ? '#f5f5f5' : 'white',
                      color: isQuantityDisabled ? '#666' : 'inherit',
                      cursor: isQuantityDisabled ? 'not-allowed' : 'text',
                      border: isQuantityDisabled ? '2px solid #ccc' : '1px solid #ddd'
                    }}
                  />
                  {errors.quantity && <span className="error-message">{errors.quantity}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="productCode">
                    Product Code / SKU {isProductCodeDisabled ? '(🔒 DISABLED)' : '(✏️ ENABLED)'}
                  </label>
                  <input
                    type="text"
                    id="productCode"
                    name="productCode"
                    value={formData.productCode || ''}
                    onChange={handleInputChange}
                    className={errors.productCode ? 'form-control error' : 'form-control'}
                    placeholder={
                      isProductCodeDisabled && formData.productCode 
                        ? "Auto-filled from product name" 
                        : isProductCodeDisabled 
                        ? "Select a product name first" 
                        : "Enter product code"
                    }
                    disabled={isProductCodeDisabled}
                    style={{
                      backgroundColor: isProductCodeDisabled ? '#f5f5f5' : 'white',
                      color: isProductCodeDisabled ? '#666' : 'inherit',
                      cursor: isProductCodeDisabled ? 'not-allowed' : 'text',
                      border: isProductCodeDisabled ? '2px solid #ccc' : '1px solid #ddd'
                    }}
                  />
                  {errors.productCode && <span className="error-message">{errors.productCode}</span>}
                </div>

                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter product description (optional)"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            {/* Pricing Information */}
            <div className="form-section">
              <h2>Pricing Details</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="sellingPrice">Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    id="sellingPrice"
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    className={errors.sellingPrice ? 'form-control error' : 'form-control'}
                    placeholder="Enter selling price"
                  />
                  {errors.sellingPrice && <span className="error-message">{errors.sellingPrice}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="costPrice">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    id="costPrice"
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter cost price (optional)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discount">Discount (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    id="discount"
                    name="discount"
                    value={formData.discount}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter discount percentage"
                  />
                </div>



                <div className="form-group">
                  <label htmlFor="gstType">GST Type *</label>
                  <select
                    id="gstType"
                    name="gstType"
                    value={formData.gstType}
                    onChange={handleInputChange}
                    className="form-control"
                    required
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                      paddingRight: '45px'
                    }}
                  >
                    <option value="">Select GST Type...</option>
                    <option value="EXCLUDE">EXCLUDE (GST added separately)</option>
                    <option value="INCLUDE">INCLUDE (GST included in price)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="taxRate">Tax Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    id="taxRate"
                    name="taxRate"
                    value={formData.taxRate}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter tax rate percentage"
                    required
                  />
                </div>

              </div>
            </div>

            {/* Food Information & Display Settings */}
            <div className="form-section">
              <h2>Food Information & Display</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="isVeg">Is Veg / Non-Veg *</label>
                  <select
                    id="isVeg"
                    name="isVeg"
                    value={formData.isVeg === '' ? '' : formData.isVeg.toString()}
                    onChange={(e) => handleInputChange({ target: { name: 'isVeg', value: e.target.value, type: 'select' } })}
                    className="form-control"
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '20px',
                      paddingRight: '45px'
                    }}
                  >
                    <option value="">Select Type...</option>
                    <option value="true">Vegetarian</option>
                    <option value="false">Non-Vegetarian</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="preparationTime">Preparation Time (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    id="preparationTime"
                    name="preparationTime"
                    value={formData.preparationTime}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter preparation time"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lowStockAlert">Low Stock Alert Level</label>
                  <input
                    type="number"
                    min="0"
                    id="lowStockAlert"
                    name="lowStockAlert"
                    value={formData.lowStockAlert}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter low stock alert level"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="ingredients">Ingredients</label>
                  <textarea
                    id="ingredients"
                    name="ingredients"
                    value={formData.ingredients}
                    onChange={handleInputChange}
                    className="form-control"
                    placeholder="Enter ingredients (optional)"
                    rows="3"
                  />
                </div>
              </div>
            </div>

            {/* Product Image - Auto-filled ONLY (Upload Completely Removed) */}
            <div className="form-section">
              <h2>Product Image</h2>
              <div className="form-group full-width" style={{ width: '100%', maxWidth: '100%' }}>
                <label htmlFor="productImage">Product Image</label>
                
                {/* Show auto-filled image if available - NO UPLOAD OPTION AT ALL */}
                {isImageFromProductType && productImage ? (
                  <div className="auto-filled-image-container" style={{
                    border: '2px solid #8B5CF6',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#f8f4ff',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                      color: '#8B5CF6',
                      fontWeight: '600'
                    }}>
                      <span style={{ marginRight: '8px' }}>🖼️</span>
                      Image from Product Type
                    </div>
                    <img 
                      src={productImage} 
                      alt="Auto-filled product" 
                      style={{
                        maxWidth: '200px',
                        maxHeight: '200px',
                        borderRadius: '8px',
                        border: '1px solid #e1e5e9',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {

                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  /* NO UPLOAD - Show message when no auto-filled image */
                  <div style={{
                    border: '2px dashed #e1e5e9',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center',
                    color: '#666'
                  }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>📷</div>
                    <p>No image available for this product</p>
                    <small>Images are provided by Product Type configuration</small>
                  </div>
                )}
                {errors.productImage && <span className="error-message">{errors.productImage}</span>}
              </div>
            </div>

            {/* Form Actions - Following Global Design System */}
            <div className="modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading-spinner"></span>
                    Adding Product...
                  </>
                ) : (
                  'Add Product'
                )}
              </button>
            </div>
          </form>
          
          )} {/* End of !authLoading conditional */}

          {/* Professional Validation Error Modal - Following Delete Modal Style */}
          {validationModal.show && (
            <div className="modal-overlay" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div className="delete-modal" style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                maxWidth: '400px',
                width: '90%',
                overflow: 'hidden'
              }}>
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #ef4444, #f87171)',
                  padding: '24px',
                  color: 'white'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Validation Error</h3>
                </div>
                <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      color: '#ef4444', 
                      background: '#fef2f2', 
                      padding: '16px', 
                      borderRadius: '50%', 
                      display: 'inline-flex' 
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', lineHeight: '1.5' }}>{validationModal.message}</p>
                  <p className="warning-text" style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>Please fix all errors before submitting.</p>
                </div>
                <div className="modal-actions" style={{ 
                  background: '#f9fafb', 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button 
                    onClick={() => setValidationModal({ show: false, message: '' })}
                    className="btn-primary"
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Unsaved Changes Modal - Following Delete Modal Style */}
          {unsavedChangesModal.show && (
            <div className="modal-overlay" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div className="delete-modal" style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                maxWidth: '400px',
                width: '90%',
                overflow: 'hidden'
              }}>
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                  padding: '24px',
                  color: 'white'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Unsaved Changes</h3>
                </div>
                <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      color: '#f59e0b', 
                      background: '#fffbeb', 
                      padding: '16px', 
                      borderRadius: '50%', 
                      display: 'inline-flex' 
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', lineHeight: '1.5' }}>You have unsaved changes. Are you sure you want to leave?</p>
                  <p className="warning-text" style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>All unsaved data will be lost.</p>
                </div>
                <div className="modal-actions" style={{ 
                  background: '#f9fafb', 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button 
                    onClick={() => setUnsavedChangesModal({ show: false })}
                    className="cancel-btn"
                    style={{
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmUnsavedChanges}
                    className="confirm-delete-btn"
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Leave Page
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Success Modal - Following Delete Modal Style */}
          {successModal.show && (
            <div className="modal-overlay" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div className="delete-modal" style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                maxWidth: '400px',
                width: '90%',
                overflow: 'hidden'
              }}>
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  padding: '24px',
                  color: 'white'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Success</h3>
                </div>
                <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      color: '#10b981', 
                      background: '#ecfdf5', 
                      padding: '16px', 
                      borderRadius: '50%', 
                      display: 'inline-flex' 
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22,4 12,14.01 9,11.01"></polyline>
                      </svg>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', lineHeight: '1.5' }}>{successModal.message}</p>
                  <p className="warning-text" style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>You will be redirected to the dashboard.</p>
                </div>
                <div className="modal-actions" style={{ 
                  background: '#f9fafb', 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button 
                    onClick={handleSuccessModalClose}
                    className="btn-primary"
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Professional Error Modal - Following Delete Modal Style */}
          {errorModal.show && (
            <div className="modal-overlay" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <div className="delete-modal" style={{
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
                maxWidth: '400px',
                width: '90%',
                overflow: 'hidden'
              }}>
                <div className="modal-header" style={{
                  background: 'linear-gradient(135deg, #ef4444, #f87171)',
                  padding: '24px',
                  color: 'white'
                }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Error</h3>
                </div>
                <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ 
                      color: '#ef4444', 
                      background: '#fef2f2', 
                      padding: '16px', 
                      borderRadius: '50%', 
                      display: 'inline-flex' 
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', lineHeight: '1.5' }}>{errorModal.message}</p>
                  <p className="warning-text" style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '600', margin: 0 }}>Please try again.</p>
                </div>
                <div className="modal-actions" style={{ 
                  background: '#f9fafb', 
                  padding: '16px 24px', 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  gap: '12px'
                }}>
                  <button 
                    onClick={() => setErrorModal({ show: false, message: '' })}
                    className="btn-primary"
                    style={{
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
          
        </PageContainer>
      </TheaterLayout>
    </ErrorBoundary>
  );
});

AddProduct.displayName = 'AddProduct';

export default AddProduct;