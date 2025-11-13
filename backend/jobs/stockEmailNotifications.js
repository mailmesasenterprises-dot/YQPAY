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
  sendDailySalesReport,
  sendDailyStockReport,
  sendExpiredStockNotification
} = require('../utils/emailService');
const { getTheaterEmailAddresses } = require('../utils/stockEmailHelper');

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
    
    // Get all active theaters
    const theaters = await Theater.find({ isActive: true });
    
    for (const theater of theaters) {
      try {
        // Check if theater has active email notifications
        const emailAddresses = await getTheaterEmailAddresses(theater._id);
        if (!emailAddresses || emailAddresses.length === 0) {
          continue; // Skip theaters without email notifications
        }
        
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
 * Checks 30 minutes before reaching threshold by predicting stock depletion
 * Runs every 30 minutes
 */
async function checkLowStock() {
  try {
    console.log('🔔 Checking for low stock products (30 minutes before threshold)...');
    
    // Get all active theaters
    const theaters = await Theater.find({ isActive: true });
    
    for (const theater of theaters) {
      try {
        // Check if theater has active email notifications
        const emailAddresses = await getTheaterEmailAddresses(theater._id);
        if (!emailAddresses || emailAddresses.length === 0) {
          continue; // Skip theaters without email notifications
        }
        
        // Get all products for this theater
        const products = await Product.find({ theaterId: theater._id, isActive: true });
        
        const lowStockProducts = [];
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        for (const product of products) {
          // Get current stock from product inventory
          const currentStock = product.inventory?.currentStock || 0;
          const lowStockAlert = product.inventory?.minStock || 5; // Default threshold
          
          // Get monthly stock document for sales calculation
          const monthlyDoc = await MonthlyStock.findOne({
            theaterId: theater._id,
            productId: product._id,
            year,
            monthNumber: month
          });
          
          // Calculate average daily sales from last 7 days
          let totalSales = 0;
          let daysWithSales = 0;
          if (monthlyDoc && monthlyDoc.stockDetails) {
            const last7DaysEntries = monthlyDoc.stockDetails.filter(entry => {
              const entryDate = new Date(entry.date);
              return entryDate >= sevenDaysAgo;
            });
            
            last7DaysEntries.forEach(entry => {
              if (entry.sales > 0) {
                totalSales += entry.sales;
                daysWithSales++;
              }
            });
          }
          
          const averageDailySales = daysWithSales > 0 ? totalSales / daysWithSales : 0;
          const salesPer30Minutes = averageDailySales / 48; // 48 * 30 minutes = 24 hours
          
          // Predict stock level in 30 minutes
          const predictedStockIn30Minutes = currentStock - salesPer30Minutes;
          
          // Check if stock will reach threshold in 30 minutes OR is already at/below threshold
          const willReachThreshold = predictedStockIn30Minutes <= lowStockAlert && predictedStockIn30Minutes > 0;
          const isAlreadyLow = currentStock > 0 && currentStock <= lowStockAlert;
          
          if (willReachThreshold || isAlreadyLow) {
            // Get today's stock entry
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
              predictedBalance: Math.max(0, predictedStockIn30Minutes),
              expireDate: stockEntry?.expireDate || null,
              lowStockAlert,
              warningType: isAlreadyLow ? 'Currently Low' : 'Will Reach Threshold Soon'
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
 * Send daily stock report to all theaters
 * Runs daily at 10:00 PM
 */
async function sendDailyStockReports() {
  try {
    console.log('🔔 Sending daily stock reports...');
    
    // Get all active theaters
    const theaters = await Theater.find({ isActive: true });
    
    for (const theater of theaters) {
      try {
        // Check if theater has active email notifications
        const emailAddresses = await getTheaterEmailAddresses(theater._id);
        if (!emailAddresses || emailAddresses.length === 0) {
          continue; // Skip theaters without email notifications
        }
        
        // Get all products for this theater
        const products = await Product.find({ theaterId: theater._id, isActive: true });
        
        const stockData = [];
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (const product of products) {
          // Get current stock
          const currentStock = product.inventory?.currentStock || 0;
          const lowStockAlert = product.inventory?.minStock || 5;
          
          // Get today's stock entry
          const monthlyDoc = await MonthlyStock.findOne({
            theaterId: theater._id,
            productId: product._id,
            year,
            monthNumber: month
          });
          
          let stockEntry = null;
          if (monthlyDoc && monthlyDoc.stockDetails) {
            stockEntry = monthlyDoc.stockDetails.find(entry => {
              const entryDate = new Date(entry.date);
              entryDate.setHours(0, 0, 0, 0);
              return entryDate.getTime() === today.getTime();
            });
          }
          
          // Determine status
          let status = 'Active';
          if (currentStock <= 0) {
            status = 'Out of Stock';
          } else if (currentStock <= lowStockAlert) {
            status = 'Low Stock';
          }
          
          // Check expiration
          if (stockEntry?.expireDate) {
            const expiryDate = new Date(stockEntry.expireDate);
            expiryDate.setHours(0, 0, 0, 0);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
              status = 'Expired';
            } else if (daysUntilExpiry <= 3) {
              status = 'Expiring Soon';
            }
          }
          
          stockData.push({
            productName: product.name,
            oldStock: stockEntry?.oldStock || 0,
            invordStock: stockEntry?.invordStock || 0,
            sales: stockEntry?.sales || 0,
            damageStock: stockEntry?.damageStock || 0,
            expiredStock: stockEntry?.expiredStock || 0,
            balance: currentStock,
            expireDate: stockEntry?.expireDate || null,
            lowStockAlert,
            status
          });
        }
        
        if (stockData.length > 0) {
          console.log(`📧 Sending daily stock report to ${theater.name} (${stockData.length} products)`);
          await sendDailyStockReport(theater, stockData);
        } else {
          console.log(`ℹ️  No products for ${theater.name}. Skipping stock report.`);
        }
      } catch (error) {
        console.error(`❌ Error processing theater ${theater.name}:`, error);
      }
    }
    
    console.log('✅ Daily stock reports sent');
  } catch (error) {
    console.error('❌ Error in sendDailyStockReports:', error);
  }
}

/**
 * Check for expired stock and send notifications
 * Runs daily at 8:00 AM
 */
async function checkExpiredStock() {
  try {
    console.log('🔔 Checking for expired stock...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all active theaters
    const theaters = await Theater.find({ isActive: true });
    
    for (const theater of theaters) {
      try {
        // Check if theater has active email notifications
        const emailAddresses = await getTheaterEmailAddresses(theater._id);
        if (!emailAddresses || emailAddresses.length === 0) {
          continue; // Skip theaters without email notifications
        }
        
        // Get all products for this theater
        const products = await Product.find({ theaterId: theater._id, isActive: true });
        
        const expiredProducts = [];
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        
        for (const product of products) {
          // Get current month's stock
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
                
                // Check if expired (past today)
                if (expiryDate < today) {
                  expiredProducts.push({
                    productName: product.name,
                    oldStock: entry.oldStock || 0,
                    invordStock: entry.invordStock || 0,
                    sales: entry.sales || 0,
                    damageStock: entry.damageStock || 0,
                    expiredStock: entry.expiredStock || 0,
                    balance: entry.balance || 0,
                    expireDate: entry.expireDate
                  });
                }
              }
            }
          }
        }
        
        // Send email if there are expired products
        if (expiredProducts.length > 0) {
          console.log(`📧 Sending expired stock notification to ${theater.name} for ${expiredProducts.length} products`);
          await sendExpiredStockNotification(theater, expiredProducts);
        }
      } catch (error) {
        console.error(`❌ Error processing theater ${theater.name}:`, error);
      }
    }
    
    console.log('✅ Expired stock check completed');
  } catch (error) {
    console.error('❌ Error in checkExpiredStock:', error);
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
  
  // Check expired stock daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    await checkExpiredStock();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  // Check low stock every 30 minutes (predicts 30 minutes before threshold)
  cron.schedule('*/30 * * * *', async () => {
    await checkLowStock();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  // Send daily stock report at 10:00 PM
  cron.schedule('0 22 * * *', async () => {
    await sendDailyStockReports();
  }, {
    scheduled: true,
    timezone: 'Asia/Kolkata'
  });
  
  console.log('✅ Stock email notification jobs initialized');
  console.log('   - Daily stock report: 10:00 PM');
  console.log('   - Expired stock check: 8:00 AM');
  console.log('   - Expiring stock check: 9:00 AM');
  console.log('   - Low stock check: Every 30 minutes (30 min before threshold)');
}

module.exports = {
  checkExpiringStock,
  checkExpiredStock,
  checkLowStock,
  sendDailyStockReports,
  initializeStockEmailJobs
};

