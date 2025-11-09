const mongoose = require('mongoose');
require('dotenv').config();

async function analyzePaymentGatewaySetup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    
    // Get all theaters
    const theaters = await db.collection('theaters').find({}).toArray();
    
    console.log(`📊 Found ${theaters.length} theaters\n`);
    console.log('='.repeat(80));
    
    for (const theater of theaters) {
      console.log(`\n🎭 THEATER: ${theater.name} (${theater._id})`);
      console.log('─'.repeat(80));
      
      if (!theater.paymentGateway) {
        console.log('❌ No payment gateway configuration found');
        continue;
      }
      
      // Check KIOSK/POS configuration
      console.log('\n📱 KIOSK/POS PAYMENT GATEWAY:');
      const kiosk = theater.paymentGateway.kiosk;
      if (kiosk) {
        console.log(`   Enabled: ${kiosk.enabled ? '✅' : '❌'}`);
        console.log(`   Provider: ${kiosk.provider || 'none'}`);
        
        if (kiosk.razorpay) {
          console.log(`   \n   💳 Razorpay (Kiosk):`);
          console.log(`      - Enabled: ${kiosk.razorpay.enabled ? '✅' : '❌'}`);
          console.log(`      - Key ID: ${kiosk.razorpay.keyId || '❌ Not set'}`);
          console.log(`      - Key Secret: ${kiosk.razorpay.keySecret ? '✅ Set' : '❌ Not set'}`);
          console.log(`      - Test Mode: ${kiosk.razorpay.testMode ? '🧪 Yes' : '🔴 Live'}`);
        }
        
        if (kiosk.phonepe) {
          console.log(`   \n   📱 PhonePe (Kiosk):`);
          console.log(`      - Enabled: ${kiosk.phonepe.enabled ? '✅' : '❌'}`);
          console.log(`      - Merchant ID: ${kiosk.phonepe.merchantId || '❌ Not set'}`);
        }
        
        if (kiosk.acceptedMethods) {
          console.log(`   \n   💵 Accepted Methods (Kiosk):`);
          console.log(`      - Cash: ${kiosk.acceptedMethods.cash ? '✅' : '❌'}`);
          console.log(`      - Card: ${kiosk.acceptedMethods.card ? '✅' : '❌'}`);
          console.log(`      - UPI: ${kiosk.acceptedMethods.upi ? '✅' : '❌'}`);
          console.log(`      - Net Banking: ${kiosk.acceptedMethods.netbanking ? '✅' : '❌'}`);
          console.log(`      - Wallet: ${kiosk.acceptedMethods.wallet ? '✅' : '❌'}`);
        }
      } else {
        console.log('   ❌ Not configured');
      }
      
      // Check ONLINE configuration
      console.log('\n🌐 ONLINE PAYMENT GATEWAY:');
      const online = theater.paymentGateway.online;
      if (online) {
        console.log(`   Enabled: ${online.enabled ? '✅' : '❌'}`);
        console.log(`   Provider: ${online.provider || 'none'}`);
        
        if (online.razorpay) {
          console.log(`   \n   💳 Razorpay (Online):`);
          console.log(`      - Enabled: ${online.razorpay.enabled ? '✅' : '❌'}`);
          console.log(`      - Key ID: ${online.razorpay.keyId || '❌ Not set'}`);
          console.log(`      - Key Secret: ${online.razorpay.keySecret ? '✅ Set' : '❌ Not set'}`);
          console.log(`      - Test Mode: ${online.razorpay.testMode ? '🧪 Yes' : '🔴 Live'}`);
        }
        
        if (online.phonepe) {
          console.log(`   \n   📱 PhonePe (Online):`);
          console.log(`      - Enabled: ${online.phonepe.enabled ? '✅' : '❌'}`);
          console.log(`      - Merchant ID: ${online.phonepe.merchantId || '❌ Not set'}`);
        }
        
        if (online.acceptedMethods) {
          console.log(`   \n   💵 Accepted Methods (Online):`);
          console.log(`      - Cash: ${online.acceptedMethods.cash ? '✅' : '❌'}`);
          console.log(`      - Card: ${online.acceptedMethods.card ? '✅' : '❌'}`);
          console.log(`      - UPI: ${online.acceptedMethods.upi ? '✅' : '❌'}`);
          console.log(`      - Net Banking: ${online.acceptedMethods.netbanking ? '✅' : '❌'}`);
          console.log(`      - Wallet: ${online.acceptedMethods.wallet ? '✅' : '❌'}`);
        }
      } else {
        console.log('   ❌ Not configured');
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
    // Summary
    console.log('\n\n📋 SUMMARY:');
    console.log('─'.repeat(80));
    
    const kioskEnabled = theaters.filter(t => t.paymentGateway?.kiosk?.enabled).length;
    const onlineEnabled = theaters.filter(t => t.paymentGateway?.online?.enabled).length;
    const razorpayKiosk = theaters.filter(t => t.paymentGateway?.kiosk?.razorpay?.enabled).length;
    const razorpayOnline = theaters.filter(t => t.paymentGateway?.online?.razorpay?.enabled).length;
    
    console.log(`Total Theaters: ${theaters.length}`);
    console.log(`Kiosk Payment Enabled: ${kioskEnabled}`);
    console.log(`Online Payment Enabled: ${onlineEnabled}`);
    console.log(`Razorpay (Kiosk): ${razorpayKiosk}`);
    console.log(`Razorpay (Online): ${razorpayOnline}`);
    
    console.log('\n✅ Analysis complete!');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzePaymentGatewaySetup();
