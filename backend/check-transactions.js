const mongoose = require('mongoose');
require('dotenv').config();

async function checkTransaction() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Get the latest payment transaction
    const transactions = await db.collection('paymenttransactions')
      .find({})
      .sort({ _id: -1 })
      .limit(3)
      .toArray();
    
    console.log(`\n📋 Found ${transactions.length} recent transactions:\n`);
    
    transactions.forEach((tx, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${tx._id}`);
      console.log('   Order ID:', tx.orderId);
      console.log('   Theater ID:', tx.theaterId);
      console.log('   Amount:', tx.amount);
      console.log('   Status:', tx.status);
      console.log('   Gateway Provider:', tx.gateway?.provider);
      console.log('   Gateway Order ID:', tx.gateway?.orderId);
      console.log('   Gateway Channel:', tx.gateway?.channel);
      console.log('   Payment ID:', tx.paymentId || 'Not set');
      console.log('   Signature:', tx.signature || 'Not set');
      console.log('   Created At:', tx.createdAt);
      console.log('   Updated At:', tx.updatedAt);
    });
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTransaction();
