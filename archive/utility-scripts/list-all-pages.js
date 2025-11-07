const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function listAllPages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const pageAccess = await mongoose.connection.db.collection('pageaccesses').findOne({});
    
    if (pageAccess) {
      console.log(`\n📋 All ${pageAccess.pageAccessList.length} pages in database:\n`);
      
      pageAccess.pageAccessList.forEach((page, index) => {
        console.log(`${index + 1}. ${page.page} - Active: ${page.isActive ? '✅' : '❌'}`);
      });
      
      console.log('\n\n📋 Expected pages from App.js (19 total):');
      const expected = [
        'TheaterDashboardWithId',
        'TheaterOrderInterface',
        'OnlinePOSInterface',
        'TheaterOrderHistory',
        'OnlineOrderHistory',
        'TheaterProductList',
        'TheaterAddProductWithId',
        'TheaterCategories',
        'TheaterKioskTypes',
        'TheaterProductTypes',
        'TheaterMessages',
        'TheaterReports',
        'TheaterRoles',
        'TheaterRoleAccess',
        'TheaterQRCodeNames',
        'TheaterGenerateQR',
        'TheaterQRManagement',
        'TheaterUserManagement',
        'TheaterSettingsWithId'
      ];
      
      expected.forEach((exp, idx) => {
        const found = pageAccess.pageAccessList.find(p => p.page === exp);
        console.log(`${idx + 1}. ${exp}: ${found ? '✅ IN DB' : '❌ MISSING'}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllPages();
