const mongoose = require('mongoose');
require('dotenv').config();

async function fixPendingOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get theaterorders with pending payments
    const theaterOrders = await db.collection('theaterorders').find({}).toArray();
    
    console.log(`\n📋 Found ${theaterOrders.length} theater order documents\n`);
    
    let totalUpdated = 0;
    
    for (const doc of theaterOrders) {
      if (!doc.orderList || doc.orderList.length === 0) continue;
      
      let docUpdated = false;
      
      for (const order of doc.orderList) {
        // Check if order has payment pending but was actually paid
        if (order.payment && order.payment.status === 'pending') {
          // Check if there's a successful transaction for this order
          const transaction = await db.collection('paymenttransactions').findOne({
            orderId: order._id,
            status: { $in: ['success', 'initiated'] }
          });
          
          if (transaction) {
            console.log(`\n🔄 Updating order: ${order.orderNumber}`);
            console.log(`   Current status: ${order.payment.status}`);
            console.log(`   Transaction found: ${transaction._id}`);
            console.log(`   Transaction status: ${transaction.status}`);
            
            // If transaction shows authorized in Razorpay, mark as paid
            if (transaction.status === 'initiated') {
              // Check Razorpay for actual payment status
              console.log(`   ⚠️  Transaction is 'initiated' - payment might be completed`);
              console.log(`   Gateway Order ID: ${transaction.gateway?.orderId}`);
              
              // Update to paid and add transaction IDs
              order.payment.status = 'paid';
              order.payment.paidAt = new Date();
              order.payment.transactionId = transaction._id.toString();
              order.payment.razorpayOrderId = transaction.gateway?.orderId;
              
              docUpdated = true;
              totalUpdated++;
              
              console.log(`   ✅ Updated to 'paid' with transaction IDs`);
            } else if (transaction.status === 'success') {
              order.payment.status = 'paid';
              order.payment.paidAt = transaction.updatedAt;
              order.payment.transactionId = transaction._id.toString();
              order.payment.razorpayPaymentId = transaction.paymentId;
              order.payment.razorpayOrderId = transaction.gateway?.orderId;
              order.payment.razorpaySignature = transaction.signature;
              
              docUpdated = true;
              totalUpdated++;
              
              console.log(`   ✅ Updated to 'paid' with full transaction details`);
            }
          }
        }
      }
      
      if (docUpdated) {
        await db.collection('theaterorders').updateOne(
          { _id: doc._id },
          { $set: { orderList: doc.orderList } }
        );
        console.log(`   💾 Saved updates to database`);
      }
    }
    
    console.log(`\n✅ Updated ${totalUpdated} orders from pending to paid`);
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixPendingOrders();
