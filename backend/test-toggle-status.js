/**
 * Test Script: Product Status Toggle Functionality
 * Tests toggling product isActive status ON/OFF
 * 
 * Run: node test-toggle-status.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';
const THEATER_ID = '6917522d0e4759744329c5bb';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    log('\n🧪 Testing Product Status Toggle', 'bright');
    log('='.repeat(70), 'cyan');
    
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');
    
    const db = mongoose.connection.db;
    const productListCollection = db.collection('productlist');
    const theaterObjectId = new mongoose.Types.ObjectId(THEATER_ID);
    
    // Get products
    const productDoc = await productListCollection.findOne({
      theater: theaterObjectId
    });
    
    if (!productDoc || !productDoc.productList || productDoc.productList.length === 0) {
      log('❌ No products found', 'red');
      await mongoose.disconnect();
      return;
    }
    
    // Test with the first test product we created
    const testProduct = productDoc.productList.find(p => p.name.includes('Test Product 1'));
    
    if (!testProduct) {
      log('⚠️  Test Product 1 not found, using first product', 'yellow');
      const firstProduct = productDoc.productList[0];
      await testToggle(db, productListCollection, theaterObjectId, firstProduct);
    } else {
      await testToggle(db, productListCollection, theaterObjectId, testProduct);
    }
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.disconnect();
    log('\n📡 Disconnected from MongoDB', 'cyan');
  }
}

async function testToggle(db, productListCollection, theaterObjectId, product) {
  log(`\n📦 Testing toggle for: ${product.name}`, 'cyan');
  log(`   Current isActive: ${product.isActive}`, 'blue');
  log(`   Current isAvailable: ${product.isAvailable !== undefined ? product.isAvailable : 'undefined'}`, 'blue');
  
  const currentStatus = !!product.isActive && (product.isAvailable !== undefined ? !!product.isAvailable : true);
  log(`   Current toggle state: ${currentStatus ? 'ON' : 'OFF'}`, 'blue');
  
  // Test 1: Toggle ON
  log('\n🔄 Test 1: Toggling ON...', 'cyan');
  const newStatusOn = true;
  
  const result1 = await productListCollection.updateOne(
    {
      theater: theaterObjectId,
      'productList._id': product._id
    },
    {
      $set: {
        'productList.$.isActive': newStatusOn,
        'productList.$.isAvailable': newStatusOn,
        'productList.$.updatedAt': new Date()
      }
    }
  );
  
  if (result1.matchedCount > 0) {
    log('✅ Update successful', 'green');
    
    // Verify
    const updatedDoc = await productListCollection.findOne({
      theater: theaterObjectId,
      'productList._id': product._id
    });
    
    const updatedProduct = updatedDoc.productList.find(p => p._id.equals(product._id));
    log(`   Updated isActive: ${updatedProduct.isActive}`, updatedProduct.isActive ? 'green' : 'red');
    log(`   Updated isAvailable: ${updatedProduct.isAvailable !== undefined ? updatedProduct.isAvailable : 'undefined'}`, 
        updatedProduct.isAvailable !== undefined ? 'green' : 'yellow');
    
    const newToggleState = !!updatedProduct.isActive && (updatedProduct.isAvailable !== undefined ? !!updatedProduct.isAvailable : true);
    log(`   New toggle state: ${newToggleState ? 'ON' : 'OFF'}`, newToggleState ? 'green' : 'red');
    
    if (newToggleState === newStatusOn) {
      log('   ✅ Toggle ON working correctly!', 'green');
    } else {
      log('   ❌ Toggle ON failed - state mismatch!', 'red');
    }
  } else {
    log('❌ Product not found for update', 'red');
  }
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test 2: Toggle OFF
  log('\n🔄 Test 2: Toggling OFF...', 'cyan');
  const newStatusOff = false;
  
  const result2 = await productListCollection.updateOne(
    {
      theater: theaterObjectId,
      'productList._id': product._id
    },
    {
      $set: {
        'productList.$.isActive': newStatusOff,
        'productList.$.isAvailable': newStatusOff,
        'productList.$.updatedAt': new Date()
      }
    }
  );
  
  if (result2.matchedCount > 0) {
    log('✅ Update successful', 'green');
    
    // Verify
    const updatedDoc2 = await productListCollection.findOne({
      theater: theaterObjectId,
      'productList._id': product._id
    });
    
    const updatedProduct2 = updatedDoc2.productList.find(p => p._id.equals(product._id));
    log(`   Updated isActive: ${updatedProduct2.isActive}`, !updatedProduct2.isActive ? 'green' : 'red');
    log(`   Updated isAvailable: ${updatedProduct2.isAvailable !== undefined ? updatedProduct2.isAvailable : 'undefined'}`, 
        updatedProduct2.isAvailable !== undefined ? 'green' : 'yellow');
    
    const newToggleState2 = !!updatedProduct2.isActive && (updatedProduct2.isAvailable !== undefined ? !!updatedProduct2.isAvailable : true);
    log(`   New toggle state: ${newToggleState2 ? 'ON' : 'OFF'}`, !newToggleState2 ? 'green' : 'red');
    
    if (newToggleState2 === newStatusOff) {
      log('   ✅ Toggle OFF working correctly!', 'green');
    } else {
      log('   ❌ Toggle OFF failed - state mismatch!', 'red');
    }
  } else {
    log('❌ Product not found for update', 'red');
  }
  
  log('\n' + '='.repeat(70), 'cyan');
  log('✅ Toggle test complete!', 'green');
}

main();
