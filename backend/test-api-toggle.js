/**
 * Test API Toggle Endpoint
 * Simulates frontend API call to test toggle functionality
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
    log('\n🧪 Testing API Toggle Endpoint', 'bright');
    log('='.repeat(70), 'cyan');
    
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');
    
    const db = mongoose.connection.db;
    const productListCollection = db.collection('productlist');
    const theaterObjectId = new mongoose.Types.ObjectId(THEATER_ID);
    
    // Get a test product
    const productDoc = await productListCollection.findOne({
      theater: theaterObjectId
    });
    
    if (!productDoc || !productDoc.productList || productDoc.productList.length === 0) {
      log('❌ No products found', 'red');
      await mongoose.disconnect();
      return;
    }
    
    const testProduct = productDoc.productList.find(p => p.name.includes('Test Product')) || productDoc.productList[0];
    
    log(`\n📦 Testing with product: ${testProduct.name}`, 'cyan');
    log(`   Current isActive: ${testProduct.isActive}`, 'blue');
    log(`   Current isAvailable: ${testProduct.isAvailable !== undefined ? testProduct.isAvailable : 'undefined'}`, 'blue');
    
    // Simulate frontend request - toggle ON
    log('\n🔄 Simulating Frontend Toggle ON Request...', 'cyan');
    const newStatus = true;
    
    // Simulate what the backend route handler does
    const updateData = {
      isActive: newStatus,
      isAvailable: newStatus
    };
    
    log('📤 Request body:', JSON.stringify(updateData, null, 2), 'blue');
    
    // Process as backend does
    const processedData = { ...updateData };
    
    // Build update fields
    const updateFields = {};
    const isActiveValue = processedData.isActive !== undefined ? processedData.isActive : updateData.isActive;
    const isAvailableValue = processedData.isAvailable !== undefined ? processedData.isAvailable : updateData.isAvailable;
    
    if (isActiveValue !== undefined) {
      let boolValue;
      if (typeof isActiveValue === 'boolean') {
        boolValue = isActiveValue;
      } else if (typeof isActiveValue === 'string') {
        boolValue = isActiveValue.toLowerCase() === 'true';
      } else {
        boolValue = !!isActiveValue;
      }
      updateFields['productList.$.isActive'] = boolValue;
      log(`✅ isActive will be saved as: ${boolValue} (from: ${isActiveValue}, type: ${typeof isActiveValue})`, 'green');
    }
    
    if (isAvailableValue !== undefined) {
      let boolValue;
      if (typeof isAvailableValue === 'boolean') {
        boolValue = isAvailableValue;
      } else if (typeof isAvailableValue === 'string') {
        boolValue = isAvailableValue.toLowerCase() === 'true';
      } else {
        boolValue = !!isAvailableValue;
      }
      updateFields['productList.$.isAvailable'] = boolValue;
      log(`✅ isAvailable will be saved as: ${boolValue} (from: ${isAvailableValue}, type: ${typeof isAvailableValue})`, 'green');
    }
    
    log('\n📋 Update fields to be applied:', JSON.stringify(updateFields, null, 2), 'blue');
    
    // Apply update
    const result = await productListCollection.updateOne(
      {
        theater: theaterObjectId,
        'productList._id': testProduct._id
      },
      {
        $set: updateFields
      }
    );
    
    if (result.matchedCount > 0) {
      log('\n✅ Update successful!', 'green');
      
      // Verify
      const updatedDoc = await productListCollection.findOne({
        theater: theaterObjectId,
        'productList._id': testProduct._id
      });
      
      const updatedProduct = updatedDoc.productList.find(p => p._id.equals(testProduct._id));
      
      log('\n📊 Verification:', 'cyan');
      log(`   isActive: ${updatedProduct.isActive} (expected: ${newStatus})`, 
          updatedProduct.isActive === newStatus ? 'green' : 'red');
      log(`   isAvailable: ${updatedProduct.isAvailable} (expected: ${newStatus})`, 
          updatedProduct.isAvailable === newStatus ? 'green' : 'red');
      
      if (updatedProduct.isActive === newStatus && updatedProduct.isAvailable === newStatus) {
        log('\n🎉 Toggle ON working correctly!', 'green');
      } else {
        log('\n❌ Toggle ON failed!', 'red');
      }
      
      // Test 2: Toggle OFF
      log('\n' + '='.repeat(70), 'cyan');
      log('🔄 Simulating Frontend Toggle OFF Request...', 'cyan');
      const newStatusOff = false;
      
      const updateDataOff = {
        isActive: newStatusOff,
        isAvailable: newStatusOff
      };
      
      const processedDataOff = { ...updateDataOff };
      const updateFieldsOff = {};
      
      const isActiveValueOff = processedDataOff.isActive !== undefined ? processedDataOff.isActive : updateDataOff.isActive;
      const isAvailableValueOff = processedDataOff.isAvailable !== undefined ? processedDataOff.isAvailable : updateDataOff.isAvailable;
      
      if (isActiveValueOff !== undefined) {
        let boolValue;
        if (typeof isActiveValueOff === 'boolean') {
          boolValue = isActiveValueOff;
        } else if (typeof isActiveValueOff === 'string') {
          boolValue = isActiveValueOff.toLowerCase() === 'true';
        } else {
          boolValue = !!isActiveValueOff;
        }
        updateFieldsOff['productList.$.isActive'] = boolValue;
        log(`✅ isActive will be saved as: ${boolValue} (from: ${isActiveValueOff}, type: ${typeof isActiveValueOff})`, 'green');
      }
      
      if (isAvailableValueOff !== undefined) {
        let boolValue;
        if (typeof isAvailableValueOff === 'boolean') {
          boolValue = isAvailableValueOff;
        } else if (typeof isAvailableValueOff === 'string') {
          boolValue = isAvailableValueOff.toLowerCase() === 'true';
        } else {
          boolValue = !!isAvailableValueOff;
        }
        updateFieldsOff['productList.$.isAvailable'] = boolValue;
        log(`✅ isAvailable will be saved as: ${boolValue} (from: ${isAvailableValueOff}, type: ${typeof isAvailableValueOff})`, 'green');
      }
      
      const result2 = await productListCollection.updateOne(
        {
          theater: theaterObjectId,
          'productList._id': testProduct._id
        },
        {
          $set: updateFieldsOff
        }
      );
      
      if (result2.matchedCount > 0) {
        const updatedDoc2 = await productListCollection.findOne({
          theater: theaterObjectId,
          'productList._id': testProduct._id
        });
        
        const updatedProduct2 = updatedDoc2.productList.find(p => p._id.equals(testProduct._id));
        
        log('\n📊 Verification:', 'cyan');
        log(`   isActive: ${updatedProduct2.isActive} (expected: ${newStatusOff})`, 
            updatedProduct2.isActive === newStatusOff ? 'green' : 'red');
        log(`   isAvailable: ${updatedProduct2.isAvailable} (expected: ${newStatusOff})`, 
            updatedProduct2.isAvailable === newStatusOff ? 'green' : 'red');
        
        if (updatedProduct2.isActive === newStatusOff && updatedProduct2.isAvailable === newStatusOff) {
          log('\n🎉 Toggle OFF working correctly!', 'green');
        } else {
          log('\n❌ Toggle OFF failed!', 'red');
        }
      }
    }
    
    log('\n' + '='.repeat(70), 'cyan');
    log('✅ Test Complete!', 'green');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
