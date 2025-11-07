// Cart Test Utilities
export const testCartPersistence = () => {

  // Test localStorage availability
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch (e) {

    return false;
  }
  
  // Check current cart in localStorage
  const currentCart = localStorage.getItem('yqpay_cart');

  if (currentCart) {
    try {
      const parsed = JSON.parse(currentCart);
  } catch (e) {
  }
  } else {
  }
  
  return true;
};

// Add this to browser console to test
window.testCartPersistence = testCartPersistence;