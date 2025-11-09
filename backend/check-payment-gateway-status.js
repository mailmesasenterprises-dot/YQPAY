const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

async function checkPaymentGatewayStatus() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Theater = mongoose.connection.collection('theaters');
    
    // Find the theater (assuming Vetri Cinemas)
    const theater = await Theater.findOne({ 
      $or: [
        { name: /vetri/i },
        { username: /vetri/i }
      ]
    });

    if (!theater) {
      console.log('❌ Theater not found');
      process.exit(1);
    }

    console.log('🎭 Theater:', theater.name);
    console.log('📍 ID:', theater._id);
    console.log('\n' + '='.repeat(60));
    console.log('💳 PAYMENT GATEWAY CONFIGURATION');
    console.log('='.repeat(60) + '\n');

    // Check if payment gateway exists
    if (!theater.paymentGateway) {
      console.log('❌ NO PAYMENT GATEWAY CONFIGURED');
      console.log('\n📝 You need to run the setup script to configure Razorpay\n');
      console.log('Run: node backend/check-payment-gateway.js --setup\n');
      process.exit(0);
    }

    // Check KIOSK channel
    console.log('📺 KIOSK CHANNEL (for POS/ViewCart):');
    console.log('  Enabled:', theater.paymentGateway.kiosk?.enabled || false);
    console.log('  Provider:', theater.paymentGateway.kiosk?.provider || 'none');
    
    if (theater.paymentGateway.kiosk?.razorpay) {
      const rp = theater.paymentGateway.kiosk.razorpay;
      console.log('  Razorpay Enabled:', rp.enabled);
      console.log('  Razorpay Key ID:', rp.keyId ? rp.keyId.substring(0, 15) + '...' : 'NOT SET');
      console.log('  Razorpay Test Mode:', rp.testMode);
    } else {
      console.log('  ❌ Razorpay NOT configured');
    }
    
    console.log('  Accepted Methods:');
    const kioskMethods = theater.paymentGateway.kiosk?.acceptedMethods || {};
    console.log('    Cash:', kioskMethods.cash ? '✅' : '❌');
    console.log('    Card:', kioskMethods.card ? '✅' : '❌');
    console.log('    UPI:', kioskMethods.upi ? '✅' : '❌');

    console.log('\n🌐 ONLINE CHANNEL (for Customer Portal):');
    console.log('  Enabled:', theater.paymentGateway.online?.enabled || false);
    console.log('  Provider:', theater.paymentGateway.online?.provider || 'none');
    
    if (theater.paymentGateway.online?.razorpay) {
      const rp = theater.paymentGateway.online.razorpay;
      console.log('  Razorpay Enabled:', rp.enabled);
      console.log('  Razorpay Key ID:', rp.keyId ? rp.keyId.substring(0, 15) + '...' : 'NOT SET');
      console.log('  Razorpay Test Mode:', rp.testMode);
    } else {
      console.log('  ❌ Razorpay NOT configured');
    }
    
    console.log('  Accepted Methods:');
    const onlineMethods = theater.paymentGateway.online?.acceptedMethods || {};
    console.log('    Card:', onlineMethods.card ? '✅' : '❌');
    console.log('    UPI:', onlineMethods.upi ? '✅' : '❌');
    console.log('    Net Banking:', onlineMethods.netbanking ? '✅' : '❌');

    console.log('\n' + '='.repeat(60));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(60) + '\n');

    const kioskEnabled = theater.paymentGateway.kiosk?.enabled && 
                        theater.paymentGateway.kiosk?.razorpay?.enabled;
    const onlineEnabled = theater.paymentGateway.online?.enabled && 
                         theater.paymentGateway.online?.razorpay?.enabled;

    if (!kioskEnabled) {
      console.log('⚠️  KIOSK channel is NOT properly configured');
      console.log('   This affects: ViewCart page, POS system');
      console.log('   Run setup to fix: node backend/enable-online-razorpay.js');
    } else {
      console.log('✅ KIOSK channel is properly configured');
    }

    if (!onlineEnabled) {
      console.log('\n⚠️  ONLINE channel is NOT properly configured');
      console.log('   This affects: Customer portal payments');
      console.log('   Run setup to fix: node backend/enable-online-razorpay.js');
    } else {
      console.log('\n✅ ONLINE channel is properly configured');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 WHAT HAPPENS WHEN YOU SELECT CARD/UPI:');
    console.log('='.repeat(60) + '\n');

    if (kioskEnabled && (kioskMethods.card || kioskMethods.upi)) {
      console.log('✅ Payment gateway SHOULD open Razorpay modal');
      console.log('✅ Card: Shows card input form');
      console.log('✅ UPI: Shows UPI QR code and apps');
      console.log('\nIf it\'s NOT opening, check:');
      console.log('  1. Browser console for errors (F12)');
      console.log('  2. Razorpay SDK loading status');
      console.log('  3. Network tab for API calls');
    } else {
      console.log('❌ Payment gateway will NOT work');
      console.log('❌ Reason: Gateway not enabled or methods not accepted');
      console.log('\n🔧 FIX: Run this command:');
      console.log('   node backend/enable-online-razorpay.js');
    }

    console.log('\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkPaymentGatewayStatus();
