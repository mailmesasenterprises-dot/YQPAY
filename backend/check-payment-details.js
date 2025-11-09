const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';
const THEATER_ID = '6910485995ffe942c8fef423';

async function checkOrderPaymentDetails() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const TheaterOrders = mongoose.connection.collection('theaterorders');
    
    // Find the theater orders
    const theaterOrders = await TheaterOrders.findOne({ 
      theater: new mongoose.Types.ObjectId(THEATER_ID)
    });

    if (!theaterOrders) {
      console.log('❌ No theater orders document found');
      process.exit(1);
    }

    if (!theaterOrders.orderList || theaterOrders.orderList.length === 0) {
      console.log('❌ No orders in orderList');
      process.exit(1);
    }

    // Get recent orders
    const recentOrders = theaterOrders.orderList.slice(-5).reverse();
    
    console.log('📋 RECENT ORDERS WITH PAYMENT DETAILS:\n');
    console.log('='.repeat(80));
    
    for (const order of recentOrders) {
      console.log(`\n📦 Order: ${order.orderNumber}`);
      console.log(`   Amount: ₹${order.pricing?.total}`);
      console.log(`   Payment Method: ${order.payment?.method}`);
      console.log(`   Payment Status: ${order.payment?.status}`);
      
      if (order.payment?.status === 'paid') {
        console.log('\n   💳 Transaction Details:');
        console.log(`   ✅ Transaction ID: ${order.payment.transactionId || '❌ NOT SET'}`);
        console.log(`   ✅ Razorpay Payment ID: ${order.payment.razorpayPaymentId || '❌ NOT SET'}`);
        console.log(`   ✅ Razorpay Order ID: ${order.payment.razorpayOrderId || '❌ NOT SET'}`);
        console.log(`   ✅ Paid At: ${order.payment.paidAt || '❌ NOT SET'}`);
        
        // Check if all fields are present
        if (order.payment.transactionId && 
            order.payment.razorpayPaymentId && 
            order.payment.razorpayOrderId) {
          console.log('\n   🎉 ALL TRANSACTION IDS STORED CORRECTLY!');
        } else {
          console.log('\n   ⚠️  MISSING TRANSACTION IDS');
        }
      } else {
        console.log('   ℹ️  Payment not completed yet');
      }
      
      console.log('='.repeat(80));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkOrderPaymentDetails();
