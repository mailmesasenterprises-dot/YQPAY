/**
 * Test script to debug Excel download issue
 */

const express = require('express');
const router = express.Router();
const MonthlyStock = require('./models/MonthlyStock');
const Theater = require('./models/Theater');

async function testExcelDownload() {
  try {
    console.log('🧪 Testing Excel Download Function...\n');
    
    const theaterId = '68f8837a541316c6ad54b79f';
    const dateStr = '2025-11-01';
    
    console.log('📅 Testing with:');
    console.log('  Theater ID:', theaterId);
    console.log('  Date:', dateStr);
    console.log('');
    
    // Parse the date
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();
    
    console.log('📆 Parsed Date:');
    console.log('  Year:', targetYear);
    console.log('  Month:', targetMonth);
    console.log('  Day:', targetDay);
    console.log('');
    
    // ✅ FIX: Fetch products from productlist collection (NEW structure)
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let products = [];
    
    if (productContainer && productContainer.productList) {
      products = productContainer.productList || [];
      console.log('✅ Found products in NEW structure:', products.length);
    } else {
      // Fallback to OLD structure
      const Product = require('./models/Product');
      products = await Product.find({ theaterId: new mongoose.Types.ObjectId(theaterId) }).lean();
      console.log('✅ Found products in OLD structure:', products.length);
    }
    
    if (!products || products.length === 0) {
      throw new Error('No products found for this theater');
    }
    
    // Test with first product
    const product = products[0];
    console.log('🧪 Testing with first product:', product.name);
    console.log('  Product ID:', product._id);
    console.log('');
    
    // Find monthly stock document for this product
    const monthlyDoc = await MonthlyStock.findOne({
      theaterId,
      productId: product._id,
      year: targetYear,
      monthNumber: targetMonth
    });
    
    if (!monthlyDoc) {
      console.log('⚠️  No MonthlyStock document found for this product');
      console.log('  This means no stock entries exist for', `${targetMonth}/${targetYear}`);
      console.log('');
    } else {
      console.log('✅ MonthlyStock document found');
      console.log('  Stock entries:', monthlyDoc.stockDetails?.length || 0);
      console.log('');
      
      if (monthlyDoc.stockDetails && monthlyDoc.stockDetails.length > 0) {
        // Find the entry for this specific date
        const dateStr2 = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
        const dayEntry = monthlyDoc.stockDetails.find(entry => {
          const entryDateStr = new Date(entry.date).toISOString().split('T')[0];
          return entryDateStr === dateStr2;
        });
        
        if (dayEntry) {
          console.log('✅ Stock entry found for this date:');
          console.log('  Carry Forward:', dayEntry.carryForward || 0);
          console.log('  Stock Added:', dayEntry.stockAdded || 0);
          console.log('  Used Stock:', dayEntry.usedStock || 0);
          console.log('  Balance:', dayEntry.balance || 0);
        } else {
          console.log('⚠️  No stock entry found for date:', dateStr2);
          console.log('Available dates:');
          monthlyDoc.stockDetails.forEach(entry => {
            const d = new Date(entry.date).toISOString().split('T')[0];
            console.log('  -', d);
          });
        }
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('📊 Summary: Excel download should work if there are stock entries for the selected date.');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

// Connect to MongoDB and run test
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/YQPAY')
  .then(() => {
    console.log('✅ Connected to MongoDB\n');
    return testExcelDownload();
  })
  .then(() => {
    console.log('\n👋 Disconnecting...');
    return mongoose.disconnect();
  })
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
