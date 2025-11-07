const mongoose = require('mongoose');
const Theater = require('./models/Theater');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function checkTheater() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const theater = await Theater.findById('68f8837a541316c6ad54b79f');
    
    if (!theater) {
      console.log('❌ Theater not found');
      return;
    }

    console.log('\n🎭 Theater:', theater.name || theater.theaterName);
    console.log('📦 Products:', theater.products?.length || 0);
    
    if (theater.products && theater.products.length > 0) {
      console.log('\n📋 Products List:');
      theater.products.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log('   Price:', p.sellingPrice || p.pricing?.basePrice);
        console.log('   GST Type:', p.gstType);
        console.log('   Tax Rate:', p.taxRate || p.pricing?.taxRate);
        console.log('   Discount:', p.discountPercentage || p.pricing?.discountPercentage);
      });
      
      // Find and update Pop Corn product
      const popCornIndex = theater.products.findIndex(p => 
        p.name && p.name.toLowerCase().includes('corn') && 
        (p.sellingPrice === 190 || p.pricing?.basePrice === 190)
      );
      
      if (popCornIndex !== -1) {
        console.log('\n\n🎯 Found Pop Corn product! Updating...');
        const product = theater.products[popCornIndex];
        
        product.sellingPrice = 200;
        if (product.pricing) {
          product.pricing.basePrice = 200;
        }
        product.gstType = 'INCLUDE';
        
        await theater.save();
        
        console.log('✅ Updated successfully!');
        console.log('   Name:', product.name);
        console.log('   New Price: ₹200');
        console.log('   GST Type: INCLUDE');
        console.log('\n🎯 Refresh the page - Total should now be ₹190.00!');
      } else {
        console.log('\n❌ Pop Corn product with price ₹190 not found');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkTheater();