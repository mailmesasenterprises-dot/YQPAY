const mongoose = require('mongoose');
const TheaterOrders = require('./models/TheaterOrders');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpay';

async function fixOrderSources() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all theater orders
    const allTheaterOrders = await TheaterOrders.find({});
    console.log(`📦 Found ${allTheaterOrders.length} theater documents`);

    let totalOrders = 0;
    let updatedOrders = 0;
    let qrCodeOrders = 0;
    let posOrders = 0;

    for (const theaterDoc of allTheaterOrders) {
      if (!theaterDoc.orderList || theaterDoc.orderList.length === 0) {
        continue;
      }

      let docUpdated = false;

      for (let i = 0; i < theaterDoc.orderList.length; i++) {
        const order = theaterDoc.orderList[i];
        totalOrders++;

        // Determine correct source based on qrName or seat
        const hasQrInfo = !!(order.qrName || order.seat);
        const correctSource = hasQrInfo ? 'qr_code' : 'pos';
        
        // Update if source is wrong
        if (order.source !== correctSource) {
          console.log(`🔄 Updating order ${order.orderNumber || order._id}:`);
          console.log(`   Old source: ${order.source} → New source: ${correctSource}`);
          console.log(`   QR Name: ${order.qrName || 'N/A'}, Seat: ${order.seat || 'N/A'}`);
          
          theaterDoc.orderList[i].source = correctSource;
          docUpdated = true;
          updatedOrders++;
        }

        // Count sources
        if (correctSource === 'qr_code') {
          qrCodeOrders++;
        } else {
          posOrders++;
        }
      }

      // Save if any orders were updated
      if (docUpdated) {
        await theaterDoc.save();
        console.log(`💾 Saved updates for theater ${theaterDoc.theater}`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total orders processed: ${totalOrders}`);
    console.log(`   Orders updated: ${updatedOrders}`);
    console.log(`   QR Code orders: ${qrCodeOrders}`);
    console.log(`   POS orders: ${posOrders}`);
    console.log('✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the fix
fixOrderSources();
