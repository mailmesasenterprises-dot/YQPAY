const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

async function checkAllOrders() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check all possible collections for orders
    const collections = ['orders', 'theaterorders', 'Orders', 'TheaterOrders'];
    
    for (const collName of collections) {
      try {
        const coll = mongoose.connection.collection(collName);
        const count = await coll.countDocuments();
        console.log(`📊 ${collName}: ${count} documents`);
        
        if (count > 0) {
          const sample = await coll.findOne({});
          console.log(`   Sample ID: ${sample._id}`);
          if (sample.orderList) {
            console.log(`   Has orderList with ${sample.orderList.length} orders`);
            if (sample.orderList.length > 0) {
              const latest = sample.orderList[sample.orderList.length - 1];
              console.log(`   Latest order: ${latest.orderNumber}`);
              console.log(`   Payment: ${latest.payment?.method} - ${latest.payment?.status}`);
            }
          } else if (sample.orderNumber) {
            console.log(`   Direct order: ${sample.orderNumber}`);
            console.log(`   Payment: ${sample.payment?.method} - ${sample.payment?.status}`);
          }
        }
      } catch (err) {
        console.log(`   ${collName}: Collection not found`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAllOrders();
