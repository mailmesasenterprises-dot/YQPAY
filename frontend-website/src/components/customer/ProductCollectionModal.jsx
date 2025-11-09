import React, { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { useNavigate, useLocation } from 'react-router-dom';
import InstantImage from '../InstantImage'; // 🚀 Instant image loading
import '../../styles/components/customer/ProductCollectionModal.css';

const ProductCollectionModal = ({ collection, isOpen, onClose }) => {
  const { addItem, removeItem, getItemQuantity, totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [slideDirection, setSlideDirection] = useState('right');

  useEffect(() => {
    if (isOpen && collection?.variants?.length > 0) {
      // Sort variants: available first, out of stock last
      const sortedVariants = [...collection.variants].sort((a, b) => {
        const aAvailable = (a.originalProduct || a).isAvailable !== false;
        const bAvailable = (b.originalProduct || b).isAvailable !== false;
        
        // Available items come first
        if (aAvailable && !bAvailable) return -1;
        if (!aAvailable && bAvailable) return 1;
        return 0;
      });
      
      // Select first available variant, or first variant if all out of stock
      const firstAvailable = sortedVariants.find(v => (v.originalProduct || v).isAvailable !== false);
      const variantToSelect = firstAvailable || sortedVariants[0];
      
      setSelectedVariant(variantToSelect);
      setSelectedImage(variantToSelect.image || collection.baseImage);
      setSlideDirection('right');
      
      // Update collection variants with sorted order
      collection.variants = sortedVariants;
      
      // Preload all variant images for instant switching
      collection.variants.forEach(variant => {
        if (variant.image) {
          const img = new Image();
          img.src = variant.image;
        }
      });
    }
  }, [isOpen, collection]);

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    
    // Check if variant is available
    const product = selectedVariant.originalProduct || selectedVariant;
    if (product.isAvailable === false) {
      return; // Don't add to cart if not available
    }
    
    addItem({
      _id: selectedVariant._id,
      name: `${collection.name} - ${selectedVariant.sizeLabel || selectedVariant.size}`,
      price: selectedVariant.price,
      image: selectedVariant.image || collection.baseImage,
      size: selectedVariant.size,
      taxRate: product.taxRate || 0,
      gstType: product.gstType || 'EXCLUDE',
      discountPercentage: product.discountPercentage || 0
    });
  };

  const handleNavigation = (path) => {
    const params = new URLSearchParams(location.search);
    navigate(`${path}?${params.toString()}`);
  };

  if (!isOpen || !collection) return null;

  const handleVariantClick = (variant, index) => {
    // Determine slide direction based on variant position
    const totalVariants = collection.variants.length;
    const middleIndex = (totalVariants - 1) / 2;
    
    if (index < middleIndex) {
      setSlideDirection('left');
    } else if (index > middleIndex) {
      setSlideDirection('right');
    } else {
      setSlideDirection('center');
    }
    
    setSelectedVariant(variant);
    setSelectedImage(variant.image || collection.baseImage);
  };

  const getCircularPosition = (index, total) => {
    // Changed to straight horizontal line instead of circular arc
    const spacing = 85; // Space between each item
    const totalWidth = (total - 1) * spacing;
    const startX = -totalWidth / 2; // Center the line
    return { x: startX + (index * spacing), y: 0 }; // y: 0 keeps them in a straight line
  };

  return (
    <div className="circular-modal-overlay" onClick={onClose}>
      <div className="circular-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-top-bar">
        </div>
        <div className="modal-main-content">
          
          {/* Product Name - Above Center Image */}
          <div className="product-name-above-image">
            <h2>{collection.name}</h2>
          </div>

          {/* Center Product Image */}
          <div className={`center-product-image slide-from-${slideDirection}`} key={selectedImage || collection.baseImage}>
            <InstantImage
              src={selectedImage || collection.baseImage} 
              alt={collection.name}
              loading="eager"
              onError={(e) => { 
                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="300"%3E%3Crect fill="%23f0f0f0" width="300" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" font-size="80"%3E🍿%3C/text%3E%3C/svg%3E'; 
              }}
            />
          </div>

          {/* Product Size/Quantity Label Below Center Image */}
          {selectedVariant && (
            <div className="selected-product-quantity">
              {selectedVariant.sizeLabel || selectedVariant.size}
            </div>
          )}

          {/* Product Price - Bottom Center */}
          {selectedVariant && (
            <div className="product-price-display">
              ₹{selectedVariant.price}
            </div>
          )}

          <div className="circular-menu-right">
            {collection.variants?.map((variant, index) => {
              const pos = getCircularPosition(index, collection.variants.length);
              const isSelected = selectedVariant?._id === variant._id;
              const quantity = getItemQuantity(variant._id);
              const product = variant.originalProduct || variant;
              const isAvailable = product.isAvailable !== false;
              
              return (
                <button 
                  key={variant._id} 
                  className={`circular-variant-item ${isSelected ? 'selected' : ''} ${!isAvailable ? 'variant-out-of-stock' : ''}`}
                  style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                  onClick={() => isAvailable && handleVariantClick(variant, index)}
                  disabled={!isAvailable}
                >
                  <div className="variant-image-circle">
                    <InstantImage
                      src={variant.image || collection.baseImage} 
                      alt={variant.sizeLabel || variant.size}
                      onError={(e) => { 
                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60"%3E%3Crect fill="%23ddd" width="60" height="60"/%3E%3C/svg%3E'; 
                      }}
                    />
                    {!isAvailable && (
                      <div className="variant-out-of-stock-badge">Out</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quantity Controls - Right Side */}
          {selectedVariant && (() => {
            const product = selectedVariant.originalProduct || selectedVariant;
            const isAvailable = product.isAvailable !== false;
            
            return (
              <div className="modal-quantity-controls">
                {isAvailable ? (
                  <>
                    <button 
                      className="modal-quantity-btn modal-minus-btn"
                      onClick={() => removeItem(selectedVariant)}
                      aria-label="Decrease quantity"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                    
                    <span className="modal-quantity-display">{getItemQuantity(selectedVariant._id)}</span>
                    
                    <button 
                      className="modal-quantity-btn modal-plus-btn"
                      onClick={handleAddToCart}
                      aria-label="Increase quantity"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </>
                ) : (
                  <div className="modal-out-of-stock-message">
                    <span className="out-of-stock-badge-modal">OUT OF STOCK</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Back Icon - Bottom Left */}
          <button 
            className="modal-back-icon"
            onClick={onClose}
            aria-label="Back to products"
          >
            <span className="back-arrow">←</span>
          </button>

          {/* Floating Cart Icon - Bottom Right */}
          {totalItems > 0 && (
            <button 
              className="modal-floating-cart-icon"
              onClick={() => {
                const params = new URLSearchParams(location.search);
                navigate(`/customer/cart?${params.toString()}`);
              }}
              aria-label={`View Cart (${totalItems} items)`}
            >
              <span className="cart-icon">🛒</span>
              <span className="cart-count">{totalItems}</span>
            </button>
          )}

        </div>
        <div className="background-blur-image">
          <InstantImage
            src={selectedImage || collection.baseImage} 
            alt="background" 
            onError={(e) => { 
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="800"%3E%3Crect fill="%23333" width="600" height="800"/%3E%3C/svg%3E'; 
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductCollectionModal;
