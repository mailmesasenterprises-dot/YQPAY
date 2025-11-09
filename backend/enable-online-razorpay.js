const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yqpaynow';

// Razorpay test credentials
const RAZORPAY_TEST_CREDENTIALS = {
  keyId: 'rzp_test_Rdh6Uj5JfsXuon',
  keySecret: 'VPY06VMZFJB4fpOKOfJkqq6Z',
  webhookSecret: 'test_webhook_secret_12345'
};

async function enableRazorpayGateway() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Theater = mongoose.connection.collection('theaters');
    
    // Find Vetri Cinemas theater
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

    console.log('🎭 Found Theater:', theater.name);
    console.log('📍 ID:', theater._id);
    console.log('\n' + '='.repeat(60));
    console.log('🔧 ENABLING PAYMENT GATEWAY');
    console.log('='.repeat(60) + '\n');

    // Prepare the payment gateway configuration
    const paymentGatewayConfig = {
      // KIOSK Channel (for ViewCart, POS)
      kiosk: {
        enabled: true,
        provider: 'razorpay',
        razorpay: {
          enabled: true,
          keyId: RAZORPAY_TEST_CREDENTIALS.keyId,
          keySecret: RAZORPAY_TEST_CREDENTIALS.keySecret,
          webhookSecret: RAZORPAY_TEST_CREDENTIALS.webhookSecret,
          testMode: true
        },
        acceptedMethods: {
          cash: true,
          card: true,
          upi: true,
          netbanking: false,
          wallet: false
        },
        configuredAt: new Date()
      },
      // ONLINE Channel (for Customer Portal)
      online: {
        enabled: true,
        provider: 'razorpay',
        razorpay: {
          enabled: true,
          keyId: RAZORPAY_TEST_CREDENTIALS.keyId,
          keySecret: RAZORPAY_TEST_CREDENTIALS.keySecret,
          webhookSecret: RAZORPAY_TEST_CREDENTIALS.webhookSecret,
          testMode: true
        },
        acceptedMethods: {
          card: true,
          upi: true,
          netbanking: true,
          wallet: true
        },
        configuredAt: new Date()
      }
    };

    // Update the theater
    const result = await Theater.updateOne(
      { _id: theater._id },
      { $set: { paymentGateway: paymentGatewayConfig } }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Payment gateway enabled successfully!\n');
      
      console.log('📺 KIOSK CHANNEL (ViewCart/POS):');
      console.log('  ✅ Enabled: true');
      console.log('  ✅ Provider: razorpay');
      console.log('  ✅ Cash: true');
      console.log('  ✅ Card: true');
      console.log('  ✅ UPI: true');
      
      console.log('\n🌐 ONLINE CHANNEL (Customer Portal):');
      console.log('  ✅ Enabled: true');
      console.log('  ✅ Provider: razorpay');
      console.log('  ✅ Card: true');
      console.log('  ✅ UPI: true');
      console.log('  ✅ Net Banking: true');
      console.log('  ✅ Wallet: true');
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 SETUP COMPLETE!');
      console.log('='.repeat(60) + '\n');
      
      console.log('🔍 What will happen now:');
      console.log('  1. ✅ ViewCart will show Card and UPI as available');
      console.log('  2. ✅ When you select Card/UPI, Razorpay modal will open');
      console.log('  3. ✅ Card: Shows card input form (Test: 4111 1111 1111 1111)');
      console.log('  4. ✅ UPI: Shows QR code and UPI apps');
      console.log('  5. ✅ Payment will be processed and verified');
      console.log('  6. ✅ Order will be marked as "paid"');
      
      console.log('\n📝 Next Steps:');
      console.log('  1. Refresh your browser');
      console.log('  2. Go to ViewCart page');
      console.log('  3. Select Card or UPI payment');
      console.log('  4. Click "Confirm Order"');
      console.log('  5. Razorpay modal should open! 🎊');
      
      console.log('\n🧪 Test Credentials:');
      console.log('  Card Number: 4111 1111 1111 1111');
      console.log('  CVV: 123');
      console.log('  Expiry: Any future date (e.g., 12/25)');
      console.log('  Name: Any name');
      
      console.log('\n');
    } else {
      console.log('ℹ️  No changes made (already configured)\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

enableRazorpayGateway();
