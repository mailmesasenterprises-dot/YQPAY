import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import OptimizedImage from '../../components/common/OptimizedImage';
import ProductCollectionModal from '../../components/customer/ProductCollectionModal';
import OfflineNotice from '../../components/OfflineNotice';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { 
  groupProductsIntoCollections, 
  filterCollections,
  getDefaultVariant 
} from '../../utils/productCollections';
import config from '../../config';
import './../../styles/customer/CustomerHome.css';

const CustomerHome = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const { items, addItem, updateQuantity, removeItem, getTotalItems, getItemQuantity } = cart;
  
  // Network status for offline handling
  const { shouldShowOfflineUI, isNetworkError } = useNetworkStatus();
  const [theaterId, setTheaterId] = useState(null);
  const [theater, setTheater] = useState(null);
  const [products, setProducts] = useState([]);
  const [productCollections, setProductCollections] = useState([]);
  const [filteredCollections, setFilteredCollections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrName, setQrName] = useState(null);
  const [seat, setSeat] = useState(null);
  const [screenName, setScreenName] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState('all');

  // Initialize state from localStorage if URL params are missing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('theaterid') || params.get('theaterId') || params.get('THEATERID');
    
    // If no theaterId in URL, try to restore from localStorage and redirect
    if (!id) {
      const savedId = localStorage.getItem('customerTheaterId');
      if (savedId) {
        const savedQr = localStorage.getItem('customerQrName');
        const savedScreen = localStorage.getItem('customerScreenName');
        const savedSeat = localStorage.getItem('customerSeat');
        
        const newParams = new URLSearchParams();
        newParams.set('theaterid', savedId);
        if (savedQr) newParams.set('qrName', savedQr);
        if (savedScreen) newParams.set('screen', savedScreen);
        if (savedSeat) newParams.set('seat', savedSeat);
        
        // Redirect with saved parameters
        navigate(`/customer/home?${newParams.toString()}`, { replace: true });
        return;
      }
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Support multiple parameter name variations for backwards compatibility
    const id = params.get('theaterid') || params.get('theaterId') || params.get('THEATERID');
    const qr = params.get('qrName') || params.get('qrname') || params.get('QRNAME');
    const seatNum = params.get('seat') || params.get('SEAT');
    const screen = params.get('screen') || params.get('SCREEN') || params.get('screenName');
    const category = params.get('category'); // Get saved category from URL
    
    console.log('🔍 URL Parameters:', {
      theaterid: id,
      qrName: qr,
      // seat: seatNum,
      screen: screen,
      category: category,
      fullURL: location.search,
      allParams: Object.fromEntries(params.entries())
    });
    
    // Save to localStorage for persistence on refresh
    if (id) {
      setTheaterId(id);
      localStorage.setItem('customerTheaterId', id);
    }
    
    if (qr) {
      console.log('✅ Setting QR Name:', qr);
      setQrName(qr);
      localStorage.setItem('customerQrName', qr);
      // If no screen name is provided, use qrName as screen name
      if (!screen) {
        console.log('ℹ️ No screen parameter, using qrName as screen name');
        setScreenName(qr);
        localStorage.setItem('customerScreenName', qr);
      }
    }
    
    if (seatNum) {
      setSeat(seatNum);
      localStorage.setItem('customerSeat', seatNum);
    }
    
    if (screen) {
      setScreenName(screen);
      localStorage.setItem('customerScreenName', screen);
    }
    
    if (category) setSelectedCategory(category); // Restore selected category
  }, [location.search, navigate]);

  const loadTheater = useCallback(async (id) => {
    try {
      const res = await fetch(`${config.api.baseUrl}/theaters/${id}`);
      const data = await res.json();
      if (data.success && data.data) setTheater(data.data);
    } catch (err) {
      console.error('Error loading theater:', err);
    }
  }, []);

  const loadProducts = useCallback(async (id) => {
    try {
      // Use session storage to cache products for better performance
      const res = await fetch(`${config.api.baseUrl}/theater-products/${id}`);
      const data = await res.json();
      if (data.success && data.data.products) {
        console.log('🍔 Raw products from API:', data.data.products.slice(0, 2));
        console.log('🍔 Full raw products:', data.data.products.map(p => ({ 
          name: p.name, 
          category: p.category, 
          categoryType: typeof p.category,
          categoryKeys: p.category ? Object.keys(p.category) : null
        })));
        const mappedProducts = data.data.products.map(p => {
          // Handle different image formats
          let imageUrl = null;
          if (p.images && Array.isArray(p.images) && p.images.length > 0) {
            // New format: images array with objects or strings
            if (typeof p.images[0] === 'object' && p.images[0].url) {
              imageUrl = p.images[0].url; // Object with url property
            } else if (typeof p.images[0] === 'string') {
              imageUrl = p.images[0]; // Direct string URL
            }
          } else if (p.productImage) {
            imageUrl = p.productImage; // Old format
          } else if (p.image) {
            imageUrl = p.image; // Alternative old format
          }
          
          // Check if product is available (active and has stock)
          const isActive = p.isActive === true; // Must be explicitly true
          const trackStock = p.inventory?.trackStock !== false;
          const currentStock = p.inventory?.currentStock || 0;
          const hasStock = !trackStock || currentStock > 0;
          const isAvailable = isActive && hasStock;
          
          // Debug logging for ALL products to see stock info
          console.log(`📦 Product: ${p.name}`, {
            size: p.size || p.quantity,
            currentStock,
            trackStock,
            rawTrackStock: p.inventory?.trackStock,
            rawIsActive: p.isActive,
            hasStock,
            isActive,
            isAvailable,
            status: p.status,
            inventory: p.inventory
          });
          
          return {
            _id: p._id,
            name: p.name || p.productName,
            price: p.pricing?.salePrice || p.price || p.sellingPrice || 0,
            description: p.description || '',
            image: imageUrl,
            // Store category ID directly from the product (it's already a field in the DB)
            categoryId: p.categoryId || (typeof p.category === 'object' ? p.category?._id : p.category),
            category: typeof p.category === 'object' ? (p.category?.categoryName || p.category?.name) : p.category,
            quantity: p.quantity || null,
            size: p.size || null,
            // Include tax and discount information
            pricing: p.pricing,
            taxRate: p.pricing?.taxRate || p.taxRate || 0,
            gstType: p.gstType || 'EXCLUDE',
            discountPercentage: p.pricing?.discountPercentage || p.discountPercentage || 0,
            // Include availability information
            isActive: p.isActive,
            status: p.status,
            inventory: p.inventory,
            currentStock: currentStock,
            trackStock: trackStock,
            isAvailable: isAvailable,
          };
        });
        console.log('✅ Mapped products:', mappedProducts.slice(0, 2));
        setProducts(mappedProducts);
        
        // Group products into collections (for "All" view)
        const collections = groupProductsIntoCollections(mappedProducts);
        console.log('📦 Collections created:', collections.length);
        setProductCollections(collections);
        
        // Don't set filtered collections here - let filterProductCollections handle it
        // This will be triggered by the useEffect that watches products/collections changes
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  }, []);

  const loadCategories = useCallback(async (id) => {
    try {
      const res = await fetch(`${config.api.baseUrl}/theater-categories/${id}`);
      const data = await res.json();
      console.log('📦 Categories API Response:', data);
      if (data.success && data.data.categories) {
        const activeCategories = data.data.categories
          .filter(cat => cat.isActive)
          .slice(0, 6) // Limit to 6 categories for header
          .map(cat => ({
            _id: cat._id,
            name: cat.categoryName || cat.name,
            image: cat.imageUrl || cat.image,
            icon: cat.icon || '📦',
            isActive: cat.isActive
          }));
        console.log('✅ Mapped categories:', activeCategories);
        setCategories(activeCategories);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  }, []);

  useEffect(() => {
    if (theaterId) {
      Promise.all([loadTheater(theaterId), loadProducts(theaterId), loadCategories(theaterId)])
        .finally(() => setLoading(false));
    }
  }, [theaterId, loadTheater, loadProducts, loadCategories]);

  // Auto-refresh products every 30 seconds to get admin updates
  useEffect(() => {
    if (!theaterId) return;
    
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing products...');
      loadProducts(theaterId);
      loadCategories(theaterId);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [theaterId, loadProducts, loadCategories]);

  // Filter collections based on search query and selected category
  const filterProductCollections = useCallback(() => {
    console.log('🔍 Filtering:', { 
      selectedCategory, 
      totalCollections: productCollections.length,
      totalProducts: products.length
    });
    
    // For "All" category: show grouped collections
    if (selectedCategory === 'all') {
      const filtered = filterCollections(productCollections, searchQuery, selectedCategory);
      console.log('✅ Showing grouped collections:', filtered.length);
      setFilteredCollections(filtered);
    } else {
      // For specific categories: show individual products
      // Filter by category ID (not name)
      console.log('🔍 Selected category ID:', selectedCategory);
      console.log('🔍 All product categories:', products.map(p => ({ name: p.name, categoryId: p.categoryId, category: p.category })));
      
      let individualProducts = products.filter(p => {
        const matches = p.categoryId === selectedCategory;
        console.log(`🔍 Comparing: "${p.categoryId}" === "${selectedCategory}" for product: ${p.name} - ${matches ? '✅' : '❌'}`);
        return matches;
      });
      
      console.log('🔍 Filtered products:', individualProducts.length);
      
      // Apply search filter
      if (searchQuery && searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        individualProducts = individualProducts.filter(p =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query))
        );
      }
      
      // Apply veg filter (only for category view, not "all")
      // When toggle is ON, show only NON-VEG items
      if (isVegOnly) {
        individualProducts = individualProducts.filter(p => 
          p.isVeg === false || (!p.isVeg && !p.category?.toLowerCase().includes('veg'))
        );
      }
      
      // Apply price range filter (only for category view, not "all")
      if (selectedPriceRange !== 'all') {
        individualProducts = individualProducts.filter(p => {
          const price = parseFloat(p.price) || 0;
          switch (selectedPriceRange) {
            case 'under100':
              return price < 100;
            case '100-200':
              return price >= 100 && price <= 200;
            case '200-300':
              return price > 200 && price <= 300;
            case 'above300':
              return price > 300;
            default:
              return true;
          }
        });
      }
      
      // Convert to collection format for consistent rendering
      const productItems = individualProducts.map(p => ({
        name: p.name,
        baseImage: p.image,
        category: p.category,
        isCollection: false,
        basePrice: parseFloat(p.price) || 0,
        singleVariant: {
          _id: p._id,
          size: p.size || 'Regular',
          sizeLabel: p.quantity || null,
          price: parseFloat(p.price) || 0,
          description: p.description,
          image: p.image,
          originalProduct: p
        },
        variants: [{
          _id: p._id,
          size: p.size || 'Regular',
          sizeLabel: p.quantity || null,
          price: parseFloat(p.price) || 0,
          description: p.description,
          image: p.image,
          originalProduct: p
        }]
      }));
      
      console.log('✅ Showing individual products:', productItems.length);
      setFilteredCollections(productItems);
    }
  }, [productCollections, products, selectedCategory, searchQuery, isVegOnly, selectedPriceRange]);

  // Update filtered collections when filters change
  useEffect(() => {
    filterProductCollections();
  }, [filterProductCollections]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleVoiceSearch = () => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Voice search is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; // English India
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      console.log('Voice recognition started. Speak now...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('Voice input:', transcript);
      setSearchQuery(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        alert('Voice recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      console.log('Voice recognition ended.');
    };

    recognition.start();
  };

  const handleCategoryChange = (categoryId) => {
    console.log('📂 Category changed to:', categoryId);
    // Store the category ID (not the name) for filtering, except for 'all'
    console.log('📂 All categories:', categories.map(c => ({ id: c._id, name: c.name })));
    setSelectedCategory(categoryId === 'all' ? 'all' : categoryId);
    
    // Update URL to persist category selection on refresh
    const params = new URLSearchParams(location.search);
    if (categoryId === 'all') {
      params.delete('category'); // Remove category param for 'all'
    } else {
      params.set('category', categoryId);
    }
    // Replace URL without reloading the page
    window.history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
  };

  // Handle adding product to cart
  const handleAddToCart = (product) => {
    // Check if product is available
    if (product.isAvailable === false) {
      return; // Don't add to cart if not available
    }
    
    addItem({
      _id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity: 1,
      taxRate: product.pricing?.taxRate || product.taxRate || 0,
      gstType: product.pricing?.gstType || product.gstType || 'EXCLUDE',
      discountPercentage: product.pricing?.discountPercentage || product.discountPercentage || 0,
      theaterId: theaterId // Add theater ID to cart item
    });
  };

  // Handle increasing quantity
  const handleIncreaseQuantity = (product) => {
    // Check if product is available
    if (product.isAvailable === false) {
      return; // Don't allow adding if not available
    }
    
    const currentQty = getItemQuantity(product._id);
    if (currentQty > 0) {
      updateQuantity(product._id, currentQty + 1);
    } else {
      handleAddToCart(product);
    }
  };

  // Handle decreasing quantity
  const handleDecreaseQuantity = (product) => {
    const currentQty = getItemQuantity(product._id);
    if (currentQty > 1) {
      updateQuantity(product._id, currentQty - 1);
    } else if (currentQty === 1) {
      removeItem({ _id: product._id });
    }
  };

  // Handle collection click
  const handleCollectionClick = (collection) => {
    if (collection.isCollection) {
      setSelectedCollection(collection);
      setIsCollectionModalOpen(true);
    }
  };

  // Handle profile dropdown toggle
  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  // Handle order history navigation
  const handleOrderHistory = () => {
    setShowProfileDropdown(false);
    // Get phone number from localStorage
    const savedPhone = localStorage.getItem('customerPhone');
    
    console.log('📱 Navigating to order history with:', {
      theaterId,
      theaterName: theater?.name,
      phoneNumber: savedPhone
    });
    
    if (!savedPhone) {
      alert('Please place an order first to view history');
      return;
    }
    
    navigate('/customer/order-history', {
      state: {
        theaterId,
        theaterName: theater?.name,
        phoneNumber: savedPhone
      }
    });
  };

  // Handle logout
  const handleLogout = () => {
    setShowProfileDropdown(false);
    // Clear customer data
    localStorage.removeItem('customerPhone');
    localStorage.removeItem('cart');
    localStorage.removeItem('yqpay_cart');
    localStorage.removeItem('checkoutData');
    // Redirect to customer landing page
    navigate('/customer');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileDropdown]);

  if (loading) return <div className="customer-loading"><div className="spinner"></div></div>;

  const totalItems = getTotalItems();
  const defaultEmojis = ['🍔', '🥤', '🥤', '🍿'];
  
  // Debug: Log header values
  console.log('📊 Header Display Values:', {
    qrName,
    seat,
    screenName,
    theaterName: theater?.name
  });

  return (
    <div className="customer-home">
      {/* Show offline notice if in offline mode */}
      {shouldShowOfflineUI && <OfflineNotice />}
      
      <header className="customer-header">
        {/* Theater Name - First Line */}
        <div className="theater-name-row">
          <h1 className="theater-name">{theater?.name || 'Theater Name'}</h1>
        </div>

        {/* Balance Icons - Second Line */}
        <div className="balance-row">
          <div className="balance-info">
            {screenName && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
                </svg>
                <span className="balance-text">{screenName}</span>
              </div>
            )}
            {qrName && qrName !== screenName && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h5v-5zm0 7h2v-2h-2v2zm-2-2h-2v2h2v-2z"/>
                </svg>
                <span className="balance-text">QR: {qrName}</span>
              </div>
            )}
            {seat && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4 18v3h3v-3h10v3h3v-6H4zm15-8h3v3h-3zM2 10h3v3H2zm15 3H7V5c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v8z"/>
                </svg>
                <span className="balance-text">Seat {seat}</span>
              </div>
            )}
          </div>
          <div className="header-actions">
            <div className="profile-dropdown-container">
              <button 
                className="profile-btn" 
                aria-label="User profile"
                onClick={handleProfileClick}
              >
                <svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              
              {showProfileDropdown && (
                <div className="profile-dropdown">
                  <button 
                    className="dropdown-item"
                    onClick={handleOrderHistory}
                  >
                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                    </svg>
                    <span>Order History</span>
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={handleLogout}
                  >
                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                    </svg>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="search-container">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for products..." 
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search products"
          />
          <button className="mic-btn" aria-label="Voice search" onClick={handleVoiceSearch}>
            <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>

        {/* Categories Section */}
        <div className="categories-section">
          <button
            className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
            aria-label="All categories"
          >
            <div className="category-content">
              <div className="category-icon-large">
                <OptimizedImage
                  src="/images/cinema-combo.jpg.png"
                  alt="All Categories"
                  width={48}
                  height={48}
                  className="category-img"
                  priority={true}
                  lazy={false}
                />
              </div>
              <span className="category-name">All</span>
            </div>
          </button>
          {categories.map((category) => {
            // Use actual category image or provide default based on category name
            let categoryImgUrl = category.image && typeof category.image === 'string' 
              ? (category.image.startsWith('http') ? category.image : `${config.api.baseUrl}${category.image}`) 
              : null;
            
            // Fallback to default images based on category type/name
            if (!categoryImgUrl) {
              const categoryLower = (category.name || '').toLowerCase();
              if (categoryLower.includes('pop') || categoryLower.includes('corn')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('sweet') || categoryLower.includes('dessert') || categoryLower.includes('candy')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('burger') || categoryLower.includes('sandwich')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('pizza')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('drink') || categoryLower.includes('beverage') || categoryLower.includes('cola') || categoryLower.includes('soda')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('coffee')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('snack') || categoryLower.includes('chips')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1613919113640-25732ec5e61f?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('ice') || categoryLower.includes('cream')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('hot') || categoryLower.includes('dog')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1612392062798-2ba2c6bb84e0?w=100&h=100&fit=crop';
              } else if (categoryLower.includes('nachos')) {
                categoryImgUrl = 'https://images.unsplash.com/photo-1582169296194-e4d644c48063?w=100&h=100&fit=crop';
              } else {
                // Default food image
                categoryImgUrl = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop';
              }
            }
            
            return (
              <button
                key={category._id}
                className={`category-chip ${selectedCategory === category._id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category._id)}
                aria-label={`Filter by ${category.name}`}
              >
                <div className="category-content">
                  <div className="category-icon-large">
                    <OptimizedImage
                      src={categoryImgUrl}
                      alt={category.name}
                      width={48}
                      height={48}
                      className="category-img"
                      fallback="https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop"
                      priority={true}
                      lazy={false}
                      />
                    </div>
                    <span className="category-name">{category.name}</span>
                  </div>
                </button>
              );
            })}
        </div>
      </header>
      <main className="customer-main">
       
        {/* Filter Section - Only show when not in "All" category */}
        {selectedCategory !== 'all' && (
          <div className="filter-section">
            <div className="filter-chips-container">
              {/* Veg Toggle Switch */}
              <div className="veg-toggle-container">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isVegOnly}
                    onChange={() => setIsVegOnly(!isVegOnly)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              {/* All Button - Clear all filters */}
              <button
                className={`filter-chip ${!isVegOnly && selectedPriceRange === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setIsVegOnly(false);
                  setSelectedPriceRange('all');
                }}
              >
                <span>All</span>
              </button>
              
              {/* Price Range Filters */}
              <button
                className={`filter-chip ${selectedPriceRange === 'under100' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === 'under100' ? 'all' : 'under100')}
              >
                <span>Under ₹100</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === '100-200' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === '100-200' ? 'all' : '100-200')}
              >
                <span>₹100-200</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === '200-300' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === '200-300' ? 'all' : '200-300')}
              >
                <span>₹200-300</span>
              </button>
              
              <button
                className={`filter-chip ${selectedPriceRange === 'above300' ? 'active' : ''}`}
                onClick={() => setSelectedPriceRange(selectedPriceRange === 'above300' ? 'all' : 'above300')}
              >
                <span>Above ₹300</span>
              </button>
              
              {/* Clear Filters - Show only when filters are active */}
              {(isVegOnly || selectedPriceRange !== 'all') && (
                <button
                  className="filter-chip clear-filter"
                  onClick={() => {
                    setIsVegOnly(false);
                    setSelectedPriceRange('all');
                  }}
                >
                  <span>✕ Clear</span>
                </button>
              )}
            </div>
          </div>
        )}
       
        {/* Products List - Collection Design */}
        <section className="products-section">
          <div className="products-list">
            {filteredCollections.length > 0 ? (
              filteredCollections.map((collection, index) => {
                const defaultVariant = getDefaultVariant(collection);
                const imgUrl = defaultVariant?.image || collection.baseImage;
                const product = defaultVariant?.originalProduct || defaultVariant;
                const productQty = product ? getItemQuantity(product._id) : 0;
                
                // Priority load first 6 images (above the fold)
                const isPriority = index < 6;
                
                // Check if ANY variant in the collection is available
                const hasAvailableVariant = collection.variants?.some(variant => 
                  variant.originalProduct?.isAvailable === true
                );
                const isProductAvailable = collection.isCollection 
                  ? hasAvailableVariant 
                  : (product?.isAvailable === true);
                
                // Debug logging
                if (!isProductAvailable) {
                  console.log(`🔴 Rendering out-of-stock: ${collection.name}`, {
                    isCollection: collection.isCollection,
                    hasAvailableVariant,
                    productIsAvailable: product?.isAvailable,
                    variants: collection.variants?.map(v => ({
                      size: v.size,
                      isAvailable: v.originalProduct?.isAvailable,
                      currentStock: v.originalProduct?.currentStock
                    }))
                  });
                }
                
                return (
                  <div 
                    key={collection.isCollection ? `collection-${collection.name}` : defaultVariant?._id} 
                    className={`product-card ${collection.isCollection ? 'collection-card' : 'single-product-card'} ${!isProductAvailable ? 'out-of-stock' : ''}`}
                    onClick={() => isProductAvailable && handleCollectionClick(collection)}
                    style={{ cursor: (collection.isCollection && isProductAvailable) ? 'pointer' : 'default' }}
                  >
                    {/* Image Container */}
                    <div className="product-image-container">
                      {imgUrl ? (
                        <OptimizedImage
                          src={imgUrl && typeof imgUrl === 'string' 
                            ? (imgUrl.startsWith('http') ? imgUrl : `${config.api.baseUrl}${imgUrl}`) 
                            : null
                          }
                          alt={collection.name}
                          width={100}
                          height={100}
                          className="product-img"
                          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='40'%3E🍽️%3C/text%3E%3C/svg%3E"
                          priority={isPriority}
                          lazy={!isPriority}
                        />
                      ) : (
                        <div className="product-placeholder">
                          <span>🍽️</span>
                        </div>
                      )}
                      {/* Discount Badge */}
                      {product?.discountPercentage > 0 && isProductAvailable && (
                        <div className="product-discount-badge">
                          {product.discountPercentage}% OFF
                        </div>
                      )}
                      {/* Out of Stock Overlay */}
                      {!isProductAvailable && (
                        <div className="out-of-stock-overlay">
                          <span className="out-of-stock-text">Out of Stock</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="product-details">
                      <h3 className="product-name">{collection.name}</h3>
                      {collection.isCollection ? (
                        <>
                          <p className="product-collection-info">
                            {collection.variants.length > 1 ? `${collection.variants.length} sizes available` : '1 size available'}
                          </p>
                          <p className="product-price-range">
                            {collection.variants.length > 1 ? `From ₹${parseFloat(collection.basePrice || 0).toFixed(2)}` : `₹${parseFloat(collection.basePrice || 0).toFixed(2)}`}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="product-quantity">{defaultVariant?.sizeLabel || defaultVariant?.originalProduct?.quantity || 'Regular'}</p>
                          {product?.discountPercentage > 0 ? (
                            <div className="product-price-container">
                              <span className="product-discounted-price">
                                ₹{(parseFloat(defaultVariant?.price || 0) * (1 - product.discountPercentage / 100)).toFixed(2)}
                              </span>
                              <span className="product-original-price">
                                ₹{parseFloat(defaultVariant?.price || 0).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <p className="product-regular-price">
                              ₹{parseFloat(defaultVariant?.price || 0).toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Actions Section - Only for single products */}
                    {!collection.isCollection && product && (
                      <div className="product-item-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="product-actions">
                          <button 
                            className="quantity-btn minus"
                            onClick={() => handleDecreaseQuantity(product)}
                            disabled={!isProductAvailable}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </button>
                          
                          <span className="quantity-display">{productQty}</span>
                          
                          <button 
                            className="quantity-btn plus"
                            onClick={() => isProductAvailable && handleIncreaseQuantity(product)}
                            disabled={!isProductAvailable}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Veg/Non-Veg Indicator */}
                        <div className="product-veg-indicator">
                          {product.isVeg === true ? (
                            <span className="veg-badge">
                              <span className="veg-dot">●</span> Veg
                            </span>
                          ) : product.isVeg === false ? (
                            <span className="non-veg-badge">
                              <span className="non-veg-dot">●</span> Non-Veg
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-products">
                <p>No products found {searchQuery ? `for "${searchQuery}"` : 'in this category'}</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Floating Cart Icon */}
      {cart.items && cart.items.length > 0 && (
        <button 
          className="floating-cart-icon"
          onClick={() => {
            const params = new URLSearchParams({
              ...(theaterId && { theaterid: theaterId }),
              ...(theater?.name && { theatername: theater.name }),
              ...(qrName && { qrname: qrName }),
              ...(seat && { seat: seat }),
              ...(selectedCategory && selectedCategory !== 'all' && { category: selectedCategory })
            });
            navigate(`/customer/cart?${params.toString()}`);
          }}
          aria-label={`View Cart (${cart.items.length} items)`}
        >
          <span className="cart-icon">🛒</span>
          <span className="cart-count">{cart.items.length}</span>
        </button>
      )}

      {/* Product Collection Modal */}
      <ProductCollectionModal
        collection={selectedCollection}
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
      />
    </div>
  );
};

export default CustomerHome;
