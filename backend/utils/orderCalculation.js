/**
 * Order Calculation Utility (Backend)
 * Handles order total calculations with GST and discount support
 * Mirrors frontend logic for consistency
 */

/**
 * Calculate order totals with dynamic GST and discount handling
 * @param {Array} orderItems - Array of order items with product data
 * @returns {Object} Object containing subtotal, tax, total, and totalDiscount
 */
const calculateOrderTotals = (orderItems = []) => {
  let calculatedSubtotal = 0; // Original prices (before discount)
  let calculatedTax = 0;
  let calculatedDiscount = 0;
  let hasIncludeGST = false; // Track if any item has GST INCLUDE
  
  orderItems.forEach(item => {
    const price = parseFloat(item.unitPrice) || 0;
    const qty = parseInt(item.quantity) || 0;
    const taxRate = parseFloat(item.taxRate || item.product?.pricing?.taxRate || item.product?.taxRate) || 0;
    
    // Handle both formats: Check pricing object first, then root level
    const gstTypeRaw = item.gstType || item.product?.pricing?.gstType || item.product?.gstType || 'EXCLUDE';
    const gstType = gstTypeRaw.toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
    
    if (gstType === 'INCLUDE') {
      hasIncludeGST = true;
    }
    
    const discountPercentage = parseFloat(item.discountPercentage || item.product?.pricing?.discountPercentage || item.product?.discountPercentage) || 0;
    
    const lineTotal = price * qty;
    
    // Add original price to subtotal (before discount)
    calculatedSubtotal += lineTotal;
    
    if (gstType === 'INCLUDE') {
      // GST INCLUDE - Price already includes GST
      // Step 1: Calculate discount amount on original price
      const discountAmount = discountPercentage > 0 ? lineTotal * (discountPercentage / 100) : 0;
      
      // Step 2: Apply discount to get price after discount
      const priceAfterDiscount = lineTotal - discountAmount;
      
      // Step 3: Extract GST from the discounted price (for display only)
      const taxAmount = priceAfterDiscount * (taxRate / (100 + taxRate));
      
      calculatedTax += taxAmount;
      calculatedDiscount += discountAmount;
    } else {
      // GST EXCLUDE - GST is added on top
      // Calculate discount on the original price
      const discountAmount = discountPercentage > 0 ? lineTotal * (discountPercentage / 100) : 0;
      
      // Apply discount first
      const discountedLineTotal = lineTotal - discountAmount;
      
      // Calculate tax on the discounted amount
      const taxAmount = discountedLineTotal * (taxRate / 100);
      
      calculatedTax += taxAmount;
      calculatedDiscount += discountAmount;
    }
  });
  
  // Round individual components first
  const roundedSubtotal = Math.round(calculatedSubtotal * 100) / 100;
  const roundedTax = Math.round(calculatedTax * 100) / 100;
  const roundedDiscount = Math.round(calculatedDiscount * 100) / 100;
  
  // Calculate total based on GST type:
  // - For GST INCLUDE: Total = Subtotal - Discount (tax already included)
  // - For GST EXCLUDE: Total = Subtotal - Discount + Tax
  const calculatedTotal = hasIncludeGST 
    ? roundedSubtotal - roundedDiscount  // GST INCLUDE
    : roundedSubtotal - roundedDiscount + roundedTax;  // GST EXCLUDE
  
  return { 
    subtotal: roundedSubtotal, // Original price (before discount)
    tax: roundedTax, 
    total: Math.round(calculatedTotal * 100) / 100,
    totalDiscount: roundedDiscount
  };
};

/**
 * Calculate line item total with proper GST and discount handling
 * @param {Object} item - Order line item
 * @returns {number} Final line item total
 */
const calculateLineItemTotal = (item) => {
  const price = parseFloat(item.unitPrice) || 0;
  const qty = parseInt(item.quantity) || 0;
  const taxRate = parseFloat(item.taxRate || item.product?.pricing?.taxRate || item.product?.taxRate) || 0;
  
  const gstTypeRaw = item.gstType || item.product?.pricing?.gstType || item.product?.gstType || 'EXCLUDE';
  const gstType = gstTypeRaw.toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
  
  const discountPercentage = parseFloat(item.discountPercentage || item.product?.pricing?.discountPercentage || item.product?.discountPercentage) || 0;
  
  const lineTotal = price * qty;
  const discountAmount = discountPercentage > 0 ? lineTotal * (discountPercentage / 100) : 0;
  const priceAfterDiscount = lineTotal - discountAmount;
  
  if (gstType === 'INCLUDE') {
    // For GST INCLUDE, price already includes tax
    return Math.round(priceAfterDiscount * 100) / 100;
  } else {
    // For GST EXCLUDE, add tax on top
    const taxAmount = priceAfterDiscount * (taxRate / 100);
    return Math.round((priceAfterDiscount + taxAmount) * 100) / 100;
  }
};

module.exports = {
  calculateOrderTotals,
  calculateLineItemTotal
};
