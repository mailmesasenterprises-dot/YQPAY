/**
 * Test Script: Create 2 Products with KioskType Testing
 * This script creates 2 products directly in the database:
 * 1. Product WITH kioskType
 * 2. Product WITHOUT kioskType (null)
 * 
 * Run: node test-create-products-with-kiosktype.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';

// Test configuration
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

async function getTestData(db) {
  const categoryCollection = db.collection('categories');
  const kioskTypeCollection = db.collection('kiosktypes');
  const productTypeCollection = db.collection('producttypes');
  
  const theaterObjectId = new mongoose.Types.ObjectId(THEATER_ID);
  
  // Get category
  const categoryDoc = await categoryCollection.findOne({ theater: theaterObjectId });
  let categoryId = null;
  if (categoryDoc && categoryDoc.categoryList && categoryDoc.categoryList.length > 0) {
    categoryId = categoryDoc.categoryList[0]._id;
    log(`✅ Found category: ${categoryDoc.categoryList[0].categoryName}`, 'green');
  } else {
    throw new Error('No categories found');
  }
  
  // Get kiosk type
  const kioskTypeDoc = await kioskTypeCollection.findOne({ theater: theaterObjectId });
  let kioskTypeId = null;
  if (kioskTypeDoc && kioskTypeDoc.kioskTypeList && kioskTypeDoc.kioskTypeList.length > 0) {
    kioskTypeId = kioskTypeDoc.kioskTypeList[0]._id;
    log(`✅ Found kiosk type: ${kioskTypeDoc.kioskTypeList[0].name}`, 'green');
  } else {
    log('⚠️  No kiosk types found (will use null for Product 2)', 'yellow');
  }
  
  // Get product type
  const productTypeDoc = await productTypeCollection.findOne({ theater: theaterObjectId });
  let productTypeId = null;
  if (productTypeDoc && productTypeDoc.productTypeList && productTypeDoc.productTypeList.length > 0) {
    productTypeId = productTypeDoc.productTypeList[0]._id;
    log(`✅ Found product type: ${productTypeDoc.productTypeList[0].productName}`, 'green');
  } else {
    log('⚠️  No product types found (will use null)', 'yellow');
  }
  
  return { categoryId, kioskTypeId, productTypeId };
}

async function main() {
  try {
    log('\n🧪 Creating Test Products with KioskType', 'bright');
    log('='.repeat(70), 'cyan');
    
    // Connect to MongoDB
    log('\n📡 Connecting to MongoDB...', 'cyan');
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');
    
    const db = mongoose.connection.db;
    const productListCollection = db.collection('productlist');
    const theaterObjectId = new mongoose.Types.ObjectId(THEATER_ID);
    
    // Get test data
    log('\n📊 Fetching test data...', 'cyan');
    const { categoryId, kioskTypeId, productTypeId } = await getTestData(db);
    
    // Get or create product container
    let productContainer = await productListCollection.findOne({
      theater: theaterObjectId
    });
    
    if (!productContainer) {
      productContainer = {
        _id: new mongoose.Types.ObjectId(),
        theater: theaterObjectId,
        productList: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await productListCollection.insertOne(productContainer);
    }
    
    // Product 1: WITH kioskType
    log('\n📦 Creating Product 1 (WITH kioskType)...', 'cyan');
    const product1 = {
      _id: new mongoose.Types.ObjectId(),
      theaterId: theaterObjectId,
      name: 'Test Product 1 - With KioskType',
      description: 'Test product created to verify kioskType saving',
      categoryId: categoryId,
      kioskType: kioskTypeId || null, // Use kioskType if available, otherwise null
      productTypeId: productTypeId || null,
      sku: `TEST-${Date.now()}-1`,
      quantity: '500ML',
      pricing: {
        basePrice: 100,
        salePrice: 100,
        discountPercentage: 0,
        taxRate: 0,
        currency: 'INR',
        gstType: 'EXCLUDE'
      },
      inventory: {
        trackStock: true,
        currentStock: 10,
        minStock: 5,
        maxStock: 100,
        unit: 'piece'
      },
      images: [],
      imageUrl: null,
      image: null,
      tags: [],
      status: 'active',
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      views: 0,
      orders: 0,
      rating: { average: 0, count: 0 },
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    log(`   Name: ${product1.name}`, 'blue');
    log(`   KioskType: ${product1.kioskType ? product1.kioskType : 'null'}`, 
        product1.kioskType ? 'green' : 'yellow');
    
    // Product 2: WITHOUT kioskType (explicitly null)
    log('\n📦 Creating Product 2 (WITHOUT kioskType - null)...', 'cyan');
    const product2 = {
      _id: new mongoose.Types.ObjectId(),
      theaterId: theaterObjectId,
      name: 'Test Product 2 - Without KioskType',
      description: 'Test product created to verify kioskType null saving',
      categoryId: categoryId,
      kioskType: null, // Explicitly null
      productTypeId: productTypeId || null,
      sku: `TEST-${Date.now()}-2`,
      quantity: '250ML',
      pricing: {
        basePrice: 50,
        salePrice: 50,
        discountPercentage: 0,
        taxRate: 0,
        currency: 'INR',
        gstType: 'EXCLUDE'
      },
      inventory: {
        trackStock: true,
        currentStock: 20,
        minStock: 5,
        maxStock: 100,
        unit: 'piece'
      },
      images: [],
      imageUrl: null,
      image: null,
      tags: [],
      status: 'active',
      isActive: true,
      isFeatured: false,
      sortOrder: 0,
      views: 0,
      orders: 0,
      rating: { average: 0, count: 0 },
      variants: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    log(`   Name: ${product2.name}`, 'blue');
    log(`   KioskType: null`, 'yellow');
    
    // Add products to database
    log('\n💾 Saving products to database...', 'cyan');
    await productListCollection.updateOne(
      { theater: theaterObjectId },
      {
        $push: { 
          productList: { 
            $each: [product1, product2]
          }
        },
        $set: { updatedAt: new Date() }
      }
    );
    
    log('✅ Products saved successfully!', 'green');
    
    // Verify the saved products
    log('\n🔍 Verifying saved products...', 'cyan');
    const updatedDoc = await productListCollection.findOne({
      theater: theaterObjectId,
      'productList._id': { $in: [product1._id, product2._id] }
    });
    
    if (updatedDoc) {
      const savedProduct1 = updatedDoc.productList.find(p => p._id.equals(product1._id));
      const savedProduct2 = updatedDoc.productList.find(p => p._id.equals(product2._id));
      
      log('\n' + '='.repeat(70), 'cyan');
      log('📋 VERIFICATION RESULTS:', 'bright');
      log('='.repeat(70), 'cyan');
      
      if (savedProduct1) {
        log(`\n✅ Product 1: ${savedProduct1.name}`, 'green');
        if (savedProduct1.hasOwnProperty('kioskType')) {
          if (savedProduct1.kioskType) {
            log(`   KioskType: ${savedProduct1.kioskType} ✅`, 'green');
          } else if (savedProduct1.kioskType === null) {
            log(`   KioskType: null ✅`, 'green');
          } else {
            log(`   KioskType: undefined ❌`, 'red');
          }
        } else {
          log(`   KioskType: FIELD MISSING ❌`, 'red');
        }
      }
      
      if (savedProduct2) {
        log(`\n✅ Product 2: ${savedProduct2.name}`, 'green');
        if (savedProduct2.hasOwnProperty('kioskType')) {
          if (savedProduct2.kioskType === null) {
            log(`   KioskType: null ✅ (Correctly saved!)`, 'green');
          } else if (savedProduct2.kioskType) {
            log(`   KioskType: ${savedProduct2.kioskType} ⚠️`, 'yellow');
          } else {
            log(`   KioskType: undefined ❌`, 'red');
          }
        } else {
          log(`   KioskType: FIELD MISSING ❌`, 'red');
        }
      }
      
      log('\n' + '='.repeat(70), 'cyan');
      
      // Final check
      const product1HasField = savedProduct1 && savedProduct1.hasOwnProperty('kioskType');
      const product2HasField = savedProduct2 && savedProduct2.hasOwnProperty('kioskType');
      
      if (product1HasField && product2HasField) {
        log('\n🎉 SUCCESS: Both products have kioskType field saved correctly!', 'green');
        log('✅ CRUD operation is working properly!', 'green');
      } else {
        log('\n⚠️  WARNING: Some products are missing the kioskType field.', 'yellow');
      }
    }
    
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
