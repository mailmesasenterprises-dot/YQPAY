import React, { createContext, useContext, useReducer, useEffect, useState, useMemo, useCallback } from 'react';
import { calculateOrderTotals } from '../utils/orderCalculation';

const CartContext = createContext();

// 🚀 OPTIMIZED: Split into state and actions contexts
const CartStateContext = createContext();
const CartActionsContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const useCartState = () => {
  const context = useContext(CartStateContext);
  if (!context) {
    throw new Error('useCartState must be used within a CartProvider');
  }
  return context;
};

export const useCartActions = () => {
  const context = useContext(CartActionsContext);
  if (!context) {
    throw new Error('useCartActions must be used within a CartProvider');
  }
  return context;
};

const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  LOAD_CART: 'LOAD_CART'
};

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

const initialState = {
  items: []
};

// 🚀 OPTIMIZED: Memoized provider component
export const CartProvider = React.memo(({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadCart = () => {
      try {
        const testKey = 'test_storage';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);

        const savedCart = localStorage.getItem('yqpay_cart');

        if (savedCart && savedCart !== 'null' && savedCart !== '[]') {
          const cartItems = JSON.parse(savedCart);
          if (Array.isArray(cartItems) && cartItems.length > 0) {
            dispatch({ type: CART_ACTIONS.LOAD_CART, payload: cartItems });
          }
        }
      } catch (error) {
        // Silent fail
      } finally {
        setIsLoaded(true);
      }
    };

    setTimeout(loadCart, 100);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      const cartData = JSON.stringify(state.items);
      localStorage.setItem('yqpay_cart', cartData);
    } catch (error) {
      // Silent fail
    }
  }, [state.items, isLoaded]);

  // Development helper - make cart state accessible in console
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      window.cartState = state;
      window.cartActions = { addItem, removeItem, updateQuantity, clearCart };
    }
  }, [state]);

  // 🚀 OPTIMIZED: Memoized cart actions
  const addItem = useCallback((product) => {
    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: product });
  }, []);

  const removeItem = useCallback((product) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: product });
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    dispatch({ 
      type: CART_ACTIONS.UPDATE_QUANTITY, 
      payload: { _id: productId, quantity } 
    });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  }, []);

  // 🚀 OPTIMIZED: Memoized getters
  const getItemQuantity = useCallback((productId) => {
    const item = state.items.find(item => item._id === productId);
    return item ? item.quantity : 0;
  }, [state.items]);

  const getVariantQuantity = useCallback((variantId) => {
    const item = state.items.find(item => 
      item._id === variantId || item.variant?.id === variantId
    );
    return item ? item.quantity : 0;
  }, [state.items]);

  const getCollectionQuantity = useCallback((collectionName) => {
    return state.items
      .filter(item => item.name.includes(collectionName))
      .reduce((total, item) => total + item.quantity, 0);
  }, [state.items]);

  const getVariantsByCollection = useCallback((collectionName) => {
    return state.items.filter(item => item.name.includes(collectionName));
  }, [state.items]);

  const getTotalItems = useCallback(() => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  }, [state.items]);

  const getTotalPrice = useCallback(() => {
    return state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [state.items]);

  // 🚀 OPTIMIZED: Memoized calculated totals
  const getCalculatedTotals = useCallback(() => {
    const orderItems = state.items.map(item => ({
      ...item,
      sellingPrice: parseFloat(item.price) || 0,
      quantity: item.quantity,
      taxRate: parseFloat(item.taxRate) || 0,
      gstType: item.gstType || item.pricing?.gstType || 'EXCLUDE',
      discountPercentage: parseFloat(item.discountPercentage || item.pricing?.discountPercentage) || 0,
      pricing: item.pricing
    }));
    
    return calculateOrderTotals(orderItems);
  }, [state.items]);

  const getSubtotal = useCallback(() => {
    const totals = getCalculatedTotals();
    return totals.subtotal;
  }, [getCalculatedTotals]);

  const getDeliveryCharge = useCallback(() => {
    return state.items.length > 0 ? 20.00 : 0;
  }, [state.items.length]);

  const getTax = useCallback(() => {
    const totals = getCalculatedTotals();
    return totals.tax;
  }, [getCalculatedTotals]);

  const getFinalTotal = useCallback(() => {
    const totals = getCalculatedTotals();
    return totals.total + getDeliveryCharge();
  }, [getCalculatedTotals, getDeliveryCharge]);

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  }, []);

  // 🚀 OPTIMIZED: Memoized computed values
  const computedValues = useMemo(() => {
    const totals = getCalculatedTotals();
    const delivery = getDeliveryCharge();
    return {
      totalItems: getTotalItems(),
      subtotal: totals.subtotal,
      deliveryCharge: delivery,
      tax: totals.tax,
      total: totals.total + delivery,
      isEmpty: state.items.length === 0
    };
  }, [state.items, getTotalItems, getCalculatedTotals, getDeliveryCharge]);

  // 🚀 OPTIMIZED: Memoized state value
  const stateValue = useMemo(() => ({
    items: state.items,
    isLoading: !isLoaded,
    ...computedValues,
  }), [state.items, isLoaded, computedValues]);

  // 🚀 OPTIMIZED: Memoized actions value
  const actionsValue = useMemo(() => ({
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
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
  }), [addItem, removeItem, updateQuantity, clearCart, getItemQuantity, getVariantQuantity, getCollectionQuantity, getVariantsByCollection, getTotalItems, getTotalPrice, getSubtotal, getDeliveryCharge, getTax, getFinalTotal, formatPrice]);

  // 🚀 OPTIMIZED: Combined value for backward compatibility
  const combinedValue = useMemo(() => ({
    ...stateValue,
    ...actionsValue,
  }), [stateValue, actionsValue]);

  return (
    <CartContext.Provider value={combinedValue}>
      <CartStateContext.Provider value={stateValue}>
        <CartActionsContext.Provider value={actionsValue}>
          {children}
        </CartActionsContext.Provider>
      </CartStateContext.Provider>
    </CartContext.Provider>
  );
});

CartProvider.displayName = 'CartProvider';

export default CartContext;
