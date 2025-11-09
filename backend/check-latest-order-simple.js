const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

async function checkLatestOrders() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Collections:', collections.map(c => c.name).join(', '));

    // Check TheaterOrders
    const TheaterOrders = mongoose.connection.collection('theaterorders');
    const count = await TheaterOrders.countDocuments();
    console.log(`\n📊 TheaterOrders count: ${count}\n`);

    if (count > 0) {
      const doc = await TheaterOrders.findOne({});
      console.log('Theater ID:', doc.theater);
      console.log('Total orders:', doc.orderList?.length || 0);
      
      if (doc.orderList && doc.orderList.length > 0) {
        const latestOrder = doc.orderList[doc.orderList.length - 1];
        console.log('\n🎯 LATEST ORDER:');
        console.log('Order Number:', latestOrder.orderNumber);
        console.log('Payment Method:', latestOrder.payment?.method);
        console.log('Payment Status:', latestOrder.payment?.status);
        console.log('\n💳 Transaction IDs:');
        console.log('transactionId:', latestOrder.payment?.transactionId || '❌ NOT SET');
        console.log('razorpayPaymentId:', latestOrder.payment?.razorpayPaymentId || '❌ NOT SET');
        console.log('razorpayOrderId:', latestOrder.payment?.razorpayOrderId || '❌ NOT SET');
        console.log('razorpaySignature:', latestOrder.payment?.razorpaySignature || '❌ NOT SET');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkLatestOrders();
