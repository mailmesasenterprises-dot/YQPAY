const mongoose = require('mongoose');
const Product = require('./models/Product');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function updatePopCornProduct() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find Pop Corn product
    const product = await Product.findOne({ name: /Pop Corn/i });
    
    if (!product) {
      console.log('❌ Pop Corn product not found');
      return;
    }

    console.log('📦 Current Product:', {
      name: product.name,
      sellingPrice: product.sellingPrice || product.pricing?.basePrice,
      gstType: product.gstType,
      taxRate: product.taxRate || product.pricing?.taxRate,
      discount: product.discountPercentage || product.pricing?.discountPercentage
    });

    // Update the product
    product.sellingPrice = 200;
    
    // Update pricing object if it exists
    if (product.pricing) {
      product.pricing.basePrice = 200;
    }
    
    // Set GST Type to INCLUDE
    product.gstType = 'INCLUDE';
    
    await product.save();

    console.log('✅ Updated Product:', {
      name: product.name,
      sellingPrice: product.sellingPrice || product.pricing?.basePrice,
      gstType: product.gstType,
      taxRate: product.taxRate || product.pricing?.taxRate,
      discount: product.discountPercentage || product.pricing?.discountPercentage
    });

    console.log('\n🎯 Expected Calculation:');
    console.log('Price: ₹200 (GST INCLUDE)');
    console.log('Discount 5%: ₹10');
    console.log('After discount: ₹190');
    console.log('GST (already included): Extracted from ₹190');
    console.log('Total: ₹190.00 ✅');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

updatePopCornProduct();
