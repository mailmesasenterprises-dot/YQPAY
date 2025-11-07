const mongoose = require('mongoose');
require('dotenv').config();

async function checkMonthlyStock() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const theaterId = '68f8837a541316c6ad54b79f';
    const productId = '6905a45543cd3c77584cd387';
    
    console.log('🔍 Checking MonthlyStock collection...\n');
    
    // Check all MonthlyStock for this theater
    const allStocks = await mongoose.connection.db.collection('monthlystocks').find({
      theater: new mongoose.Types.ObjectId(theaterId)
    }).toArray();
    
    console.log(`Found ${allStocks.length} MonthlyStock documents for this theater\n`);
    
    allStocks.forEach((stock, index) => {
      console.log(`📊 Stock ${index + 1}:`);
      console.log('  Product ID:', stock.product);
      console.log('  Year:', stock.year);
      console.log('  Month:', stock.month);
      console.log('  Days:', stock.days ? stock.days.length : 0);
      if (stock.days && stock.days.length > 0) {
        console.log('  Sample day:', stock.days[0]);
      }
      console.log('');
    });
    
    // Check for the specific product
    console.log(`\n🔍 Looking specifically for product ${productId}...\n`);
    const specificStock = await mongoose.connection.db.collection('monthlystocks').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      product: new mongoose.Types.ObjectId(productId)
    });
    
    if (specificStock) {
      console.log('✅ Found MonthlyStock for this product!');
      console.log('Year:', specificStock.year);
      console.log('Month:', specificStock.month);
      console.log('Days with data:', specificStock.days ? specificStock.days.length : 0);
    } else {
      console.log('❌ No MonthlyStock found for this product');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMonthlyStock();
