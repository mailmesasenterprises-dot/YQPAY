const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/theater_canteen_db';

async function checkProductImage() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find all products named "Pop Corn"
    const productContainers = await db.collection('productlist').find({}).toArray();
    
    console.log(`\n📦 Found ${productContainers.length} theaters with products\n`);
    
    for (const container of productContainers) {
      if (container.productList) {
        const popCorn = container.productList.find(p => 
          p.name && p.name.toLowerCase().includes('pop corn')
        );
        
        if (popCorn) {
          console.log('🍿 Found Pop Corn product:');
          console.log('  Theater ID:', container.theater);
          console.log('  Product ID:', popCorn._id);
          console.log('  Name:', popCorn.name);
          console.log('  Images:', JSON.stringify(popCorn.images, null, 2));
          console.log('  Image field:', popCorn.image);
          console.log('  Has images array:', !!popCorn.images);
          console.log('  Images array length:', popCorn.images?.length || 0);
          if (popCorn.images && popCorn.images.length > 0) {
            console.log('  First image URL:', popCorn.images[0].url);
          }
          console.log('\n');
        }
      }
    }
    
    await mongoose.connection.close();
    console.log('✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkProductImage();
