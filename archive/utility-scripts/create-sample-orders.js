const mongoose = require('mongoose');

// MongoDB connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpay';

// Theater ID (use your actual theater ID)
const THEATER_ID = '68f8837a541316c6ad54b79f';

async function createSampleOrders() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const theaterOrdersCollection = db.collection('theaterorders');
    const theaterIdObjectId = new mongoose.Types.ObjectId(THEATER_ID);

    // Sample products
    const sampleProducts = [
      { name: 'Popcorn', price: 150 },
      { name: 'Coke', price: 80 },
      { name: 'Nachos', price: 120 },
      { name: 'Ice Cream', price: 100 },
      { name: 'Burger', price: 200 }
    ];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Create sample orders
    const sampleOrders = [];

    // Create 3 QR Code orders (Online orders)
    for (let i = 1; i <= 3; i++) {
      const orderDate = new Date(today.getTime() + (i * 3600000)); // Each order 1 hour apart
      const product = sampleProducts[i - 1];
      const quantity = Math.floor(Math.random() * 3) + 1;
      const subtotal = product.price * quantity;
      const taxAmount = subtotal * 0.18;
      const total = subtotal + taxAmount;
      
      // Random payment method
      const paymentMethods = ['cash', 'upi', 'card'];
      const paymentMethod = paymentMethods[i % 3];

      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ORD-${dateStr}-${String(i).padStart(4, '0')}`;

      sampleOrders.push({
        _id: new mongoose.Types.ObjectId(),
        orderNumber,
        customerInfo: {
          name: `Customer ${i}`,
          phone: `98765432${i}0`
        },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          name: product.name,
          quantity,
          unitPrice: product.price,
          totalPrice: subtotal,
          variants: []
        }],
        pricing: {
          subtotal,
          taxAmount,
          total,
          currency: 'INR'
        },
        payment: {
          method: paymentMethod,
          status: 'completed'
        },
        status: 'confirmed',
        orderType: 'dine_in',
        source: 'qr_code',  // QR Code order
        qrName: `Screen-${i} | A${i}`,  // QR Name indicates online order
        seat: `A${i}`,  // Seat number
        tableNumber: `T${i}`,
        specialInstructions: 'Extra napkins please',
        staffInfo: null,
        timestamps: {
          placedAt: orderDate,
          confirmedAt: orderDate
        },
        createdAt: orderDate,
        updatedAt: orderDate
      });
    }

    // Create 3 POS orders (Staff orders)
    for (let i = 4; i <= 6; i++) {
      const orderDate = new Date(today.getTime() + (i * 3600000));
      const productIndex = (i - 1) % sampleProducts.length; // Use modulo to avoid out of bounds
      const product = sampleProducts[productIndex];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const subtotal = product.price * quantity;
      const taxAmount = subtotal * 0.18;
      const total = subtotal + taxAmount;

      const paymentMethods = ['cash', 'upi', 'card'];
      const paymentMethod = paymentMethods[i % 3];

      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ORD-${dateStr}-${String(i).padStart(4, '0')}`;

      sampleOrders.push({
        _id: new mongoose.Types.ObjectId(),
        orderNumber,
        customerInfo: {
          name: 'POS Customer',
          phone: 'N/A'
        },
        items: [{
          productId: new mongoose.Types.ObjectId(),
          name: product.name,
          quantity,
          unitPrice: product.price,
          totalPrice: subtotal,
          variants: []
        }],
        pricing: {
          subtotal,
          taxAmount,
          total,
          currency: 'INR'
        },
        payment: {
          method: paymentMethod,
          status: 'completed'
        },
        status: 'completed',
        orderType: 'dine_in',
        source: 'pos',  // POS order (no qrName or seat)
        qrName: null,
        seat: null,
        tableNumber: null,
        specialInstructions: '',
        staffInfo: {
          staffId: new mongoose.Types.ObjectId(),
          username: 'sabarish',
          role: 'theater_admin'
        },
        timestamps: {
          placedAt: orderDate,
          confirmedAt: orderDate,
          completedAt: orderDate
        },
        createdAt: orderDate,
        updatedAt: orderDate
      });
    }

    console.log(`\n📝 Creating ${sampleOrders.length} sample orders...`);
    console.log(`   - QR Code orders: 3`);
    console.log(`   - POS orders: 3`);

    // Check if theater document exists
    let theaterDoc = await theaterOrdersCollection.findOne({ theater: theaterIdObjectId });

    if (theaterDoc) {
      console.log('✅ Theater document found, adding orders...');
      
      // Add orders to existing document
      await theaterOrdersCollection.updateOne(
        { theater: theaterIdObjectId },
        { 
          $push: { orderList: { $each: sampleOrders } },
          $set: { updatedAt: new Date() }
        }
      );
    } else {
      console.log('📦 Creating new theater document...');
      
      // Create new theater document
      await theaterOrdersCollection.insertOne({
        _id: new mongoose.Types.ObjectId(),
        theater: theaterIdObjectId,
        orderList: sampleOrders,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    console.log('✅ Sample orders created successfully!');
    
    // Print summary
    console.log('\n📊 Order Summary:');
    console.log('\n🔹 QR Code Orders (Online):');
    sampleOrders.filter(o => o.source === 'qr_code').forEach(order => {
      console.log(`   ${order.orderNumber}: ${order.items[0].name} x${order.items[0].quantity} - ₹${order.pricing.total.toFixed(2)} (${order.payment.method})`);
      console.log(`      QR: ${order.qrName}, Seat: ${order.seat}`);
    });
    
    console.log('\n🔹 POS Orders (Staff):');
    sampleOrders.filter(o => o.source === 'pos').forEach(order => {
      console.log(`   ${order.orderNumber}: ${order.items[0].name} x${order.items[0].quantity} - ₹${order.pricing.total.toFixed(2)} (${order.payment.method})`);
      console.log(`      Staff: ${order.staffInfo.username}`);
    });

    console.log('\n✅ You can now:');
    console.log('   1. Visit Online Order History page and download Excel (should show 3 QR orders)');
    console.log('   2. Visit Theater Order History page and download Excel (should show all 6 orders)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

// Run the script
createSampleOrders();
