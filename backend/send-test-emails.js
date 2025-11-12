/**
 * Direct Email Test Script
 * Sends actual test emails to configured email notifications
 * Forces email sending regardless of stock conditions
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Theater = require('./models/Theater');
const Product = require('./models/Product');
const {
  sendStockExpirationWarning,
  sendLowStockAlert,
  sendDailySalesReport
} = require('./utils/emailService');

async function sendTestEmails() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB');

    // Get Vetri Theater (has email notifications)
    const theater = await Theater.findOne({ name: 'Vetri Theater' });
    
    if (!theater) {
      console.error('❌ Vetri Theater not found');
      process.exit(1);
    }

    // Check email notifications
    const emailDoc = await mongoose.connection.db.collection('emailnotification').findOne({
      theater: theater._id
    });
    
    const activeEmails = emailDoc?.emailNotificationList
      ?.filter(n => n.isActive)
      ?.map(n => n.emailNotification) || [];
    
    console.log(`\n🎭 Theater: ${theater.name}`);
    console.log(`   ID: ${theater._id}`);
    console.log(`   Email Notifications: ${activeEmails.join(', ')}`);

    if (activeEmails.length === 0) {
      console.error('\n❌ No active email notifications configured for this theater');
      console.log('Please add email notifications in Super Admin → Email Notification');
      process.exit(1);
    }

    console.log('\n' + '='.repeat(70));
    console.log('📧 SENDING TEST EMAILS TO ALL CONFIGURED ADDRESSES');
    console.log('='.repeat(70));

    // Test 1: Send Expiring Stock Warning (with dummy data)
    console.log('\n📧 Test 1: Sending Expiring Stock Warning...');
    const expiringProducts = [
      {
        productName: 'Test Product - Popcorn',
        oldStock: 100,
        invordStock: 50,
        sales: 20,
        damageStock: 5,
        expiredStock: 0,
        balance: 125,
        expireDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Expires in 2 days
        daysUntilExpiry: 2
      }
    ];
    
    const result1 = await sendStockExpirationWarning(theater, expiringProducts);
    if (result1.success) {
      console.log(`   ✅ Expiration warning sent to ${activeEmails.length} recipient(s)`);
      console.log(`   📬 Recipients: ${activeEmails.join(', ')}`);
    } else {
      console.log(`   ❌ Failed: ${result1.error}`);
    }

    // Test 2: Send Low Stock Alert (with dummy data)
    console.log('\n📧 Test 2: Sending Low Stock Alert...');
    const lowStockProducts = [
      {
        productName: 'Test Product - Soft Drink',
        oldStock: 15,
        invordStock: 0,
        sales: 10,
        damageStock: 0,
        expiredStock: 0,
        balance: 5,
        lowStockAlert: 10,
        expireDate: null
      }
    ];
    
    const result2 = await sendLowStockAlert(theater, lowStockProducts);
    if (result2.success) {
      console.log(`   ✅ Low stock alert sent to ${activeEmails.length} recipient(s)`);
      console.log(`   📬 Recipients: ${activeEmails.join(', ')}`);
    } else {
      console.log(`   ❌ Failed: ${result2.error}`);
    }

    // Test 3: Send Daily Sales Report (with dummy data)
    console.log('\n📧 Test 3: Sending Daily Sales Report...');
    const salesData = [
      {
        orderId: 'TEST001',
        createdAt: new Date(),
        totalAmount: 250,
        paymentMethod: 'Cash',
        itemsCount: 3,
        status: 'Completed',
        customerName: 'Test Customer'
      },
      {
        orderId: 'TEST002',
        createdAt: new Date(),
        totalAmount: 150,
        paymentMethod: 'UPI',
        itemsCount: 2,
        status: 'Completed',
        customerName: 'Test Customer 2'
      }
    ];
    
    const result3 = await sendDailySalesReport(theater, salesData);
    if (result3.success) {
      console.log(`   ✅ Daily sales report sent to ${activeEmails.length} recipient(s)`);
      console.log(`   📬 Recipients: ${activeEmails.join(', ')}`);
    } else {
      console.log(`   ❌ Failed: ${result3.error}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST EMAILS SENT!');
    console.log('='.repeat(70));
    console.log('\n📬 Check the following email addresses for test emails:');
    activeEmails.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });
    console.log('\n💡 Check:');
    console.log('   1. Inbox (may take 1-2 minutes to arrive)');
    console.log('   2. Spam/Junk folder');
    console.log('   3. Promotions tab (Gmail)');
    console.log('\n📧 You should receive 3 emails per address:');
    console.log('   • Stock Expiration Warning');
    console.log('   • Low Stock Alert');
    console.log('   • Daily Sales Report');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the test
sendTestEmails();
