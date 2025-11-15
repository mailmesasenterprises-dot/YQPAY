/**
 * KioskType CRUD Verification Script
 * Verifies that products are saving kioskType correctly in the database
 * 
 * Run from backend directory: node test-kiosktype-verification.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

// Test theater ID (update this to your actual theater ID)
const THEATER_ID = '6917522d0e4759744329c5bb';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    log('\n🧪 KioskType CRUD Verification Script', 'bright');
    log('='.repeat(70), 'cyan');
    
    // Connect to MongoDB
    log('\n📡 Connecting to MongoDB...', 'cyan');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');
    
    const db = mongoose.connection.db;
    const productListCollection = db.collection('productlist');
    const theaterObjectId = new mongoose.Types.ObjectId(THEATER_ID);
    
    // Get products
    log(`\n📊 Fetching products for theater: ${THEATER_ID}`, 'cyan');
    const productDoc = await productListCollection.findOne({
      theater: theaterObjectId
    });
    
    if (!productDoc || !productDoc.productList || productDoc.productList.length === 0) {
      log('⚠️  No products found in database', 'yellow');
      log('\n💡 Create products first using the Add Product form', 'yellow');
      await mongoose.disconnect();
      return;
    }
    
    log(`✅ Found ${productDoc.productList.length} products`, 'green');
    
    // Analyze all products
    log('\n' + '='.repeat(70), 'cyan');
    log('📋 PRODUCT ANALYSIS:', 'bright');
    log('='.repeat(70), 'cyan');
    
    let productsWithKioskType = 0;
    let productsWithoutKioskType = 0;
    let productsWithNullKioskType = 0;
    let productsMissingKioskTypeField = 0;
    
    productDoc.productList.forEach((product, index) => {
      const hasKioskTypeField = product.hasOwnProperty('kioskType');
      const kioskTypeValue = product.kioskType;
      
      log(`\n${index + 1}. Product: ${product.name}`, 'blue');
      log(`   ID: ${product._id}`, 'blue');
      
      if (hasKioskTypeField) {
        if (kioskTypeValue === null) {
          log(`   KioskType: null ✅`, 'green');
          productsWithNullKioskType++;
        } else if (kioskTypeValue) {
          log(`   KioskType: ${kioskTypeValue} ✅`, 'green');
          productsWithKioskType++;
        } else {
          log(`   KioskType: undefined ❌`, 'red');
          productsMissingKioskTypeField++;
        }
      } else {
        log(`   KioskType: FIELD MISSING ❌`, 'red');
        productsMissingKioskTypeField++;
      }
      
      log(`   Category ID: ${product.categoryId || 'null'}`, 'blue');
      log(`   Product Type ID: ${product.productTypeId || 'null'}`, 'blue');
      log(`   Created: ${product.createdAt ? new Date(product.createdAt).toLocaleString() : 'N/A'}`, 'blue');
    });
    
    // Summary
    log('\n' + '='.repeat(70), 'cyan');
    log('📊 SUMMARY:', 'bright');
    log('='.repeat(70), 'cyan');
    log(`Total Products: ${productDoc.productList.length}`, 'blue');
    log(`✅ Products with KioskType (ObjectId): ${productsWithKioskType}`, 'green');
    log(`✅ Products with KioskType (null): ${productsWithNullKioskType}`, 'green');
    log(`❌ Products missing KioskType field: ${productsMissingKioskTypeField}`, 
        productsMissingKioskTypeField > 0 ? 'red' : 'green');
    
    if (productsMissingKioskTypeField === 0) {
      log('\n🎉 SUCCESS: All products have the kioskType field properly saved!', 'green');
    } else {
      log('\n⚠️  WARNING: Some products are missing the kioskType field.', 'yellow');
      log('   This means they were created before the fix was applied.', 'yellow');
      log('   Please update these products or recreate them.', 'yellow');
    }
    
    // Get the last 2 products (most recently created)
    const lastTwoProducts = productDoc.productList.slice(-2);
    if (lastTwoProducts.length >= 2) {
      log('\n' + '='.repeat(70), 'cyan');
      log('🔍 LATEST 2 PRODUCTS (Most Recent):', 'bright');
      log('='.repeat(70), 'cyan');
      
      lastTwoProducts.forEach((product, idx) => {
        const num = idx + 1;
        log(`\nProduct ${num}: ${product.name}`, 'bright');
        const hasField = product.hasOwnProperty('kioskType');
        if (hasField && product.kioskType) {
          log(`   ✅ Has KioskType: ${product.kioskType}`, 'green');
        } else if (hasField && product.kioskType === null) {
          log(`   ✅ Has KioskType: null (correctly saved)`, 'green');
        } else {
          log(`   ❌ KioskType field missing or undefined`, 'red');
        }
      });
    }
    
    log('\n' + '='.repeat(70), 'cyan');
    log('✅ Verification Complete!', 'green');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log('\n📡 Disconnected from MongoDB', 'cyan');
  }
}

// Run the script
main();
