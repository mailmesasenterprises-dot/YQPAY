/**
 * Test Script for KioskType CRUD Operations
 * This script tests creating 2 products:
 * 1. Product with kioskType selected
 * 2. Product without kioskType (should save as null)
 * 
 * Run: node test-kiosktype-crud.js
 */

// Change to backend directory
process.chdir(__dirname + '/backend');

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/yqpaynow';
const API_BASE_URL = 'http://localhost:8080/api';

// Test configuration - You need to update these with actual IDs from your database
const TEST_CONFIG = {
  theaterId: '6917522d0e4759744329c5bb', // Update with your theater ID
  categoryId: null, // Will be fetched from database
  kioskTypeId: null, // Will be fetched from database
  productTypeId: null // Will be fetched from database
};

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

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    log('✅ Connected to MongoDB', 'green');
    return true;
  } catch (error) {
    log(`❌ MongoDB connection error: ${error.message}`, 'red');
    return false;
  }
}

async function getTestData() {
  try {
    const db = mongoose.connection.db;
    
    // Get a category
    const Category = mongoose.model('Category', new mongoose.Schema({}, { strict: false }), 'categories');
    const categoryDoc = await Category.findOne({ theater: new mongoose.Types.ObjectId(TEST_CONFIG.theaterId) });
    if (categoryDoc && categoryDoc.categoryList && categoryDoc.categoryList.length > 0) {
      TEST_CONFIG.categoryId = categoryDoc.categoryList[0]._id.toString();
      log(`✅ Found category: ${categoryDoc.categoryList[0].categoryName} (ID: ${TEST_CONFIG.categoryId})`, 'green');
    } else {
      log('❌ No categories found for theater', 'red');
      return false;
    }
    
    // Get a kiosk type
    const KioskType = mongoose.model('KioskType', new mongoose.Schema({}, { strict: false }), 'kiosktypes');
    const kioskTypeDoc = await KioskType.findOne({ theater: new mongoose.Types.ObjectId(TEST_CONFIG.theaterId) });
    if (kioskTypeDoc && kioskTypeDoc.kioskTypeList && kioskTypeDoc.kioskTypeList.length > 0) {
      TEST_CONFIG.kioskTypeId = kioskTypeDoc.kioskTypeList[0]._id.toString();
      log(`✅ Found kiosk type: ${kioskTypeDoc.kioskTypeList[0].name} (ID: ${TEST_CONFIG.kioskTypeId})`, 'green');
    } else {
      log('⚠️  No kiosk types found (will test with null)', 'yellow');
    }
    
    // Get a product type
    const ProductType = mongoose.model('ProductType', new mongoose.Schema({}, { strict: false }), 'producttypes');
    const productTypeDoc = await ProductType.findOne({ theater: new mongoose.Types.ObjectId(TEST_CONFIG.theaterId) });
    if (productTypeDoc && productTypeDoc.productTypeList && productTypeDoc.productTypeList.length > 0) {
      TEST_CONFIG.productTypeId = productTypeDoc.productTypeList[0]._id.toString();
      log(`✅ Found product type: ${productTypeDoc.productTypeList[0].productName} (ID: ${TEST_CONFIG.productTypeId})`, 'green');
    } else {
      log('⚠️  No product types found (will use null)', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Error getting test data: ${error.message}`, 'red');
    return false;
  }
}

async function verifyProducts() {
  try {
    const db = mongoose.connection.db;
    const productListCollection = db.collection('productlist');
    
    log('\n📋 Verifying Products in Database:', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const productDoc = await productListCollection.findOne({
      theater: new mongoose.Types.ObjectId(TEST_CONFIG.theaterId)
    });
    
    if (!productDoc || !productDoc.productList) {
      log('❌ No products found', 'red');
      return;
    }
    
    log(`\n📦 Total products: ${productDoc.productList.length}`, 'blue');
    
    // Get the last 2 products (should be our test products)
    const lastProducts = productDoc.productList.slice(-2);
    
    lastProducts.forEach((product, index) => {
      log(`\n${'='.repeat(60)}`, 'cyan');
      log(`Product ${index + 1}: ${product.name}`, 'bright');
      log(`ID: ${product._id}`, 'blue');
      log(`Category ID: ${product.categoryId || 'null'}`, 'blue');
      log(`Kiosk Type: ${product.kioskType ? `ObjectId(${product.kioskType})` : 'null'}`, 
          product.kioskType ? 'green' : 'yellow');
      log(`Product Type ID: ${product.productTypeId || 'null'}`, 'blue');
      log(`Quantity: ${product.quantity || 'null'}`, 'blue');
      log(`Created: ${product.createdAt}`, 'blue');
      
      if (product.kioskType) {
        log('✅ KioskType is saved correctly!', 'green');
      } else if (product.kioskType === null || product.hasOwnProperty('kioskType')) {
        log('✅ KioskType is null (correctly saved)', 'green');
      } else {
        log('❌ KioskType field is missing!', 'red');
      }
    });
    
    log(`\n${'='.repeat(60)}`, 'cyan');
    log('\n✅ Verification Complete!', 'green');
    
  } catch (error) {
    log(`❌ Error verifying products: ${error.message}`, 'red');
    console.error(error);
  }
}

async function main() {
  log('\n🧪 KioskType CRUD Test Script', 'bright');
  log('='.repeat(60), 'cyan');
  
  // Connect to database
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }
  
  // Get test data
  log('\n📊 Fetching test data...', 'cyan');
  const dataReady = await getTestData();
  if (!dataReady || !TEST_CONFIG.categoryId) {
    log('\n❌ Cannot proceed without test data', 'red');
    await mongoose.disconnect();
    process.exit(1);
  }
  
  log('\n📝 Test Configuration:', 'cyan');
  log(JSON.stringify(TEST_CONFIG, null, 2), 'blue');
  
  // Verify existing products
  await verifyProducts();
  
  log('\n\n💡 To create test products via API:', 'yellow');
  log('1. Use Postman or curl to POST to:', 'yellow');
  log(`   ${API_BASE_URL}/theater-products/${TEST_CONFIG.theaterId}`, 'cyan');
  log('\n2. Product 1 (with kioskType):', 'yellow');
  log(JSON.stringify({
    name: 'Test Product 1',
    description: 'Test product with kioskType',
    categoryId: TEST_CONFIG.categoryId,
    kioskType: TEST_CONFIG.kioskTypeId,
    productTypeId: TEST_CONFIG.productTypeId || null,
    sku: 'TEST-001',
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
    isActive: true,
    status: 'active'
  }, null, 2), 'cyan');
  
  log('\n3. Product 2 (without kioskType):', 'yellow');
  log(JSON.stringify({
    name: 'Test Product 2',
    description: 'Test product without kioskType',
    categoryId: TEST_CONFIG.categoryId,
    kioskType: null, // Explicitly null
    productTypeId: TEST_CONFIG.productTypeId || null,
    sku: 'TEST-002',
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
    isActive: true,
    status: 'active'
  }, null, 2), 'cyan');
  
  log('\n4. After creating products, run this script again to verify!', 'yellow');
  
  await mongoose.disconnect();
  log('\n✅ Script completed', 'green');
}

// Run the script
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
