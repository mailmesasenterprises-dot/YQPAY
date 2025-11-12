/**
 * Test script to manually trigger email notifications
 * Tests all three notification types:
 * 1. Expired Stock Warning (within 3 days)
 * 2. Low Stock Alert
 * 3. Daily Sales Report
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Theater = require('./models/Theater');
const {
  checkExpiringStock,
  checkLowStock,
  sendDailySalesReports
} = require('./jobs/stockEmailNotifications');

async function testEmailNotifications() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Get all theaters
    const theaters = await Theater.find({});
    console.log(`\n📋 Found ${theaters.length} theaters`);
    
    for (const theater of theaters) {
      // Check if theater has email notifications configured
      const emailDoc = await mongoose.connection.db.collection('emailnotification').findOne({
        theater: theater._id
      });
      
      const activeEmails = emailDoc?.emailNotificationList
        ?.filter(n => n.isActive)
        ?.map(n => n.emailNotification) || [];
      
      console.log(`\n🎭 Theater: ${theater.name}`);
      console.log(`   ID: ${theater._id}`);
      console.log(`   Theater Email: ${theater.email || 'Not configured'}`);
      console.log(`   Email Notifications: ${activeEmails.length > 0 ? activeEmails.join(', ') : 'None configured'}`);
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('🧪 Starting Email Notification Tests');
    console.log('='.repeat(60));

    // Test 1: Expiring Stock Notification
    console.log('\n\n📧 Test 1: Expiring Stock Warning (within 3 days)');
    console.log('-'.repeat(60));
    await checkExpiringStock();

    // Test 2: Low Stock Notification
    console.log('\n\n📧 Test 2: Low Stock Alert');
    console.log('-'.repeat(60));
    await checkLowStock();

    // Test 3: Daily Sales Report
    console.log('\n\n📧 Test 3: Daily Sales Report');
    console.log('-'.repeat(60));
    await sendDailySalesReports();

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
    console.log('\n📬 Check your email inbox for notifications.');
    console.log('\n💡 If you didn\'t receive emails, verify:');
    console.log('   1. SMTP configuration in Settings → Mail Configuration');
    console.log('   2. Theater has active email notifications configured');
    console.log('   3. Products meet notification criteria:');
    console.log('      - Low stock: currentStock ≤ lowStockAlert threshold');
    console.log('      - Expiring: expireDate within 3 days');
    console.log('   4. Check spam/junk folder');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the test
testEmailNotifications();
