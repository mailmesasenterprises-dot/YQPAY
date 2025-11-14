/**
 * Setup Razorpay Test Credentials for All Theaters
 * 
 * This script adds Razorpay test credentials to all theaters
 * for both KIOSK/POS and ONLINE channels
 * 
 * Usage: node backend/scripts/setup-razorpay-test-credentials.js
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables from backend directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Razorpay Test Credentials (Standard Test Keys)
const RAZORPAY_TEST_CREDENTIALS = {
  keyId: 'rzp_test_1DP5mmOlF5M5dp',
  keySecret: '3KgeNoLSHqk7L0XmXqgJ5Xqg',
  webhookSecret: 'test_webhook_secret_12345'
};

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  setupPaymentGateways();
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

async function setupPaymentGateways() {
  try {
    const Theater = require(path.join(__dirname, '../models/Theater'));
    
    // Get all theaters
    const theaters = await Theater.find({});
    console.log(`\n📋 Found ${theaters.length} theaters\n`);
    
    if (theaters.length === 0) {
      console.log('⚠️ No theaters found. Please create theaters first.');
      process.exit(0);
    }
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const theater of theaters) {
      console.log(`\n🏢 Processing: ${theater.name} (${theater._id})`);
      
      // Initialize paymentGateway if it doesn't exist
      if (!theater.paymentGateway) {
        theater.paymentGateway = {};
      }
      
      // Setup KIOSK/POS Channel
      if (!theater.paymentGateway.kiosk) {
        theater.paymentGateway.kiosk = {};
      }
      
      // Setup ONLINE Channel
      if (!theater.paymentGateway.online) {
        theater.paymentGateway.online = {};
      }
      
      let theaterUpdated = false;
      
      // Configure KIOSK Channel
      if (!theater.paymentGateway.kiosk.enabled || !theater.paymentGateway.kiosk.razorpay?.enabled) {
        console.log('  🔧 Setting up KIOSK/POS channel...');
        theater.paymentGateway.kiosk.enabled = true;
        theater.paymentGateway.kiosk.provider = 'razorpay';
        theater.paymentGateway.kiosk.razorpay = {
          enabled: true,
          keyId: RAZORPAY_TEST_CREDENTIALS.keyId,
          keySecret: RAZORPAY_TEST_CREDENTIALS.keySecret,
          webhookSecret: RAZORPAY_TEST_CREDENTIALS.webhookSecret,
          testMode: true
        };
        theater.paymentGateway.kiosk.acceptedMethods = {
          cash: true,
          card: true,
          upi: true,
          netbanking: false,
          wallet: false
        };
        theater.paymentGateway.kiosk.configuredAt = new Date();
        theaterUpdated = true;
        console.log('  ✅ KIOSK channel configured');
      } else {
        console.log('  ⏭️  KIOSK channel already configured');
      }
      
      // Configure ONLINE Channel
      if (!theater.paymentGateway.online.enabled || !theater.paymentGateway.online.razorpay?.enabled) {
        console.log('  🔧 Setting up ONLINE channel...');
        theater.paymentGateway.online.enabled = true;
        theater.paymentGateway.online.provider = 'razorpay';
        theater.paymentGateway.online.razorpay = {
          enabled: true,
          keyId: RAZORPAY_TEST_CREDENTIALS.keyId,
          keySecret: RAZORPAY_TEST_CREDENTIALS.keySecret,
          webhookSecret: RAZORPAY_TEST_CREDENTIALS.webhookSecret,
          testMode: true
        };
        theater.paymentGateway.online.acceptedMethods = {
          cash: false,
          card: true,
          upi: true,
          netbanking: true,
          wallet: false
        };
        theater.paymentGateway.online.configuredAt = new Date();
        theaterUpdated = true;
        console.log('  ✅ ONLINE channel configured');
      } else {
        console.log('  ⏭️  ONLINE channel already configured');
      }
      
      if (theaterUpdated) {
        await theater.save();
        updatedCount++;
        console.log(`  ✅ Theater ${theater.name} updated successfully`);
      } else {
        skippedCount++;
        console.log(`  ⏭️  Theater ${theater.name} skipped (already configured)`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Updated: ${updatedCount} theaters`);
    console.log(`⏭️  Skipped: ${skippedCount} theaters`);
    console.log(`📋 Total: ${theaters.length} theaters`);
    console.log('\n✅ Payment gateway setup completed!\n');
    
    console.log('💡 Test Credentials:');
    console.log(`   Key ID: ${RAZORPAY_TEST_CREDENTIALS.keyId}`);
    console.log(`   Test Mode: Enabled`);
    console.log('\n⚠️  NOTE: These are TEST credentials. For production, update with live credentials.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up payment gateways:', error);
    process.exit(1);
  }
}

