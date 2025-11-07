/**
 * Order Calculation Utility
 * Handles order total calculations with GST and discount support
 */

/**
 * Calculate order totals with dynamic GST and discount handling
 * @param {Array} orderItems - Array of order items with price, quantity, tax, etc.
 * @returns {Object} Object containing subtotal, tax, total, and totalDiscount
 */
export const calculateOrderTotals = (orderItems = []) => {
  let calculatedSubtotal = 0; // Original prices (before discount)
  let calculatedTax = 0;
  let calculatedDiscount = 0;
  let hasIncludeGST = false; // Track if any item has GST INCLUDE
  
  orderItems.forEach(item => {
    const price = parseFloat(item.sellingPrice) || 0;
    const qty = parseInt(item.quantity) || 0;
    const taxRate = parseFloat(item.taxRate) || 0;
    
    // Handle both formats: Check pricing object first, then root level
    const gstTypeRaw = item.pricing?.gstType || item.gstType || 'EXCLUDE';
    const gstType = gstTypeRaw.toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
    
    if (gstType === 'INCLUDE') {
      hasIncludeGST = true;
    }
    
    console.log('🔍 GST Type Debug:', {
      productName: item.name,
      gstTypeRaw: gstTypeRaw,
      gstTypeNormalized: gstType,
      taxRate: taxRate
    });
    
    const discountPercentage = parseFloat(item.discountPercentage) || 0;
    
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
      
      console.log('✅ GST INCLUDE calculation:', {
        lineTotal,
        discountAmount,
        priceAfterDiscount,
        taxAmount: taxAmount.toFixed(2),
        note: 'Tax is extracted for display, already included in price'
      });
      
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
      
      console.log('❌ GST EXCLUDE calculation:', {
        lineTotal,
        discountAmount,
        discountedLineTotal,
        taxAmount: taxAmount.toFixed(2),
        note: 'Tax will be added to total'
      });
      
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
 * Calculate line item total for a single product
 * @param {Object} item - Order item with price, quantity, tax, discount
 * @returns {Object} Object containing lineTotal, taxAmount, discountAmount, finalTotal
 */
export const calculateLineItemTotal = (item) => {
  const price = parseFloat(item.sellingPrice) || 0;
  const qty = parseInt(item.quantity) || 0;
  const taxRate = parseFloat(item.taxRate) || 0;
  const gstType = item.gstType || 'EXCLUDE';
  const discountPercentage = parseFloat(item.discountPercentage) || 0;
  
  const lineTotal = price * qty;
  let taxAmount = 0;
  let discountAmount = 0;
  let basePrice = lineTotal;
  
  if (gstType === 'INCLUDE') {
    // GST INCLUDE - Price already includes GST
    // Apply discount first
    discountAmount = discountPercentage > 0 ? lineTotal * (discountPercentage / 100) : 0;
    const priceAfterDiscount = lineTotal - discountAmount;
    
    // Extract GST from discounted price
    taxAmount = priceAfterDiscount * (taxRate / (100 + taxRate));
    basePrice = priceAfterDiscount - taxAmount;
  } else {
    // GST EXCLUDE - GST is added on top
    discountAmount = discountPercentage > 0 ? lineTotal * (discountPercentage / 100) : 0;
    const discountedLineTotal = lineTotal - discountAmount;
    taxAmount = discountedLineTotal * (taxRate / 100);
    basePrice = discountedLineTotal;
  }
  
  const finalTotal = basePrice + taxAmount;
  
  return {
    lineTotal: Math.round(lineTotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    basePrice: Math.round(basePrice * 100) / 100,
    finalTotal: Math.round(finalTotal * 100) / 100
  };
};

/**
 * Format currency in Indian Rupees
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

/**
 * Round to 2 decimal places
 * @param {number} value - Value to round
 * @returns {number} Rounded value
 */
export const roundToTwo = (value) => {
  return Math.round((value || 0) * 100) / 100;
};
