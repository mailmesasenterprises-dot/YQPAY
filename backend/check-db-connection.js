const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📊 MongoDB URI:', process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    
    console.log('✅ Connected successfully');
    
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log('📂 Database name:', dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📋 Collections in database:');
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`  - ${coll.name}: ${count} documents`);
    }
    
    // Check theaterorders specifically
    console.log('\n🎬 Checking theaterorders collection:');
    const theaterOrders = await db.collection('theaterorders').find({}).limit(5).toArray();
    console.log(`Found ${theaterOrders.length} documents (showing first 5)`);
    
    if (theaterOrders.length > 0) {
      console.log('\n📄 Sample theaterorders document:');
      const sample = theaterOrders[0];
      console.log('Theater:', sample.theater);
      console.log('Date:', sample.date);
      console.log('Total orders in orderList:', sample.orderList?.length || 0);
      
      if (sample.orderList && sample.orderList.length > 0) {
        const lastOrder = sample.orderList[sample.orderList.length - 1];
        console.log('\n🎫 Last order in list:');
        console.log('Order ID:', lastOrder._id);
        console.log('Order Number:', lastOrder.orderNumber);
        console.log('Payment Method:', lastOrder.payment?.method);
        console.log('Payment Status:', lastOrder.payment?.status);
        console.log('Transaction ID:', lastOrder.payment?.transactionId);
        console.log('Razorpay Payment ID:', lastOrder.payment?.razorpayPaymentId);
        console.log('Razorpay Order ID:', lastOrder.payment?.razorpayOrderId);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
