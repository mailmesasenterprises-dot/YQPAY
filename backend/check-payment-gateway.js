const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = 'mongodb+srv://aedentekuiuxdesigner:Aedentek%40123%23@cluster0.vrj9qje.mongodb.net/yqpay';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ Connected to MongoDB\n');
  
  const theaterId = '68f8837a541316c6ad54b79f';
  
  // Find the theater document
  const theater = await mongoose.connection.db.collection('theaters').findOne(
    { _id: new mongoose.Types.ObjectId(theaterId) },
    { projection: { name: 1, paymentGateway: 1 } }
  );
  
  if (!theater) {
    console.log('❌ Theater not found!');
  } else {
    console.log('📋 Theater Name:', theater.name);
    console.log('\n💳 Payment Gateway Data:');
    console.log(JSON.stringify(theater.paymentGateway, null, 2));
  }
  
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
