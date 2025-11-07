const mongoose = require('mongoose');
const TheaterOrders = require('./models/TheaterOrders');

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function checkOrderIds() {
  try {
    console.log('\n🔍 Checking orders in database...\n');
    
    // Find all orders
    const orders = await TheaterOrders.find().sort({ createdAt: -1 }).limit(5);
    
    console.log(`Found ${orders.length} orders:\n`);
    
    orders.forEach((order, index) => {
      console.log(`Order ${index + 1}:`);
      console.log(`  _id (from DB): ${order._id}`);
      console.log(`  Order Number: ${order.orderNumber}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Theater ID: ${order.theaterId}`);
      console.log(`  Source: ${order.source}`);
      console.log(`  Created: ${order.createdAt}`);
      console.log('');
    });
    
    // Try to find by the ID we're searching for
    const searchId = '690e3d2d9b23f418ef982852';
    console.log(`\n🔎 Searching for order ID: ${searchId}`);
    const foundOrder = await TheaterOrders.findById(searchId);
    
    if (foundOrder) {
      console.log('✅ FOUND by findById!');
      console.log('  Order Number:', foundOrder.orderNumber);
    } else {
      console.log('❌ NOT FOUND by findById');
      
      // Try finding by orderNumber or other fields
      console.log('\n🔍 Searching by orderNumber...');
      const byOrderNumber = await TheaterOrders.findOne({ orderNumber: 'ORD-20251107-0001' });
      if (byOrderNumber) {
        console.log('✅ Found by order number!');
        console.log('  Real _id:', byOrderNumber._id);
        console.log('  Matches search ID?', byOrderNumber._id.toString() === searchId);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setTimeout(checkOrderIds, 1000);
