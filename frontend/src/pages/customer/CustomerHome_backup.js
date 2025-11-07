import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import config from '../../config';
import './../../styles/customer/CustomerHome.css';

const CustomerHome = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const cart = useCart();
  const { addItem, removeItem, getTotalItems } = cart;
  const [theaterId, setTheaterId] = useState(null);
  const [theater, setTheater] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [qrName, setQrName] = useState(null);
  const [seat, setSeat] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('theaterid');
    const qr = params.get('qrname');
    const seatNum = params.get('seat');
    if (id) setTheaterId(id);
    if (qr) setQrName(qr);
    if (seatNum) setSeat(seatNum);
  }, [location.search]);

  const loadTheater = useCallback(async (id) => {
    try {
      const res = await fetch(`${config.api.baseUrl}/theaters/${id}`);
      const data = await res.json();
      if (data.success && data.data) setTheater(data.data);
    } catch (err) {
  }
  }, []);

  const loadProducts = useCallback(async (id) => {
    try {
      const res = await fetch(`${config.api.baseUrl}/theater-products/${id}`);
      const data = await res.json();

      if (data.success && data.data.products) {
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
          
          return {
            _id: p._id,
            name: p.name || p.productName,
            price: p.pricing?.salePrice || p.price || p.sellingPrice || 0,
            image: imageUrl,
            category: p.category || 'Other',
          };
        });

        setProducts(mappedProducts);
      }
    } catch (err) {
  }
  }, []);

  const loadCategories = useCallback(async (id) => {
    try {
      const res = await fetch(`${config.api.baseUrl}/theater-categories/${id}`);
      const data = await res.json();

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

        setCategories(activeCategories);
      }
    } catch (err) {
  }
  }, []);

  useEffect(() => {
    if (theaterId) {
      Promise.all([loadTheater(theaterId), loadProducts(theaterId), loadCategories(theaterId)])
        .finally(() => setLoading(false));
    }
  }, [theaterId, loadTheater, loadProducts, loadCategories]);

  const handleAddToCart = (product) => {
    addItem({ id: product._id, name: product.name, price: product.price, image: product.image });
  };

  if (loading) return <div className="customer-loading"><div className="spinner"></div></div>;

  const totalItems = getTotalItems();
  const defaultEmojis = ['🍔', '🥤', '🥤', '🍿'];

  return (
    <div className="customer-home">
      <header className="customer-header">
        {/* Theater Name - First Line */}
        <div className="theater-name-row">
          <h1 className="theater-name">{theater?.name || 'Theater Name'}</h1>
        </div>

        {/* Balance Icons - Second Line */}
        <div className="balance-row">
          <div className="balance-info">
            {qrName && (
              <div className="balance-item">
                <svg className="balance-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h5v-5zm0 7h2v-2h-2v2zm-2-2h-2v2h2v-2z"/>
                </svg>
                <span className="balance-text">{qrName}</span>
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
            <button className="profile-btn">
              <svg className="profile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="search-container">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input type="text" className="search-input" placeholder="Search for " />
          <button className="mic-btn">
            <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>

        {/* Categories Section */}
        <div className="categories-section">
          <button
            className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <div className="category-icon-large">
              <img 
                src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=100&h=100&fit=crop" 
                alt="All Categories"
              />
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
                onClick={() => setSelectedCategory(category._id)}
              >
                <div className="category-icon-large">
                  <img 
                    src={categoryImgUrl} 
                    alt={category.name}
                    onError={(e) => { 
                      e.target.src = 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop';
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </header>
      <main className="customer-main">
       
        {/* Products List - Card Design */}
        <section className="products-section">
          <div className="products-list">
            {products.map((product) => {
              const imgUrl = product.image && typeof product.image === 'string' 
                ? (product.image.startsWith('http') ? product.image : `${config.api.baseUrl}${product.image}`) 
                : null;

              const cartItem = cart.items?.find(item => item._id === product._id);
              const quantity = cartItem?.quantity || 0;
              
              return (
                <div key={product._id} className="product-card">
                  <div className="product-image">
                    {imgUrl ? (
                      <img 
                        src={imgUrl} 
                        alt={product.name}
                        onError={(e) => { 
                          e.target.src = 'https://via.placeholder.com/80x80?text=No+Image';
                        }}
                      />
                    ) : (
                      <div className="product-placeholder">
                        <span>🍽️</span>
                      </div>
                    )}
                  </div>
                  <div className="product-details">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-quantity">{quantity > 0 ? `${quantity}pcs` : '1pcs'}</p>
                  </div>
                  <div className="product-actions">
                    {quantity > 0 ? (
                      <>
                        <button 
                          className="quantity-btn minus"
                          onClick={() => removeItem(product._id)}
                        >
                          −
                        </button>
                        <span className="quantity-display">{quantity}</span>
                        <button 
                          className="quantity-btn plus"
                          onClick={() => addItem({ 
                            _id: product._id, 
                            name: product.name, 
                            price: product.price, 
                            image: product.image 
                          })}
                        >
                          +
                        </button>
                      </>
                    ) : (
                      <button 
                        className="quantity-btn plus-only"
                        onClick={() => addItem({ 
                          _id: product._id, 
                          name: product.name, 
                          price: product.price, 
                          image: product.image 
                        })}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
              ...(seat && { seat: seat })
            });
            navigate(`/customer/cart?${params.toString()}`);
          }}
          aria-label={`View Cart (${cart.items.length} items)`}
        >
          <span className="cart-icon">🛒</span>
          <span className="cart-count">{cart.items.length}</span>
        </button>
      )}
    </div>
  );
};

export default CustomerHome;
