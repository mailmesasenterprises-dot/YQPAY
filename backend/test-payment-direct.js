// Simple test - just test the payment order creation with a mock order ID
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';
const THEATER_ID = '6910485995ffe942c8fef423';

async function testPaymentOrderCreation() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Load models
    const Theater = require('./models/Theater');
    const TheaterOrders = require('./models/TheaterOrders');
    const paymentService = require('./services/paymentService');

    // Get theater
    const theater = await Theater.findById(THEATER_ID);
    if (!theater) {
      console.log('❌ Theater not found');
      process.exit(1);
    }

    console.log('🎭 Theater:', theater.name);

    // Get latest order
    const theaterOrders = await TheaterOrders.findOne({ theater: THEATER_ID });
    if (!theaterOrders || !theaterOrders.orderList || theaterOrders.orderList.length === 0) {
      console.log('❌ No orders found');
      process.exit(1);
    }

    const latestOrder = theaterOrders.orderList[theaterOrders.orderList.length - 1];
    console.log('📦 Latest Order:', latestOrder.orderNumber);
    console.log('💰 Total:', latestOrder.pricing?.total);
    console.log('📍 Source:', latestOrder.source);

    // Prepare order for payment service
    const orderForPayment = {
      _id: latestOrder._id,
      orderNumber: latestOrder.orderNumber,
      theaterId: THEATER_ID,
      pricing: latestOrder.pricing || { 
        total: latestOrder.totalAmount,
        currency: 'INR'
      },
      payment: latestOrder.payment,
      customerInfo: latestOrder.customerInfo,
      orderType: latestOrder.source,
      source: latestOrder.source
    };

    console.log('\n🔄 Determining channel...');
    const channel = paymentService.determineChannel(latestOrder.source || 'pos');
    console.log('📡 Channel:', channel);

    console.log('\n🔑 Getting gateway config...');
    const gatewayConfig = paymentService.getGatewayConfig(theater, channel);
    console.log('✅ Gateway:', gatewayConfig.provider, '- Enabled:', gatewayConfig.enabled);

    console.log('\n💳 Creating Razorpay order...');
    const paymentOrder = await paymentService.createPaymentOrder(
      theater,
      orderForPayment,
      channel
    );

    console.log('\n🎉 SUCCESS! Payment order created:');
    console.log(JSON.stringify(paymentOrder, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

testPaymentOrderCreation();
