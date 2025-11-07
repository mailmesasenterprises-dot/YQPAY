const mongoose = require('mongoose');
const TheaterOrders = require('./models/TheaterOrders');

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/yqpaynow', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

async function testStatusUpdate() {
  try {
    // Find first order - ANY order
    console.log('🔍 Searching for orders...');
    const order = await TheaterOrders.findOne().sort({ createdAt: -1 });
    
    if (!order) {
      console.log('❌ No orders found in database');
      return;
    }
    
    console.log('\n📦 Found Order:');
    console.log('  ID:', order._id);
    console.log('  Order Number:', order.orderNumber);
    console.log('  Current Status:', order.status);
    console.log('  Theater ID:', order.theaterId);
    console.log('  Source:', order.source);
    console.log('  QR Name:', order.qrName);
    
    // Test update
    console.log('\n🔄 Testing status update to "completed"...');
    order.status = 'completed';
    order.updatedAt = new Date();
    await order.save();
    
    console.log('✅ Status updated successfully!');
    console.log('  New Status:', order.status);
    
    // Verify
    const updatedOrder = await TheaterOrders.findById(order._id);
    console.log('\n✓ Verification:');
    console.log('  Status from DB:', updatedOrder.status);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setTimeout(testStatusUpdate, 1000);
