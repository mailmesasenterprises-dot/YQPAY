const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

async function searchProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📚 Collections in database:');
    collections.forEach(c => console.log('  -', c.name));

    // Search in products collection
    const productsCol = db.collection('productlist');
    const allProducts = await productsCol.find({}).limit(5).toArray();
    
    console.log('\n\n📦 Sample Products:');
    allProducts.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name}`);
      console.log('   Theater ID:', p.theaterId);
      console.log('   Price:', p.sellingPrice || p.pricing?.basePrice);
      console.log('   GST Type:', p.gstType);
      console.log('   Discount:', p.discountPercentage || p.pricing?.discountPercentage);
    });

    // Search for the specific theater products
    const theaterProducts = await productsCol.find({
      theaterId: '68f8837a541316c6ad54b79f'
    }).toArray();

    console.log(`\n\n🎭 Found ${theaterProducts.length} products for theater 68f8837a541316c6ad54b79f:`);
    theaterProducts.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.name} (ID: ${p._id})`);
      console.log('   Price:', p.sellingPrice || p.pricing?.basePrice);
      console.log('   GST Type:', p.gstType);
      console.log('   Tax Rate:', p.taxRate || p.pricing?.taxRate);
      console.log('   Discount:', p.discountPercentage || p.pricing?.discountPercentage, '%');
    });

    // Find the product with price 190
    const targetProduct = theaterProducts.find(p => 
      (p.sellingPrice === 190 || p.pricing?.basePrice === 190) &&
      (p.discountPercentage === 5 || p.pricing?.discountPercentage === 5)
    );

    if (targetProduct) {
      console.log('\n\n🎯 Found target product:', targetProduct.name);
      console.log('Updating...');
      
      await productsCol.updateOne(
        { _id: targetProduct._id },
        {
          $set: {
            sellingPrice: 200,
            'pricing.basePrice': 200,
            gstType: 'INCLUDE'
          }
        }
      );
      
      console.log('✅ Updated successfully!');
      console.log('   New Price: ₹200');
      console.log('   GST Type: INCLUDE');
      console.log('\n🎯 Refresh the page - Total should now be ₹190.00');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

searchProducts();
