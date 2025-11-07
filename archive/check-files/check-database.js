const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpay';

async function checkDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📚 Collections in database:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });

    // Check theaterorders collection
    console.log('\n🔍 Checking theaterorders collection...');
    const theaterOrders = await db.collection('theaterorders').find({}).toArray();
    console.log(`   Found ${theaterOrders.length} documents`);

    if (theaterOrders.length > 0) {
      const firstDoc = theaterOrders[0];
      console.log('\n📝 First document structure:');
      console.log(`   Theater ID: ${firstDoc.theater}`);
      console.log(`   Order List length: ${firstDoc.orderList?.length || 0}`);
      
      if (firstDoc.orderList && firstDoc.orderList.length > 0) {
        const firstOrder = firstDoc.orderList[0];
        console.log('\n📋 First order sample:');
        console.log(`   Order Number: ${firstOrder.orderNumber}`);
        console.log(`   Source: ${firstOrder.source}`);
        console.log(`   QR Name: ${firstOrder.qrName || 'N/A'}`);
        console.log(`   Seat: ${firstOrder.seat || 'N/A'}`);
        console.log(`   Customer: ${firstOrder.customerInfo?.name || firstOrder.customerName}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the check
checkDatabase();
