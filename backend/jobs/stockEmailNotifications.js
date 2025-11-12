/**
 * Stock Email Notification Jobs
 * Automated email notifications for stock management events
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const Theater = require('../models/Theater');
const Product = require('../models/Product');
const MonthlyStock = require('../models/MonthlyStock');
const Order = require('../models/Order');
const {
  sendStockExpirationWarning,
  sendLowStockAlert,
  sendDailySalesReport
} = require('../utils/emailService');

/**
 * Check for stock expiring within 3 days and send warnings
 * Runs daily at 9:00 AM
 */
async function checkExpiringStock() {
  try {
    console.log('🔔 Checking for expiring stock...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(today.getDate() + 3);
    threeDaysLater.setHours(23, 59, 59, 999);
    
    // Get all theaters
    const theaters = await Theater.find({ email: { $exists: true, $ne: '' } });
    
    for (const theater of theaters) {
      try {
        // Get all products for this theater
        const products = await Product.find({ theaterId: theater._id, isActive: true });
        
        const expiringProducts = [];
        
        for (const product of products) {
          // Get current month's stock
          const currentDate = new Date();
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          
          const monthlyDoc = await MonthlyStock.findOne({
            theaterId: theater._id,
            productId: product._id,
            year,
            monthNumber: month
          });
          
          if (monthlyDoc && monthlyDoc.stockDetails) {
            // Check each stock entry for expiration
            for (const entry of monthlyDoc.stockDetails) {
              if (entry.expireDate && entry.balance > 0) {
                const expiryDate = new Date(entry.expireDate);
                expiryDate.setHours(0, 0, 0, 0);
                
                // Check if expiring within 3 days
                if (expiryDate >= today && expiryDate <= threeDaysLater) {
                  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                  
                  expiringProducts.push({
                    productName: product.name,
                    oldStock: entry.oldStock || 0,
                    invordStock: entry.invordStock || 0,
                    sales: entry.sales || 0,
                    damageStock: entry.damageStock || 0,
                    expiredStock: entry.expiredStock || 0,
                    balance: entry.balance || 0,
                    expireDate: entry.expireDate,
                    daysUntilExpiry
                  });
                }
              }
            }
          }
        }
        
        // Send email if there are expiring products
        if (expiringProducts.length > 0) {
          console.log(`📧 Sending expiration warning to ${theater.name} for ${expiringProducts.length} products`);
          await sendStockExpirationWarning(theater, expiringProducts);
        }
      } catch (error) {
        console.error(`❌ Error processing theater ${theater.name}:`, error);
      }
    }
    
    console.log('✅ Expiring stock check completed');
  } catch (error) {
    console.error('❌ Error in checkExpiringStock:', error);
  }
}

/**
 * Check for low stock products and send alerts
 * Runs every 30 minutes as a backup check
 * (Real-time checks happen in orders.js and stock.js)
 */
async function checkLowStock() {
  try {
    console.log('🔔 Checking for low stock products...');
    
    // Get all theaters
    const theaters = await Theater.find({ email: { $exists: true, $ne: '' } });
    
    for (const theater of theaters) {
      try {
        // Get all products for this theater
        const products = await Product.find({ theaterId: theater._id, isActive: true });
        
        const lowStockProducts = [];
        
        for (const product of products) {
          // Get current stock from product inventory
          const currentStock = product.inventory?.currentStock || 0;
          const lowStockAlert = product.inventory?.minStock || 5; // Default threshold
          
          // Check if stock is low
          if (currentStock > 0 && currentStock <= lowStockAlert) {
            // Get current month's stock details
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const monthlyDoc = await MonthlyStock.findOne({
              theaterId: theater._id,
              productId: product._id,
              year,
              monthNumber: month
            });
            
            // Get today's stock entry
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let stockEntry = null;
            
            if (monthlyDoc && monthlyDoc.stockDetails) {
              stockEntry = monthlyDoc.stockDetails.find(entry => {
                const entryDate = new Date(entry.date);
                entryDate.setHours(0, 0, 0, 0);
                return entryDate.getTime() === today.getTime();
              });
            }
            
            lowStockProducts.push({
              productName: product.name,
              oldStock: stockEntry?.oldStock || 0,
              invordStock: stockEntry?.invordStock || 0,
              sales: stockEntry?.sales || 0,
              damageStock: stockEntry?.damageStock || 0,
              expiredStock: stockEntry?.expiredStock || 0,
              balance: currentStock,
              expireDate: stockEntry?.expireDate || null,
              lowStockAlert
            });
          }
        }
        
        // Send email if there are low stock products
        if (lowStockProducts.length > 0) {
          console.log(`📧 Sending low stock alert to ${theater.name} for ${lowStockProducts.length} products`);
          await sendLowStockAlert(theater, lowStockProducts);
        }
      } catch (error) {
        console.error(`❌ Error processing theater ${theater.name}:`, error);
      }
    }
    
    console.log('✅ Low stock check completed');
  } catch (error) {
    console.error('❌ Error in checkLowStock:', error);
  }
}

/**
 * Send daily sales report to all theaters
 * Runs daily at 11:00 PM
 */
async function sendDailySalesReports() {
  try {
    console.log('🔔 Sending daily sales reports...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Get all theaters
    const theaters = await Theater.find({ email: { $exists: true, $ne: '' } });
    
    for (const theater of theaters) {
      try {
        // Get today's orders
        const orders = await Order.find({
          theater: theater._id,
          createdAt: {
            $gte: today,
            $lt: tomorrow
          },
          status: { $ne: 'cancelled' }
        }).populate('items.product', 'name').sort({ createdAt: -1 });
        
        if (orders.length > 0) {
          const salesData = orders.map(order => ({
            orderId: order.orderNumber || order._id,
            _id: order._id,
            createdAt: order.createdAt,
            totalAmount: order.totalAmount || 0,
            paymentMethod: order.paymentMethod || 'N/A',
            itemsCount: order.items?.length || 0,
            status: order.status || 'Completed',
            customerName: order.customerName || 'Walk-in Customer'
          }));
          
          console.log(`📧 Sending daily sales report to ${theater.name} (${orders.length} orders)`);
          await sendDailySalesReport(theater, salesData);
        } else {
          console.log(`ℹ️  No orders for ${theater.name} today. Skipping report.`);
        }
      } catch (error) {
        console.error(`❌ Error processing theater ${theater.name}:`, error);
      }
    }
    
    console.log('✅ Daily sales reports sent');
  } catch (error) {
    console.error('❌ Error in sendDailySalesReports:', error);
  }
}

/**
 * Initialize cron jobs
 */
function initializeStockEmailJobs() {
  // Check expiring stock daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    await checkExpiringStock();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  // Check low stock every 30 minutes (backup check - real-time checks happen in orders/stock routes)
  cron.schedule('*/30 * * * *', async () => {
    await checkLowStock();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  // Send daily sales reports at 11:00 PM
  cron.schedule('0 23 * * *', async () => {
    await sendDailySalesReports();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  console.log('✅ Stock email notification jobs initialized');
}

module.exports = {
  checkExpiringStock,
  checkLowStock,
  sendDailySalesReports,
  initializeStockEmailJobs
};

