const mongoose = require('mongoose');
const Product = require('./models/Product');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function findAndUpdateProduct() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find products with 'corn' in the name
    const products = await Product.find({ name: /corn/i }).limit(5);
    
    console.log(`📦 Found ${products.length} products with 'corn' in name:`);
    products.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name} (ID: ${p._id})`);
      console.log('   Price:', p.sellingPrice || p.pricing?.basePrice);
      console.log('   GST Type:', p.gstType);
      console.log('   Tax Rate:', p.taxRate || p.pricing?.taxRate);
      console.log('   Discount:', p.discountPercentage || p.pricing?.discountPercentage, '%');
    });

    // Also search for products with price 190
    const priceProducts = await Product.find({
      $or: [
        { sellingPrice: 190 },
        { 'pricing.basePrice': 190 }
      ]
    }).limit(10);

    console.log(`\n\n💰 Found ${priceProducts.length} products with price ₹190:`);
    priceProducts.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name} (ID: ${p._id})`);
      console.log('   Price:', p.sellingPrice || p.pricing?.basePrice);
      console.log('   GST Type:', p.gstType);
      console.log('   Tax Rate:', p.taxRate || p.pricing?.taxRate);
      console.log('   Discount:', p.discountPercentage || p.pricing?.discountPercentage, '%');
    });

    if (priceProducts.length > 0) {
      console.log('\n\n🔧 Updating the first product with price ₹190...');
      const product = priceProducts[0];
      
      product.sellingPrice = 200;
      if (product.pricing) {
        product.pricing.basePrice = 200;
      }
      product.gstType = 'INCLUDE';
      
      await product.save();
      
      console.log('✅ Updated:', product.name);
      console.log('   New Price: ₹200');
      console.log('   GST Type: INCLUDE');
      console.log('\n🎯 Now refresh the page and the total should be ₹190.00');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

findAndUpdateProduct();
