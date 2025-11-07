const mongoose = require('mongoose');

async function findTheater() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Find theaters collection
    const theatersCol = db.collection('theaters');
    const count = await theatersCol.countDocuments();
    console.log(`\n🎭 Theaters collection: ${count} documents`);
    
    const theaters = await theatersCol.find({}).toArray();
    console.log(`\nFound ${theaters.length} theaters:`);
    
    theaters.forEach((t, i) => {
      console.log(`\n${i + 1}. ${t.name || t.theaterName} (ID: ${t._id})`);
      console.log('   Products:', t.products?.length || 0);
      
      if (t.products && t.products.length > 0) {
        t.products.slice(0, 3).forEach((p, pi) => {
          console.log(`   ${pi + 1}. ${p.name} - ₹${p.sellingPrice || p.pricing?.basePrice}`);
        });
      }
    });
    
    // Update product in the first theater
    if (theaters.length > 0) {
      const theater = theaters[0];
      console.log(`\n\n🔧 Working with theater: ${theater.name || theater.theaterName}`);
      
      if (theater.products) {
        const productIndex = theater.products.findIndex(p => 
          (p.sellingPrice === 190 || p.pricing?.basePrice === 190) &&
          (p.discountPercentage === 5 || p.pricing?.discountPercentage === 5)
        );
        
        if (productIndex !== -1) {
          const product = theater.products[productIndex];
          console.log(`\n✅ Found product: ${product.name}`);
          console.log('   Current Price:', product.sellingPrice || product.pricing?.basePrice);
          console.log('   Current GST Type:', product.gstType);
          
          // Update the product
          theater.products[productIndex].sellingPrice = 200;
          if (theater.products[productIndex].pricing) {
            theater.products[productIndex].pricing.basePrice = 200;
          }
          theater.products[productIndex].gstType = 'INCLUDE';
          
          await theatersCol.updateOne(
            { _id: theater._id },
            { $set: { products: theater.products } }
          );
          
          console.log('\n✅ Updated successfully!');
          console.log('   New Price: ₹200');
          console.log('   New GST Type: INCLUDE');
          console.log('\n🎯 Refresh your browser - Total should now be ₹190.00!');
        } else {
          console.log('\n❌ No product found with price ₹190 and discount 5%');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
  }
}

findTheater();
