import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';

// Cart Context
const CartContext = createContext();

// Cart Actions
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  LOAD_CART: 'LOAD_CART'
};

// Cart Reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case CART_ACTIONS.ADD_ITEM: {
      const existingItem = state.items.find(item => 
        item._id === action.payload._id || 
        (item.variant?.id === action.payload.variant?.id && item.variant?.id)
      );
      
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            (item._id === action.payload._id || 
             (item.variant?.id === action.payload.variant?.id && item.variant?.id))
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        };
      } else {
        return {
          ...state,
          items: [...state.items, { ...action.payload, quantity: 1 }]
        };
      }
    }

    case CART_ACTIONS.REMOVE_ITEM: {
      const existingItem = state.items.find(item => item._id === action.payload._id);
      
      if (existingItem && existingItem.quantity > 1) {
        return {
          ...state,
          items: state.items.map(item =>
            item._id === action.payload._id
              ? { ...item, quantity: item.quantity - 1 }
              : item
          )
        };
      } else {
        return {
          ...state,
          items: state.items.filter(item => item._id !== action.payload._id)
        };
      }
    }

    case CART_ACTIONS.UPDATE_QUANTITY: {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(item => item._id !== action.payload._id)
        };
      }
      
      return {
        ...state,
        items: state.items.map(item =>
          item._id === action.payload._id
            ? { ...item, quantity: action.payload.quantity }
            : item
        )
      };
    }

    case CART_ACTIONS.CLEAR_CART: {
      return {
        ...state,
        items: []
      };
    }

    case CART_ACTIONS.LOAD_CART: {
      return {
        ...state,
        items: action.payload
      };
    }

    default:
      return state;
  }
};

// Initial state
const initialState = {
  items: []
};

// Cart Provider Component
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadCart = () => {
      try {
        // Test localStorage availability
        const testKey = 'test_storage';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);

        const savedCart = localStorage.getItem('yqpay_cart');

        if (savedCart && savedCart !== 'null' && savedCart !== '[]') {
          const cartItems = JSON.parse(savedCart);

          if (Array.isArray(cartItems) && cartItems.length > 0) {
            dispatch({ type: CART_ACTIONS.LOAD_CART, payload: cartItems });
  }
        } else {
  }
      } catch (error) {
  } finally {
        setIsLoaded(true);
      }
    };

    // Small delay to ensure localStorage is available
    setTimeout(loadCart, 100);
  }, []);

  // Save cart to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    
    try {

      const cartData = JSON.stringify(state.items);
      localStorage.setItem('yqpay_cart', cartData);

      // Verify the save worked
      const verification = localStorage.getItem('yqpay_cart');
      if (verification === cartData) {
  } else {
  }
    } catch (error) {
  }
  }, [state.items, isLoaded]);

  // Development helper - make cart state accessible in console
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.cartState = state;
      window.cartActions = { addItem, removeItem, updateQuantity, clearCart };
  }
  }, [state]);

  // Cart actions
  const addItem = (product) => {

    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: product });
  };

  const removeItem = (product) => {

    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: product });
  };

  const updateQuantity = (productId, quantity) => {

    dispatch({ 
      type: CART_ACTIONS.UPDATE_QUANTITY, 
      payload: { _id: productId, quantity } 
    });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  };

  const getItemQuantity = (productId) => {
    const item = state.items.find(item => item._id === productId);
    return item ? item.quantity : 0;
  };

  // Variant-specific utility functions
  const getVariantQuantity = (variantId) => {
    const item = state.items.find(item => 
      item._id === variantId || item.variant?.id === variantId
    );
    return item ? item.quantity : 0;
  };

  const getCollectionQuantity = (collectionName) => {
    return state.items
      .filter(item => item.name.includes(collectionName))
      .reduce((total, item) => total + item.quantity, 0);
  };

  const getVariantsByCollection = (collectionName) => {
    return state.items.filter(item => item.name.includes(collectionName));
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getSubtotal = () => {
    let subtotal = 0;
    
    state.items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const gstType = item.gstType || 'EXCLUDE';
      
      const lineTotal = price * qty;
      
      if (gstType === 'INCLUDE') {
        // Price already includes GST, calculate base price
        const basePrice = lineTotal / (1 + (taxRate / 100));
        subtotal += basePrice;
      } else {
        // GST EXCLUDE - price is the subtotal
        subtotal += lineTotal;
      }
    });
    
    return parseFloat(subtotal.toFixed(2));
  };

  const getDeliveryCharge = () => {
    return state.items.length > 0 ? 20.00 : 0; // ₹20 delivery charge if cart has items
  };

  const getTax = () => {
    let totalTax = 0;
    
    state.items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const qty = parseInt(item.quantity) || 0;
      const taxRate = parseFloat(item.taxRate) || 0;
      const gstType = item.gstType || 'EXCLUDE';
      
      const lineTotal = price * qty;
      
      if (gstType === 'INCLUDE') {
        // Price already includes GST, extract the GST amount
        const basePrice = lineTotal / (1 + (taxRate / 100));
        const gstAmount = lineTotal - basePrice;
        totalTax += gstAmount;
      } else {
        // GST EXCLUDE - add GST on top of price
        const gstAmount = lineTotal * (taxRate / 100);
        totalTax += gstAmount;
      }
    });
    
    return parseFloat(totalTax.toFixed(2));
  };

  const getFinalTotal = () => {
    return getSubtotal() + getDeliveryCharge() + getTax();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const value = {
    // State
    items: state.items,
    isLoading: !isLoaded,
    
    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    
    // Getters
    getItemQuantity,
    getVariantQuantity,
    getCollectionQuantity,
    getVariantsByCollection,
    getTotalItems,
    getTotalPrice,
    getSubtotal,
    getDeliveryCharge,
    getTax,
    getFinalTotal,
    formatPrice,
    
    // Computed values
    totalItems: getTotalItems(),
    subtotal: getSubtotal(),
    deliveryCharge: getDeliveryCharge(),
    tax: getTax(),
    total: getFinalTotal(),
    isEmpty: state.items.length === 0
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

// Custom hook to use cart context
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartContext;