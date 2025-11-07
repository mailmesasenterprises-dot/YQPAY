const mongoose = require('mongoose');
require('dotenv').config();

async function testExcelAPI() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const theaterId = '68f8837a541316c6ad54b79f';
    const dateStr = '2025-11-01';
    
    console.log('\n📊 Testing Excel download logic...');
    console.log('Theater ID:', theaterId);
    console.log('Date:', dateStr);

    // Simulate the downloadStockByDate function logic
    const ExcelJS = require('exceljs');
    
    // Parse the date
    const targetDate = new Date(dateStr);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth() + 1;
    const targetDay = targetDate.getDate();
    
    console.log('\n📅 Target date:', { targetYear, targetMonth, targetDay });

    // Fetch products from productlist collection
    console.log('\n🔍 Fetching products...');
    const productContainer = await mongoose.connection.db.collection('productlist').findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      productList: { $exists: true }
    });

    let products = [];
    
    if (productContainer && productContainer.productList) {
      products = productContainer.productList || [];
      console.log('✅ Found products in NEW structure:', products.length);
    } else {
      console.log('⚠️  No products found in NEW structure');
      const Product = require('./models/Product');
      products = await Product.find({ theaterId: new mongoose.Types.ObjectId(theaterId) }).lean();
      console.log('✅ Found products in OLD structure:', products.length);
    }

    if (products.length === 0) {
      console.log('❌ No products found!');
      process.exit(1);
    }

    console.log('\n🧪 Testing with first product:', products[0].name || products[0].productName);
    const productId = products[0]._id || products[0].productId;
    console.log('Product ID:', productId);

    // Fetch MonthlyStock
    console.log('\n🔍 Fetching MonthlyStock...');
    const MonthlyStock = require('./models/MonthlyStock');
    
    const monthlyStock = await MonthlyStock.findOne({
      theater: new mongoose.Types.ObjectId(theaterId),
      product: new mongoose.Types.ObjectId(productId),
      year: targetYear,
      month: targetMonth
    });

    if (!monthlyStock) {
      console.log('❌ No MonthlyStock document found for:', { theaterId, productId, targetYear, targetMonth });
      process.exit(1);
    }

    console.log('✅ MonthlyStock document found');

    // Find the stock entry for the specific date
    const stockEntry = monthlyStock.days.find(d => d.day === targetDay);

    if (!stockEntry) {
      console.log('❌ No stock entry found for day:', targetDay);
      console.log('Available days:', monthlyStock.days.map(d => d.day));
      process.exit(1);
    }

    console.log('✅ Stock entry found for this date:');
    console.log('  Carry Forward:', stockEntry.carryForward);
    console.log('  Stock Added:', stockEntry.stockAdded);
    console.log('  Used Stock:', stockEntry.usedStock);
    console.log('  Balance:', stockEntry.balance);

    // Now try to create the Excel file
    console.log('\n📝 Creating Excel workbook...');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Test';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Stock by Date');
    
    // Add headers
    worksheet.columns = [
      { header: 'S.NO', key: 'sno', width: 8 },
      { header: 'PRODUCT', key: 'product', width: 25 },
      { header: 'CATEGORY', key: 'category', width: 20 },
      { header: 'CARRY FORWARD', key: 'carryForward', width: 15 },
      { header: 'STOCK ADDED', key: 'stockAdded', width: 15 },
      { header: 'EXPIRED (OLD)', key: 'expiredOld', width: 15 },
      { header: 'USED', key: 'used', width: 15 },
      { header: 'EXPIRED', key: 'expired', width: 15 },
      { header: 'DAMAGE', key: 'damage', width: 15 },
      { header: 'BALANCE', key: 'balance', width: 15 },
      { header: 'REMARKS', key: 'remarks', width: 30 }
    ];

    // Add a test row
    worksheet.addRow({
      sno: 1,
      product: products[0].name || products[0].productName,
      category: 'French Fries',
      carryForward: stockEntry.carryForward || 0,
      stockAdded: stockEntry.stockAdded || 0,
      expiredOld: stockEntry.expiredOld || 0,
      used: stockEntry.usedStock || 0,
      expired: stockEntry.expired || 0,
      damage: stockEntry.damage || 0,
      balance: stockEntry.balance || 0,
      remarks: stockEntry.remarks || ''
    });

    // Write to file
    await workbook.xlsx.writeFile('test-output.xlsx');
    console.log('\n✅ Excel file created successfully: test-output.xlsx');

    console.log('\n✅ Test completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testExcelAPI();
