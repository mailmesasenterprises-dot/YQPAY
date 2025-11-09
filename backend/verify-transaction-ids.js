const mongoose = require('mongoose');
require('dotenv').config();

async function checkLatestOrder() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the latest theaterorders document
    const theaterOrders = await db.collection('theaterorders')
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .toArray();
    
    if (theaterOrders.length === 0) {
      console.log('❌ No theater orders found');
      await mongoose.disconnect();
      return;
    }
    
    const doc = theaterOrders[0];
    console.log('\n📋 Theater Orders Document:');
    console.log('Theater ID:', doc.theater);
    console.log('Total orders in list:', doc.orderList?.length || 0);
    
    if (doc.orderList && doc.orderList.length > 0) {
      const latestOrder = doc.orderList[doc.orderList.length - 1];
      
      console.log('\n🎫 LATEST ORDER DETAILS:');
      console.log('=====================================');
      console.log('Order ID:', latestOrder._id);
      console.log('Order Number:', latestOrder.orderNumber);
      console.log('Status:', latestOrder.status);
      console.log('\n💳 PAYMENT INFORMATION:');
      console.log('Payment Method:', latestOrder.payment?.method);
      console.log('Payment Status:', latestOrder.payment?.status);
      console.log('Paid At:', latestOrder.payment?.paidAt);
      console.log('\n🆔 TRANSACTION IDs:');
      console.log('Transaction ID (Internal):', latestOrder.payment?.transactionId);
      console.log('Razorpay Payment ID:', latestOrder.payment?.razorpayPaymentId);
      console.log('Razorpay Order ID:', latestOrder.payment?.razorpayOrderId);
      console.log('Razorpay Signature:', latestOrder.payment?.razorpaySignature ? '✅ Present' : '❌ Missing');
      console.log('=====================================');
      
      // Check if transaction IDs are saved
      const hasTransactionId = !!latestOrder.payment?.transactionId;
      const hasRazorpayIds = !!latestOrder.payment?.razorpayPaymentId && !!latestOrder.payment?.razorpayOrderId;
      
      if (hasTransactionId && hasRazorpayIds) {
        console.log('\n✅ All transaction IDs are saved correctly!');
      } else if (!hasTransactionId && !hasRazorpayIds) {
        console.log('\n⚠️  Payment not completed yet or transaction IDs not saved');
      } else {
        console.log('\n⚠️  Some transaction IDs are missing');
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLatestOrder();
